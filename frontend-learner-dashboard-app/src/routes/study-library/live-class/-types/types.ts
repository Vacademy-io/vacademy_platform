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
  live_sessions: SessionDetails[];
  upcoming_sessions: SessionDetails[];
  totalReturned: number;
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

export interface LearnerButtonConfig {
  text: string;
  url: string;
  background_color: string;
  text_color: string;
  visible: boolean;
}

export interface SessionDetails {
  session_id: string;
  waiting_room_time: number;
  // 'DEFAULT' = waiting-room screen during the waiting-room window.
  // 'PRE_JOINING' = join the live class directly during that window.
  waiting_room_type?: string;
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
  timezone: string;
  link_type?: string;
  learner_button_config?: LearnerButtonConfig | null;
  default_class_link?: string | null;
  custom_meeting_link?: string | null;
  provider_meeting_id?: string | null;
}

export interface DaySession {
  date: string;
  sessions: SessionDetails[];
  learnerButtonConfig?: LearnerButtonConfig | null;
  defaultClassLink?: string | null;
  defaultClassName?: string | null;
}

export interface SessionDetailsResponse {
  sessionId: string;
  scheduleId: string;
  instituteId: string;
  sessionStartTime: string;
  timezone: string;
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
  allowPlayPause: boolean;
  allowRewind: string;
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
  providerMeetingId: string | null;
  providerEmbedToken: string | null;
  providerHostUrl: string | null;
}

// Feedback types
export interface FeedbackQuestion {
    id: string;
    type: 'star_rating' | 'free_text';
    label: string;
    enabled: boolean;
    mandatory: boolean;
    max_stars?: number;
    allow_half?: boolean;
}

export interface FeedbackConfig {
    enabled: boolean;
    // When false, the learner cannot dismiss the form — the Skip button is
    // hidden and the backend rejects empty mandatory answers.
    allow_skip?: boolean;
    questions: FeedbackQuestion[];
}

export interface FeedbackConfigResponse {
    feedback_config: FeedbackConfig | null;
    already_submitted: boolean;
    session_title: string;
    institute_name?: string;
    institute_logo?: string;
}

export interface FeedbackSubmitRequest {
    schedule_id: string;
    responses: Record<string, string | number>;
}

