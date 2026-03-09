import {
    CREATE_LIVE_SESSION_STEP_1,
    CREATE_LIVE_SESSION_STEP_2,
    GET_LIVE_SESSIONS,
    DELETE_LIVE_SESSION,
    CREATE_PROVIDER_MEETING
    // GET_LIVE_SESSIONS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LiveSessionStep1RequestDTO, LiveSessionStep2RequestDTO } from '../../-constants/helper';

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

export const createLiveSessionStep2 = async (data: LiveSessionStep2RequestDTO) => {
    const response = await authenticatedAxiosInstance.post(CREATE_LIVE_SESSION_STEP_2, data, {
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

export const deleteLiveSession = async (ids: string[], type: string) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            DELETE_LIVE_SESSION,
            {
                ids,
                type,
            },
            {
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error deleting live session:', error);
        throw error;
    }
};
