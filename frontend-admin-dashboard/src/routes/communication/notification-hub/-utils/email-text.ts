/**
 * Pure helpers for the Email Inbox thread. They exist because the backend rows that feed the
 * inbox were written by several unrelated senders (campaigns, inbox replies, OTPs, automations,
 * AWS bounce daemons) and the raw fields leak that history: `source` can be a service name OR the
 * UUID of the email being replied to, and an inbound body carries the whole quoted chain.
 *
 * Everything here is defensive against an older backend that has not deployed the newer
 * `origin` / `system` fields yet — each function derives the same verdict from the raw fields.
 */

export type EmailOutgoingOrigin = 'CAMPAIGN' | 'INBOX_REPLY' | 'OTP' | 'AUTOMATION' | 'EMAIL';
export type EmailIncomingOrigin = 'REPLY' | 'INCOMING' | 'BOUNCE';
export type EmailOrigin = EmailOutgoingOrigin | EmailIncomingOrigin;

/** The subset of an inbox message the origin resolver needs — kept structural so tests stay light. */
export interface EmailOriginInput {
    direction: 'OUTGOING' | 'INCOMING';
    origin?: string;
    system?: boolean;
    source?: string;
    subject?: string;
    counterpartyEmail?: string;
}

export interface QuotedReplySplit {
    /** The part the person actually typed. */
    main: string;
    /** The quoted chain below it, or null when the body has no recognisable quote. */
    quoted: string | null;
    /** Number of lines in `quoted` — shown on the "Show quoted text" toggle. */
    quotedLineCount: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mail-system local parts: bounce daemons and AWS's own notifier — never a person. */
const SYSTEM_LOCAL_PART_RE = /^(mailer-daemon|postmaster|no-reply-aws|bounce|bounces)$/i;

/** Subject prefixes that mail systems use for delivery failures and setup notices. */
const SYSTEM_SUBJECT_RE =
    /^\s*(delivery status notification|undeliverable|undelivered mail|mail delivery failed|amazon ses setup notification)/i;

/** "On Mon, Sep 14, 2026 at 2:14 PM Shreyash Jain <...> wrote:" on ONE line. */
const ON_WROTE_LINE_RE = /^On .+ wrote:\s*$/;
/** The first half of the same header when the mail client wrapped it. */
const ON_LINE_START_RE = /^On .+/;
const WROTE_LINE_END_RE = /wrote:\s*$/;
const QUOTE_MARKER_RE = /^>/;
const ORIGINAL_MESSAGE_RE = /^-{2,}\s*Original Message\s*-{2,}\s*$/i;
const UNDERSCORE_RULE_RE = /^_{20,}\s*$/;
const OUTLOOK_FROM_RE = /^From:\s*\S/i;
const OUTLOOK_SENT_RE = /^(Sent|Date):\s*\S/i;

export function looksLikeUuid(s?: string): boolean {
    return !!s && UUID_RE.test(s.trim());
}

/**
 * True when the counterparty is the mail system itself (a bounce daemon, postmaster, AWS's
 * notifier) or the subject is a delivery-failure notice. Same rule as the backend.
 */
export function isSystemSender(email?: string, subject?: string): boolean {
    if (email) {
        const at = email.indexOf('@');
        const local = (at >= 0 ? email.slice(0, at) : email).trim();
        if (SYSTEM_LOCAL_PART_RE.test(local)) return true;
    }
    return !!subject && SYSTEM_SUBJECT_RE.test(subject);
}

/**
 * Index of the first line where the quoted chain starts, or -1 when there is none.
 * Checks, in document order, whichever marker appears FIRST:
 *  - "On … wrote:" (one line, or "On …" wrapped so that "wrote:" lands within the next 2 lines)
 *  - a line starting with ">"
 *  - "-----Original Message-----"
 *  - a rule of 20+ underscores
 *  - an Outlook "From: …" line followed by "Sent: …" / "Date: …" within the next 3 lines
 */
function findQuoteStart(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (ON_WROTE_LINE_RE.test(line)) return i;
        if (ON_LINE_START_RE.test(line)) {
            for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
                if (WROTE_LINE_END_RE.test(lines[j] ?? '')) return i;
            }
        }
        if (QUOTE_MARKER_RE.test(line)) return i;
        if (ORIGINAL_MESSAGE_RE.test(line)) return i;
        if (UNDERSCORE_RULE_RE.test(line)) return i;
        if (OUTLOOK_FROM_RE.test(line)) {
            for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
                if (OUTLOOK_SENT_RE.test(lines[j] ?? '')) return i;
            }
        }
    }
    return -1;
}

/**
 * Separate what the sender typed from the quoted chain their mail client appended below it.
 * When nothing precedes the quote (the person only forwarded/quoted), the whole text stays as
 * `main` so the bubble is never empty.
 */
export function splitQuotedReply(text: string): QuotedReplySplit {
    const whole = text ?? '';
    const lines = whole.split(/\r?\n/);
    const start = findQuoteStart(lines);
    if (start < 0) {
        return { main: whole, quoted: null, quotedLineCount: 0 };
    }

    const mainLines = lines.slice(0, start);
    while (mainLines.length > 0 && (mainLines[mainLines.length - 1] ?? '').trim() === '') {
        mainLines.pop();
    }
    if (mainLines.length === 0) {
        return { main: whole, quoted: null, quotedLineCount: 0 };
    }

    const quotedLines = lines.slice(start);
    while (quotedLines.length > 0 && (quotedLines[quotedLines.length - 1] ?? '').trim() === '') {
        quotedLines.pop();
    }
    const quoted = quotedLines.join('\n');
    return { main: mainLines.join('\n'), quoted, quotedLineCount: quotedLines.length };
}

/**
 * The backend's `origin` when it sent one; otherwise the same verdict derived from the raw
 * fields an older backend exposes (a UUID in `source` on an inbound row is the parent
 * outbound log id, i.e. a reply).
 */
export function resolveOrigin(msg: EmailOriginInput): EmailOrigin {
    if (msg.origin) return msg.origin as EmailOrigin;
    if (msg.direction === 'OUTGOING') return 'EMAIL';
    if (msg.system || isSystemSender(msg.counterpartyEmail, msg.subject)) return 'BOUNCE';
    return looksLikeUuid(msg.source) ? 'REPLY' : 'INCOMING';
}

/** True for bounces and other mail-system notices, whichever side of the contract produced them. */
export function isSystemMessage(msg: EmailOriginInput): boolean {
    return !!msg.system || resolveOrigin(msg) === 'BOUNCE';
}
