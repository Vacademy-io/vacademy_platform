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
  /** Course name, so the UI can name which course changed. Older cached manifests won't have it. */
  course_name?: string | null;
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
    // Body keys MUST be snake_case: OfflineDownloadUrlsRequest is annotated
    // @JsonNaming(SnakeCaseStrategy), so camelCase keys silently deserialize
    // to nulls and the endpoint rejects with "packageSessionId is required".
    const response = await authenticatedAxiosInstance.post<OfflineDownloadUrl[]>(
      OFFLINE_DOWNLOAD_URLS_URL,
      { device_id: deviceId ?? null, package_session_id: packageSessionId, file_ids: batch }
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

/**
 * Parsed manifests keyed by their raw JSON, so re-parsing is skipped when the
 * stored tree hasn't changed. Every download control on the course page reads
 * the manifest to decide whether to render, and a chapter of 15 slides now
 * mounts 16 of them — without this, one expand re-parsed the whole course tree
 * 16 times. Keying on the JSON text means a rewritten manifest can never hit a
 * stale entry.
 */
const parsedManifests = new Map<string, OfflineManifest>();

/** Loads and JSON-parses a previously persisted manifest, or null if never fetched. */
export async function loadPersistedManifest(
  userId: string,
  packageSessionId: string
): Promise<OfflineManifest | null> {
  const db = await getOfflineDb();
  const row = await manifestsDao.get(db, userId, packageSessionId);
  if (!row) return null;
  const cached = parsedManifests.get(row.tree_json);
  if (cached) return cached;
  const parsed = JSON.parse(row.tree_json) as OfflineManifest;
  // One entry per course is all that is ever re-read; drop the previous
  // version's tree so this can't grow with every manifest bump.
  parsedManifests.clear();
  parsedManifests.set(row.tree_json, parsed);
  return parsed;
}

/** In-flight ensureManifest calls, keyed by `${userId}:${packageSessionId}`. */
const inFlightManifests = new Map<string, Promise<OfflineManifest | null>>();

/** package_session_ids already re-validated this session (see ensureManifest). */
const revalidated = new Set<string>();

const hasDownloadableSlides = (manifest: OfflineManifest): boolean =>
  (manifest.subjects ?? []).some((s) =>
    (s.modules ?? []).some((m) =>
      (m.chapters ?? []).some((c) => (c.slides ?? []).some((sl) => sl.downloadable))
    )
  );

/**
 * Returns the persisted manifest, fetching and persisting it once if this device
 * has never seen this course.
 *
 * The download button only renders when it can prove a node has admin-allowed
 * content, which it reads from the manifest — but the manifest used to be fetched
 * only when the learner TAPPED download. On a fresh install that deadlocked: no
 * manifest meant no button, and no button meant nothing ever fetched the manifest.
 *
 * Concurrent callers share one request: a course page renders a download control
 * per chapter, and each would otherwise fire its own identical fetch.
 */
export async function ensureManifest(
  userId: string,
  packageSessionId: string
): Promise<OfflineManifest | null> {
  const existing = await loadPersistedManifest(userId, packageSessionId);
  // A cached manifest with nothing downloadable is usually one fetched while the
  // institute had offline access switched OFF (the server marks every slide
  // non-downloadable then). Trusting it forever means re-enabling offline never
  // restores the download buttons — the learner is stuck on a snapshot taken
  // during the outage. Re-validate once per session; it self-heals and costs one
  // request for a manifest that was useless anyway.
  if (existing && !hasDownloadableSlides(existing) && !revalidated.has(packageSessionId)) {
    revalidated.add(packageSessionId);
  } else if (existing) {
    return existing;
  }

  const key = `${userId}:${packageSessionId}`;
  const pending = inFlightManifests.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const fetched = await fetchManifest(packageSessionId);
      await persistManifest(userId, null, fetched);
      return await loadPersistedManifest(userId, packageSessionId);
    } catch {
      // Offline or server error — keep whatever we had rather than losing it;
      // callers treat null as "not known yet".
      return existing ?? null;
    } finally {
      inFlightManifests.delete(key);
    }
  })();
  inFlightManifests.set(key, request);
  return request;
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
