/**
 * Offline manifest fetch + persistence + diffing (plan §B3 "manifest
 * persist"). Mirrors the backend contract in
 * admin_core_service/.../features/learner_offline/dto/OfflineManifest*DTO.java
 * exactly (snake_case JSON — see @JsonNaming(SnakeCaseStrategy) on every DTO).
 */

import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { OFFLINE_DOWNLOAD_URLS_URL, OFFLINE_MANIFEST_URL } from "@/constants/urls";
import { getOfflineDb } from "@/lib/offline/db/connection";
import { manifestsDao } from "@/lib/offline/db/dao/manifests-dao";
import type { ManifestRow } from "@/lib/offline/db/types";

export type OfflineDownloadReason = "ALLOWED" | "PERMISSION_DENIED" | "ONLINE_ONLY";

export interface OfflineAssetRef {
  file_id: string;
  /** VIDEO | DOCUMENT | AUDIO | ASSIGNMENT_ATTACHMENT */
  role: string;
  size_bytes: number | null;
  checksum: string | null;
  checksum_type: string | null;
}

export interface OfflineManifestSlide {
  slide_id: string;
  slide_type: string;
  title: string;
  slide_order: number | null;
  downloadable: boolean;
  reason: OfflineDownloadReason;
  key_ref: string | null;
  inline_payload: unknown;
  assets: OfflineAssetRef[];
}

export interface OfflineManifestChapter {
  chapter_id: string;
  chapter_name: string;
  chapter_order: number | null;
  slides: OfflineManifestSlide[];
}

export interface OfflineManifestModule {
  module_id: string;
  module_name: string;
  module_order: number | null;
  chapters: OfflineManifestChapter[];
}

export interface OfflineManifestSubject {
  subject_id: string;
  subject_name: string;
  subject_order: number | null;
  modules: OfflineManifestModule[];
}

export interface OfflineManifestSettings {
  revalidation_days: number;
  max_devices: number;
}

export interface OfflineManifest {
  package_session_id: string;
  manifest_version: number;
  settings: OfflineManifestSettings;
  subjects: OfflineManifestSubject[];
}

export interface OfflineDownloadUrl {
  file_id: string;
  url: string;
}

/** GET /admin-core-service/learner-offline/v1/manifest?packageSessionId= */
export async function fetchManifest(packageSessionId: string): Promise<OfflineManifest> {
  const response = await authenticatedAxiosInstance.get<OfflineManifest>(OFFLINE_MANIFEST_URL, {
    params: { packageSessionId },
  });
  return response.data;
}

/** POST /admin-core-service/learner-offline/v1/download-urls — batches of at most 50 fileIds (backend contract). */
export async function fetchDownloadUrls(
  packageSessionId: string,
  fileIds: string[],
  deviceId?: string | null
): Promise<OfflineDownloadUrl[]> {
  if (fileIds.length === 0) return [];
  const BATCH = 50;
  const results: OfflineDownloadUrl[] = [];
  for (let i = 0; i < fileIds.length; i += BATCH) {
    const batch = fileIds.slice(i, i + BATCH);
    const response = await authenticatedAxiosInstance.post<OfflineDownloadUrl[]>(
      OFFLINE_DOWNLOAD_URLS_URL,
      { deviceId: deviceId ?? null, packageSessionId, fileIds: batch }
    );
    results.push(...response.data);
  }
  return results;
}

/** Persists a freshly fetched manifest as the (user, packageSession) snapshot, clearing update_available. */
export async function persistManifest(
  userId: string,
  institueId: string | null,
  manifest: OfflineManifest
): Promise<ManifestRow> {
  const db = await getOfflineDb();
  const row: ManifestRow = {
    user_id: userId,
    package_session_id: manifest.package_session_id,
    institute_id: institueId,
    version: manifest.manifest_version,
    fetched_at: Date.now(),
    tree_json: JSON.stringify(manifest),
    update_available: 0,
  };
  await manifestsDao.upsert(db, row);
  return row;
}

/** Loads and JSON-parses a previously persisted manifest, or null if never fetched. */
export async function loadPersistedManifest(
  userId: string,
  packageSessionId: string
): Promise<OfflineManifest | null> {
  const db = await getOfflineDb();
  const row = await manifestsDao.get(db, userId, packageSessionId);
  if (!row) return null;
  return JSON.parse(row.tree_json) as OfflineManifest;
}

/** Every slide across the manifest tree, flattened (order preserved depth-first). */
export function flattenManifestSlides(manifest: OfflineManifest): OfflineManifestSlide[] {
  const slides: OfflineManifestSlide[] = [];
  for (const subject of manifest.subjects ?? []) {
    for (const mod of subject.modules ?? []) {
      for (const chapter of mod.chapters ?? []) {
        slides.push(...(chapter.slides ?? []));
      }
    }
  }
  return slides;
}

export interface ManifestDiffEntry {
  slideId: string;
  /** New slide that didn't exist in the old manifest at all. */
  isNew: boolean;
  /** True when any asset checksum changed, or downloadability flipped ALLOWED→not or vice versa. */
  hasChanges: boolean;
}

/**
 * Diffs two manifests by slideId + asset checksum (plan §A2 "client diffing").
 * Used to decide which locally-downloaded slides should flip to
 * UPDATE_AVAILABLE, and (on "Update") which assets actually need re-download
 * — unchanged checksums are left alone.
 */
export function diffManifests(
  oldManifest: OfflineManifest | null,
  newManifest: OfflineManifest
): ManifestDiffEntry[] {
  const oldSlides = new Map(
    (oldManifest ? flattenManifestSlides(oldManifest) : []).map((s) => [s.slide_id, s])
  );
  const newSlides = flattenManifestSlides(newManifest);

  return newSlides.map((slide) => {
    const prior = oldSlides.get(slide.slide_id);
    if (!prior) {
      return { slideId: slide.slide_id, isNew: true, hasChanges: true };
    }
    const checksumsChanged = !sameAssetChecksums(prior.assets, slide.assets);
    const downloadabilityChanged = prior.downloadable !== slide.downloadable;
    const payloadChanged =
      JSON.stringify(prior.inline_payload ?? null) !== JSON.stringify(slide.inline_payload ?? null);
    return {
      slideId: slide.slide_id,
      isNew: false,
      hasChanges: checksumsChanged || downloadabilityChanged || payloadChanged,
    };
  });
}

function sameAssetChecksums(a: OfflineAssetRef[], b: OfflineAssetRef[]): boolean {
  if (a.length !== b.length) return false;
  const byFileId = new Map(a.map((asset) => [asset.file_id, asset.checksum]));
  return b.every((asset) => byFileId.get(asset.file_id) === asset.checksum);
}
