import { SessionDetails } from "../../-types/types";
import { convertSessionTimeToUserTimezone } from "@/utils/timezone";

export interface SessionStatus {
  isActive: boolean; // Either in waiting room or live (and not ended)
  isInWaitingRoom: boolean;
  isLive: boolean;
  isEnded: boolean; // Session has ended
  sessionDate: Date;
  waitingRoomStart: Date;
  sessionEndDate: Date;
}

/**
 * Check if a session is currently active (in waiting room or live)
 * @param session - The session details to check
 * @returns SessionStatus object with timing information
 */
export const getSessionStatus = (session: SessionDetails): SessionStatus => {
  const now = new Date();
  let sessionDate: Date;
  let waitingRoomStart: Date;
  let sessionEndDate: Date;

  if (session.timezone) {
    // Use timezone-aware calculation
    sessionDate = convertSessionTimeToUserTimezone(
      session.meeting_date,
      session.start_time,
      session.timezone
    );
    sessionEndDate = convertSessionTimeToUserTimezone(
      session.meeting_date,
      session.last_entry_time,
      session.timezone
    );
    // waiting_room_time is in minutes, convert to milliseconds
    waitingRoomStart = new Date(
      sessionDate.getTime() - session.waiting_room_time * 60000
    );
  } else {
    // Fallback to original logic
    sessionDate = new Date(`${session.meeting_date}T${session.start_time}`);
    sessionEndDate = new Date(
      `${session.meeting_date}T${session.last_entry_time}`
    );
    // waiting_room_time is in minutes, convert to milliseconds
    waitingRoomStart = new Date(
      sessionDate.getTime() - session.waiting_room_time * 60000
    );
  }

  const isEnded = now > sessionEndDate;
  const isInWaitingRoom =
    now >= waitingRoomStart && now < sessionDate && !isEnded;
  const isLive = now >= sessionDate && !isEnded;
  const isActive = (isInWaitingRoom || isLive) && !isEnded;

  return {
    isActive,
    isInWaitingRoom,
    isLive,
    isEnded,
    sessionDate,
    waitingRoomStart,
    sessionEndDate,
  };
};

/**
 * Get all active sessions (either in waiting room or live)
 * @param sessions - Array of session details
 * @returns Array of active sessions with their status
 */
export const getActiveSessions = (
  sessions: SessionDetails[]
): Array<{ session: SessionDetails; status: SessionStatus }> => {
  return sessions
    .map((session) => ({
      session,
      status: getSessionStatus(session),
    }))
    .filter(({ status }) => status.isActive);
};
