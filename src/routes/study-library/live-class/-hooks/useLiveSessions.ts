import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { DaySession, SessionDetails } from "../-types/types";
import { LIVE_SESSION_GET_LIVE_AND_UPCOMING } from "@/constants/urls";
import {
  getTokenDecodedData,
  getTokenFromStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import {
  isSessionLiveTimezoneAware,
  isSessionUpcomingTimezoneAware,
} from "@/utils/timezone";

const fetchLiveAndUpcomingSessions = async (
  batchId: string
): Promise<{
  live_sessions: SessionDetails[];
  upcoming_sessions: SessionDetails[];
}> => {
  try {
    const accessToken = await getTokenFromStorage(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const response = await authenticatedAxiosInstance({
      method: "GET",
      url: LIVE_SESSION_GET_LIVE_AND_UPCOMING,
      params: {
        batchId,
        userId: tokenData?.user,
      },
    });

    const allSessions = (response.data as DaySession[]).reduce<
      SessionDetails[]
    >((acc, day) => [...acc, ...day.sessions], []);

    const live_sessions = allSessions.filter(isSessionLiveTimezoneAware);
    const upcoming_sessions = allSessions.filter(
      isSessionUpcomingTimezoneAware
    );

    // Simple debug logging
    console.log("Current time:", new Date().toISOString());
    console.log("Live sessions:", live_sessions.length);
    console.log("Upcoming sessions:", upcoming_sessions.length);

    allSessions.forEach((session, index) => {
      console.log(
        `Session ${index + 1}: ${session.title} - ${
          session.timezone
        } - Live: ${isSessionLiveTimezoneAware(
          session
        )} - Upcoming: ${isSessionUpcomingTimezoneAware(session)}`
      );
    });

    // Sort upcoming sessions by date and time
    upcoming_sessions.sort((a, b) => {
      const dateA = new Date(`${a.meeting_date}T${a.start_time}`);
      const dateB = new Date(`${b.meeting_date}T${b.start_time}`);
      return dateA.getTime() - dateB.getTime();
    });

    const transformedData = {
      live_sessions,
      upcoming_sessions,
    };
    console.log("live", transformedData);

    return transformedData;
  } catch (error) {
    console.error("Error fetching live and upcoming sessions:", error);
    throw error;
  }
};

export const useLiveSessions = (batchId: string | null) => {
  return useQuery({
    queryKey: ["liveSessions", batchId],
    queryFn: () => fetchLiveAndUpcomingSessions(batchId!),
    // enabled: !!batchId,
    refetchInterval: 60000, // Refetch every minute to keep live status updated
  });
};
