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
    /**
     * What WhatsApp said about the last message when it was outgoing: SENT | DELIVERED | READ |
     * FAILED. Absent when nothing has been reported yet (or when the last message was incoming),
     * which the row draws as a single tick — sent, nothing more known.
     */
    lastMessageStatus?: string;
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
    /**
     * SUCCESS/FAILED describe the SEND (did the provider accept the request). SENT/DELIVERED/READ
     * come from WhatsApp's own status webhook afterwards and describe what actually happened to the
     * message — an accepted send can still end as FAILED seconds later.
     */
    deliveryStatus?: 'SUCCESS' | 'FAILED' | 'SENT' | 'DELIVERED' | 'READ';
    error?: string;
    headerType?: string;
    /** Media URL for an IMAGE/VIDEO/DOCUMENT template header. */
    headerMediaUrl?: string;
    /** On a failed non-template send: what we tried to send. */
    attemptedType?: string;

    // Free-form media (an attachment sent from the Inbox, not a template header).
    /** image | video | audio | document. Absent on a plain text message. */
    mediaType?: WhatsAppMediaKind;
    /** Public URL of the attachment, for inline rendering. */
    mediaUrl?: string;
    /** Original filename — what a document bubble shows. */
    mediaFilename?: string;
}

/** The media kinds WhatsApp accepts as a free-form message. */
export type WhatsAppMediaKind = 'image' | 'video' | 'audio' | 'document';

/**
 * Whether Meta's 24-hour customer service window is still open on a conversation. Free-form
 * replies (text and attachments) are only allowed while it is; after that only an approved
 * template can re-open the conversation.
 */
export interface SessionWindow {
    open: boolean;
    lastInboundAt?: string;
    expiresAt?: string;
    minutesRemaining?: number;
    /** No inbound message on record, so the state is unknown rather than closed. */
    unknown: boolean;
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
export interface SendReplyOptions {
    repliedBy?: string;
    /** Attach an image/video/audio/document. `text` then travels as the caption. */
    mediaType?: WhatsAppMediaKind;
    /** Public URL WhatsApp can download the file from. */
    mediaUrl?: string;
    filename?: string;
    /** Send even though our record says the 24h window has closed. */
    force?: boolean;
}

export async function sendReply(
    phone: string,
    text: string,
    instituteId: string,
    options: SendReplyOptions = {}
): Promise<InboxMessage> {
    const { repliedBy, mediaType, mediaUrl, filename, force } = options;
    const { data } = await authenticatedAxiosInstance.post(`${WHATSAPP_INBOX_BASE}/send`, {
        phone,
        text,
        instituteId,
        ...(repliedBy ? { repliedBy } : {}),
        ...(mediaType && mediaUrl ? { mediaType, mediaUrl } : {}),
        ...(filename ? { filename } : {}),
        ...(force ? { force } : {}),
    });
    return data;
}

/**
 * Remaining life of the 24-hour reply window.
 *
 * Returns null when the backend does not expose the endpoint yet — the deployed build may predate
 * it, and an inbox that still sends fine must not show an error banner because of a missing
 * nice-to-have. The result is remembered so a backend without it is probed once, not once per
 * conversation.
 */
let backendSupport: 'unknown' | 'yes' | 'no' = 'unknown';

export async function getSessionWindow(
    phone: string,
    instituteId: string
): Promise<SessionWindow | null> {
    if (backendSupport === 'no') return null;
    try {
        const { data } = await authenticatedAxiosInstance.get(
            `${WHATSAPP_INBOX_BASE}/conversations/${encodeURIComponent(phone)}/session-window`,
            { params: { instituteId } }
        );
        backendSupport = 'yes';
        return data;
    } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // 403 is what this backend returns for an unknown route (404 forwards to a secured /error).
        if (status === 403 || status === 404) backendSupport = 'no';
        return null;
    }
}

/**
 * Whether the backend understands attachments — 'unknown' until the first probe answers.
 *
 * This matters more than a missing banner: `/inbox/send` ignores JSON fields it does not know, so
 * an older backend would accept a media send and quietly deliver the caption as a plain text
 * message, with the attachment dropped and nobody told. The session-window endpoint ships in the
 * same change as media support, so its presence is a reliable proxy, and the composer disables
 * attaching until it answers.
 */
export function getInboxMediaSupport(): 'unknown' | 'yes' | 'no' {
    return backendSupport;
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
