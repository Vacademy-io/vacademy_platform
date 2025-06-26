import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SUBMIT_SLIDE_ANSWERS } from "@/constants/urls";
import { v4 as uuidv4 } from "uuid";
import { getUserId } from "@/constants/getUserId";

interface VideoQuestionSubmitParams {
  questionId: string;
  selectedOption: string | string[];
  sourceId: string;
  sourceType: string;
}

export const useSubmitVideoQuestion = () => {
  return useMutation({
    mutationFn: async ({
      questionId,
      selectedOption,
      sourceId,
      sourceType,
    }: VideoQuestionSubmitParams) => {
      // Extract slideId and chapterId from URL
      const urlParams = new URLSearchParams(window.location.search);
      const slideId = urlParams.get("slideId") || "";
      const userId = await getUserId();

      if (!slideId || !getUserId) {
        throw new Error("Missing slideId or chapterId in URL");
      }

      const payload = {
        id: uuidv4(),
        source_id: sourceId,
        source_type: sourceType,
        user_id: "current-user-id", // Replace with actual user ID
        slide_id: slideId,
        start_time_in_millis: Date.now() - 60000, // Assuming started 1 minute ago
        end_time_in_millis: Date.now(),
        percentage_watched: 0,
        videos: [],
        documents: [],
        question_slides: [],
        assignment_slides: [],
        video_slides_questions: [
          {
            id: questionId,
            response_json: JSON.stringify({
              selectedOption: Array.isArray(selectedOption)
                ? selectedOption
                : [selectedOption],
            }),
            response_status: "SUBMITTED",
          },
        ],
        new_activity: true,
        concentration_score: {
          id: uuidv4(),
          concentration_score: 100,
          tab_switch_count: 0,
          pause_count: 0,
          answer_times_in_seconds: [5], // Example time to answer
        },
      };

      //   return authenticatedAxiosInstance.post(
      //     `${SUBMIT_SLIDE_ANSWERS}?slideId=${slideId}&chapterId=${chapterId}`,
      //     payload
      //   );
      return authenticatedAxiosInstance.post(SUBMIT_SLIDE_ANSWERS, payload, {
        params: {
          slideId,
          userId,
        },
      });
    },
  });
};
