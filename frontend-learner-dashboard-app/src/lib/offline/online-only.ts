/**
 * Client-side mirror of the backend's "online-only" slide classification
 * (plan §A1 platform gate / OfflineAssetExtractor): third-party-hosted
 * content and execution environments that are never downloadable, so the
 * learner app must gate them behind a "Requires internet" message when
 * offline rather than attempting (and failing) to load them.
 *
 * This is a best-effort client mirror for UI gating only — the manifest's
 * per-slide `downloadable`/`reason` (see manifest-service.ts) is the
 * authoritative source once a manifest has been fetched for this course.
 */

import type { Slide } from "@/hooks/study-library/use-slides";

const ONLINE_ONLY_SOURCE_TYPES = new Set([
  "AI_VIDEO",
  "HTML_VIDEO",
  "SCORM",
  "ASSESSMENT",
]);

export function isOnlineOnlySlide(slide: Pick<Slide, "source_type" | "video_slide" | "document_slide">): boolean {
  const type = slide.source_type?.toUpperCase();
  if (!type) return false;
  if (ONLINE_ONLY_SOURCE_TYPES.has(type)) return true;

  if (type === "VIDEO") {
    const videoSourceType = slide.video_slide?.source_type?.toUpperCase();
    // Only FILE_ID-backed video is S3-hosted (downloadable); everything else
    // (YouTube/Vimeo/Drive/embeds) is third-party-hosted.
    return !!videoSourceType && videoSourceType !== "FILE_ID";
  }

  if (type === "DOCUMENT") {
    const docType = slide.document_slide?.type?.toUpperCase();
    // CODE/JUPYTER/SCRATCH embeds run in an execution environment, not a
    // static downloadable file.
    return docType === "CODE" || docType === "JUPYTER" || docType === "SCRATCH";
  }

  return false;
}
