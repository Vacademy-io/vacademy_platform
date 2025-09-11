import { SessionDetails } from "@/routes/study-library/live-class/-types/types";

export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error("Error detecting user timezone:", error);
    return "Asia/Kolkata"; // fallback
  }
};

/**
 * Convert session time from session timezone to user timezone
 */
export const convertSessionTimeToUserTimezone = (
  sessionDate: string,
  sessionTime: string,
  sessionTimezone: string
): Date => {
  // Create a date object representing the session time
  const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);

  // Get current time for offset calculation
  const now = new Date();

  // Get the time in session timezone
  const timeInSessionTz = new Date(
    now.toLocaleString("en-US", { timeZone: sessionTimezone })
  );

  // Get the time in user timezone
  const timeInUserTz = new Date(
    now.toLocaleString("en-US", { timeZone: getUserTimezone() })
  );

  // Calculate offset difference
  const offsetDifference = timeInUserTz.getTime() - timeInSessionTz.getTime();

  // Apply offset to session time
  return new Date(sessionDateTime.getTime() + offsetDifference);
};

/**
 * Check if session is live (timezone-aware)
 */
export const isSessionLiveTimezoneAware = (
  session: SessionDetails
): boolean => {
  const now = new Date();

  if (!session.timezone) {
    // No timezone info - use local time
    const sessionStart = new Date(
      `${session.meeting_date}T${session.start_time}`
    );
    const sessionEnd = new Date(
      `${session.meeting_date}T${session.last_entry_time}`
    );
    const waitingRoomStart = new Date(
      sessionStart.getTime() - session.waiting_room_time * 60000
    );
    return now >= waitingRoomStart && now <= sessionEnd;
  }

  // Convert session times to user timezone
  const sessionStart = convertSessionTimeToUserTimezone(
    session.meeting_date,
    session.start_time,
    session.timezone
  );

  const sessionEnd = convertSessionTimeToUserTimezone(
    session.meeting_date,
    session.last_entry_time,
    session.timezone
  );

  const waitingRoomStart = new Date(
    sessionStart.getTime() - session.waiting_room_time * 60000
  );

  return now >= waitingRoomStart && now <= sessionEnd;
};

/**
 * Check if session is upcoming (timezone-aware)
 */
export const isSessionUpcomingTimezoneAware = (
  session: SessionDetails
): boolean => {
  const now = new Date();

  if (!session.timezone) {
    // No timezone info - use local time
    const sessionStart = new Date(
      `${session.meeting_date}T${session.start_time}`
    );
    const waitingRoomStart = new Date(
      sessionStart.getTime() - session.waiting_room_time * 60000
    );
    return now < waitingRoomStart;
  }

  // Convert session start time to user timezone
  const sessionStart = convertSessionTimeToUserTimezone(
    session.meeting_date,
    session.start_time,
    session.timezone
  );

  const waitingRoomStart = new Date(
    sessionStart.getTime() - session.waiting_room_time * 60000
  );

  return now < waitingRoomStart;
};

/**
 * Format session time in user timezone for display
 */
export const formatSessionTimeInUserTimezone = (
  sessionDate: string,
  sessionTime: string,
  sessionTimezone: string
): string => {
  if (!sessionTimezone) {
    const datetime = new Date(`${sessionDate}T${sessionTime}`);
    return datetime.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const convertedTime = convertSessionTimeToUserTimezone(
    sessionDate,
    sessionTime,
    sessionTimezone
  );
  return convertedTime.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Get timezone display info
 */
export const getTimezoneDisplayInfo = (sessionTimezone: string) => {
  const now = new Date();
  const userTimezone = getUserTimezone();

  const sessionTzName =
    now
      .toLocaleDateString("en-US", {
        timeZone: sessionTimezone,
        timeZoneName: "short",
      })
      .split(", ")[1] || sessionTimezone;

  const userTzName =
    now
      .toLocaleDateString("en-US", {
        timeZone: userTimezone,
        timeZoneName: "short",
      })
      .split(", ")[1] || userTimezone;

  return {
    sessionTz: sessionTzName,
    userTz: userTzName,
    isSameTimezone: sessionTimezone === userTimezone,
  };
};
