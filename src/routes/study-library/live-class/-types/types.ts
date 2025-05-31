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
  schedule_id: string;
  meeting_date: string;
  start_time: string;
  last_entry_time: string;
  recurrence_type: string;
  access_level: string;
  title: string;
  subject: string;
  meeting_link: string;
}

export interface DaySession {
  date: string;
  sessions: SessionDetails[];
}
