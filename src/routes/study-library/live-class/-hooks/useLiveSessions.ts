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

export interface LiveSessionsParams {
  startDate?: string;
  endDate?: string;
  size?: number;
  page?: number;
}

const fetchLiveAndUpcomingSessions = async (
  batchId: string,
  params?: LiveSessionsParams
): Promise<{
  live_sessions: SessionDetails[];
  upcoming_sessions: SessionDetails[];
  totalReturned: number;
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
        ...params,
      },
    });



    const allSessions = (response.data as DaySession[]).reduce<
      SessionDetails[]
    >((acc, day) => [...acc, ...day.sessions], []);

    const live_sessions = allSessions.filter(isSessionLiveTimezoneAware);
    const upcoming_sessions = allSessions.filter(
      isSessionUpcomingTimezoneAware
    );

    // Sort upcoming sessions by date and time
    upcoming_sessions.sort((a, b) => {
      const dateA = new Date(`${a.meeting_date}T${a.start_time}`);
      const dateB = new Date(`${b.meeting_date}T${b.start_time}`);
      return dateA.getTime() - dateB.getTime();
    });

    const transformedData = {
      live_sessions,
      upcoming_sessions,
      totalReturned: allSessions.length,
    };

    return transformedData;
  } catch (error) {
    console.error("Error fetching live and upcoming sessions:", error);
    throw error;
  }
};

// Fetch sessions for multiple batches and combine results
const fetchLiveAndUpcomingSessionsForMultipleBatches = async (
  batchIds: string[],
  params?: LiveSessionsParams
): Promise<{
  live_sessions: SessionDetails[];
  upcoming_sessions: SessionDetails[];
  totalReturned: number;
}> => {
  try {
    // If no batch IDs, return empty results
    if (!batchIds || batchIds.length === 0) {
      return {
        live_sessions: [],
        upcoming_sessions: [],
        totalReturned: 0,
      };
    }

    // Fetch sessions for all batches in parallel
    const results = await Promise.all(
      batchIds.map((batchId) => fetchLiveAndUpcomingSessions(batchId, params))
    );

    // Combine all sessions from all batches
    const allLiveSessions: SessionDetails[] = [];
    const allUpcomingSessions: SessionDetails[] = [];

    results.forEach((result) => {
      allLiveSessions.push(...result.live_sessions);
      allUpcomingSessions.push(...result.upcoming_sessions);
    });

    // Deduplicate sessions by schedule_id (in case a session appears in multiple batches)
    const uniqueLiveSessions = Array.from(
      new Map(
        allLiveSessions.map((session) => [session.schedule_id, session])
      ).values()
    );

    const uniqueUpcomingSessions = Array.from(
      new Map(
        allUpcomingSessions.map((session) => [session.schedule_id, session])
      ).values()
    );

    // Sort upcoming sessions by date and time
    uniqueUpcomingSessions.sort((a, b) => {
      const dateA = new Date(`${a.meeting_date}T${a.start_time}`);
      const dateB = new Date(`${b.meeting_date}T${b.start_time}`);
      return dateA.getTime() - dateB.getTime();
    });

    return {
      live_sessions: uniqueLiveSessions,
      upcoming_sessions: uniqueUpcomingSessions,
      totalReturned: uniqueLiveSessions.length + uniqueUpcomingSessions.length,
    };
  } catch (error) {
    console.error("Error fetching sessions for multiple batches:", error);
    throw error;
  }
};

export const useLiveSessions = (
  batchIds: string[] | null,
  params?: LiveSessionsParams
) => {
  return useQuery({
    queryKey: [
      "liveSessions",
      batchIds,
      params?.page,
      params?.size,
      params?.startDate,
      params?.endDate,
    ],
    queryFn: () => fetchLiveAndUpcomingSessionsForMultipleBatches(batchIds!, params),
    enabled: !!batchIds && batchIds.length > 0,
    refetchInterval: 60000, // Refetch every minute to keep live status updated
  });
};
