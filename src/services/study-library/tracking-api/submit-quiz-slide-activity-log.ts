import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SUBMIT_QUIZ_SLIDE_ACTIVITY_LOG } from "@/constants/urls";
import { QuizSlideActivityLogPayload } from "@/types/quiz-slide-activity-log";

export const useSubmitQuizSlideActivityLog = () => {
  return useMutation({
    mutationFn: async ({
      slideId,
      chapterId,
      moduleId,
      subjectId,
      packageSessionId,
      userId,
      requestPayload,
    }: {
      slideId: string;
      chapterId: string;
      moduleId: string;
      subjectId: string;
      packageSessionId: string;
      userId: string;
      requestPayload: QuizSlideActivityLogPayload;
    }) => {
      return authenticatedAxiosInstance.post(
        `${SUBMIT_QUIZ_SLIDE_ACTIVITY_LOG}?slideId=${slideId}&chapterId=${chapterId}&moduleId=${moduleId}&subjectId=${subjectId}&packageSessionId=${packageSessionId}&userId=${userId}`,
        requestPayload
      );
    },
  });
}; 