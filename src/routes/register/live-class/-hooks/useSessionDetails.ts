import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID } from "@/constants/urls";
import { SessionDetailsResponse } from "@/routes/register/live-class/-types/types";

const fetchSessionDetails = async (
  scheduleId: string
): Promise<SessionDetailsResponse> => {
  try {
    const response = await axios.get(LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID, {
      params: {
        scheduleId,
      },
    });
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
