import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

export const useSlidesRefresh = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { chapterId } = router.state.location.search;

  const refreshSlides = async () => {
    console.log("🔄 [useSlidesRefresh] Starting slides refresh process");
    console.log("📋 [useSlidesRefresh] Chapter ID:", chapterId);
    
    if (chapterId) {
      try {
        console.log("🗂️ [useSlidesRefresh] Invalidating query with key:", ["slides", chapterId]);
        
        // Invalidate and refetch the slides query
        await queryClient.invalidateQueries({
          queryKey: ["slides", chapterId],
        });
        
        console.log("✅ [useSlidesRefresh] Query invalidation completed");
        
        // Force refetch to ensure data is updated immediately
        await queryClient.refetchQueries({
          queryKey: ["slides", chapterId],
        });
        
        console.log("✅ [useSlidesRefresh] Query refetch completed - slides data should be updated");
      } catch (error) {
        console.error("❌ [useSlidesRefresh] Failed to refresh slides data:", error);
      }
    } else {
      console.warn("⚠️ [useSlidesRefresh] No chapter ID available, skipping refresh");
    }
  };

  return {
    refreshSlides,
    chapterId,
  };
}; 