import { useQuery } from "@tanstack/react-query";
import { SessionDetailsResponse } from "@/routes/study-library/live-class/-types/types";
import { LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID_FOR_GUEST } from "@/constants/urls";
import axios from "axios";

  export const fetchSessionDetails = async (
  scheduleId: string
): Promise<SessionDetailsResponse> => {
  try {
    const response = await axios.get(
      LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID_FOR_GUEST,
      {
        params: {
          scheduleId,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error fetching session details:", error);
    throw error;
  }
};

export const useSessionDetails = (scheduleId: string | null) => {
  return useQuery({
    queryKey: ["sessionDetails", scheduleId],
    queryFn: () => fetchSessionDetails(scheduleId!),
    enabled: !!scheduleId,
  });
};
