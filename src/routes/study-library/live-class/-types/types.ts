export interface LiveSession {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  sessionLink?: string;
  instructorName?: string;
  description?: string;
}

export interface LiveSessionsResponse {
  data: DaySession[];
}

// Raw API response types
export interface RawSession {
  id?: string;
  _id?: string;
  title?: string;
  name?: string;
  session_name?: string;
  startTime?: string;
  start_time?: string;
  endTime?: string;
  end_time?: string;
  status: string;
  sessionLink?: string;
  session_link?: string;
  instructorName?: string;
  instructor_name?: string;
  description?: string;
}

export interface RawApiResponse {
  live_sessions?: RawSession[];
  upcoming_sessions?: RawSession[];
}

export interface SessionDetails {
  session_id: string;
  waiting_room_time: number;
  schedule_id: string;
  meeting_date: string;
  start_time: string;
  last_entry_time: string;
  recurrence_type: string;
  access_level: string;
  title: string;
  subject: string;
  meeting_link: string;
  session_streaming_service_type: string;
}

export interface DaySession {
  date: string;
  sessions: SessionDetails[];
}

export interface SessionDetailsResponse {
  sessionId: string;
  scheduleId: string;
  instituteId: string;
  sessionStartTime: string;
  lastEntryTime: string;
  accessLevel: string;
  meetingType: string | null;
  linkType: string;
  sessionStreamingServiceType: string | null;
  defaultMeetLink: string;
  waitingRoomLink: string | null;
  waitingRoomTime: number;
  registrationFormLinkForPublicSessions: string | null;
  createdByUserId: string;
  title: string;
  descriptionHtml: string;
  notificationEmailMessage: string | null;
  attendanceEmailMessage: string | null;
  coverFileId: string | null;
  subject: string;
  thumbnailFileId: string;
  backgroundScoreFileId: string;
  status: string;
  recurrenceType: string;
  recurrenceKey: string;
  meetingDate: string;
  scheduleStartTime: string;
  scheduleLastEntryTime: string;
  customMeetingLink: string;
  customWaitingRoomMediaId: string | null;
}
