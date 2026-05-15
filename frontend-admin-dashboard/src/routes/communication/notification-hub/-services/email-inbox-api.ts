import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { EMAIL_INBOX_BASE } from '@/constants/urls';

export interface EmailConversation {
    email: string;
    name?: string;
    userId?: string;
    lastMessageDirection?: 'OUTGOING' | 'INCOMING';
    lastMessagePreview?: string;
    lastMessageTime?: string;
    unreadCount?: number;
}

export interface EmailMessage {
    id: string;
    direction: 'OUTGOING' | 'INCOMING';
    subject?: string;
    bodyPreview?: string;
    body?: string;
    counterpartyEmail: string;
    instituteAddress?: string;
    timestamp: string;
    source?: string;
}

export interface EmailInboxStatus {
    inboundConfigured: boolean;
}

export type EmailDirectionFilter = 'ALL' | 'SENT' | 'RECEIVED';

export interface EmailInboxFilters {
    /** Narrow to one institute sender. Empty/undefined = all configured senders. */
    instituteAddress?: string;
    /** Direction filter. ALL = both sent + received. */
    direction?: EmailDirectionFilter;
}

function buildFilterParams(filters?: EmailInboxFilters): Record<string, string | number> {
    const p: Record<string, string | number> = {};
    if (filters?.instituteAddress) p.instituteAddress = filters.instituteAddress;
    if (filters?.direction && filters.direction !== 'ALL') p.direction = filters.direction;
    return p;
}

export async function getEmailConversations(
    instituteId: string,
    offset = 0,
    limit = 30,
    filters?: EmailInboxFilters
): Promise<EmailConversation[]> {
    const { data } = await authenticatedAxiosInstance.get(`${EMAIL_INBOX_BASE}/conversations`, {
        params: { instituteId, offset, limit, ...buildFilterParams(filters) },
    });
    return data;
}

export async function getEmailMessages(
    email: string,
    instituteId: string,
    cursor?: string,
    limit = 50,
    filters?: EmailInboxFilters
): Promise<EmailMessage[]> {
    const params: Record<string, string | number> = {
        instituteId,
        limit,
        ...buildFilterParams(filters),
    };
    if (cursor) params.cursor = cursor;
    const { data } = await authenticatedAxiosInstance.get(
        `${EMAIL_INBOX_BASE}/conversations/${encodeURIComponent(email)}/messages`,
        { params }
    );
    return data;
}

export async function searchEmailConversations(
    instituteId: string,
    query: string,
    offset = 0,
    limit = 30,
    filters?: EmailInboxFilters
): Promise<EmailConversation[]> {
    const { data } = await authenticatedAxiosInstance.get(
        `${EMAIL_INBOX_BASE}/conversations/search`,
        {
            params: {
                instituteId,
                q: query,
                offset,
                limit,
                ...buildFilterParams(filters),
            },
        }
    );
    return data;
}

/** Institute's configured sender addresses, for populating the dropdown. */
export async function getInstituteSenders(instituteId: string): Promise<string[]> {
    const { data } = await authenticatedAxiosInstance.get<string[]>(
        `${EMAIL_INBOX_BASE}/senders`,
        { params: { instituteId } }
    );
    return data;
}

export async function sendEmailReply(payload: {
    instituteId: string;
    toEmail: string;
    fromEmail?: string;
    subject?: string;
    body: string;
}): Promise<EmailMessage> {
    const { data } = await authenticatedAxiosInstance.post(`${EMAIL_INBOX_BASE}/reply`, payload);
    return data;
}

export async function getEmailInboxStatus(instituteId: string): Promise<EmailInboxStatus> {
    const { data } = await authenticatedAxiosInstance.get(`${EMAIL_INBOX_BASE}/status`, {
        params: { instituteId },
    });
    return data;
}
