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
import type { OfflineManifest, OfflineManifestSlide } from "@/services/offline/manifest-service";

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
export function rollupNodeStatus(
  childStatuses: NodeDownloadStatus[],
  hasOnlineOnlyDescendant: boolean
): NodeDownloadStatus {
  if (childStatuses.length === 0) {
    return hasOnlineOnlyDescendant ? "PARTIAL" : "NOT_DOWNLOADED";
  }
  if (childStatuses.some((s) => s === "ERROR")) return "ERROR";
  if (childStatuses.some((s) => s === "DOWNLOADING")) return "DOWNLOADING";
  if (childStatuses.some((s) => s === "QUEUED")) return "QUEUED";

  const allDownloaded = childStatuses.every((s) => s === "DOWNLOADED");
  const allNotDownloaded = childStatuses.every((s) => s === "NOT_DOWNLOADED");
  const anyRemoved = childStatuses.some((s) => s === "REMOVED_BY_ADMIN");
  const anyUpdateAvailable = childStatuses.some((s) => s === "UPDATE_AVAILABLE");

  if (allDownloaded) return hasOnlineOnlyDescendant ? "PARTIAL" : "DOWNLOADED";
  if (allNotDownloaded && !anyRemoved) {
    return hasOnlineOnlyDescendant ? "PARTIAL" : "NOT_DOWNLOADED";
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

async function upsertNodeIfAbsentOrNonTerminal(
  db: OfflineDbConnection,
  userId: string,
  row: NodeRow
): Promise<void> {
  const existing = await nodesDao.get(db, userId, row.node_id);
  if (existing && (existing.status === "DOWNLOADED" || existing.status === "DOWNLOADING")) {
    // Don't downgrade content the user already has / is actively fetching
    // just because it's being re-discovered while ensuring the tree exists.
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
  for (const subject of manifest.subjects ?? []) {
    await upsertNodeIfAbsentOrNonTerminal(db, userId, {
      user_id: userId,
      node_id: subject.subject_id,
      node_type: "SUBJECT",
      package_session_id: manifest.package_session_id,
      parent_id: null,
      status: "NOT_DOWNLOADED",
      bytes_total: 0,
      bytes_done: 0,
    });
    for (const mod of subject.modules ?? []) {
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
    const existingSlideNode = await nodesDao.get(db, userId, slide.slide_id);
    if (existingSlideNode?.status !== "DOWNLOADED") {
      await nodesDao.upsert(db, {
        user_id: userId,
        node_id: slide.slide_id,
        node_type: "SLIDE",
        package_session_id: manifest.package_session_id,
        parent_id: chapterId,
        status: "QUEUED",
        bytes_total: (slide.assets ?? []).reduce((sum, a) => sum + (a.size_bytes ?? 0), 0),
        bytes_done: existingSlideNode?.bytes_done ?? 0,
      });
    }

    for (const asset of slide.assets ?? []) {
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

    // If the slide has no assets AND no payload (nothing to fetch), it's
    // trivially complete the moment it's queued.
    if ((slide.assets ?? []).length === 0 && (slide.inline_payload === null || slide.inline_payload === undefined)) {
      await nodesDao.setStatus(db, userId, slide.slide_id, "DOWNLOADED");
    }
  }

  // Roll target + ancestor container nodes up to QUEUED (download-manager
  // will refine to DOWNLOADING/DOWNLOADED/PARTIAL as jobs complete).
  const containerIds = new Set<string>();
  for (const ctx of slides) {
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
