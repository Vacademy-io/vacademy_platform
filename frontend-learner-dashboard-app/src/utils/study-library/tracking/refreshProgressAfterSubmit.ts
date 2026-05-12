import type { QueryClient } from "@tanstack/react-query";

// Invalidate every React Query cache that feeds a progress UI after a slide
// submit. The backend cascade (slide → chapter → module → subject →
// package_session) runs @Async, so we wait briefly before invalidating so the
// refetch sees the new rows. Keys covered:
//   - ["slides", chapterId]            — chapter sidebar (per-slide %)
//   - ["MODULES_WITH_CHAPTERS", ...]   — module list (rollup chapter %)
//   - ["GET_MODULES_WITH_CHAPTERS",...] — alternate naming used in this codebase
//   - ["GET_COURSE_INIT", ...]         — course-overall % tile
//
// The 600ms delay is the empirical settle window for the @Async cascade
// (see 2026-05-09 work in .samar/). Shorter risks invalidating before the
// backend has written; longer makes the UI feel laggy.
export const refreshProgressAfterSubmit = async (
  queryClient: QueryClient,
  chapterId: string
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  await queryClient.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      if (!Array.isArray(k)) return false;
      return (
        k[0] === "MODULES_WITH_CHAPTERS" ||
        k[0] === "GET_MODULES_WITH_CHAPTERS" ||
        k[0] === "GET_COURSE_INIT" ||
        (k[0] === "slides" && k[1] === chapterId)
      );
    },
  });
};
