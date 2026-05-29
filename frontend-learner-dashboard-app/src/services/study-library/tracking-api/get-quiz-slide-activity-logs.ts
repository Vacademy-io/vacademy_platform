import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GET_QUIZ_SLIDE_ACTIVITY_LOGS } from "@/constants/urls";

export interface QuizSideEntry {
  id: string;
  question_id: string;
  response_json: string | null;
  response_status: string | null;
  instructor_feedback?: string | null;
  instructor_feedback_file_id?: string | null;
}

export interface QuizAttemptLog {
  id: string;
  start_time: string | null;
  end_time: string | null;
  percentage_watched: number | null;
  status: string | null;
  quiz_sides?: QuizSideEntry[];
}

interface PageResponse {
  content: QuizAttemptLog[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export const useGetQuizSlideActivityLogs = (userId: string | undefined, slideId: string | undefined) => {
  return useQuery<QuizAttemptLog[]>({
    queryKey: ["quiz-slide-activity-logs", userId, slideId],
    queryFn: async () => {
      const response = await authenticatedAxiosInstance.get<PageResponse>(
        `${GET_QUIZ_SLIDE_ACTIVITY_LOGS}?userId=${userId}&slideId=${slideId}&pageNo=0&pageSize=50`
      );
      return response.data.content ?? [];
    },
    enabled: !!userId && !!slideId,
    staleTime: 30_000,
  });
};
