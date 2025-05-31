import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  DaySession,
  SessionDetails,
} from "../-types/types";

const isSessionLive = (session: SessionDetails): boolean => {
  const now = new Date();
  const sessionDate = new Date(`${session.meeting_date}T${session.start_time}`);
  const lastEntryTime = new Date(
    `${session.meeting_date}T${session.last_entry_time}`
  );

  return now >= sessionDate && now <= lastEntryTime;
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
      url: "http://localhost:8072/admin-core-service/get-sessions/learner/live-and-upcoming",
      params: {
        batchId,
      },
    });

    console.log("Raw API Response:", response.data);

    const allSessions = (response.data as DaySession[]).reduce<
      SessionDetails[]
    >((acc, day) => [...acc, ...day.sessions], []);

    const live_sessions = allSessions.filter(isSessionLive);
    const upcoming_sessions = allSessions.filter(
      (session) =>
        !isSessionLive(session) &&
        new Date(`${session.meeting_date}T${session.start_time}`) > new Date()
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
    };

    console.log("Transformed Data:", transformedData);
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
