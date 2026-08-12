/**
 * Manifest tree → local DB rows (plan §B3 "expander.ts").
 *
 * Turns an `OfflineManifest` (or a subtree of one, rooted at a user-picked
 * subject/module/chapter/slide) into:
 *  - `nodes` rows for every subject/module/chapter/slide in the manifest
 *    (created once, lazily, and never downgraded once DOWNLOADED — see
 *    `ensureNodeTree`), with the *target* subtree's nodes (re)set to QUEUED;
 *  - `assets` rows (status PENDING) for every downloadable slide's files,
 *    skipping already-DOWNLOADED assets so retry doesn't re-fetch finished
 *    siblings;
 *  - staged `slide_payloads` rows (encrypted) for slides carrying inline
 *    quiz/question/assignment JSON.
 *
 * Non-downloadable ("online-only") slides are skipped entirely — no node,
 * no asset row — but their presence in the manifest still matters for
 * rollup: an ancestor whose subtree contains any online-only slide can never
 * reach DOWNLOADED, only PARTIAL (see `rollupNodeStatus` / `subtreeHasOnlineOnly`).
 */

import type { OfflineDbConnection } from "../db/connection";
import { nodesDao } from "../db/dao/nodes-dao";
import { assetsDao } from "../db/dao/assets-dao";

/**
 * A media_service file id is a short opaque token (UUID-style). Inline slide
 * content (HTML bodies, JSON) must never be mistaken for one — reject
 * anything with whitespace/angle brackets or implausible length.
 */
export function isPlausibleFileId(fileId: string | null | undefined): boolean {
  if (!fileId) return false;
  if (fileId.length < 4 || fileId.length > 128) return false;
  return !/[\s<>{}"]/.test(fileId);
}
import { slidePayloadsDao } from "../db/dao/slide-payloads-dao";
import type {
  AssetDownloadStatus,
  AssetRow,
  NodeDownloadStatus,
  NodeRow,
  OfflineNodeType,
} from "../db/types";
import { getOrCreateOfflineKey } from "../crypto/keys";
import { encryptJsonPayload } from "../crypto/decrypt";
import type {
  OfflineManifest,
  OfflineManifestChapter,
  OfflineManifestModule,
  OfflineManifestSlide,
  OfflineManifestSubject,
} from "@/services/offline/manifest-service";

export type ExpandableNodeType = OfflineNodeType;

interface SlideContext {
  subjectId: string;
  moduleId: string;
  chapterId: string;
  slide: OfflineManifestSlide;
}

/** Depth-first list of every slide in the manifest with its ancestor ids. */
function flattenWithContext(manifest: OfflineManifest): SlideContext[] {
  const out: SlideContext[] = [];
  for (const subject of manifest.subjects ?? []) {
    for (const mod of subject.modules ?? []) {
      for (const chapter of mod.chapters ?? []) {
        for (const slide of chapter.slides ?? []) {
          out.push({
            subjectId: subject.subject_id,
            moduleId: mod.module_id,
            chapterId: chapter.chapter_id,
            slide,
          });
        }
      }
    }
  }
  return out;
}

/** True when the given node (or the whole manifest, if nodeId omitted) contains at least one non-downloadable slide beneath it. */
export function subtreeHasOnlineOnly(
  manifest: OfflineManifest,
  nodeId?: string,
  nodeType?: ExpandableNodeType
): boolean {
  const slides = slidesInSubtree(manifest, nodeId, nodeType);
  return slides.some((ctx) => !ctx.slide.downloadable);
}

/** All slide-contexts within the subtree rooted at (nodeId, nodeType); the whole manifest when nodeId is omitted. */
export function slidesInSubtree(
  manifest: OfflineManifest,
  nodeId?: string,
  nodeType?: ExpandableNodeType
): SlideContext[] {
  const all = flattenWithContext(manifest);
  if (!nodeId || !nodeType) return all;

  switch (nodeType) {
    // The whole course: node_id is the package session, so there is nothing to
    // filter on — every slide in the manifest belongs to it.
    case "COURSE":
      return all;
    case "SLIDE":
      return all.filter((ctx) => ctx.slide.slide_id === nodeId);
    case "CHAPTER":
      return all.filter((ctx) => ctx.chapterId === nodeId);
    case "MODULE":
      return all.filter((ctx) => ctx.moduleId === nodeId);
    case "SUBJECT":
      return all.filter((ctx) => ctx.subjectId === nodeId);
    default:
      return [];
  }
}

/**
 * Rollup: given a node's direct-child statuses and whether its subtree
 * contains any online-only slide, computes what the node's own status
 * should be. Pure function — used by the expander for initial state and by
 * the download manager to recompute ancestors after each completion.
 */
export function rollupNodeStatus(childStatuses: NodeDownloadStatus[]): NodeDownloadStatus {
  // Nothing saved is NOT_DOWNLOADED, even when the subtree contains online-only
  // content. PARTIAL has to mean "some of this is on your device" — reporting it
  // for an untouched node made never-downloaded chapters look partly saved, and
  // left subjects listed on the Downloads screen after "Clear all downloads"
  // (which treats PARTIAL as on-device), so the empty state never appeared.
  // The "can never be 100%" nuance still applies once something IS downloaded,
  // via the allDownloaded branch below.
  if (childStatuses.length === 0) {
    return "NOT_DOWNLOADED";
  }
  if (childStatuses.some((s) => s === "ERROR")) return "ERROR";
  if (childStatuses.some((s) => s === "DOWNLOADING")) return "DOWNLOADING";
  if (childStatuses.some((s) => s === "QUEUED")) return "QUEUED";

  const allDownloaded = childStatuses.every((s) => s === "DOWNLOADED");
  const allNotDownloaded = childStatuses.every((s) => s === "NOT_DOWNLOADED");
  const anyRemoved = childStatuses.some((s) => s === "REMOVED_BY_ADMIN");
  const anyUpdateAvailable = childStatuses.some((s) => s === "UPDATE_AVAILABLE");

  // Every child that CAN be saved is saved. Online-only slides get no node row
  // at all (see the module header), so there is nothing left for the learner to
  // download here — reporting PARTIAL showed a half-filled tick on a chapter
  // that was as complete as it could ever be, with no way to act on it. PARTIAL
  // is now strictly "some of this is still missing", which is what the download
  // control keys off.
  if (allDownloaded) return "DOWNLOADED";
  if (allNotDownloaded && !anyRemoved) {
    return "NOT_DOWNLOADED"; // see the note above — nothing saved is never PARTIAL
  }
  if (anyUpdateAvailable) return "UPDATE_AVAILABLE";
  // Mixed (some downloaded, some not, and/or some removed-by-admin).
  return "PARTIAL";
}

/** Slide-level rollup: DOWNLOADED only when every asset AND the inline payload (if any) are done — plan's "all-or-nothing". */
export function computeSlideStatus(
  assetStatuses: AssetDownloadStatus[],
  hasPayload: boolean,
  payloadStaged: boolean
): NodeDownloadStatus {
  if (assetStatuses.some((s) => s === "FAILED")) return "ERROR";
  if (assetStatuses.some((s) => s === "DOWNLOADING")) return "DOWNLOADING";

  const assetsDone = assetStatuses.every((s) => s === "DOWNLOADED");
  const payloadDone = !hasPayload || payloadStaged;
  if (assetsDone && payloadDone) return "DOWNLOADED";

  const allPending = assetStatuses.every((s) => s === "PENDING") && !payloadStaged;
  return allPending ? "QUEUED" : "DOWNLOADING";
}

/**
 * Statuses that mean "this device already holds, or is actively getting, this
 * content". Re-walking the manifest tree must never overwrite them with the
 * default NOT_DOWNLOADED.
 *
 * UPDATE_AVAILABLE and PARTIAL were missing here, and that broke the update
 * flow outright: applyManifestUpdate calls expandNode -> ensureNodeTree over
 * the WHOLE tree, so every node the check-in had just badged UPDATE_AVAILABLE
 * was reset to NOT_DOWNLOADED before the "clear the badge" pass could restore
 * it. The learner tapped Update and watched their downloaded chapter turn back
 * into an undownloaded one, even though the payloads were still on disk.
 * QUEUED matters for the same reason — losing it strands queued work.
 */
const PRESERVED_NODE_STATUSES = new Set<NodeDownloadStatus>([
  "DOWNLOADED",
  "DOWNLOADING",
  "QUEUED",
  "PARTIAL",
  "UPDATE_AVAILABLE",
]);

async function upsertNodeIfAbsentOrNonTerminal(
  db: OfflineDbConnection,
  userId: string,
  row: NodeRow
): Promise<void> {
  const existing = await nodesDao.get(db, userId, row.node_id);
  if (existing && PRESERVED_NODE_STATUSES.has(existing.status)) {
    // Don't downgrade content the user already has / is actively fetching
    // just because it's being re-discovered while ensuring the tree exists.
    // The parent link is still repaired: subjects predating the COURSE root
    // were stored with parent_id null, and leaving them detached would hide
    // already-downloaded subjects from the course's rollup.
    if (existing.parent_id !== row.parent_id) {
      await nodesDao.setParent(db, userId, row.node_id, row.parent_id);
    }
    return;
  }
  await nodesDao.upsert(db, row);
}

/**
 * Ensures node rows exist for the ENTIRE manifest tree (so ancestor badges
 * — subject/module/chapter cards — can render rollup status even for
 * branches nobody has queued yet), without downgrading already-downloaded
 * or actively-downloading nodes.
 */
export async function ensureNodeTree(
  db: OfflineDbConnection,
  userId: string,
  manifest: OfflineManifest
): Promise<void> {
  // A container earns a node row only if something beneath it can actually be
  // saved. Online-only slides already get none; without the same rule for their
  // containers, a fully-restricted chapter sat in every ancestor's rollup as a
  // child that could never reach DOWNLOADED, so its module/subject/course were
  // stuck reporting PARTIAL forever.
  const savable = (slidesList: OfflineManifestSlide[]) =>
    slidesList.some((slide) => slide.downloadable);
  const chapterSavable = (chapter: OfflineManifestChapter) => savable(chapter.slides ?? []);
  const moduleSavable = (mod: OfflineManifestModule) =>
    (mod.chapters ?? []).some(chapterSavable);
  const subjectSavable = (subject: OfflineManifestSubject) =>
    (subject.modules ?? []).some(moduleSavable);

  if (!(manifest.subjects ?? []).some(subjectSavable)) {
    // Nothing in this course is downloadable — leave no tree behind at all.
    return;
  }

  // Course root, so "download everything in this course" is a node like any
  // other and rolls up from its subjects.
  await upsertNodeIfAbsentOrNonTerminal(db, userId, {
    user_id: userId,
    node_id: manifest.package_session_id,
    node_type: "COURSE",
    package_session_id: manifest.package_session_id,
    parent_id: null,
    status: "NOT_DOWNLOADED",
    bytes_total: 0,
    bytes_done: 0,
  });
  for (const subject of manifest.subjects ?? []) {
    if (!subjectSavable(subject)) continue;
    await upsertNodeIfAbsentOrNonTerminal(db, userId, {
      user_id: userId,
      node_id: subject.subject_id,
      node_type: "SUBJECT",
      package_session_id: manifest.package_session_id,
      parent_id: manifest.package_session_id,
      status: "NOT_DOWNLOADED",
      bytes_total: 0,
      bytes_done: 0,
    });
    for (const mod of subject.modules ?? []) {
      if (!moduleSavable(mod)) continue;
      await upsertNodeIfAbsentOrNonTerminal(db, userId, {
        user_id: userId,
        node_id: mod.module_id,
        node_type: "MODULE",
        package_session_id: manifest.package_session_id,
        parent_id: subject.subject_id,
        status: "NOT_DOWNLOADED",
        bytes_total: 0,
        bytes_done: 0,
      });
      for (const chapter of mod.chapters ?? []) {
        if (!chapterSavable(chapter)) continue;
        await upsertNodeIfAbsentOrNonTerminal(db, userId, {
          user_id: userId,
          node_id: chapter.chapter_id,
          node_type: "CHAPTER",
          package_session_id: manifest.package_session_id,
          parent_id: mod.module_id,
          status: "NOT_DOWNLOADED",
          bytes_total: 0,
          bytes_done: 0,
        });
        for (const slide of chapter.slides ?? []) {
          if (!slide.downloadable) continue; // online-only: no node row
          const bytesTotal = (slide.assets ?? []).reduce(
            (sum, asset) => sum + (asset.size_bytes ?? 0),
            0
          );
          await upsertNodeIfAbsentOrNonTerminal(db, userId, {
            user_id: userId,
            node_id: slide.slide_id,
            node_type: "SLIDE",
            package_session_id: manifest.package_session_id,
            parent_id: chapter.chapter_id,
            status: "NOT_DOWNLOADED",
            bytes_total: bytesTotal,
            bytes_done: 0,
          });
        }
      }
    }
  }
}

export interface ExpandResult {
  slideIds: string[];
  assetCount: number;
  totalBytes: number;
  skippedOnlineOnly: number;
}

/**
 * Enqueues a subject/module/chapter/slide for download: ensures the full
 * node tree exists, then marks every downloadable slide (and its ancestor
 * container nodes) in the target subtree QUEUED, and stages PENDING asset
 * rows + encrypted slide_payloads for anything not already DOWNLOADED.
 */
export async function expandNode(
  db: OfflineDbConnection,
  userId: string,
  manifest: OfflineManifest,
  targetNodeId: string,
  targetNodeType: ExpandableNodeType
): Promise<ExpandResult> {
  await ensureNodeTree(db, userId, manifest);

  const slides = slidesInSubtree(manifest, targetNodeId, targetNodeType);
  const downloadable = slides.filter((ctx) => ctx.slide.downloadable);
  const skippedOnlineOnly = slides.length - downloadable.length;

  let assetCount = 0;
  let totalBytes = 0;
  const key = await getOrCreateOfflineKey(userId);

  for (const ctx of downloadable) {
    const { slide, chapterId } = ctx;

    // Slide node: QUEUED unless it's already fully DOWNLOADED (idempotent re-enqueue).
    // Defensive: only sane media file ids become download jobs. A malformed
    // manifest (e.g. inline HTML leaking into file_id) must never enqueue an
    // undownloadable phantom asset — that wedges the node in DOWNLOADING
    // forever (spec §4.2 "phantom downloading state").
    const validAssets = (slide.assets ?? []).filter((a) => isPlausibleFileId(a.file_id));
    const droppedAssets = (slide.assets ?? []).length - validAssets.length;

    const existingSlideNode = await nodesDao.get(db, userId, slide.slide_id);
    if (existingSlideNode?.status !== "DOWNLOADED") {
      await nodesDao.upsert(db, {
        user_id: userId,
        node_id: slide.slide_id,
        node_type: "SLIDE",
        package_session_id: manifest.package_session_id,
        parent_id: chapterId,
        status: "QUEUED",
        bytes_total: validAssets.reduce((sum, a) => sum + (a.size_bytes ?? 0), 0),
        bytes_done: existingSlideNode?.bytes_done ?? 0,
      });
    }

    if (droppedAssets > 0) {
      console.warn(
        `[offline-expander] dropped ${droppedAssets} malformed asset ref(s) on slide ${slide.slide_id}`
      );
    }

    // The manifest is the source of truth for a slide's assets. Purge any local
    // row it no longer lists — a leftover from an older (or buggier) manifest
    // can never be downloaded, so it would keep its slide QUEUED forever.
    const wantedFileIds = new Set(validAssets.map((a) => a.file_id));
    for (const row of await assetsDao.listBySlide(db, userId, slide.slide_id)) {
      if (!wantedFileIds.has(row.file_id)) {
        await assetsDao.deleteByFileAndSlide(db, userId, row.file_id, slide.slide_id);
      }
    }

    for (const asset of validAssets) {
      assetCount++;
      totalBytes += asset.size_bytes ?? 0;
      const existingAsset = await assetsDao.get(db, userId, asset.file_id, slide.slide_id);
      if (existingAsset?.status === "DOWNLOADED" && existingAsset.checksum === asset.checksum) {
        continue; // already have it, checksum unchanged — leave it alone
      }
      const row: AssetRow = {
        user_id: userId,
        file_id: asset.file_id,
        slide_id: slide.slide_id,
        package_session_id: manifest.package_session_id,
        size: asset.size_bytes ?? 0,
        checksum: asset.checksum ?? null,
        nonce: existingAsset?.nonce ?? null,
        local_path: existingAsset?.local_path ?? null,
        status: "PENDING",
        bytes_downloaded: 0,
        attempt_count: 0,
      };
      await assetsDao.upsert(db, row);
    }

    if (slide.inline_payload !== null && slide.inline_payload !== undefined) {
      const existingPayload = await slidePayloadsDao.get(db, userId, slide.slide_id);
      if (!existingPayload || existingPayload.manifest_version !== manifest.manifest_version) {
        const { ciphertext, nonce } = await encryptJsonPayload(key, slide.inline_payload);
        await slidePayloadsDao.upsert(db, {
          user_id: userId,
          slide_id: slide.slide_id,
          manifest_version: manifest.manifest_version,
          ciphertext,
          nonce,
          key_ref: slide.key_ref ?? null,
        });
      }
    }

    // If the slide has no (valid) assets AND no payload — or its payload is
    // already stored and every remaining asset was malformed — it's complete
    // the moment it's queued.
    if (validAssets.length === 0) {
      const hasPayload = slide.inline_payload !== null && slide.inline_payload !== undefined;
      const payloadStored = hasPayload
        ? (await slidePayloadsDao.get(db, userId, slide.slide_id)) !== null
        : true;
      if (payloadStored) {
        await nodesDao.setStatus(db, userId, slide.slide_id, "DOWNLOADED");
      }
    }
  }

  // Roll target + ancestor container nodes up to QUEUED (download-manager
  // will refine to DOWNLOADING/DOWNLOADED/PARTIAL as jobs complete).
  const containerIds = new Set<string>();
  // Only containers that actually have work queued. Building this from every
  // slide in the subtree marked chapters whose slides are all online-only as
  // QUEUED — nothing would ever download for them, so nothing ever recomputed
  // them, and the QUEUED chapter wedged its module, subject and course on a
  // permanent spinner.
  for (const ctx of downloadable) {
    containerIds.add(ctx.chapterId);
    containerIds.add(ctx.moduleId);
    containerIds.add(ctx.subjectId);
  }
  for (const id of containerIds) {
    const node = await nodesDao.get(db, userId, id);
    if (node && node.status !== "DOWNLOADED" && node.status !== "DOWNLOADING") {
      await nodesDao.setStatus(db, userId, id, "QUEUED");
    }
  }

  return {
    slideIds: downloadable.map((ctx) => ctx.slide.slide_id),
    assetCount,
    totalBytes,
    skippedOnlineOnly,
  };
}
