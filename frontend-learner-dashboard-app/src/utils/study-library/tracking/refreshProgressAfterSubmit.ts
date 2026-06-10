import type { QueryClient } from "@tanstack/react-query";

// Refresh every React Query cache that feeds a progress UI after a slide submit.
//
// The backend rollup cascade (slide → chapter → module → subject →
// package_session) runs @Async and commits AFTER the submit response, with
// variable latency. A single fixed-delay refetch can therefore race the cascade
// and read a stale value. Instead of guessing one settle time, we reconcile
// across a few backoff waves: the first wave is awaited (so callers that await
// still get an immediate refresh), and later waves run in the background so the
// rollup tiles land on the authoritative value once the cascade finishes — even
// under load — without blocking the caller's submit/sync flow.
//
// We deliberately do NOT try to detect "the value changed". A genuine completion
// can legitimately leave a rollup unchanged (re-opening an already-complete
// slide, averaging absorption, or MAX across multiple package_sessions of the
// same course), so treating "unchanged" as failure would false-time-out. We just
// re-invalidate a bounded number of times and stop.
//
// Keys covered:
//   - ["slides", chapterId]              — chapter sidebar (per-slide %)
//   - ["MODULES_WITH_CHAPTERS", ...]     — module list (rollup chapter %)
//   - ["GET_MODULES_WITH_CHAPTERS", ...] — alternate naming used in this codebase
//   - ["GET_COURSE_INIT", ...]           — course-overall % tile

const ROLLUP_KEYS = [
  "MODULES_WITH_CHAPTERS",
  "GET_MODULES_WITH_CHAPTERS",
  "GET_COURSE_INIT",
];

// First wave (awaited) ~matches the previous 600ms behaviour; later waves are
// background-only reconciliation for slower cascades.
const FIRST_WAVE_MS = 500;
const BACKGROUND_WAVES_MS = [1500, 3000];

const invalidateProgress = (
  queryClient: QueryClient,
  chapterId: string,
  includeSlides: boolean
): Promise<void> =>
  queryClient
    .invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey;
        if (!Array.isArray(k)) return false;
        if (ROLLUP_KEYS.includes(k[0] as string)) return true;
        // Per-slide % is optimistically set + monotonic-guarded server-side, so
        // we only refetch it on the first wave to avoid re-flickering it.
        if (includeSlides && k[0] === "slides" && k[1] === chapterId) return true;
        return false;
      },
    })
    .catch((error) => {
      console.error("[refreshProgressAfterSubmit] invalidation failed:", error);
    });

export const refreshProgressAfterSubmit = async (
  queryClient: QueryClient,
  chapterId: string
): Promise<void> => {
  // First wave: awaited, includes the per-slide cache.
  await new Promise((resolve) => setTimeout(resolve, FIRST_WAVE_MS));
  await invalidateProgress(queryClient, chapterId, true);

  // Background waves: rollups only, fire-and-forget so we don't block the caller.
  for (const delay of BACKGROUND_WAVES_MS) {
    setTimeout(() => {
      void invalidateProgress(queryClient, chapterId, false);
    }, delay);
  }
};
