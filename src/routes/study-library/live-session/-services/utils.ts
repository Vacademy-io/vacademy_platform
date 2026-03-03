import {
    GET_LIVE_SESSIONS,
    GET_PAST_SESSIONS,
    GET_UPCOMING_SESSIONS,
    GET_DRAFT_SESSIONS,
    GET_SESSION_BY_SESSION_ID,
    LIVE_SESSION_REPORT_BY_SESSION_ID,
    STUDENT_ATTENDANCE_REPORT,
    BATCH_SESSION_ATTENDANCE_REPORT,
    SEARCH_SESSIONS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export interface LiveSession {
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
    registration_form_link_for_public_sessions: string;
    allow_rewind?: boolean | null;
    timezone?: string;
    default_class_link?: string | null;
    default_class_name?: string | null;
    learner_button_config?: {
        text: string;
        url: string;
        background_color: string;
        text_color: string;
        visible: boolean;
    } | null;
}

export interface SessionsByDate {
    date: string;
    sessions: Array<{
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
        registration_form_link_for_public_sessions: string;
        timezone?: string;
    }>;
}

export interface DraftSession {
    session_id: string;
    waiting_room_time: number | null;
    thumbnail_file_id: string | null;
    background_score_file_id: string | null;
    session_streaming_service_type: string | null;
    schedule_id: string | null;
    meeting_date: string | null;
    start_time: string | null;
    last_entry_time: string | null;
    recurrence_type: string;
    access_level: string | null;
    title: string;
    subject: string | null;
    meeting_link: string;
    registration_form_link_for_public_sessions: string | null;
    timezone?: string;
}

export type UpcomingSessionDay = SessionsByDate;
export type PastSessionDay = SessionsByDate;
export type DraftSessionDay = DraftSession;

export interface Schedule {
    session_id: string;
    institute_id: string;
    title: string;
    subject: string | null;
    description_html: string | null;
    default_meet_link: string;
    start_time: string;
    last_entry_time: string;
    link_type: string;
    join_link: string;
    recurrence_type: string | null;
    session_end_date: string;
    access_type: string;
    waiting_room_time: number | null;
    allow_rewind: boolean | null;
    allow_play_pause: boolean | null;
    thumbnail_file_id: string | null;
    background_score_file_id: string | null;
    cover_file_id: string | null;
    session_streaming_service_type: string | null;
    schedule_id: string | null;
    meeting_date: string | null;
    timezone?: string;
    package_session_ids: string[];
    added_schedules: Array<{
        day: string;
        startTime: string;
        duration: string;
        link: string;
        id: string;
        thumbnailFileId: string;
        countAttendanceDaily: boolean;
        dailyAttendance?: boolean;
        default_class_link?: string | null;
        default_class_name?: string | null;
        learner_button_config?: {
            text: string;
            url: string;
            background_color: string;
            text_color: string;
            visible: boolean;
        } | null;
    }>;
}

export interface NotificationAction {
    id: string;
    type: string;
    notifyBy: {
        mail: boolean;
        whatsapp: boolean;
    };
    notify: boolean;
    time: string | null;
}

export interface Field {
    id: string;
    type: string;
    label: string;
    required: boolean;
    isDefault: boolean | null;
}

export interface Notifications {
    addedNotificationActions: NotificationAction[];
    addedFields: Field[];
}

export interface LiveSessionReport {
    fullName: string;
    attendanceDetails: string | null;
    attendanceTimestamp: string | null;
    attendanceStatus: string | null;
    dateOfBirth: string | null;
    mobileNumber: string;
    email: string;
    enrollmentStatus: string;
    gender: string;
    studentId: string;
    instituteEnrollmentNumber: string;
}

export interface SessionBySessionIdResponse {
    schedule: Schedule;
    notifications: Notifications;
}

export const getLiveSessions = async (instituteId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_LIVE_SESSIONS, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
        params: {
            instituteId,
        },
    });
    return response.data;
};

export const getUpcomingSessions = async (instituteId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_UPCOMING_SESSIONS, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
        params: {
            instituteId,
        },
    });
    return response.data as UpcomingSessionDay[];
};

export const getPastSessions = async (instituteId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_PAST_SESSIONS, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
        params: {
            instituteId,
        },
    });
    return response.data as PastSessionDay[];
};

export const getDraftSessions = async (instituteId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_DRAFT_SESSIONS, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
        params: {
            instituteId,
        },
    });
    return response.data as DraftSessionDay[];
};

export const getSessionBySessionId = async (sessionId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_SESSION_BY_SESSION_ID, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
        params: {
            sessionId,
        },
    });
    return response.data;
};

export const getLiveSessionReport = async (
    sessionId: string,
    scheduleId: string,
    accessType: string
): Promise<LiveSessionReport[]> => {
    const response = await authenticatedAxiosInstance.get(LIVE_SESSION_REPORT_BY_SESSION_ID, {
        params: {
            sessionId,
            scheduleId,
            accessType,
        },
    });
    return response.data;
};

export interface StudentSchedule {
    scheduleId: string;
    meetingDate: string;
    startTime: string;
    lastEntryTime: string;
    sessionId: string;
    sessionTitle: string;
    subject: string | null;
    sessionStatus: string;
    accessLevel: string;
    attendanceStatus: 'PRESENT' | 'ABSENT';
}

export interface StudentAttendanceReport {
    userId: string;
    attendancePercentage: number;
    schedules: StudentSchedule[];
}

export const getStudentAttendanceReport = async (
    userId: string,
    batchId?: string,
    startDate?: string,
    endDate?: string
): Promise<StudentAttendanceReport> => {
    const params: Record<string, string> = { userId };

    if (batchId) params.batchId = batchId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await authenticatedAxiosInstance.get<StudentAttendanceReport>(
        STUDENT_ATTENDANCE_REPORT,
        { params }
    );
    return response.data;
};

export interface BatchStudentSession {
    scheduleId: string;
    sessionId: string;
    title: string;
    meetingDate: string;
    startTime: string;
    lastEntryTime: string;
    attendanceStatus: string | null; // 'PRESENT' | 'ABSENT' | null
    attendanceDetails: string | null;
    attendanceTimestamp: string | null;
}

export interface BatchStudentReport {
    studentId: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    gender: string;
    dateOfBirth: string | null;
    instituteEnrollmentNumber: string;
    enrollmentStatus: string;
    sessions: BatchStudentSession[];
}

export const getBatchSessionAttendanceReport = async (
    batchSessionId?: string,
    startDate?: string,
    endDate?: string
): Promise<BatchStudentReport[]> => {
    const params: Record<string, string> = {};

    // Only attach batchSessionId when a specific batch is selected.
    if (batchSessionId) {
        params.batchSessionId = batchSessionId;
    }

    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await authenticatedAxiosInstance.get<BatchStudentReport[]>(
        BATCH_SESSION_ATTENDANCE_REPORT,
        { params }
    );
    return response.data;
};

// New Search API types
export interface SessionSearchRequest {
    institute_id: string;
    page?: number;
    size?: number;
    sort_by?: 'meetingDate' | 'startTime' | 'title' | 'createdAt' | 'updatedAt';
    sort_direction?: 'ASC' | 'DESC';
    statuses?: string[];
    session_ids?: string[];
    start_date?: string;
    end_date?: string;
    start_time_of_day?: string;
    end_time_of_day?: string;
    recurrence_types?: string[];
    access_levels?: string[];
    batch_ids?: string[];
    user_ids?: string[];
    search_query?: string;
    timezones?: string[];
    schedule_ids?: string[];
    streaming_service_types?: string[];
    time_status?: 'UPCOMING' | 'PAST' | 'LIVE' | null;
}

export interface SessionSearchResponseItem {
    session_id: string;
    waiting_room_time: number | null;
    thumbnail_file_id: string | null;
    background_score_file_id: string | null;
    session_streaming_service_type: string | null;
    schedule_id: string;
    meeting_date: string;
    start_time: string;
    last_entry_time: string;
    recurrence_type: string;
    access_level: string;
    title: string;
    subject: string | null;
    meeting_link: string;
    registration_form_link_for_public_sessions: string | null;
    timezone: string;
    default_class_link?: string | null;
    default_class_name?: string | null;
    learner_button_config?: {
        text: string;
        url: string;
        background_color: string;
        text_color: string;
        visible: boolean;
    } | null;
}

export interface PaginationMetadata {
    current_page: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
}

export interface SessionSearchResponse {
    sessions: SessionSearchResponseItem[];
    pagination: PaginationMetadata;
}

export const searchSessions = async (
    request: SessionSearchRequest
): Promise<SessionSearchResponse> => {
    const response = await authenticatedAxiosInstance.post<SessionSearchResponse>(
        SEARCH_SESSIONS,
        request,
        {
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/json',
            },
        }
    );
    return response.data;
};
