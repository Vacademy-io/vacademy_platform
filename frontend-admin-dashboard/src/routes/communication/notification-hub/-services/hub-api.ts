import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { NOTIFICATION_HUB_BASE } from '@/constants/urls';

export interface HubEmailStats {
    configured: boolean;
    inboundConfigured: boolean;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    inbound: number;
}

export interface HubWhatsAppStats {
    configured: boolean;
    outgoing: number;
    incoming: number;
}

export interface HubBatchStats {
    active: number;
    completedInWindow: number;
}

export interface HubOverview {
    windowDays: number;
    email: HubEmailStats;
    whatsapp: HubWhatsAppStats;
    batches: HubBatchStats;
}

export interface HubRecentItem {
    id: string;
    channel: 'EMAIL' | 'WHATSAPP';
    from: string;
    fromName?: string;
    userId?: string;
    preview?: string;
    timestamp: string;
}

/** Event types the stat-card drill-down supports (matches backend whitelist). */
export type HubEmailEventType = 'DELIVERY' | 'OPEN' | 'CLICK' | 'BOUNCE' | 'COMPLAINT';

export interface HubEmailEventItem {
    id: string;
    emailLogId: string;
    recipient: string;
    subject?: string;
    timestamp: string;
    bounceType?: string;
    bounceSubType?: string;
    clickedLink?: string;
    ipAddress?: string;
    userAgent?: string;
    complaintType?: string;
}

export interface HubEmailEventList {
    eventType: HubEmailEventType;
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    content: HubEmailEventItem[];
}

export async function getHubOverview(instituteId: string, windowDays = 7): Promise<HubOverview> {
    const { data } = await authenticatedAxiosInstance.get<HubOverview>(
        `${NOTIFICATION_HUB_BASE}/overview`,
        { params: { instituteId, windowDays } }
    );
    return data;
}

export async function getHubEmailEvents(
    instituteId: string,
    eventType: HubEmailEventType,
    windowDays: number,
    page = 0,
    size = 20
): Promise<HubEmailEventList> {
    const { data } = await authenticatedAxiosInstance.get<HubEmailEventList>(
        `${NOTIFICATION_HUB_BASE}/emails`,
        { params: { instituteId, eventType, windowDays, page, size } }
    );
    return data;
}

export async function getHubRecent(
    instituteId: string,
    limit = 20,
    offset = 0
): Promise<HubRecentItem[]> {
    const { data } = await authenticatedAxiosInstance.get<HubRecentItem[]>(
        `${NOTIFICATION_HUB_BASE}/recent`,
        { params: { instituteId, limit, offset } }
    );
    return data;
}
