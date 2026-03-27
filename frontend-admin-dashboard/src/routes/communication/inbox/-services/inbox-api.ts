import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { WHATSAPP_INBOX_BASE } from '@/constants/urls';

export interface InboxConversation {
    phone: string;
    senderName?: string;
    userId?: string;
    lastMessage?: string;
    lastMessageType?: string;
    lastMessageTime?: string;
    unreadCount?: number;
}

export interface InboxMessage {
    id: string;
    body: string;
    direction: 'OUTGOING' | 'INCOMING';
    timestamp: string;
    source?: string;
    senderName?: string;
    status?: string;
}

export async function getConversations(
    instituteId: string,
    offset = 0,
    limit = 30
): Promise<InboxConversation[]> {
    const { data } = await authenticatedAxiosInstance.get(`${WHATSAPP_INBOX_BASE}/conversations`, {
        params: { instituteId, offset, limit },
    });
    return data;
}

export async function getMessages(
    phone: string,
    instituteId: string,
    cursor?: string,
    limit = 50
): Promise<InboxMessage[]> {
    const params: Record<string, string | number> = { instituteId, limit };
    if (cursor) params.cursor = cursor;
    const { data } = await authenticatedAxiosInstance.get(
        `${WHATSAPP_INBOX_BASE}/conversations/${encodeURIComponent(phone)}/messages`,
        { params }
    );
    return data;
}

export async function searchConversations(
    instituteId: string,
    query: string
): Promise<InboxConversation[]> {
    const { data } = await authenticatedAxiosInstance.get(
        `${WHATSAPP_INBOX_BASE}/conversations/search`,
        { params: { instituteId, q: query } }
    );
    return data;
}

export async function sendReply(
    phone: string,
    text: string,
    instituteId: string
): Promise<InboxMessage> {
    const { data } = await authenticatedAxiosInstance.post(`${WHATSAPP_INBOX_BASE}/send`, {
        phone,
        text,
        instituteId,
    });
    return data;
}
