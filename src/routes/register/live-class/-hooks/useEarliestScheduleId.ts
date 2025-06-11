import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { LIVE_SESSION_GET_EARLIEST_SCHEDULE_ID } from "@/constants/urls";

const fetchEarliestScheduleId = async (sessionId: string): Promise<string> => {
  try {
    const response = await authenticatedAxiosInstance.get(
      LIVE_SESSION_GET_EARLIEST_SCHEDULE_ID,
      {
        params: {
          sessionId,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching earliest schedule ID:", error);
    throw error;
  }
};

export const useEarliestScheduleId = (sessionId: string | null) => {
  return useQuery({
    queryKey: ["earliestScheduleId", sessionId],
    queryFn: () => fetchEarliestScheduleId(sessionId!),
    enabled: !!sessionId,
  });
};
