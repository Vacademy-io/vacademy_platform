import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

export const useSlidesRefresh = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { chapterId } = router.state.location.search;

  // Refresh every progress-bearing cache after a slide-tracking POST. The
  // backend cascade (slide → chapter → module → subject → package_session)
  // runs @Async, so we wait briefly before invalidating; otherwise the
  // refetch races the cascade and reads stale data. Same pattern is used in
  // QuizViewer's refreshProgressAfterSubmit.
  const refreshSlides = async () => {
    if (!chapterId) {
      console.warn("⚠️ [useSlidesRefresh] No chapter ID available, skipping refresh");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
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
    } catch (error) {
      console.error("❌ [useSlidesRefresh] Failed to refresh progress caches:", error);
    }
  };

  return {
    refreshSlides,
    chapterId,
  };
};
