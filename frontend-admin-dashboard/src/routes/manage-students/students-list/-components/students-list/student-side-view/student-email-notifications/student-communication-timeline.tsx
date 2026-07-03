import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getUserCommunications,
    type CommunicationItem,
    type StatusEvent,
} from '@/services/communication-timeline-service';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { formatDistanceToNow, format } from 'date-fns';
import {
    ChatsCircle,
    Envelope,
    EnvelopeSimple,
    WhatsappLogo,
    BellRinging,
    ChatTeardrop,
    ArrowUp,
    ArrowDown,
    CaretDown,
    CaretUp,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { IndividualSendDialog } from './individual-send-dialog';
import { UnsubscribeButtons } from './UnsubscribeButtons';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileTimeline,
    type ProfileTimelineItem,
} from '../profile-ui';

// ─── HTML helpers ──────────────────────────────────────────────────────────
// The communication-timeline service often returns the raw email HTML in
// `title` / `bodyPreview` (e.g. starting with `<!DOCTYPE html>`). Showing that
// verbatim makes the timeline unreadable, so we strip tags client-side.

const HTML_LIKE = /^\s*<!?(?:DOCTYPE|html|head|body|div|p|span|table|tr|td|h\d|br|meta)\b/i;

const looksLikeHtml = (text?: string | null): boolean =>
    !!text && (HTML_LIKE.test(text) || /<[a-z][^>]*>/i.test(text));

// Decode the small set of named entities that show up in real emails. We
// intentionally avoid setting innerHTML on a temporary node here — that runs
// linked images and would broaden the XSS surface; a regex pass is enough for
// preview text.
const decodeEntities = (text: string): string =>
    text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// Plain-text version of an HTML string, suitable for one-line previews.
const htmlToPreviewText = (html: string, maxLen = 140): string => {
    const stripped = html
        // drop <style>/<script> blocks entirely so their CSS/JS doesn't
        // leak into the preview
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        // strip every remaining complete tag
        .replace(/<[^>]+>/g, ' ')
        // strip a dangling/unclosed tag — backend previews are often HTML cut
        // mid-tag (e.g. "<table align='center' width='600' style='...mar"), which
        // has no closing ">" so the rule above can't remove it.
        .replace(/<[^>]*$/g, ' ');
    const text = decodeEntities(stripped).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > maxLen ? `${text.slice(0, maxLen).trimEnd()}…` : text;
};

// Best-effort subject extraction: prefer the document's <title>, fall back to
// the first heading, and finally to a truncated text preview.
const extractEmailSubject = (rawTitle: string | undefined, body?: string): string => {
    const candidates = [rawTitle, body].filter(Boolean) as string[];
    for (const c of candidates) {
        const titleMatch = c.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch?.[1]) {
            const decoded = decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim();
            if (decoded) return decoded;
        }
        const h1 = c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1?.[1]) {
            const decoded = decodeEntities(h1[1].replace(/<[^>]+>/g, ' '))
                .replace(/\s+/g, ' ')
                .trim();
            if (decoded) return decoded;
        }
    }
    if (rawTitle && !looksLikeHtml(rawTitle)) {
        const t = rawTitle.trim();
        if (t) return t;
    }
    if (body) {
        const fallback = htmlToPreviewText(body, 80);
        if (fallback) return fallback;
    }
    return '(no subject)';
};

// ─── Channel Config ─────────────────────────────────────────────────────────
// Colors use design-system semantic tokens: info for email, success for WhatsApp,
// primary for push notifications, warning for SMS.

const CHANNEL_CONFIG: Record<
    string,
    { icon: PhosphorIcon; pillClass: string; iconClass: string; label: string }
> = {
    EMAIL: {
        icon: Envelope,
        pillClass: 'bg-info-50 text-info-700 ring-1 ring-info-200',
        iconClass: 'text-info-600',
        label: 'Email',
    },
    WHATSAPP: {
        icon: WhatsappLogo,
        pillClass: 'bg-success-50 text-success-700 ring-1 ring-success-200',
        iconClass: 'text-success-600',
        label: 'WhatsApp',
    },
    PUSH: {
        icon: BellRinging,
        pillClass: 'bg-primary-50 text-primary-700 ring-1 ring-primary-200',
        iconClass: 'text-primary-600',
        label: 'Push',
    },
    SMS: {
        icon: ChatTeardrop,
        pillClass: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200',
        iconClass: 'text-warning-600',
        label: 'SMS',
    },
};

// Status pill classes use semantic tokens only (no raw colors).
const STATUS_CONFIG: Record<string, { pillClass: string; label: string }> = {
    PENDING: {
        pillClass: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200',
        label: 'Pending',
    },
    SENT: {
        pillClass: 'bg-info-50 text-info-700 ring-1 ring-info-200',
        label: 'Sent',
    },
    DELIVERED: {
        pillClass: 'bg-success-50 text-success-700 ring-1 ring-success-200',
        label: 'Delivered',
    },
    READ: {
        pillClass: 'bg-success-50 text-success-700 ring-1 ring-success-200',
        label: 'Read',
    },
    CLICKED: {
        pillClass: 'bg-primary-50 text-primary-700 ring-1 ring-primary-200',
        label: 'Clicked',
    },
    FAILED: {
        pillClass: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200',
        label: 'Failed',
    },
    BOUNCED: {
        pillClass: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200',
        label: 'Bounced',
    },
    COMPLAINT: {
        pillClass: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200',
        label: 'Complaint',
    },
    RECEIVED: {
        pillClass: 'bg-info-50 text-info-700 ring-1 ring-info-200',
        label: 'Received',
    },
};

const FILTER_OPTIONS = [
    { key: 'ALL', label: 'All' },
    { key: 'EMAIL', label: 'Email' },
    { key: 'WHATSAPP', label: 'WhatsApp' },
    { key: 'PUSH', label: 'Push' },
] as const;

// ─── Status Mini Timeline ───────────────────────────────────────────────────

const STATUS_FLOW_EMAIL = ['SENT', 'DELIVERED', 'READ', 'CLICKED'];

function StatusMiniTimeline({ events, status }: { events: StatusEvent[]; status: string }) {
    const flow = STATUS_FLOW_EMAIL;
    const achieved = new Set(events.map((e) => e.status));
    // Also mark the current status
    achieved.add(status);

    return (
        <div className="mt-1.5 flex items-center gap-1">
            {flow.map((step, i) => {
                const active = achieved.has(step);
                return (
                    <div key={step} className="flex items-center gap-1">
                        <div
                            className={cn(
                                'size-2 rounded-full transition-colors',
                                active ? 'bg-success-500' : 'bg-neutral-200'
                            )}
                            title={step}
                        />
                        {i < flow.length - 1 && (
                            <div
                                className={cn(
                                    'h-px w-3',
                                    active ? 'bg-success-300' : 'bg-neutral-200'
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Date Separator ─────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: Date }) {
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs font-medium text-neutral-500">
                {format(date, 'MMM d, yyyy')}
            </span>
            <div className="h-px flex-1 bg-neutral-200" />
        </div>
    );
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

function StatusPill({ statusKey }: { statusKey: string }) {
    const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.PENDING!;
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                cfg.pillClass
            )}
        >
            {cfg.label}
        </span>
    );
}

// ─── Expanded Detail Body ───────────────────────────────────────────────────
// Rendered as the `body` slot of a ProfileTimelineItem when the item is
// expanded.  Click propagation is stopped so expanding text-selection inside
// the email HTML doesn't collapse the item.

function ExpandedDetail({
    item,
    onCollapse,
}: {
    item: CommunicationItem;
    onCollapse: () => void;
}) {
    const isEmail = item.channel === 'EMAIL';
    const subject = isEmail
        ? extractEmailSubject(item.title, item.fullBody || item.bodyPreview)
        : item.title;

    return (
        <div
            className="mt-2 space-y-3 border-t border-neutral-100 pt-3"
            onClick={(e) => e.stopPropagation()}
        >
            {/* EMAIL → render as an email-client card (Gmail-like): a sender row
                with a red envelope avatar + from/date/to, then the subject, then
                the email's own HTML body. Non-email channels keep the plain
                Message box. */}
            {isEmail && item.fullBody ? (
                <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {/* Header: sender identity + timestamp + recipient */}
                    <div className="flex items-start gap-2.5 border-b border-neutral-100 bg-neutral-50/70 px-3 py-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                            <EnvelopeSimple weight="fill" className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <span
                                    className="truncate text-xs font-semibold text-neutral-800"
                                    title={item.senderInfo || undefined}
                                >
                                    {item.senderInfo || 'Email'}
                                </span>
                                <span className="shrink-0 text-2xs text-neutral-400">
                                    {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                                </span>
                            </div>
                            {item.recipientInfo && (
                                <div
                                    className="truncate text-2xs text-neutral-500"
                                    title={item.recipientInfo}
                                >
                                    to {item.recipientInfo}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Subject */}
                    {subject && (
                        <p className="px-3 pt-2.5 text-xs font-semibold text-neutral-900">
                            {subject}
                        </p>
                    )}
                    {/* Body — the email's own HTML, contained so wide markup scrolls
                        inside this box instead of widening the panel. */}
                    <div
                        className="max-h-96 max-w-full overflow-auto px-3 pb-3 pt-2 text-xs text-neutral-800 [&_img]:max-w-full [&_table]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: item.fullBody }}
                    />
                </div>
            ) : (
                item.fullBody && (
                    <div className="rounded-md border border-neutral-100 bg-neutral-50 p-2.5">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Message
                        </p>
                        <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-xs text-neutral-700">
                            {item.fullBody}
                        </p>
                    </div>
                )
            )}

            {/* Template name */}
            {item.templateName && (
                <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-neutral-500">Template:</span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700">
                        {item.templateName}
                    </span>
                </div>
            )}

            {/* Sender / Recipient / Source — From/To already live in the email
                header above, so for email we only surface Source here. */}
            <div className="space-y-1 text-xs">
                {!isEmail && item.senderInfo && (
                    <div className="flex gap-2">
                        <span className="font-medium text-neutral-500">From:</span>
                        <span className="text-neutral-700">{item.senderInfo}</span>
                    </div>
                )}
                {!isEmail && item.recipientInfo && (
                    <div className="flex gap-2">
                        <span className="font-medium text-neutral-500">To:</span>
                        <span className="text-neutral-700">{item.recipientInfo}</span>
                    </div>
                )}
                {item.source && (
                    <div className="flex gap-2">
                        <span className="font-medium text-neutral-500">Source:</span>
                        <span className="text-neutral-700">{item.source}</span>
                    </div>
                )}
            </div>

            {/* Status delivery timeline */}
            {item.statusTimeline && item.statusTimeline.length > 0 && (
                <div>
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Delivery Timeline</p>
                    <div className="space-y-1.5">
                        {item.statusTimeline.map((event, i) => (
                            <div
                                key={`${event.status}-${event.timestamp}-${i}`}
                                className="flex items-center gap-2 text-xs"
                            >
                                <div className="size-1.5 rounded-full bg-neutral-300" />
                                <StatusPill statusKey={event.status} />
                                <span className="text-neutral-500">
                                    {format(new Date(event.timestamp), 'MMM d, h:mm a')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={onCollapse}
                className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
                <CaretUp className="size-3" />
                Collapse
            </button>
        </div>
    );
}

// ─── Communication Timeline Item (card body for ProfileTimeline) ─────────────
// This component is rendered inside the `body` slot of each ProfileTimelineItem.
// It provides the expand/collapse interaction with preview text and delivery
// status dots — all behaviour the spec requires to be preserved.

function CommItemBody({ item }: { item: CommunicationItem }) {
    const [expanded, setExpanded] = useState(false);
    const channel = CHANNEL_CONFIG[item.channel] ?? CHANNEL_CONFIG.EMAIL!;
    const isInbound = item.direction === 'INBOUND';

    const isEmail = item.channel === 'EMAIL';
    // For emails prefer the COMPLETE fullBody — the backend's bodyPreview is often
    // HTML truncated mid-tag, which has no real text to extract. Fall back to
    // bodyPreview when fullBody is absent.
    const rawPreview = isEmail
        ? item.fullBody || item.bodyPreview || ''
        : item.bodyPreview || '';
    const displayPreview = looksLikeHtml(rawPreview)
        ? htmlToPreviewText(rawPreview, 160)
        : rawPreview;

    return (
        <div
            className="cursor-pointer select-none rounded-md border border-neutral-100 bg-neutral-50 p-2.5 transition-shadow hover:shadow-sm"
            onClick={() => setExpanded((v) => !v)}
        >
            {/* Direction label row */}
            <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    {isInbound ? (
                        <ArrowDown className="size-3 shrink-0 text-success-500" />
                    ) : (
                        <ArrowUp className="size-3 shrink-0 text-info-500" />
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        {isInbound ? 'Received' : 'Sent'} via {channel.label}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <StatusPill statusKey={item.status} />
                    {expanded ? (
                        <CaretUp className="size-3 text-neutral-400" />
                    ) : (
                        <CaretDown className="size-3 text-neutral-400" />
                    )}
                </div>
            </div>

            {/* Body preview */}
            {!expanded && displayPreview && (
                <p className="line-clamp-2 text-xs text-neutral-600">{displayPreview}</p>
            )}

            {/* Timestamp + mini delivery dots */}
            <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>
                {item.channel === 'EMAIL' && !isInbound && (
                    <StatusMiniTimeline events={item.statusTimeline || []} status={item.status} />
                )}
            </div>

            {/* Expanded details */}
            {expanded && (
                <ExpandedDetail item={item} onCollapse={() => setExpanded(false)} />
            )}
        </div>
    );
}

// ─── Map a CommunicationItem → ProfileTimelineItem ───────────────────────────

function toTimelineItem(item: CommunicationItem): ProfileTimelineItem {
    const channel = CHANNEL_CONFIG[item.channel] ?? CHANNEL_CONFIG.EMAIL!;
    const isEmail = item.channel === 'EMAIL';
    const displayTitle = isEmail
        ? extractEmailSubject(item.title, item.fullBody || item.bodyPreview)
        : item.title || '(no subject)';

    // Tone: direction-based — outbound=primary, inbound=success, failed/bounced=danger
    const failedStatuses = new Set(['FAILED', 'BOUNCED', 'COMPLAINT']);
    const tone =
        failedStatuses.has(item.status)
            ? 'danger'
            : item.direction === 'INBOUND'
              ? 'success'
              : 'primary';

    return {
        id: item.id,
        icon: channel.icon,
        tone,
        title: (
            <span className="truncate font-medium text-neutral-800" title={displayTitle}>
                {displayTitle}
            </span>
        ),
        meta: formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }),
        body: <CommItemBody item={item} />,
    };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const StudentCommunicationTimeline = () => {
    const { selectedStudent } = useStudentSidebar();
    const [page, setPage] = useState(0);
    const [channelFilter, setChannelFilter] = useState<string>('ALL');
    const pageSize = 20;
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id ?? '';
    const [sendDialog, setSendDialog] = useState<'EMAIL' | 'WHATSAPP' | null>(null);

    const email = selectedStudent?.email || undefined;
    const phone = selectedStudent?.mobile_number || undefined;
    const hasContact = !!(email || phone);

    const {
        data: timelineData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['communication-timeline', email, phone, page, channelFilter],
        queryFn: () =>
            getUserCommunications({
                email,
                phone,
                page,
                size: pageSize,
                channels: channelFilter === 'ALL' ? undefined : [channelFilter],
            }),
        enabled: hasContact,
        staleTime: 30000,
    });

    // ─── Guard states ────────────────────────────────────────────────────────

    if (!hasContact) {
        return (
            <ProfileEmpty
                icon={Envelope}
                title="No contact details"
                hint="Select a student with an email or phone number to view their communications."
            />
        );
    }

    if (isLoading) {
        return <ProfileSkeleton blocks={3} />;
    }

    if (error) {
        return (
            <ProfileError
                title="Failed to load communications"
                hint="Something went wrong while fetching messages. Please try again."
                onRetry={() => void refetch()}
            />
        );
    }

    const communications = timelineData?.content || [];

    // Group by date for separators
    const groupedItems: Array<
        { type: 'date'; date: Date } | { type: 'item'; item: CommunicationItem }
    > = [];
    let lastDate: string | null = null;

    for (const item of communications) {
        const itemDate = new Date(item.timestamp);
        const dateKey = format(itemDate, 'yyyy-MM-dd');
        if (dateKey !== lastDate) {
            groupedItems.push({ type: 'date', date: itemDate });
            lastDate = dateKey;
        }
        groupedItems.push({ type: 'item', item });
    }

    // Count by channel for filter chip badges
    const channelCounts = communications.reduce(
        (acc, item) => {
            acc[item.channel] = (acc[item.channel] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* ── Send Notification card (matches production) ──────────────── */}
            <div className="rounded-lg border border-neutral-200 bg-card p-3">
                <div className="mb-2 flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info-50 text-info-600">
                        <BellRinging className="size-4" weight="duotone" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-neutral-800">
                            Send Notification
                        </h4>
                        <p className="text-2xs text-neutral-500">Email or WhatsApp message</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={!selectedStudent?.email}
                        onClick={() => {
                            if (selectedStudent) setSendDialog('EMAIL');
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 border-info-200 text-info-700 hover:border-info-300 hover:bg-info-50"
                    >
                        <Envelope className="size-3.5" />
                        Email
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={!selectedStudent?.mobile_number}
                        onClick={() => {
                            if (selectedStudent) setSendDialog('WHATSAPP');
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 border-success-200 text-success-700 hover:border-success-300 hover:bg-success-50"
                    >
                        <WhatsappLogo className="size-3.5" />
                        WhatsApp
                    </MyButton>
                </div>
            </div>

            {/* ── Promotional unsubscribe (admin-only) ─────────────────────── */}
            <UnsubscribeButtons />

            {/* ── Channel filter chips ─────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                {FILTER_OPTIONS.map((opt) => (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                            setChannelFilter(opt.key);
                            setPage(0);
                        }}
                        className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                            channelFilter === opt.key
                                ? 'bg-primary-500 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        )}
                    >
                        {opt.label}
                        {opt.key !== 'ALL' && channelCounts[opt.key] ? (
                            <span className="ml-1 opacity-75">({channelCounts[opt.key]})</span>
                        ) : null}
                    </button>
                ))}
                {timelineData?.totalElements != null && (
                    <span className="ml-auto text-xs text-neutral-400">
                        {timelineData.totalElements} total
                    </span>
                )}
            </div>

            {/* ── Timeline or empty state ──────────────────────────────────── */}
            {communications.length === 0 ? (
                <ProfileEmpty
                    icon={ChatsCircle}
                    title="No communications found"
                    hint={
                        channelFilter !== 'ALL'
                            ? `No ${channelFilter.toLowerCase()} messages yet. Try selecting "All" to see other channels.`
                            : 'No messages have been sent to or received from this student yet.'
                    }
                    action={
                        channelFilter === 'ALL' ? (
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="small"
                                onClick={() => {
                                    if (selectedStudent) setSendDialog('EMAIL');
                                }}
                                className="flex items-center gap-1.5"
                            >
                                <Envelope className="size-3.5" />
                                Send first message
                            </MyButton>
                        ) : undefined
                    }
                />
            ) : (
                /* Render date separators interleaved with ProfileTimeline groups.
                   We collect consecutive items between separators and pass each
                   batch to a ProfileTimeline so the vertical spine line is
                   contained within each date group. */
                <div className="flex flex-col gap-2">
                    {(() => {
                        const sections: Array<
                            | { type: 'date'; date: Date; key: string }
                            | { type: 'group'; items: ProfileTimelineItem[]; key: string }
                        > = [];
                        let currentGroup: ProfileTimelineItem[] = [];

                        for (const entry of groupedItems) {
                            if (entry.type === 'date') {
                                if (currentGroup.length > 0) {
                                    sections.push({
                                        type: 'group',
                                        items: currentGroup,
                                        key: `group-before-${entry.date.toISOString()}`,
                                    });
                                    currentGroup = [];
                                }
                                sections.push({
                                    type: 'date',
                                    date: entry.date,
                                    key: `date-${entry.date.toISOString()}`,
                                });
                            } else {
                                currentGroup.push(toTimelineItem(entry.item));
                            }
                        }
                        if (currentGroup.length > 0) {
                            sections.push({
                                type: 'group',
                                items: currentGroup,
                                key: `group-final`,
                            });
                        }

                        return sections.map((s) =>
                            s.type === 'date' ? (
                                <DateSeparator key={s.key} date={s.date} />
                            ) : (
                                <ProfileTimeline key={s.key} items={s.items} />
                            )
                        );
                    })()}
                </div>
            )}

            {/* ── Pagination ───────────────────────────────────────────────── */}
            {timelineData && timelineData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-neutral-200 pt-4">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={page === 0}
                        onClick={() => setPage(Math.max(0, page - 1))}
                    >
                        Previous
                    </MyButton>
                    <span className="text-xs text-neutral-500">
                        Page {page + 1} of {timelineData.totalPages}
                    </span>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={page >= timelineData.totalPages - 1}
                        onClick={() => setPage(Math.min(timelineData.totalPages - 1, page + 1))}
                    >
                        Next
                    </MyButton>
                </div>
            )}

            {/* ── Send dialog (existing — behavior unchanged) ───────────────── */}
            {sendDialog && (
                <IndividualSendDialog
                    open={!!sendDialog}
                    onOpenChange={(o) => {
                        if (!o) {
                            setSendDialog(null);
                            // Refresh the timeline so the just-sent message shows up.
                            void refetch();
                        }
                    }}
                    student={selectedStudent}
                    channel={sendDialog}
                    instituteId={instituteId}
                />
            )}
        </div>
    );
};
