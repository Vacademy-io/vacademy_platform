import { SessionDetails } from "@/routes/study-library/live-class/-types/types";
import { format } from "date-fns";

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

    let timeOnly = sessionTime;
    if (sessionTime.includes("T")) {
      timeOnly = sessionTime.split("T")[1];
    }

    // Remove any timezone offset from timeOnly if present
    timeOnly = timeOnly.replace(/[+-]\d{2}:\d{2}$|Z$/, "");

    // Get the user's timezone
    const userTimezone = getUserTimezone();

    // If timezones are the same, return as is
    if (sessionTimezone === userTimezone) {
      return new Date(`${sessionDate}T${timeOnly}`);
    }

    // Create the session datetime string
    const sessionDateTimeString = `${sessionDate}T${timeOnly}`;

    // Modern approach: Use Temporal-like logic with Intl.DateTimeFormat
    // The idea: create a "moment" that represents the session time in the session timezone

    // Step 1: Parse the date/time components
    const sessionDateTime = new Date(sessionDateTimeString);
    if (isNaN(sessionDateTime.getTime())) {
      throw new Error(`Invalid date created from: ${sessionDateTimeString}`);
    }

    // Step 2: Use the inverse operation approach
    // Find what UTC time would result in our desired session time in the session timezone

    // Start with our session time as if it were UTC
    const candidateUTC = new Date(sessionDateTime.getTime());

    // Check what time this UTC moment appears in the session timezone
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      // sv-SE gives us YYYY-MM-DD HH:mm:ss format
      timeZone: sessionTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const sessionTzDisplay = formatter.format(candidateUTC);
    const sessionTzDateTime = new Date(sessionTzDisplay);

    // Calculate the difference and adjust
    const diff = sessionDateTime.getTime() - sessionTzDateTime.getTime();
    const correctUTC = new Date(candidateUTC.getTime() + diff);

    // Step 3: Now convert this correct UTC time to user timezone
    const userFormatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const userTzDisplay = userFormatter.format(correctUTC);
    const result = new Date(userTzDisplay);

    return result;
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
    let sessionEnd = new Date(
      `${session.meeting_date}T${session.last_entry_time}`
    );

    // If end time is before start time, session spans midnight
    if (sessionEnd < sessionStart) {
      sessionEnd = new Date(sessionEnd.getTime() + 24 * 60 * 60 * 1000);
    }

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

  let sessionEnd = convertSessionTimeToUserTimezone(
    session.meeting_date,
    session.last_entry_time,
    session.timezone
  );

  // If end time is before start time, session spans midnight - add 1 day
  if (sessionEnd < sessionStart) {
    sessionEnd = new Date(sessionEnd.getTime() + 24 * 60 * 60 * 1000);
  }

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
    // Handle case where sessionTime might already be a full datetime string
    let timeOnly = sessionTime;
    if (sessionTime.includes("T")) {
      // Extract time part from full datetime string
      timeOnly = sessionTime.split("T")[1];
    }
    const datetime = new Date(`${sessionDate}T${timeOnly}`);
    return format(datetime, "h:mm aa");
  }

  const convertedTime = convertSessionTimeToUserTimezone(
    sessionDate,
    sessionTime,
    sessionTimezone
  );
  return format(convertedTime, "h:mm aa");
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
