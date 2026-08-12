/**
 * Download manager singleton (plan §B3). Owns the FIFO/concurrency-2 asset
 * job queue, per-slide all-or-nothing rollup, retry backoff, Wi-Fi gating,
 * boot recovery, and node-status rollup up the tree. UI reads progress via
 * `useOfflineStore` (updated here on every state transition).
 *
 * This module intentionally does the orchestration only — byte-level work is
 * `chunked-downloader.ts`, tree math is `expander.ts`, entitlement/space/
 * network gating is `preflight.ts`.
 */

import { getOfflineDb, type OfflineDbConnection } from "../db/connection";
import { assetsDao } from "../db/dao/assets-dao";
import { deviceStateDao } from "../db/dao/device-state-dao";
import {
  completeDownloadNotification,
  ensureDownloadNotificationPermission,
  startDownloadNotification,
  stopDownloadNotification,
  updateDownloadNotification,
} from "../native/offline-downloads";
import { nodesDao } from "../db/dao/nodes-dao";
import { manifestsDao } from "../db/dao/manifests-dao";
import type { NodeDownloadStatus } from "../db/types";
import { getOrCreateOfflineKey } from "../crypto/keys";
import {
  computeSlideStatus,
  expandNode,
  rollupNodeStatus,
  slidesInSubtree,
  type ExpandableNodeType,
} from "./expander";
import {
  deleteAssetFile,
  deletePartFile,
  downloadAssetChunked,
  generateNonce,
} from "./chunked-downloader";
import { runPreflight } from "./preflight";
import { Network } from "@/utils/network-plugin";
import { useOfflineStore } from "@/stores/offline/use-offline-store";
import {
  fetchDownloadUrls,
  fetchManifest,
  persistManifest,
  diffManifests,
  loadPersistedManifest,
  type OfflineManifest,
} from "@/services/offline/manifest-service";
import { slidePayloadsDao } from "../db/dao/slide-payloads-dao";
import { recordDownloadStateEvent } from "../events/event-queue";
import { ensureDeviceRegistered } from "../lease/checkin";
import { DeviceLimitReachedError } from "@/services/offline/device-service";

const CONCURRENCY = 2;
const RETRY_BACKOFF_MS = [5_000, 30_000, 120_000];
const MAX_ATTEMPTS = RETRY_BACKOFF_MS.length + 1; // 5 tries total (per plan: 5s/30s/2m x5 — 4 backoff steps between 5 attempts)
/** Safety-net re-check for parked jobs whose unblock condition fires no event. */
const PARK_RETRY_MS = 60_000;
/** Grace for in-flight status writes before the completion summary is fixed. */
const COMPLETION_SETTLE_MS = 600;

interface AssetJobKey {
  userId: string;
  fileId: string;
  slideId: string;
  packageSessionId: string;
}

function jobKey(k: AssetJobKey): string {
  return `${k.userId}::${k.fileId}::${k.slideId}`;
}

interface QueuedJob extends AssetJobKey {
  requestedAt: number;
  allowCellular: boolean;
}

class DownloadManager {
  private queue: QueuedJob[] = [];
  /**
   * Jobs that can't run yet (no Wi-Fi, offline, lease not valid). They must NOT
   * sit in `queue`: runJob's finally always calls pump(), so a deferred job left
   * queued is instantly shifted back out and re-attempted, spinning the CPU at
   * ~1k SQLite reads/sec for as long as the blocking condition lasts. Parked
   * jobs re-enter the queue only on an unblock signal (network change, resume)
   * or via the safety-net timer below.
   */
  private parked: QueuedJob[] = [];
  private parkTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Progress for the current run, counted in SLIDES — what the learner sees in
   * a chapter. Counting asset jobs instead reported "1 of 2" for an 8-slide
   * chapter, because inline-payload slides (question/quiz/document) carry no
   * binary asset and so never produced a job.
   */
  private runSlides = new Set<string>();
  private doneSlides = new Set<string>();
  private failedSlides = new Set<string>();
  /** Owner of the current run, so completion can recount against the DB. */
  private runUserId: string | null = null;
  /**
   * Number of enqueueNode() calls still walking the manifest. The queue is
   * empty during that walk, and queue-drain is what signals "run finished" —
   * so without this the completion summary posted ~1s after the tap, before a
   * single asset job existed. Counted (not boolean) because a learner can tap
   * download on two nodes at once.
   */
  private enqueueing = 0;
  /** Last {done,total} pushed to the OS, so identical ticks aren't re-posted. */
  private lastPosted: string | null = null;
  /** Jobs sitting in a retry backoff — outstanding, but in no other collection. */
  private retrying = 0;
  private active = new Map<string, AbortController>();
  private paused = false;
  private networkListenerHandle: { remove: () => void | Promise<void> } | null = null;

  /** Boot recovery: demotes stale DOWNLOADING rows to PENDING and resumes the queue. Call once per app start / login. */
  async init(userId: string): Promise<void> {
    const db = await getOfflineDb();

    const downloading = await assetsDao.listByStatus(db, userId, "DOWNLOADING");
    for (const asset of downloading) {
      await assetsDao.updateDownloadProgress(
        db,
        userId,
        asset.file_id,
        asset.slide_id,
        asset.bytes_downloaded,
        "PENDING"
      );
    }

    const pending = await assetsDao.listByStatus(db, userId, "PENDING");
    for (const asset of pending) {
      this.enqueueAssetJob({
        userId,
        fileId: asset.file_id,
        slideId: asset.slide_id,
        packageSessionId: asset.package_session_id,
      });
    }

    if (!this.networkListenerHandle) {
      this.networkListenerHandle = await Network.addListener("networkStatusChange", (status) => {
        if (status.connected && (status.connectionType === "wifi" || !useOfflineStore.getState().wifiOnly)) {
          this.resumeParked();
        }
      });
    }

    void this.pump();
  }

  async dispose(): Promise<void> {
    if (this.networkListenerHandle) {
      await this.networkListenerHandle.remove();
      this.networkListenerHandle = null;
    }
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();
    this.queue = [];
    this.parked = [];
    this.enqueueing = 0;
    if (this.parkTimer) {
      clearTimeout(this.parkTimer);
      this.parkTimer = null;
    }
    this.runSlides.clear();
    this.doneSlides.clear();
    this.failedSlides.clear();
    this.retrying = 0;
    void stopDownloadNotification();
  }

  pauseAll(): void {
    this.paused = true;
    // Nothing is progressing — don't leave an ongoing notification (and a held
    // wake lock) implying otherwise.
    void stopDownloadNotification();
  }

  resumeAll(): void {
    this.paused = false;
    this.resumeParked();
  }

  /**
   * Defers a job that can't run right now. The job stays PENDING in SQLite, so
   * it survives a restart even if no unblock signal ever arrives in this
   * session. The timer is a safety net for conditions that fire no event (a
   * lease that is briefly invalid, say) — normal unblocking is event-driven.
   */
  private park(job: QueuedJob): void {
    this.parked.push(job);
    if (!this.parkTimer) {
      this.parkTimer = setTimeout(() => {
        this.parkTimer = null;
        this.resumeParked();
      }, PARK_RETRY_MS);
    }
  }

  /** Moves every parked job back onto the queue and restarts the pump. */
  private resumeParked(): void {
    if (this.parkTimer) {
      clearTimeout(this.parkTimer);
      this.parkTimer = null;
    }
    if (this.parked.length > 0) {
      this.queue.push(...this.parked);
      this.parked = [];
    }
    void this.pump();
  }

  /**
   * Enqueues a subject/module/chapter/slide for download: fetches (or reuses
   * the persisted) manifest, expands it into node/asset rows, then queues
   * every resulting downloadable asset job.
   *
   * Registration seam (plan §B6 point 4): this is the one call site every
   * "Download" tap funnels through, so it's where we lazily register the
   * device the first time a learner tries to go offline — cheaper than
   * checking on every asset job in preflight.ts, and it lets us fail fast
   * with a catchable `DeviceLimitReachedError` before any bytes move.
   */
  async enqueueNode(
    userId: string,
    packageSessionId: string,
    nodeId: string,
    nodeType: ExpandableNodeType,
    options?: { allowCellular?: boolean }
  ): Promise<void> {
    // Ask for notification permission on the learner's explicit tap — the only
    // moment the prompt has obvious context. Never gates the download.
    // Then show the notification immediately ("Preparing downloads…"), before the
    // manifest expansion that decides how many assets there are. Waiting until
    // the first asset was queued put a ~2s gap between the tap and any feedback,
    // and for a small chapter that's most of the download.
    void (async () => {
      await ensureDownloadNotificationPermission();
      await startDownloadNotification({ done: 0, total: 0 });
    })();

    const registration = await ensureDeviceRegistered(userId);
    if (registration.status === "limit_reached") {
      throw new DeviceLimitReachedError(registration.devices, registration.message);
    }
    if (registration.status === "error") {
      console.error("[offline-download] device registration failed, proceeding without a lease", registration.message);
    }

    const db = await getOfflineDb();
    let manifest = await loadPersistedManifest(userId, packageSessionId);
    if (!manifest) {
      // First download for this course on this device: fetch + persist the
      // manifest inline. (Every later download reuses the persisted copy and
      // picks up newer versions via the check-in → applyManifestUpdate flow.)
      const fetched = await fetchManifest(packageSessionId);
      await persistManifest(userId, null, fetched);
      manifest = await loadPersistedManifest(userId, packageSessionId);
    }
    if (!manifest) {
      throw new Error(
        `enqueueNode: manifest fetch for package session ${packageSessionId} did not persist`
      );
    }

    this.enqueueing += 1;
    try {
      const result = await expandNode(db, userId, manifest, nodeId, nodeType);

      // Seed slide-based progress: this is what "8 slides in a chapter" means to
      // the learner. Slides that are already stored (or that expandNode just
      // completed because they're payload-only) count as done immediately.
      this.runUserId = userId;
      for (const slideId of result.slideIds) {
        this.runSlides.add(slideId);
        const node = await nodesDao.get(db, userId, slideId);
        if (node?.status === "DOWNLOADED") this.doneSlides.add(slideId);
      }

      for (const slideId of result.slideIds) {
        const assets = await assetsDao.listBySlide(db, userId, slideId);
        for (const asset of assets) {
          if (asset.status === "DOWNLOADED") continue;
          this.enqueueAssetJob(
            {
              userId,
              fileId: asset.file_id,
              slideId: asset.slide_id,
              packageSessionId: asset.package_session_id,
            },
            options?.allowCellular
          );
        }
        // Slides with only a payload (no assets) were already marked DOWNLOADED
        // by expandNode when they had nothing to fetch; roll up regardless.
        await this.recomputeRollup(userId, manifest, slideId);
      }
    } finally {
      this.enqueueing -= 1;
    }

    // Only now is the queue populated, and the guard released, so a drain check
    // reflects real work. Syncing before this point saw an empty queue and
    // declared the run finished ~1s after the tap, posting a summary while the
    // asset downloads hadn't even started.
    void this.syncNotification();

    await this.refreshStoreSnapshot(userId);
  }

  private enqueueAssetJob(key: AssetJobKey, allowCellular = false): void {
    const id = jobKey(key);
    if (this.active.has(id)) return;
    if (this.queue.some((j) => jobKey(j) === id)) return;
    if (this.parked.some((j) => jobKey(j) === id)) return;
    this.queue.push({ ...key, requestedAt: Date.now(), allowCellular });
    // Counters are slide-based and set in enqueueNode; asset jobs are an
    // implementation detail the learner never sees.
    void this.pump();
  }

  async cancelNode(userId: string, packageSessionId: string, slideIds: string[]): Promise<void> {
    const db = await getOfflineDb();
    for (const slideId of slideIds) {
      const assets = await assetsDao.listBySlide(db, userId, slideId);
      for (const asset of assets) {
        const id = jobKey({ userId, fileId: asset.file_id, slideId, packageSessionId });
        this.active.get(id)?.abort();
        this.active.delete(id);
        this.queue = this.queue.filter((j) => jobKey(j) !== id);
        await deletePartFile(userId, asset.file_id);
      }
      await nodesDao.setStatus(db, userId, slideId, "NOT_DOWNLOADED");
    }
    await this.refreshStoreSnapshot(userId);
  }

  /** Deletes a downloaded node's assets/payload/rows. Ref-counts shared files so a shared asset survives if another slide still needs it. */
  async deleteNode(userId: string, packageSessionId: string, slideIds: string[]): Promise<void> {
    const db = await getOfflineDb();
    for (const slideId of slideIds) {
      const assets = await assetsDao.listBySlide(db, userId, slideId);
      for (const asset of assets) {
        const others = await assetsDao.countOtherReferences(db, userId, asset.file_id, slideId);
        if (others === 0) {
          await deleteAssetFile(userId, asset.file_id);
        }
      }
      await assetsDao.deleteBySlide(db, userId, slideId);
      await slidePayloadsDao.delete(db, userId, slideId);
      await nodesDao.delete(db, userId, slideId);
      void recordDownloadStateEvent(userId, slideId, packageSessionId, "DELETED");
    }

    // Roll the ancestors back up. Deleting only the slide rows left chapters
    // reading DOWNLOADED and subjects/modules PARTIAL with nothing beneath
    // them — after "Clear all downloads" the UI still advertised content as
    // "available offline" whose files had just been erased, and opening it
    // offline would fail. Chapters first, then modules, then subjects: each
    // level rolls up from the level below, so order matters.
    const manifest = await loadPersistedManifest(userId, packageSessionId);
    if (manifest) {
      const chapters = new Set<string>();
      const modules = new Set<string>();
      const subjects = new Set<string>();
      for (const slideId of slideIds) {
        const ctx = slidesInSubtree(manifest, slideId, "SLIDE")[0];
        if (!ctx) continue;
        chapters.add(ctx.chapterId);
        modules.add(ctx.moduleId);
        subjects.add(ctx.subjectId);
      }
      for (const id of chapters) await this.rollupAncestor(db, userId, id);
      for (const id of modules) await this.rollupAncestor(db, userId, id);
      for (const id of subjects) await this.rollupAncestor(db, userId, id);
      await this.rollupAncestor(db, userId, packageSessionId);
    }

    await this.refreshStoreSnapshot(userId);
  }

  /**
   * "Update" action for an UPDATE_AVAILABLE node (plan §5): re-fetches the
   * manifest, diffs it against the persisted snapshot by slideId + asset
   * checksum (manifest-service.diffManifests), and only re-enqueues assets
   * for slides whose checksums/payload/downloadability actually changed —
   * unchanged slides are left alone (still DOWNLOADED, no re-download).
   */
  async applyManifestUpdate(userId: string, packageSessionId: string): Promise<void> {
    const db = await getOfflineDb();
    const oldManifest = await loadPersistedManifest(userId, packageSessionId);
    const existingRow = await manifestsDao.get(db, userId, packageSessionId);
    const newManifest = await fetchManifest(packageSessionId);
    await persistManifest(userId, existingRow?.institute_id ?? null, newManifest);

    const diff = diffManifests(oldManifest, newManifest);
    for (const entry of diff.filter((d) => d.hasChanges)) {
      const ctx = slidesInSubtree(newManifest, entry.slideId, "SLIDE")[0];
      if (!ctx?.slide.downloadable) continue;

      const result = await expandNode(db, userId, newManifest, entry.slideId, "SLIDE");
      for (const slideId of result.slideIds) {
        const assets = await assetsDao.listBySlide(db, userId, slideId);
        for (const asset of assets) {
          if (asset.status === "DOWNLOADED") continue;
          this.enqueueAssetJob({
            userId,
            fileId: asset.file_id,
            slideId: asset.slide_id,
            packageSessionId: asset.package_session_id,
          });
        }
        await this.recomputeRollup(userId, newManifest, slideId);
      }
    }

    // Clear the "update available" flag + any root badges that weren't
    // touched by an actual content change above (recomputeRollup already
    // corrected the ones that were).
    const nodes = await nodesDao.listByPackageSession(db, userId, packageSessionId);
    for (const node of nodes) {
      if (node.status === "UPDATE_AVAILABLE") {
        await nodesDao.setStatus(db, userId, node.node_id, "DOWNLOADED");
        useOfflineStore.getState().setNodeStatus(node.node_id, "DOWNLOADED");
      }
    }

    await this.refreshStoreSnapshot(userId);
  }

  /**
   * Full purge of one package session's offline footprint — used by the
   * check-in loop (plan §B6) when the server reports UNENROLLED /
   * OFFLINE_DISABLED / DEVICE_REVOKED for a course. Cancels any in-flight
   * jobs for it, deletes ciphertext files (ref-counted — a file_id shared
   * with another still-present slide survives), and drops manifest/nodes/
   * assets/slide_payloads rows for this package session.
   */
  async purgePackageSession(userId: string, packageSessionId: string): Promise<void> {
    const db = await getOfflineDb();

    const assets = await assetsDao.listByPackageSession(db, userId, packageSessionId);
    for (const asset of assets) {
      const id = jobKey({ userId, fileId: asset.file_id, slideId: asset.slide_id, packageSessionId });
      this.active.get(id)?.abort();
      this.active.delete(id);
      this.queue = this.queue.filter((j) => jobKey(j) !== id);
      await deletePartFile(userId, asset.file_id);
      const others = await assetsDao.countOtherReferences(db, userId, asset.file_id, asset.slide_id);
      if (others === 0) await deleteAssetFile(userId, asset.file_id);
    }

    const nodes = await nodesDao.listByPackageSession(db, userId, packageSessionId);
    for (const node of nodes) {
      if (node.node_type === "SLIDE") await slidePayloadsDao.delete(db, userId, node.node_id);
    }

    await assetsDao.deleteByPackageSession(db, userId, packageSessionId);
    await nodesDao.deleteByPackageSession(db, userId, packageSessionId);
    await manifestsDao.delete(db, userId, packageSessionId);

    await this.refreshStoreSnapshot(userId);
  }

  /** Every offline package session this user has content for (plan §B6 "device-revoked → purge all"). */
  async purgeAllForUser(userId: string): Promise<void> {
    const db = await getOfflineDb();
    const manifests = await manifestsDao.listForUser(db, userId);
    for (const manifest of manifests) {
      await this.purgePackageSession(userId, manifest.package_session_id);
    }
  }

  private async pump(): Promise<void> {
    if (this.paused) return;
    while (this.active.size < CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      void this.runJob(job);
    }
    // Everything has drained — this is the one place guaranteed to run after the
    // last job, whatever route it took to finish. Without it a run could end
    // with the notification frozen mid-count and no completion summary.
    if (
      this.queue.length === 0 &&
      this.active.size === 0 &&
      this.parked.length === 0 &&
      this.retrying === 0
    ) {
      void this.syncNotification();
    }
  }

  private async runJob(job: QueuedJob): Promise<void> {
    const id = jobKey(job);
    const controller = new AbortController();
    this.active.set(id, controller);
    const db = await getOfflineDb();

    try {
      await this.attemptJob(db, job, controller.signal, 0);
    } finally {
      // NOTE: deliberately no progress increment here. attemptJob returns as
      // soon as a job is parked (no Wi-Fi/lease) or a retry is scheduled, so
      // counting completions here reported deferred work as "downloaded" — and
      // the same job settling later pushed done past total. Only the terminal
      // paths inside attemptJob call settleJob().
      this.active.delete(id);
      void this.syncNotification();
      void this.pump();
    }
  }

  /** Records a slide as finished (or failed) and refreshes the notification. */
  private settleSlide(slideId: string, failed = false): void {
    if (!this.runSlides.has(slideId)) return;
    if (failed) this.failedSlides.add(slideId);
    else this.doneSlides.add(slideId);
    void this.syncNotification();
  }

  /**
   * Mirrors run progress into the OS notification (and, on Android, the
   * foreground service that keeps this JS running while backgrounded).
   * Counts are per-run and in SLIDES; they reset once the run drains.
   */
  private async syncNotification(): Promise<void> {
    const total = this.runSlides.size;
    // No run in flight. Crucially this must NOT cancel anything: the completion
    // summary is posted when the run drains and the counters are cleared, so a
    // later tick landing here (runJob's finally always calls us) would wipe the
    // "N of N ready for offline use" notification a second after showing it.
    if (total === 0) return;

    // The run is over when no work remains in ANY queue. Slide bookkeeping alone
    // stalled the counter at "14 of 15" when a status transition happened outside
    // recomputeRollup — the summary then never posted at all. Queue-drain is the
    // reliable end signal; the count is recomputed from the DB so the summary
    // reports what is genuinely stored.
    const jobsOutstanding =
      this.queue.length + this.parked.length + this.active.size + this.retrying + this.enqueueing;
    if (jobsOutstanding === 0) {
      // Snapshot and clear SYNCHRONOUSLY before any await. Two callers reach
      // here concurrently (runJob's finally and pump's drain check); when both
      // awaited the recount, both posted a summary and the staler count landed
      // last — "13 of 15" was overwritten by "9 of 15". Clearing first makes the
      // second caller return at the `total === 0` guard above.
      const slides = [...this.runSlides];
      const userId = this.runUserId;
      this.runSlides.clear();
      this.doneSlides.clear();
      this.failedSlides.clear();
      this.runUserId = null;
      this.retrying = 0;
      this.lastPosted = null;
      let done = await this.countDownloadedSlides(userId, slides);
      if (done < slides.length) {
        // The last job's rollup can still be committing when the queue reports
        // empty, so a straight recount under-reports ("13 of 15" for a run that
        // finished all 15). Re-check once after a short settle before making the
        // summary permanent.
        await new Promise((resolve) => setTimeout(resolve, COMPLETION_SETTLE_MS));
        done = await this.countDownloadedSlides(userId, slides);
      }
      // Leave a summary when something was actually downloaded. Small downloads
      // finish in seconds, and simply cancelling the notification meant the
      // learner never saw one at all.
      if (done > 0) {
        await completeDownloadNotification({ done, total });
      } else {
        await stopDownloadNotification();
      }
      return;
    }
    // Recount rather than trust the in-memory set: slide statuses are written
    // from several paths (expander, rollup, retries) and the set drifted,
    // freezing the counter partway.
    // Every rollup calls in here, so a 15-slide chapter produced ~14 identical
    // "13 of 15" posts in a second. Post only on a real change.
    const done = await this.countDownloadedSlides(this.runUserId, [...this.runSlides]);
    const signature = `${done}/${total}`;
    if (signature === this.lastPosted) return;
    this.lastPosted = signature;
    await updateDownloadNotification({ done, total });
  }

  /** How many of the given slides are actually stored (single query). */
  private async countDownloadedSlides(
    userId: string | null,
    slideIds: string[]
  ): Promise<number> {
    if (!userId || slideIds.length === 0) return 0;
    try {
      const db = await getOfflineDb();
      return await nodesDao.countDownloaded(db, userId, slideIds);
    } catch {
      return 0;
    }
  }

  private async attemptJob(
    db: OfflineDbConnection,
    job: QueuedJob,
    signal: AbortSignal,
    attempt: number
  ): Promise<void> {
    const { userId, fileId, slideId, packageSessionId } = job;
    const asset = await assetsDao.get(db, userId, fileId, slideId);
    if (!asset) return; // deleted/cancelled underneath us

    const preflight = await runPreflight(db, userId, {
      allowCellular: job.allowCellular,
      wifiOnly: useOfflineStore.getState().wifiOnly,
      estimatedBytes: asset.size,
    });
    if (!preflight.ok) {
      if (preflight.reason === "WIFI_REQUIRED" || preflight.reason === "OFFLINE") {
        this.park(job); // stays PENDING; retried on networkStatusChange
        return;
      }
      if (preflight.reason === "DISK_FULL") {
        this.pauseAll();
        await assetsDao.updateDownloadProgress(db, userId, fileId, slideId, asset.bytes_downloaded, "FAILED");
        await this.markSlideError(db, userId, slideId);
        useOfflineStore.getState().setLeaseState(useOfflineStore.getState().leaseState); // no-op trigger; UI reads storageUsedBytes via hydrate
        return;
      }
      // Lease expired/revoked: leave asset PENDING, don't spin — lease loop (phase 9) will unblock it.
      this.park(job);
      return;
    }

    try {
      const key = await getOrCreateOfflineKey(userId);
      const nonce = asset.nonce ? base64Nonce(asset.nonce) : generateNonce();
      if (!asset.nonce) {
        await assetsDao.upsert(db, { ...asset, nonce: bytesToB64(nonce), status: "DOWNLOADING" });
      } else {
        await assetsDao.updateDownloadProgress(db, userId, fileId, slideId, asset.bytes_downloaded, "DOWNLOADING");
      }
      nodesDaoSafeSetDownloading(db, userId, slideId);

      // The server requires an ACTIVE device id on every signed-URL request
      // (LearnerOfflineDownloadUrlController rejects a null/blank device_id),
      // so read the registration written by ensureDeviceRegistered.
      const deviceRegistrationId = (await deviceStateDao.get(db, userId))?.device_registration_id ?? null;

      const urls = await fetchDownloadUrls(packageSessionId, [fileId], deviceRegistrationId);
      let currentUrl = urls[0]?.url;
      if (!currentUrl) throw new Error(`No signed URL returned for asset ${fileId}`);

      const result = await downloadAssetChunked({
        userId,
        fileId,
        key,
        nonce,
        sizeBytes: asset.size,
        checksum: asset.checksum,
        checksumType: null,
        signal,
        onProgress: (bytesDownloaded) => {
          void assetsDao.updateDownloadProgress(db, userId, fileId, slideId, bytesDownloaded, "DOWNLOADING");
          this.bumpNodeProgress(userId, slideId, bytesDownloaded);
        },
        getSignedUrl: async () => {
          const refreshed = await fetchDownloadUrls(packageSessionId, [fileId], deviceRegistrationId);
          currentUrl = refreshed[0]?.url ?? currentUrl;
          return currentUrl!;
        },
      });

      await assetsDao.upsert(db, {
        ...asset,
        nonce: bytesToB64(nonce),
        local_path: result.localPath,
        status: "DOWNLOADED",
        bytes_downloaded: result.bytesDownloaded,
        attempt_count: 0,
      });

      const manifest = await loadPersistedManifest(userId, packageSessionId);
      if (manifest) await this.recomputeRollup(userId, manifest, slideId);
      await this.refreshStoreSnapshot(userId);
    } catch (error) {
      if (signal.aborted) {
        // Cancelled — no longer expected work, so drop it from the denominator
        // rather than counting it as downloaded.
        this.runSlides.delete(slideId);
        void this.syncNotification();
        return;
      }
      const nextAttempt = attempt + 1;
      await assetsDao.updateDownloadProgress(
        db,
        userId,
        fileId,
        slideId,
        asset.bytes_downloaded,
        nextAttempt >= MAX_ATTEMPTS ? "FAILED" : "PENDING"
      );
      if (nextAttempt >= MAX_ATTEMPTS) {
        await this.markSlideError(db, userId, slideId);
        console.error(`[offline-download] asset ${fileId} failed permanently`, error);
        this.settleSlide(slideId, true);
        return;
      }
      const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
      // Count the backoff window as outstanding: the job has already left
      // `active`, so without this the notification would see an empty queue,
      // declare everything finished, and disappear mid-download.
      this.retrying += 1;
      setTimeout(() => {
        this.retrying -= 1;
        void this.attemptJob(db, job, signal, nextAttempt);
      }, delay);
    }
  }

  private async markSlideError(db: OfflineDbConnection, userId: string, slideId: string): Promise<void> {
    await nodesDao.setStatus(db, userId, slideId, "ERROR");
  }

  private bumpNodeProgress(userId: string, slideId: string, bytesDownloaded: number): void {
    void (async () => {
      const db = await getOfflineDb();
      await nodesDao.updateProgress(db, userId, slideId, bytesDownloaded);
      useOfflineStore.getState().setNodeStatus(slideId, "DOWNLOADING");
    })();
  }

  /** Recomputes slide status from its assets/payload, then rolls chapter→module→subject up from the manifest tree. */
  private async recomputeRollup(userId: string, manifest: OfflineManifest, slideId: string): Promise<void> {
    const db = await getOfflineDb();

    const ctx = slidesInSubtree(manifest, slideId, "SLIDE")[0];
    if (!ctx) return;

    const assets = await assetsDao.listBySlide(db, userId, slideId);
    const payload = await slidePayloadsDao.get(db, userId, slideId);
    const slideStatus = computeSlideStatus(
      assets.map((a) => a.status),
      ctx.slide.inline_payload !== null && ctx.slide.inline_payload !== undefined,
      !!payload
    );
    const previousNode = await nodesDao.get(db, userId, slideId);
    await nodesDao.setStatus(db, userId, slideId, slideStatus);
    useOfflineStore.getState().setNodeStatus(slideId, slideStatus);
    // Authoritative completion point: a slide is done only when every asset AND
    // its payload are stored, so progress is counted here rather than per asset.
    if (slideStatus === "DOWNLOADED") this.settleSlide(slideId);
    // Record DOWNLOAD_STATE only on the transition into DOWNLOADED — recomputeRollup
    // re-runs on every asset progress tick, and we don't want a queue entry per tick.
    if (slideStatus === "DOWNLOADED" && previousNode?.status !== "DOWNLOADED") {
      void recordDownloadStateEvent(userId, slideId, manifest.package_session_id, "DOWNLOADED");
    }

    await this.rollupAncestor(db, userId, ctx.chapterId);
    await this.rollupAncestor(db, userId, ctx.moduleId);
    await this.rollupAncestor(db, userId, ctx.subjectId);
    // The course root sits above the subjects; without this its control would
    // never leave "not downloaded" no matter how much was saved.
    await this.rollupAncestor(db, userId, manifest.package_session_id);
  }

  /** Recomputes one ancestor's status from whatever child node rows remain. */
  private async rollupAncestor(
    db: OfflineDbConnection,
    userId: string,
    ancestorId: string
  ): Promise<void> {
    const children = await nodesDao.listChildren(db, userId, ancestorId);
    const childStatuses: NodeDownloadStatus[] = children.map((c) => c.status);
    const status = rollupNodeStatus(childStatuses);
    await nodesDao.setStatus(db, userId, ancestorId, status);
    useOfflineStore.getState().setNodeStatus(ancestorId, status);
  }

  private async refreshStoreSnapshot(userId: string): Promise<void> {
    await useOfflineStore.getState().hydrate(userId);
  }
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64Nonce(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function nodesDaoSafeSetDownloading(db: OfflineDbConnection, userId: string, slideId: string): void {
  void nodesDao.setStatus(db, userId, slideId, "DOWNLOADING");
}

export const downloadManager = new DownloadManager();
