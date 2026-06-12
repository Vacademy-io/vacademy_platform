import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { refreshProgressAfterSubmit } from "@/utils/study-library/tracking/refreshProgressAfterSubmit";

export const useSlidesRefresh = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { chapterId } = router.state.location.search;

  // Thin wrapper around the shared refresh util so slide-sync hooks
  // (PDF / video / audio / presentation) and submit-based slides
  // (quiz / scorm / question / assignment …) all use the SAME backoff
  // reconciliation logic. chapterId comes from the active route here.
  const refreshSlides = async () => {
    if (!chapterId) {
      console.warn("⚠️ [useSlidesRefresh] No chapter ID available, skipping refresh");
      return;
    }
    await refreshProgressAfterSubmit(queryClient, chapterId);
  };

  return {
    refreshSlides,
    chapterId,
  };
};
