// Display helpers shared by the course tree sidebar and the slides route
// footer ("Up next" pill): resolving a slide's display title, de-duplicating
// ancestor-name prefixes out of it, and compact row metadata (duration/pages).

import i18n from "@/i18n";
import type { Slide } from "@/hooks/study-library/use-slides";

export function getSlideTitle(slide: Slide): string {
  return (
    (slide.source_type === "DOCUMENT" && slide.document_slide?.title) ||
    (slide.source_type === "VIDEO" && slide.video_slide?.title) ||
    slide.title ||
    "Untitled"
  );
}

/** Teachers commonly prefix every slide with the module/chapter name
 *  ("Exploring the Investigative World of Science | Doubt 01"), which makes
 *  each sidebar row 2–3 lines of identical text with the differing part
 *  buried at the end. Strip any leading ancestor name (plus trailing
 *  separators) so rows show only what distinguishes them; the full title
 *  stays on the row's `title` attribute. Falls back to the original title
 *  if stripping would leave nothing (slide named exactly like the module). */
export function stripAncestorPrefix(
  title: string,
  ancestorNames: Array<string | null | undefined>
): string {
  let out = title.trim();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const raw of ancestorNames) {
      const name = (raw || "").trim();
      // Very short ancestor names ("Ch 1") risk eating real title words.
      if (name.length < 4) continue;
      if (
        out.length > name.length &&
        out.toLowerCase().startsWith(name.toLowerCase())
      ) {
        const rest = out
          .slice(name.length)
          .replace(/^[\s|:·>–—-]+/, "")
          .trim();
        if (rest) {
          out = rest;
          stripped = true;
        }
      }
    }
  }
  return out || title.trim();
}

/** Length of the shared case-insensitive prefix of two titles, backtracked
 *  to a word boundary so we never cut mid-word. */
function sharedPrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i]!.toLowerCase() === b[i]!.toLowerCase()) i++;
  while (i > 0 && !/[\s|:·>–—-]/.test(a[i - 1]!)) i--;
  return i;
}

// Below this, a shared prefix is likely a real word in common ("Lecture 1" /
// "Lecture 2") rather than a copy-pasted heading — leave those alone.
const MIN_SHARED_PREFIX = 10;

/** Display titles for a chapter's slides, de-duplicated two ways:
 *  1. ancestor names stripped (module/chapter name pasted into every title);
 *  2. any long prefix a slide shares with a SIBLING stripped — catches slides
 *     copied between modules that carry the ORIGINAL module's name, which
 *     ancestor stripping can't see ("EXPLORING THE INVESTIGATIVE WORLD…"
 *     slides sitting under a "Practice Test" module).
 *  Keyed by slide id; callers keep the full title on the `title` attribute. */
export function computeDisplayTitles(
  slides: Slide[],
  ancestorNames: Array<string | null | undefined>
): Map<string, string> {
  const entries = slides
    .filter((s) => s.id !== "feedback-slide")
    .map((s) => ({
      id: s.id,
      title: stripAncestorPrefix(getSlideTitle(s), ancestorNames),
    }));
  const result = new Map<string, string>();
  for (const entry of entries) {
    let best = 0;
    for (const other of entries) {
      if (other.id === entry.id) continue;
      best = Math.max(best, sharedPrefixLen(entry.title, other.title));
    }
    let display = entry.title;
    if (best >= MIN_SHARED_PREFIX) {
      const rest = entry.title
        .slice(best)
        .replace(/^[\s|:·>–—-]+/, "")
        .trim();
      if (rest) display = rest;
    }
    result.set(entry.id, display);
  }
  return result;
}

/** Compact h:mm:ss / m:ss clock — locale-neutral, so no i18n needed. */
function formatClock(millis: number): string {
  const totalSeconds = Math.round(millis / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Right-aligned row metadata: duration for video/audio, page count for
 *  documents. The payload already carries these — they were just unused. */
export function getSlideMeta(slide: Slide): string {
  const type = slide.source_type?.toUpperCase();
  if (type === "VIDEO") {
    const ms =
      slide.video_slide?.video_length_in_millis ||
      slide.video_slide?.published_video_length_in_millis;
    if (ms) return formatClock(ms);
  }
  if (type === "HTML_VIDEO") {
    const ms = slide.html_video_slide?.video_length_in_millis;
    if (ms) return formatClock(ms);
  }
  if (type === "AUDIO") {
    const ms =
      slide.audio_slide?.published_audio_length_in_millis ||
      slide.audioSlide?.published_audio_length_in_millis;
    if (ms) return formatClock(ms);
  }
  if (type === "DOCUMENT") {
    const pages =
      slide.document_slide?.total_pages ||
      slide.document_slide?.published_document_total_pages;
    if (pages)
      return i18n.t("studyContent:slideDetails.pageCount", { count: pages });
  }
  return "";
}
