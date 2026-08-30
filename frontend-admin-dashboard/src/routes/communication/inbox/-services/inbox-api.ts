import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { WHATSAPP_INBOX_BASE } from '@/constants/urls';

export type InboxFilter = 'ALL' | 'UNANSWERED' | 'FAILED';

/** Why the chatbot handed a conversation to a human. */
export type EscalationReason = 'NO_CONTEXT' | 'MAX_TURNS' | 'AI_ERROR' | 'MANUAL';

export interface InboxConversation {
    phone: string;
    senderName?: string;
    userId?: string;
    lastMessage?: string;
    lastMessageType?: string;
    lastMessageTime?: string;
    unreadCount?: number;

    /** The chatbot couldn't answer and nobody has replied yet — shown as "Unanswered". */
    awaitingReply?: boolean;
    escalationId?: string;
    escalationReason?: EscalationReason;
    /** The learner message the bot couldn't answer. */
    escalationMessage?: string;
    escalatedAt?: string;

    /** How many outgoing messages the provider refused to deliver. */
    failedCount?: number;
}

export interface Escalation {
    id: string;
    instituteId: string;
    flowId?: string;
    sessionId?: string;
    userPhone: string;
    userId?: string;
    userName?: string;
    reason: EscalationReason;
    userMessage?: string;
    botReply?: string;
    status: 'PENDING' | 'RESOLVED';
    notifiedAt?: string;
    notifiedEmails?: string;
    notifiedPhones?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    createdAt?: string;
}

export interface InboxMessage {
    id: string;
    body: string;
    direction: 'OUTGOING' | 'INCOMING';
    timestamp: string;
    source?: string;
    senderName?: string;
    status?: string;
    // Template-send context (present only on outgoing template messages)
    templateName?: string;
    provider?: string;
    deliveryStatus?: 'SUCCESS' | 'FAILED';
    error?: string;
    headerType?: string;
    /** Media URL for an IMAGE/VIDEO/DOCUMENT template header. */
    headerMediaUrl?: string;
    /** On a failed non-template send: what we tried to send. */
    attemptedType?: string;
}

export async function getConversations(
    instituteId: string,
    offset = 0,
    limit = 30,
    filter: InboxFilter = 'ALL'
): Promise<InboxConversation[]> {
    const params: Record<string, string | number> = { instituteId, offset, limit };
    if (filter !== 'ALL') params.filter = filter;
    const { data } = await authenticatedAxiosInstance.get(`${WHATSAPP_INBOX_BASE}/conversations`, {
        params,
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

/**
 * Send a reply. This also resolves any open escalation on the conversation server-side — the
 * reply IS the answer the learner was waiting for, so the "Unanswered" badge clears on refresh.
 */
export async function sendReply(
    phone: string,
    text: string,
    instituteId: string,
    repliedBy?: string
): Promise<InboxMessage> {
    const { data } = await authenticatedAxiosInstance.post(`${WHATSAPP_INBOX_BASE}/send`, {
        phone,
        text,
        instituteId,
        ...(repliedBy ? { repliedBy } : {}),
    });
    return data;
}

/** Conversations the chatbot handed over. Defaults to the open ones — that is the work list. */
export async function listEscalations(
    instituteId: string,
    status: 'PENDING' | 'RESOLVED' | 'ALL' = 'PENDING'
): Promise<Escalation[]> {
    const { data } = await authenticatedAxiosInstance.get(`${WHATSAPP_INBOX_BASE}/escalations`, {
        params: { instituteId, status },
    });
    return data;
}

/** Dismiss a hand-over without replying (already handled on a call, no longer relevant, ...). */
export async function resolveEscalation(
    escalationId: string,
    resolvedBy?: string
): Promise<void> {
    await authenticatedAxiosInstance.post(
        `${WHATSAPP_INBOX_BASE}/escalations/${escalationId}/resolve`,
        resolvedBy ? { resolvedBy } : {}
    );
}
