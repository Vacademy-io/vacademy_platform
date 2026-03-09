import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const TIMELINE_URL = `${BASE_URL}/admin-core-service/timeline/v1`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TimelineEvent {
    id: string;
    type: string; // 'ENQUIRY' | 'APPLICANT'
    type_id: string;
    action_type: string;
    actor_type: string;
    actor_id: string;
    actor_name: string;
    title: string;
    description: string;
    metadata: Record<string, any>;
    created_at: string;
}

export interface TimelineEventsResponse {
    content: TimelineEvent[];
    pageable: {
        pageNumber: number;
        pageSize: number;
    };
    totalElements: number;
    totalPages: number;
    last: boolean;
}

export interface CreateTimelineEventPayload {
    type: 'ENQUIRY' | 'APPLICANT';
    type_id: string;
    action_type: string;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Fetch timeline events for an entity (Enquiry or Application)
 */
export const fetchTimelineEvents = async (
    type: 'ENQUIRY' | 'APPLICANT',
    typeId: string,
    page: number = 0,
    size: number = 20
): Promise<TimelineEventsResponse> => {
    const response = await authenticatedAxiosInstance.get(`${TIMELINE_URL}/events`, {
        params: { type, typeId, page, size },
    });
    return response.data;
};

/**
 * Create a manual timeline event (note, phone call log, etc.)
 */
export const createTimelineEvent = async (
    payload: CreateTimelineEventPayload
): Promise<TimelineEvent> => {
    const response = await authenticatedAxiosInstance.post(`${TIMELINE_URL}/event`, payload);
    return response.data;
};

// ─── React Query Helpers ─────────────────────────────────────────────────────

export const timelineQueryKeys = {
    all: ['timeline'] as const,
    events: (type: string, typeId: string) =>
        [...timelineQueryKeys.all, 'events', type, typeId] as const,
};

export const handleFetchTimelineEvents = (
    type: 'ENQUIRY' | 'APPLICANT',
    typeId: string,
    page: number = 0,
    size: number = 20
) => ({
    queryKey: [...timelineQueryKeys.events(type, typeId), page, size],
    queryFn: () => fetchTimelineEvents(type, typeId, page, size),
    enabled: !!typeId,
});
