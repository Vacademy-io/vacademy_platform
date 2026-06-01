import {
    CREATE_LIVE_SESSION_STEP_1,
    CREATE_LIVE_SESSION_STEP_2,
    CREATE_LIVE_SESSION_BULK,
    GET_LIVE_SESSIONS,
    DELETE_LIVE_SESSION,
    CREATE_PROVIDER_MEETING,
    CREATE_PROVIDER_MEETINGS_FOR_SESSION,
    PROVIDER_MEETING_AVAILABILITY_FOR_SESSION,
    // GET_LIVE_SESSIONS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LiveSessionStep1RequestDTO, LiveSessionStep2RequestDTO } from '../../-constants/helper';

export interface BulkLiveSessionRequest {
    sessions: LiveSessionStep1RequestDTO[];
    step2_template?: LiveSessionStep2RequestDTO;
    /**
     * Per-row step-2 payloads aligned with {@link sessions}. Takes precedence
     * over {@link step2_template} when present. Length must match `sessions`.
     */
    step2_per_row?: LiveSessionStep2RequestDTO[];
}

export interface BulkLiveSessionRowResult {
    index: number;
    success: boolean;
    session_id?: string;
    title?: string;
    error?: string;
    step2_applied: boolean;
}

export interface BulkLiveSessionResponse {
    total_requested: number;
    total_created: number;
    total_failed: number;
    results: BulkLiveSessionRowResult[];
}

export const createLiveSessionsBulk = async (
    data: BulkLiveSessionRequest
): Promise<BulkLiveSessionResponse> => {
    const response = await authenticatedAxiosInstance.post(CREATE_LIVE_SESSION_BULK, data, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export interface GetLiveSessionsRequest {
    instituteId?: string;
    session_id?: string;
    access_type?: string;
    package_session_ids?: string[];
    join_link?: string;
    notify_settings?: {
        notify_by: {
            mail: boolean;
            whatsapp: boolean;
        };
        on_create: boolean;
        on_live: boolean;
        before_live: boolean;
        before_live_time: Array<{
            time: string;
        }>;
    };
}

export interface PackageSessionDetail {
    package_session_id: string;
    package_name: string;
    level_name: string;
    session_name: string;
}

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
    allow_play_pause?: boolean | null;
    timezone?: string; // Changed from time_zone to timezone to match API response
    default_class_link?: string | null;
    defaultClassName?: string | null;
    learner_button_config?: {
        text: string;
        url: string;
        background_color: string;
        text_color: string;
        visible: boolean;
    } | null;
    package_session_details?: PackageSessionDetail[] | null;
}

export const createLiveSessionStep1 = async (data: LiveSessionStep1RequestDTO) => {
    const response = await authenticatedAxiosInstance.post(CREATE_LIVE_SESSION_STEP_1, data, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

/**
 * Creates the step-2 (participants/access/notifications) record for a session.
 * Defaults to {@link CREATE_LIVE_SESSION_STEP_2} (staging in dev) but can
 * accept a `urlOverride` so the bulk fan-out can target the same backend
 * the bulk endpoint hit (e.g. `localhost:8072`) — otherwise step 2 calls
 * would 404 against staging when the sessions live on a different server.
 */
export const createLiveSessionStep2 = async (
    data: LiveSessionStep2RequestDTO,
    urlOverride?: string
) => {
    const url = urlOverride ?? CREATE_LIVE_SESSION_STEP_2;
    const response = await authenticatedAxiosInstance.post(url, data, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export interface CreateProviderMeetingParams {
    instituteId: string;
    sessionId: string;
    scheduleId: string;
    topic: string;
    agenda: string;
    startTime: string;
    durationMinutes: number;
    timezone: string;
    provider: string;
    /** Zoom only — which institute_zoom_account to create the meeting under. */
    zoomAccountId?: string;
    /** Zoom only — meeting settings (waitingRoom, muteUponEntry, joinBeforeHost, autoRecording). */
    zoomConfig?: Record<string, unknown>;
}

export const createProviderMeeting = async (data: CreateProviderMeetingParams) => {
    const response = await authenticatedAxiosInstance.post(CREATE_PROVIDER_MEETING, data, {
        headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

/**
 * Provisions a provider meeting for EVERY schedule of a session server-side, in one
 * call. The backend loops the session's not-yet-provisioned schedules (idempotent)
 * and derives each occurrence's start time + duration from its own row, so the admin
 * browser no longer loops a create call per occurrence. Used for recurring sessions.
 * Returns 202 immediately ({ status: 'PROCESSING', pendingCount }).
 */
export interface CreateProviderMeetingsForSessionParams {
    instituteId: string;
    sessionId: string;
    topic: string;
    agenda: string;
    /** Fallback duration if a schedule row has no start→last-entry window. */
    durationMinutes: number;
    timezone: string;
    provider: string;
    /** Vendor-neutral meeting settings (preferred). */
    providerConfig?: Record<string, unknown>;
    /** Vendor-neutral provider-account selector (preferred over zoomAccountId). */
    providerAccountId?: string;
    /** @deprecated Zoom legacy — use providerAccountId. Sent during transition. */
    zoomAccountId?: string;
    /** @deprecated Zoom legacy — use providerConfig. Sent during transition. */
    zoomConfig?: Record<string, unknown>;
}

export const createProviderMeetingsForSession = async (
    data: CreateProviderMeetingsForSessionParams
) => {
    const response = await authenticatedAxiosInstance.post(
        CREATE_PROVIDER_MEETINGS_FOR_SESSION,
        data,
        {
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/json',
            },
        }
    );
    return response.data;
};

export interface ConflictingSession {
    meetingKey: string;
    topic: string;
    startTimeMillisec: number;
    endTimeMillisec: number;
}

export interface ProviderAvailabilityResult {
    available: boolean;
    conflicts?: ConflictingSession[];
}

/**
 * Double-booking check: returns other meetings already booked on the same provider
 * account that overlap any occurrence of this session. Advisory — the caller warns
 * the admin; it never blocks. Failures resolve to available=true so scheduling is
 * never gated on this call.
 */
export const checkProviderAvailabilityForSession = async (
    sessionId: string,
    providerAccountId: string
): Promise<ProviderAvailabilityResult> => {
    try {
        const response = await authenticatedAxiosInstance.get<ProviderAvailabilityResult>(
            PROVIDER_MEETING_AVAILABILITY_FOR_SESSION,
            { params: { sessionId, providerAccountId } }
        );
        return response.data ?? { available: true, conflicts: [] };
    } catch {
        return { available: true, conflicts: [] };
    }
};

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

export const deleteLiveSession = async (ids: string[], type: string, notifyStudents?: boolean) => {
    try {
        const body: { ids: string[]; type: string; notifyStudents?: boolean } = { ids, type };
        if (notifyStudents !== undefined) {
            body.notifyStudents = notifyStudents;
        }
        const response = await authenticatedAxiosInstance.post(DELETE_LIVE_SESSION, body, {
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting live session:', error);
        throw error;
    }
};
