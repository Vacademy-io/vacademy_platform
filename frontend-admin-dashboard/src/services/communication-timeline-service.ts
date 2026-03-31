import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

export interface StatusEvent {
    status: string;
    timestamp: string;
    details?: string;
}

export interface CommunicationItem {
    id: string;
    channel: 'EMAIL' | 'WHATSAPP' | 'PUSH' | 'SMS';
    direction: 'OUTBOUND' | 'INBOUND';
    title: string;
    bodyPreview: string;
    fullBody?: string;
    templateName?: string;
    status: string;
    statusTimeline: StatusEvent[];
    senderInfo: string;
    recipientInfo: string;
    timestamp: string;
    source: string;
    sourceId: string;
    metadata?: Record<string, unknown>;
}

export interface CommunicationTimelineResponse {
    content: CommunicationItem[];
    totalPages: number;
    totalElements: number;
    last: boolean;
    numberOfElements: number;
    size: number;
    number: number;
    first: boolean;
    empty: boolean;
}

export interface CommunicationTimelineParams {
    page: number;
    size: number;
    channels?: string[];
    direction?: string;
    fromDate?: string;
    toDate?: string;
}

export async function getUserCommunications(
    userId: string,
    params: CommunicationTimelineParams
): Promise<CommunicationTimelineResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page));
    searchParams.set('size', String(params.size));

    if (params.channels && params.channels.length > 0) {
        params.channels.forEach((ch) => searchParams.append('channels', ch));
    }
    if (params.direction) {
        searchParams.set('direction', params.direction);
    }
    if (params.fromDate) {
        searchParams.set('fromDate', params.fromDate);
    }
    if (params.toDate) {
        searchParams.set('toDate', params.toDate);
    }

    const url = `${BASE_URL}/notification-service/v1/communications/user/${userId}?${searchParams.toString()}`;

    const response = await authenticatedAxiosInstance.get<CommunicationTimelineResponse>(url);
    return response.data;
}
