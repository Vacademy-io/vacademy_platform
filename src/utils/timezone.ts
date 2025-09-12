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
  try {
    // Validate inputs
    if (!sessionDate || !sessionTime || !sessionTimezone) {
      throw new Error("Missing required parameters");
    }

    // Create date string in ISO format for the session timezone
    const sessionDateTimeString = `${sessionDate}T${sessionTime}`;

    // Create a date object in the session timezone
    // We'll use a more reliable approach with explicit timezone handling
    const sessionDateTime = new Date(sessionDateTimeString);

    // Validate the created date
    if (isNaN(sessionDateTime.getTime())) {
      throw new Error(`Invalid date created from: ${sessionDateTimeString}`);
    }

    // Get the user's timezone
    const userTimezone = getUserTimezone();

    // If timezones are the same, return as is
    if (sessionTimezone === userTimezone) {
      return sessionDateTime;
    }

    // Create a date formatter for session timezone
    const sessionTzFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: sessionTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Create a date formatter for user timezone
    const userTzFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Get current time for offset calculation
    const now = new Date();

    // Format current time in both timezones
    const nowInSessionTz = sessionTzFormatter.format(now);
    const nowInUserTz = userTzFormatter.format(now);

    // Parse the formatted times back to get offset
    const sessionTzTime = new Date(
      nowInSessionTz.replace(
        /(\d+)-(\d+)-(\d+), (\d+):(\d+):(\d+)/,
        "$1-$2-$3T$4:$5:$6"
      )
    );
    const userTzTime = new Date(
      nowInUserTz.replace(
        /(\d+)-(\d+)-(\d+), (\d+):(\d+):(\d+)/,
        "$1-$2-$3T$4:$5:$6"
      )
    );

    // Calculate offset difference
    const offsetDifference = userTzTime.getTime() - sessionTzTime.getTime();

    // Apply offset to session time
    const convertedTime = new Date(
      sessionDateTime.getTime() + offsetDifference
    );

    return convertedTime;
  } catch (error) {
    console.error("Error in timezone conversion:", error);
    // Fallback: return the original date without timezone conversion
    const fallbackDate = new Date(`${sessionDate}T${sessionTime}`);
    console.warn("Using fallback date:", fallbackDate.toISOString());
    return fallbackDate;
  }
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
