import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_ALL_LEAD_EVENTS } from '@/constants/urls';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
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
    CaretDown,
    CaretUp,
    ArrowsClockwise,
    type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import {
    ProfileSectionCard,
    ProfileTimeline,
    ProfileEmpty,
    ProfileError,
    ProfileSkeleton,
    type ProfileTimelineItem,
} from '../profile-ui';

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
    tone: ProfileTimelineItem['tone'];
    label: string;
};

const ACTION_CONFIG: Record<string, ActionConfig> = {
    // JOURNEY events
    LEAD_SUBMITTED:        { Icon: UserPlus,         tone: 'info',    label: 'Lead Submitted' },
    COUNSELOR_ASSIGNED:    { Icon: UserCheck,         tone: 'primary', label: 'Counselor Assigned' },
    STATUS_CHANGED:        { Icon: ArrowsLeftRight,   tone: 'neutral', label: 'Status Changed' },
    SCORE_UPDATED:         { Icon: TrendUp,           tone: 'warning', label: 'Score Updated' },
    MANUAL_SCORE_UPDATE:   { Icon: PencilSimple,      tone: 'primary', label: 'Manual Score' },
    FOLLOWUP:              { Icon: CalendarCheck,     tone: 'info',    label: 'Follow-up' },
    REACHOUT:              { Icon: ChatCircle,        tone: 'primary', label: 'Reachout' },
    LEAD_CONVERTED:        { Icon: CheckCircle,       tone: 'success', label: 'Converted' },
    LEAD_LOST:             { Icon: XCircle,           tone: 'danger',  label: 'Lead Lost' },
    DUPLICATE_MERGED:      { Icon: GitMerge,          tone: 'warning', label: 'Duplicate Merged' },
    PAYMENT_RECEIVED:      { Icon: CurrencyCircleDollar, tone: 'success', label: 'Payment Received' },
    ENROLLMENT_COMPLETED:  { Icon: GraduationCap,    tone: 'success', label: 'Enrolled' },
    // ACTIVITY events
    NOTE:                  { Icon: Note,              tone: 'neutral', label: 'Note' },
    CALL:                  { Icon: Phone,             tone: 'neutral', label: 'Call' },
    WALK_IN_NOTE:          { Icon: Note,              tone: 'neutral', label: 'Walk-in Note' },
    FOLLOWUP_SCHEDULED:    { Icon: CalendarCheck,     tone: 'info',    label: 'Follow-up Scheduled' },
    STATUS_CHANGE:         { Icon: ArrowsLeftRight,   tone: 'neutral', label: 'Status Changed' },
};

const FALLBACK_CONFIG: ActionConfig = {
    Icon: Warning,
    tone: 'neutral',
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
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {from ? (
                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                    {from}
                </span>
            ) : (
                <span className="text-xs italic text-neutral-400">Previous</span>
            )}
            <ArrowRight weight="bold" className="size-3 shrink-0 text-neutral-400" />
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
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
                {oldScore !== undefined && (
                    <span className="text-xs font-semibold tabular-nums text-neutral-500">
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
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
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
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                {initial}
            </div>
            <span className="text-xs font-medium text-neutral-700">{name ?? 'Unknown'}</span>
            {source && (
                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
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
            <CalendarCheck weight="fill" className="size-3.5 shrink-0 text-info-500" />
            <span className="text-xs font-medium text-neutral-700">
                {format(d, 'MMM d, yyyy · h:mm a')}
            </span>
        </div>
    );
}

function EventBodyMeta({ event }: { event: TimelineEvent }) {
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
        default:
            if (!event.description) return null;
            return (
                <div
                    className="mt-1 text-xs leading-relaxed text-neutral-500 [&_p]:m-0 [&_p+p]:mt-1"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
                />
            );
    }
}

/**
 * Maps a raw timeline event to a ProfileTimelineItem.
 * The rich metadata and actor line render in the `body` slot.
 */
function eventToTimelineItem(event: TimelineEvent): ProfileTimelineItem {
    const config = getConfig(event.action_type);

    // Backend sends raw DB timestamp without timezone (e.g. "2026-05-23T09:03:36.590").
    // Append IST offset so the browser interprets it correctly. Guard against
    // old events that still carry a timezone suffix (Z / +HH:MM).
    const rawTs = event.created_at ?? '';
    const hasOffset = rawTs.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(rawTs);
    const eventDate = new Date(hasOffset ? rawTs : rawTs + '+05:30');
    const formattedTime = format(eventDate, 'd MMM yyyy, h:mm a');

    const isSystem = event.actor_type === 'SYSTEM';
    const isActivity = event.category === 'ACTIVITY';

    const body = (
        <div>
            <EventBodyMeta event={event} />
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {isSystem ? (
                    <span className="rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                        System
                    </span>
                ) : event.actor_name ? (
                    <span className="text-xs text-neutral-400">
                        by{' '}
                        <span className="font-medium text-neutral-600">{event.actor_name}</span>
                    </span>
                ) : null}
                {isActivity && (
                    <span className="rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                        Activity
                    </span>
                )}
            </div>
        </div>
    );

    return {
        id: event.id,
        icon: config.Icon,
        tone: config.tone,
        title: event.title,
        meta: formattedTime,
        body,
    };
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

    const timelineItems: ProfileTimelineItem[] = (data?.content ?? []).map(eventToTimelineItem);

    return (
        <ProfileSectionCard
            icon={Path}
            heading="Lead Journey"
            action={
                <div className="flex items-center gap-1.5">
                    {totalCount !== undefined && totalCount > 0 && (
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-600">
                            {totalCount}
                        </span>
                    )}
                    <button
                        onClick={handleRefresh}
                        className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
                        title="Refresh"
                        aria-label="Refresh journey events"
                    >
                        <ArrowsClockwise
                            weight="bold"
                            className={cn('size-3.5 text-neutral-400', isFetching && 'animate-spin')}
                        />
                    </button>
                    <button
                        onClick={() => setOpen((v) => !v)}
                        className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        aria-expanded={open}
                        aria-label={open ? 'Collapse journey' : 'Expand journey'}
                    >
                        {open ? (
                            <CaretUp weight="bold" className="size-3.5 text-neutral-400" />
                        ) : (
                            <CaretDown weight="bold" className="size-3.5 text-neutral-400" />
                        )}
                    </button>
                </div>
            }
        >
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-neutral-200 py-2.5 text-xs text-neutral-500 transition-all hover:border-primary-300 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                    <Path className="size-3.5" weight="duotone" />
                    {totalCount !== undefined ? `View ${totalCount} events` : 'View journey events'}
                </button>
            )}

            {open && (
                <div>
                    {!userId && (
                        <ProfileEmpty
                            icon={Path}
                            title="No lead profile linked"
                            hint="A journey appears once this user has a lead profile"
                        />
                    )}

                    {userId && isLoading && <ProfileSkeleton blocks={3} />}

                    {userId && isError && (
                        <ProfileError
                            title="Failed to load events"
                            hint="Something went wrong. Please try again."
                            onRetry={() => setPage(0)}
                        />
                    )}

                    {userId && !isLoading && !isError && data && (
                        <>
                            {data.content.length === 0 ? (
                                <ProfileEmpty
                                    icon={Path}
                                    title="No events yet"
                                    hint="Events appear here as the lead progresses — submissions, scores, notes, and more"
                                />
                            ) : (
                                <div>
                                    <ProfileTimeline items={timelineItems} />

                                    {data.totalPages > 1 && (
                                        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                                            <span className="text-xs text-neutral-500">
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
        </ProfileSectionCard>
    );
}
