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
import { nodesDao } from "../db/dao/nodes-dao";
import { manifestsDao } from "../db/dao/manifests-dao";
import type { NodeDownloadStatus } from "../db/types";
import { getOrCreateOfflineKey } from "../crypto/keys";
import {
  computeSlideStatus,
  expandNode,
  rollupNodeStatus,
  slidesInSubtree,
  subtreeHasOnlineOnly,
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
  private active = new Map<string, AbortController>();
  private paused = false;
  private wifiWaiting = false;
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
          if (this.wifiWaiting) {
            this.wifiWaiting = false;
            void this.pump();
          }
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
  }

  pauseAll(): void {
    this.paused = true;
  }

  resumeAll(): void {
    this.paused = false;
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
    const registration = await ensureDeviceRegistered(userId);
    if (registration.status === "limit_reached") {
      throw new DeviceLimitReachedError(registration.devices, registration.message);
    }
    if (registration.status === "error") {
      console.error("[offline-download] device registration failed, proceeding without a lease", registration.message);
    }

    const db = await getOfflineDb();
    const manifest = await loadPersistedManifest(userId, packageSessionId);
    if (!manifest) {
      throw new Error(
        `enqueueNode: no persisted manifest for package session ${packageSessionId} — fetch it first`
      );
    }

    const result = await expandNode(db, userId, manifest, nodeId, nodeType);
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

    await this.refreshStoreSnapshot(userId);
  }

  private enqueueAssetJob(key: AssetJobKey, allowCellular = false): void {
    const id = jobKey(key);
    if (this.active.has(id)) return;
    if (this.queue.some((j) => jobKey(j) === id)) return;
    this.queue.push({ ...key, requestedAt: Date.now(), allowCellular });
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
  }

  private async runJob(job: QueuedJob): Promise<void> {
    const id = jobKey(job);
    const controller = new AbortController();
    this.active.set(id, controller);
    const db = await getOfflineDb();

    try {
      await this.attemptJob(db, job, controller.signal, 0);
    } finally {
      this.active.delete(id);
      void this.pump();
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
        this.wifiWaiting = true;
        this.queue.unshift(job); // stays PENDING; retried on networkStatusChange
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
      this.queue.push(job);
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

      const urls = await fetchDownloadUrls(packageSessionId, [fileId]);
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
          const refreshed = await fetchDownloadUrls(packageSessionId, [fileId]);
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
      if (signal.aborted) return; // cancelled — don't retry
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
        return;
      }
      const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
      setTimeout(() => {
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
    // Record DOWNLOAD_STATE only on the transition into DOWNLOADED — recomputeRollup
    // re-runs on every asset progress tick, and we don't want a queue entry per tick.
    if (slideStatus === "DOWNLOADED" && previousNode?.status !== "DOWNLOADED") {
      void recordDownloadStateEvent(userId, slideId, manifest.package_session_id, "DOWNLOADED");
    }

    for (const ancestorId of [ctx.chapterId, ctx.moduleId, ctx.subjectId]) {
      const ancestorType: ExpandableNodeType =
        ancestorId === ctx.chapterId ? "CHAPTER" : ancestorId === ctx.moduleId ? "MODULE" : "SUBJECT";
      const children = await nodesDao.listChildren(db, userId, ancestorId);
      const childStatuses: NodeDownloadStatus[] = children.map((c) => c.status);
      const hasOnlineOnly = subtreeHasOnlineOnly(manifest, ancestorId, ancestorType);
      const status = rollupNodeStatus(childStatuses, hasOnlineOnly);
      await nodesDao.setStatus(db, userId, ancestorId, status);
      useOfflineStore.getState().setNodeStatus(ancestorId, status);
    }
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
