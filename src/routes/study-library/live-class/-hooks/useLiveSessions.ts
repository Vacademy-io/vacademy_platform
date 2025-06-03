import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { DaySession, SessionDetails } from "../-types/types";
import { LIVE_SESSION_GET_LIVE_AND_UPCOMING } from "@/constants/urls";

const isSessionLive = (session: SessionDetails): boolean => {
  const now = new Date();
  const sessionDate = new Date(`${session.meeting_date}T${session.start_time}`);
  const lastEntryTime = new Date(
    `${session.meeting_date}T${session.last_entry_time}`
  );

  // Calculate waiting room start time using waiting_room_time from backend
  const waitingRoomStart = new Date(sessionDate);
  waitingRoomStart.setMinutes(
    waitingRoomStart.getMinutes() - session.waiting_room_time
  );

  // Session is live if we're either in waiting room or main session time
  return now >= waitingRoomStart && now <= lastEntryTime;
};

const fetchLiveAndUpcomingSessions = async (
  batchId: string
): Promise<{
  live_sessions: SessionDetails[];
  upcoming_sessions: SessionDetails[];
}> => {
  try {
    const response = await authenticatedAxiosInstance({
      method: "GET",
      url: LIVE_SESSION_GET_LIVE_AND_UPCOMING,
      params: {
        batchId,
      },
    });

    const allSessions = (response.data as DaySession[]).reduce<
      SessionDetails[]
    >((acc, day) => [...acc, ...day.sessions], []);

    const now = new Date();
    const live_sessions = allSessions.filter(isSessionLive);
    const upcoming_sessions = allSessions.filter((session) => {
      const sessionDate = new Date(
        `${session.meeting_date}T${session.start_time}`
      );
      const waitingRoomStart = new Date(sessionDate);
      waitingRoomStart.setMinutes(
        waitingRoomStart.getMinutes() - session.waiting_room_time
      );
      return !isSessionLive(session) && waitingRoomStart > now;
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
    enabled: !!batchId,
    refetchInterval: 60000, // Refetch every minute to keep live status updated
  });
};
