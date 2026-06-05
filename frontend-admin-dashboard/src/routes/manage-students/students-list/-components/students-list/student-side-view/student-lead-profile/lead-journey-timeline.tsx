import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_ALL_LEAD_EVENTS } from '@/constants/urls';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { MyButton } from '@/components/design-system/button';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchCallRecordingUrl } from '@/components/shared/leads';
import {
    Path,
    UserPlus,
    UserCheck,
    ArrowsLeftRight,
    TrendUp,
    TrendDown,
    CalendarCheck,
    ChatCircle,
    CheckCircle,
    XCircle,
    GitMerge,
    CurrencyCircleDollar,
    GraduationCap,
    Warning,
    ArrowRight,
    PencilSimple,
    Note,
    Phone,
    PlayCircle,
    DownloadSimple,
    CaretDown,
    CaretUp,
    ArrowsClockwise,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineEvent {
    id: string;
    type: string;
    type_id: string;
    action_type: string;
    actor_type: string;
    actor_name: string | null;
    title: string;
    description: string | null;
    metadata: Record<string, unknown> | null;
    category: 'JOURNEY' | 'ACTIVITY';
    is_pinned: boolean;
    created_at: string;
}

interface EventPage {
    content: TimelineEvent[];
    totalElements: number;
    totalPages: number;
    last: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchAllEvents(
    userId: string,
    responseId: string | null | undefined,
    page: number,
    size: number,
): Promise<EventPage> {
    const params: Record<string, unknown> = { page, size };
    // Pass responseId as typeIds so legacy journey events (stored with type_id=responseId
    // but null student_user_id) are also included in the OR query.
    if (responseId) params['typeIds'] = responseId;
    const res = await authenticatedAxiosInstance.get(GET_ALL_LEAD_EVENTS(userId), { params });
    return res.data;
}

// ── Event config ──────────────────────────────────────────────────────────────

type ActionConfig = {
    Icon: PhosphorIcon;
    dotBg: string;
    iconColor: string;
    label: string;
};

const ACTION_CONFIG: Record<string, ActionConfig> = {
    // JOURNEY events
    LEAD_SUBMITTED: {
        Icon: UserPlus,
        dotBg: 'bg-info-50 ring-info-200',
        iconColor: 'text-info-600',
        label: 'Lead Submitted',
    },
    COUNSELOR_ASSIGNED: {
        Icon: UserCheck,
        dotBg: 'bg-primary-50 ring-primary-200',
        iconColor: 'text-primary-600',
        label: 'Counselor Assigned',
    },
    STATUS_CHANGED: {
        Icon: ArrowsLeftRight,
        dotBg: 'bg-secondary ring-border',
        iconColor: 'text-muted-foreground',
        label: 'Status Changed',
    },
    SCORE_UPDATED: {
        Icon: TrendUp,
        dotBg: 'bg-warning-50 ring-warning-200',
        iconColor: 'text-warning-600',
        label: 'Score Updated',
    },
    MANUAL_SCORE_UPDATE: {
        Icon: PencilSimple,
        dotBg: 'bg-primary-50 ring-primary-200',
        iconColor: 'text-primary-600',
        label: 'Manual Score',
    },
    FOLLOWUP: {
        Icon: CalendarCheck,
        dotBg: 'bg-info-50 ring-info-200',
        iconColor: 'text-info-500',
        label: 'Follow-up',
    },
    REACHOUT: {
        Icon: ChatCircle,
        dotBg: 'bg-primary-50 ring-primary-200',
        iconColor: 'text-primary-500',
        label: 'Reachout',
    },
    LEAD_CONVERTED: {
        Icon: CheckCircle,
        dotBg: 'bg-success-50 ring-success-300',
        iconColor: 'text-success-600',
        label: 'Converted',
    },
    LEAD_LOST: {
        Icon: XCircle,
        dotBg: 'bg-danger-50 ring-danger-200',
        iconColor: 'text-danger-600',
        label: 'Lead Lost',
    },
    DUPLICATE_MERGED: {
        Icon: GitMerge,
        dotBg: 'bg-warning-50 ring-warning-200',
        iconColor: 'text-warning-600',
        label: 'Duplicate Merged',
    },
    PAYMENT_RECEIVED: {
        Icon: CurrencyCircleDollar,
        dotBg: 'bg-success-50 ring-success-200',
        iconColor: 'text-success-600',
        label: 'Payment Received',
    },
    ENROLLMENT_COMPLETED: {
        Icon: GraduationCap,
        dotBg: 'bg-success-50 ring-success-200',
        iconColor: 'text-success-700',
        label: 'Enrolled',
    },
    // ACTIVITY events
    NOTE: {
        Icon: Note,
        dotBg: 'bg-secondary ring-border',
        iconColor: 'text-neutral-500',
        label: 'Note',
    },
    CALL: {
        Icon: Phone,
        dotBg: 'bg-secondary ring-border',
        iconColor: 'text-neutral-500',
        label: 'Call',
    },
    // Outbound call placed via the telephony integration (Exotel etc.).
    // Recording playback is rendered inline in EventMeta when a
    // recording_storage_key is present on the metadata.
    CALL_MADE: {
        Icon: Phone,
        dotBg: 'bg-primary-50 ring-primary-200',
        iconColor: 'text-primary-600',
        label: 'Outbound Call',
    },
    WALK_IN_NOTE: {
        Icon: Note,
        dotBg: 'bg-secondary ring-border',
        iconColor: 'text-neutral-500',
        label: 'Walk-in Note',
    },
    FOLLOWUP_SCHEDULED: {
        Icon: CalendarCheck,
        dotBg: 'bg-info-50 ring-info-200',
        iconColor: 'text-info-500',
        label: 'Follow-up Scheduled',
    },
    STATUS_CHANGE: {
        Icon: ArrowsLeftRight,
        dotBg: 'bg-secondary ring-border',
        iconColor: 'text-muted-foreground',
        label: 'Status Changed',
    },
};

const FALLBACK_CONFIG: ActionConfig = {
    Icon: Warning,
    dotBg: 'bg-secondary ring-border',
    iconColor: 'text-muted-foreground',
    label: 'Event',
};

function getConfig(actionType: string): ActionConfig {
    return ACTION_CONFIG[actionType] ?? FALLBACK_CONFIG;
}

// ── Metadata renderers ────────────────────────────────────────────────────────

function StatusChangeMeta({ meta }: { meta: Record<string, unknown> }) {
    const from = (meta.from_status_label as string) || (meta.from_status_key as string) || (meta.old_status as string) || null;
    const to =
        (meta.to_status_label as string) ||
        (meta.to_status_key as string) ||
        (meta.new_status as string) ||
        null;
    if (!from && !to) return null;
    return (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {from ? (
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {from}
                </span>
            ) : (
                <span className="text-xs text-muted-foreground italic">Previous</span>
            )}
            <ArrowRight weight="bold" className="size-3 shrink-0 text-muted-foreground" />
            {to && (
                <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">
                    {to}
                </span>
            )}
        </div>
    );
}

function ScoreUpdateMeta({ meta }: { meta: Record<string, unknown> }) {
    const oldScore = meta.old_score as number | undefined;
    const newScore = meta.new_score as number | undefined;
    const tier = meta.tier as string | undefined;
    if (newScore === undefined) return null;
    const improved = oldScore === undefined || newScore >= oldScore;
    const TierIcon = improved ? TrendUp : TrendDown;
    const tierColor =
        tier === 'HOT'
            ? 'bg-danger-50 text-danger-600 border-danger-200'
            : tier === 'WARM'
              ? 'bg-warning-50 text-warning-700 border-warning-200'
              : 'bg-info-50 text-info-600 border-info-200';

    return (
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
                {oldScore !== undefined && (
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {oldScore}
                    </span>
                )}
                <TierIcon
                    weight="bold"
                    className={cn('size-3.5', improved ? 'text-success-500' : 'text-danger-500')}
                />
                <span
                    className={cn(
                        'text-xs font-bold tabular-nums',
                        improved ? 'text-success-600' : 'text-danger-600',
                    )}
                >
                    {newScore}
                </span>
            </div>
            <div className="h-1.5 w-16 rounded-full bg-neutral-100 overflow-hidden">
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-300',
                        improved ? 'bg-success-400' : 'bg-danger-400',
                    )}
                    style={{ width: `${newScore}%` }} /* dynamic score % — cannot use Tailwind token */
                />
            </div>
            {tier && (
                <span
                    className={cn(
                        'rounded-full border px-1.5 py-0.5 text-xs font-semibold',
                        tierColor,
                    )}
                >
                    {tier}
                </span>
            )}
        </div>
    );
}

function CounselorMeta({ meta }: { meta: Record<string, unknown> }) {
    const name = meta.counselor_name as string | undefined;
    const source = meta.assignment_source as string | undefined;
    if (!name && !meta.counselor_id) return null;
    const initial = name?.[0]?.toUpperCase() ?? '?';
    return (
        <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                {initial}
            </div>
            <span className="text-xs font-medium text-neutral-700">{name ?? 'Unknown'}</span>
            {source && (
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground border border-border">
                    {source === 'AUTO' ? 'Auto (pool)' : 'Manual'}
                </span>
            )}
        </div>
    );
}

function SourceMeta({ meta }: { meta: Record<string, unknown> }) {
    const source = meta.source_type as string | undefined;
    if (!source) return null;
    return (
        <div className="mt-1.5">
            <span className="rounded-full border border-info-200 bg-info-50 px-2 py-0.5 text-xs font-medium text-info-600">
                {source.replace(/_/g, ' ')}
            </span>
        </div>
    );
}

function FollowupMeta({ meta }: { meta: Record<string, unknown> }) {
    const scheduleTime = meta.scheduleTime as string | number | undefined;
    if (!scheduleTime) return null;
    // Handles: epoch ms number, epoch ms string, or legacy SQL timestamp string "2026-05-23 02:40:53.228"
    const asNumber = typeof scheduleTime === 'number' ? scheduleTime : Number(scheduleTime);
    const d = isNaN(asNumber)
        ? new Date(String(scheduleTime).replace(' ', 'T'))
        : new Date(asNumber);
    const isValid = !isNaN(d.getTime());
    if (!isValid) return null;
    return (
        <div className="mt-1.5 flex items-center gap-1.5">
            <CalendarCheck weight="fill" className="size-3.5 text-info-500 shrink-0" />
            <span className="text-xs font-medium text-neutral-700">
                {format(d, 'MMM d, yyyy · h:mm a')}
            </span>
        </div>
    );
}

/**
 * CallRecordingMeta — inline player + download for an Outbound Call event.
 *
 * The recording mp3 lives in our media_service (uploaded by the backend
 * after Exotel delivers the StatusCallback). The presigned URL is fetched
 * lazily on first Play click and reused for Download so we don't trigger
 * two presign round-trips per recording.
 *
 * NOT-A-BUG: the raw Exotel URL in the row's `recording_url` column does
 * require HTTP Basic Auth (our Exotel API creds). That URL is purely a
 * server-side breadcrumb — the UI never touches it. We always go through
 * GET /telephony/calls/{id}/recording, which returns a presigned URL from
 * our media_service that the browser can play directly.
 */
function CallRecordingMeta({
    title,
    description,
    meta,
}: {
    title: string;
    description: string | null;
    meta: Record<string, unknown>;
}) {
    const instituteId = getCurrentInstituteId() ?? '';
    const callLogId = typeof meta.call_log_id === 'string' ? meta.call_log_id : null;
    const callerId = typeof meta.caller_id === 'string' ? meta.caller_id : null;
    const status = typeof meta.status === 'string' ? meta.status : null;
    const durationSeconds =
        typeof meta.duration_seconds === 'number'
            ? meta.duration_seconds
            : null;
    const hasRecording = typeof meta.recording_storage_key === 'string';

    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const resolveUrl = async (): Promise<string | null> => {
        if (url) return url;
        if (!callLogId || !instituteId) return null;
        setLoading(true);
        try {
            const fetched = await fetchCallRecordingUrl(callLogId, instituteId);
            setUrl(fetched);
            return fetched;
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-1.5 space-y-1.5 text-xs text-muted-foreground">
            {/* Top line: status pill + duration + caller-ID */}
            <div className="flex flex-wrap items-center gap-1.5">
                {status && (
                    <span
                        className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                            status === 'COMPLETED'
                                ? 'bg-success-50 text-success-700'
                                : status === 'NO_ANSWER' || status === 'BUSY'
                                ? 'bg-warning-50 text-warning-700'
                                : status === 'FAILED' || status === 'CANCELLED'
                                ? 'bg-danger-50 text-danger-700'
                                : 'bg-neutral-100 text-neutral-600'
                        )}
                    >
                        {formatStatus(status)}
                    </span>
                )}
                {durationSeconds != null && durationSeconds > 0 && (
                    <span className="text-neutral-600">{formatDuration(durationSeconds)}</span>
                )}
                {callerId && (
                    <span className="text-neutral-400">· from {callerId}</span>
                )}
            </div>

            {description && status == null && (
                <p className="leading-relaxed">{description}</p>
            )}

            {hasRecording && (
                <div className="pt-0.5">
                    {url ? (
                        <div className="space-y-1.5">
                            <audio
                                controls
                                src={url}
                                preload="metadata"
                                className="w-full max-w-md"
                            />
                            <a
                                href={url}
                                download={`call-${callLogId}.mp3`}
                                className="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline"
                            >
                                <DownloadSimple className="size-3" />
                                Download
                            </a>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={resolveUrl}
                            disabled={loading || !callLogId}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] text-neutral-700 transition-colors',
                                loading || !callLogId
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'hover:bg-neutral-50 hover:border-primary-300'
                            )}
                        >
                            <PlayCircle className="size-3.5" />
                            {loading ? 'Loading…' : 'Play recording'}
                        </button>
                    )}
                </div>
            )}

            {/* Suppress title-only display for CALL_MADE — the pill row above
                already conveys "Outbound call · 0m 23s · Connected". */}
            <span className="sr-only">{title}</span>
        </div>
    );
}

function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m === 0 ? `${s}s` : `${m}m ${s}s`;
}

function formatStatus(status: string): string {
    switch (status) {
        case 'COMPLETED':
            return 'Connected';
        case 'NO_ANSWER':
            return 'No answer';
        case 'BUSY':
            return 'Busy';
        case 'FAILED':
            return 'Failed';
        case 'CANCELLED':
            return 'Cancelled';
        case 'IN_PROGRESS':
            return 'In progress';
        case 'COUNSELLOR_RINGING':
        case 'COUNSELLOR_ANSWERED':
            return 'Ringing';
        case 'QUEUED':
            return 'Queued';
        default:
            return status;
    }
}

function EventMeta({ event }: { event: TimelineEvent }) {
    const meta = event.metadata ?? {};
    switch (event.action_type) {
        case 'STATUS_CHANGED':
        case 'LEAD_CONVERTED':
        case 'LEAD_LOST':
        case 'STATUS_CHANGE':
            return <StatusChangeMeta meta={meta} />;
        case 'SCORE_UPDATED':
        case 'MANUAL_SCORE_UPDATE':
            return <ScoreUpdateMeta meta={meta} />;
        case 'COUNSELOR_ASSIGNED':
            return <CounselorMeta meta={meta} />;
        case 'LEAD_SUBMITTED':
            return <SourceMeta meta={meta} />;
        case 'FOLLOWUP_SCHEDULED':
        case 'FOLLOWUP':
            return <FollowupMeta meta={meta} />;
        case 'CALL_MADE':
            return (
                <CallRecordingMeta
                    title={event.title}
                    description={event.description}
                    meta={meta}
                />
            );
        default:
            if (!event.description) return null;
            // Sanitize and render rich text (HTML from the RichTextEditor)
            return (
                <div
                    className="mt-1 text-xs text-muted-foreground leading-relaxed prose-xs [&_p]:m-0 [&_p+p]:mt-1"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
                />
            );
    }
}

// ── Single event row ───────────────────────────────────────────────────────────

function EventRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
    const config = getConfig(event.action_type);
    const { Icon, dotBg, iconColor } = config;
    const isConverted = event.action_type === 'LEAD_CONVERTED';
    const isLost = event.action_type === 'LEAD_LOST';
    const isTerminal = isConverted || isLost;
    const isActivity = event.category === 'ACTIVITY';
    const isSystem = event.actor_type === 'SYSTEM';
    // Backend sends raw DB timestamp without timezone (e.g. "2026-05-23T09:03:36.590").
    // Append IST offset so the browser interprets it correctly. Guard against
    // old events that still carry a timezone suffix (Z / +HH:MM).
    const rawTs = event.created_at ?? '';
    const hasOffset = rawTs.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(rawTs);
    const eventDate = new Date(hasOffset ? rawTs : rawTs + '+05:30');

    return (
        <div className="flex gap-3">
            {/* Left rail — always at same x, line stays aligned */}
            <div className="flex flex-col items-center">
                <div
                    className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full ring-2',
                        dotBg,
                        isTerminal && 'ring-offset-1',
                    )}
                >
                    <Icon weight="fill" className={cn('size-3.5', iconColor)} />
                </div>
                {!isLast && <div className="mt-1 w-px flex-1 bg-border min-h-6" />}
            </div>

            {/* Card */}
            <div
                className={cn(
                    'mb-4 flex-1 min-w-0 rounded-lg border px-3 py-2.5',
                    isActivity
                        ? 'border-border/60 bg-muted/30'
                        : isConverted
                          ? 'border-success-200 bg-success-50/60'
                          : isLost
                            ? 'border-danger-200 bg-danger-50/40'
                            : 'border-border bg-card',
                )}
            >
                <div className="flex items-start justify-between gap-2">
                    <p
                        className={cn(
                            'text-xs leading-tight truncate',
                            isActivity ? 'font-medium text-neutral-600' : 'font-semibold',
                            isConverted
                                ? 'text-success-700'
                                : isLost
                                  ? 'text-danger-700'
                                  : isActivity
                                    ? 'text-neutral-600'
                                    : 'text-neutral-800',
                        )}
                    >
                        {event.title}
                    </p>
                    <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {format(eventDate, 'd MMM yyyy, h:mm a')}
                    </time>
                </div>

                <EventMeta event={event} />

                {/* Actor line: "by name" for admins, "System" badge for system events */}
                <div className="mt-1.5 flex items-center gap-1.5">
                    {isSystem ? (
                        <span className="rounded-full bg-secondary border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                            System
                        </span>
                    ) : event.actor_name ? (
                        <p className="text-xs text-muted-foreground">
                            by{' '}
                            <span className="font-medium text-neutral-600">{event.actor_name}</span>
                        </p>
                    ) : null}
                    {isActivity && (
                        <span className="rounded-full bg-secondary border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                            Activity
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
    return (
        <div className="flex flex-col">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <Skeleton className="size-7 rounded-full" />
                        {i < 3 && <Skeleton className="mt-1 w-px flex-1 min-h-8" />}
                    </div>
                    <div className="mb-4 flex-1">
                        <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 text-center">
            <Path weight="duotone" className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">No events yet</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs">
                Events appear here as the lead progresses — submissions, scores, notes, and more
            </p>
        </div>
    );
}

// ── Main exported component ───────────────────────────────────────────────────

interface LeadJourneyTimelineProps {
    /** The student user ID — all events across all types are fetched by this */
    userId: string | null | undefined;
    /** The best-score audience response ID — included in typeIds to catch legacy journey events */
    responseId?: string | null;
}

export function LeadJourneyTimeline({ userId, responseId }: LeadJourneyTimelineProps) {
    const [open, setOpen] = useState(false);
    const [page, setPage] = useState(0);
    const pageSize = 50;
    const queryClient = useQueryClient();
    const queryKey = ['lead-all-events', userId, responseId, page];

    const { data, isLoading, isError, isFetching } = useQuery({
        queryKey,
        queryFn: () => fetchAllEvents(userId!, responseId, page, pageSize),
        enabled: open && !!userId,
        staleTime: 30 * 1000,
    });

    const totalCount = data?.totalElements;

    function handleRefresh(e: React.MouseEvent) {
        e.stopPropagation();
        queryClient.invalidateQueries({ queryKey });
    }

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'flex w-full cursor-pointer items-center gap-2 px-4 py-3 transition-colors duration-150',
                    'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    open && 'border-b border-border',
                )}
                aria-expanded={open}
            >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <Path weight="fill" className="size-3.5 text-primary-500" />
                </div>
                <span className="flex-1 text-left text-sm font-semibold text-neutral-700">
                    Lead Journey
                </span>
                {totalCount !== undefined && totalCount > 0 && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-600">
                        {totalCount}
                    </span>
                )}
                <button
                    onClick={handleRefresh}
                    className="flex size-5 items-center justify-center rounded-full hover:bg-muted transition-colors duration-150 cursor-pointer"
                    title="Refresh"
                    aria-label="Refresh journey events"
                >
                    <ArrowsClockwise
                        weight="bold"
                        className={cn('size-3.5 text-muted-foreground', isFetching && 'animate-spin')}
                    />
                </button>
                {open ? (
                    <CaretUp weight="bold" className="size-3.5 text-muted-foreground" />
                ) : (
                    <CaretDown weight="bold" className="size-3.5 text-muted-foreground" />
                )}
            </button>

            {open && (
                <div className="p-4">
                    {!userId && (
                        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-6 text-center">
                            <Path weight="duotone" className="size-7 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground">No lead profile linked</p>
                        </div>
                    )}

                    {userId && isLoading && <SkeletonRows />}

                    {userId && isError && (
                        <div className="flex flex-col items-center gap-2 rounded-lg border border-danger-200 bg-danger-50/50 py-5 text-center">
                            <p className="text-xs font-medium text-danger-600">
                                Failed to load events
                            </p>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setPage(0)}
                            >
                                Retry
                            </MyButton>
                        </div>
                    )}

                    {userId && !isLoading && !isError && data && (
                        <>
                            {data.content.length === 0 ? (
                                <EmptyState />
                            ) : (
                                <div>
                                    {data.content.map((event, idx) => (
                                        <EventRow
                                            key={event.id}
                                            event={event}
                                            isLast={idx === data.content.length - 1 && data.last}
                                        />
                                    ))}

                                    {data.totalPages > 1 && (
                                        <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                                            <span className="text-xs text-muted-foreground">
                                                {page + 1} / {data.totalPages}
                                            </span>
                                            <div className="flex gap-1.5">
                                                <MyButton
                                                    buttonType="secondary"
                                                    scale="small"
                                                    onClick={() =>
                                                        setPage((p) => Math.max(0, p - 1))
                                                    }
                                                    disabled={page === 0}
                                                >
                                                    Prev
                                                </MyButton>
                                                <MyButton
                                                    buttonType="secondary"
                                                    scale="small"
                                                    onClick={() =>
                                                        setPage((p) =>
                                                            Math.min(data.totalPages - 1, p + 1),
                                                        )
                                                    }
                                                    disabled={page >= data.totalPages - 1}
                                                >
                                                    Next
                                                </MyButton>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
