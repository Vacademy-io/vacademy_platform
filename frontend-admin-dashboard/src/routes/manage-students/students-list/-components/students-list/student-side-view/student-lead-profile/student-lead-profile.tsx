import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_USER_LEAD_PROFILE,
    GET_LEAD_SCORE,
    SET_MANUAL_LEAD_SCORE,
    UPDATE_LEAD_STATUS,
    UPDATE_LEAD_TIER,
    GET_USER_AUDIENCES,
    GET_CROSS_STAGE_TIMELINE,
    CREATE_TIMELINE_EVENT,
    CREATE_LEAD_FOLLOWUP,
} from '@/constants/urls';
import { cn } from '@/lib/utils';
import { AssignCounselorToLeadDialog } from '@/components/shared/assign-counselor-to-lead-dialog';
import { FollowUpsWidget } from './follow-ups-widget';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { LeadScoreBadge } from '@/components/shared/lead-score-badge';
import { invalidateLeadCaches } from '@/hooks/use-invalidate-lead-caches';
import { useLeadStatuses } from '@/hooks/use-lead-statuses';
import { MyButton } from '@/components/design-system/button';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { parseHtmlToString } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { CallRecordingInput } from '@/components/shared/lead-calls/CallRecordingInput';
import { CallRecordingPlayer } from '@/components/shared/lead-calls/CallRecordingPlayer';
import { LeadJourneyTimeline } from './lead-journey-timeline';
import {
    type CallActivity,
    callActivityToMetadata,
    callActivityFromMetadata,
    isCallActivityEmpty,
} from '@/components/shared/lead-calls/call-activity';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import {
    ChartBar,
    PencilSimple,
    X,
    Check,
    Megaphone,
    CalendarCheck,
    Lightning,
    CheckCircle,
    NotePencil,
    Phone,
    Buildings,
    ArrowsClockwise,
    User,
    ClipboardText,
    ArrowRight,
    EnvelopeSimple,
    CurrencyCircleDollar,
    PushPin,
    GitMerge,
    ListBullets,
    CalendarDot,
    Plus,
    Crosshair,
    Fire,
} from '@phosphor-icons/react';
import {
    ProfileSectionCard,
    ProfileFieldRow,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
    ProfileHeroStat,
    ProfileActionBar,
    ProfileMiniBar,
} from '../profile-ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserLeadProfile {
    user_id: string;
    institute_id: string;
    best_score: number;
    best_score_response_id: string | null;
    lead_tier: string | null;
    conversion_status: string;
    converted_at: string | null;
    campaign_count: number;
    best_source_type: string | null;
    total_timeline_events: number;
    demo_login_count: number;
    demo_attendance_count: number;
    last_activity_at: string | null;
    last_calculated_at: string | null;
    created_at: string | null;
    assigned_counselor_id: string | null;
    assigned_counselor_name: string | null;
}

interface AudienceMembership {
    audience_id: string;
    campaign_name: string | null;
    campaign_status: string | null;
    response_id: string;
    overall_status: string | null;
    source_type: string | null;
    submitted_at: string | null;
    lead_score: number | null;
}

interface TimelineEvent {
    id: string;
    type: string;
    type_id: string;
    action_type: string;
    actor_type: string;
    actor_id: string;
    actor_name: string;
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    is_pinned: boolean;
    student_user_id: string | null;
    created_at: string;
}

interface TimelineResponse {
    content: TimelineEvent[];
    totalElements: number;
    totalPages: number;
    last: boolean;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchUserLeadProfile(userId: string, instituteId: string): Promise<UserLeadProfile> {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_USER_LEAD_PROFILE,
        params: { userId, instituteId },
    });
    return response.data;
}

async function updateLeadStatus(
    userId: string,
    instituteId: string,
    status: string
): Promise<UserLeadProfile> {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: UPDATE_LEAD_STATUS,
        params: { userId, instituteId, status },
    });
    return response.data;
}

async function updateLeadTier(
    userId: string,
    instituteId: string,
    tier: string
): Promise<UserLeadProfile> {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: UPDATE_LEAD_TIER,
        params: { userId, instituteId, tier },
    });
    return response.data;
}

async function fetchUserAudiences(userId: string): Promise<AudienceMembership[]> {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_USER_AUDIENCES,
        params: { userId },
    });
    return response.data;
}

async function fetchCrossStageTimeline(
    userId: string,
    page: number,
    size: number
): Promise<TimelineResponse> {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_CROSS_STAGE_TIMELINE}/${userId}`,
        params: { page, size },
    });
    return response.data;
}

async function createTimelineEventApi(payload: {
    type: string;
    type_id: string;
    action_type: string;
    title: string;
    description?: string;
    student_user_id?: string;
    metadata?: Record<string, unknown>;
}): Promise<TimelineEvent> {
    const response = await authenticatedAxiosInstance.post(CREATE_TIMELINE_EVENT, payload);
    return response.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** Maps conversion_status to a semantic token pill. */
function statusPill(status: string): { label: string; className: string } {
    switch (status) {
        case 'CONVERTED':
            return { label: 'Converted', className: 'bg-success-100 text-success-700' };
        case 'LOST':
            return { label: 'Lost', className: 'bg-danger-100 text-danger-700' };
        default:
            return { label: 'Lead', className: 'bg-info-100 text-info-700' };
    }
}

function sourceLabel(source: string | null): string {
    if (!source) return '—';
    return source
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function campaignStatusChip(status: string | null) {
    const s = (status ?? '').toUpperCase();
    const map: Record<string, string> = {
        ACTIVE: 'bg-success-100 text-success-700',
        PAUSED: 'bg-warning-100 text-warning-700',
        COMPLETED: 'bg-neutral-100 text-neutral-600',
        ARCHIVED: 'bg-neutral-100 text-neutral-500',
    };
    return map[s] ?? 'bg-neutral-100 text-neutral-500';
}

/**
 * Derives a "Next Best Action" hint from existing profile data — purely client-side.
 * Priority order:
 *  1. No activity in 7+ days → prompt follow-up
 *  2. High score (≥80) but tier is not HOT → schedule a demo
 *  3. Cold lead (score < 40) → light nurture
 *  4. Default → regular nurture
 */
function deriveNextBestAction(profile: UserLeadProfile): string {
    const daysSinceActivity = profile.last_activity_at
        ? differenceInDays(new Date(), new Date(profile.last_activity_at))
        : 999;

    if (daysSinceActivity >= 7) {
        return 'No activity in 7d — log a follow-up';
    }
    if (profile.best_score >= 80 && profile.lead_tier !== 'HOT') {
        return 'Hot signal — schedule a demo';
    }
    if (profile.best_score < 40) {
        return 'Cold lead — nurture lightly';
    }
    return 'Continue regular nurture';
}

/** Hero tone derived from lead tier / score. */
function heroTone(profile: UserLeadProfile): 'danger' | 'warning' | 'info' | 'primary' {
    const tier = profile.lead_tier;
    if (tier === 'HOT') return 'danger';
    if (tier === 'WARM') return 'warning';
    if (tier === 'COLD') return 'info';
    // fall back to score
    if (profile.best_score >= 80) return 'danger';
    if (profile.best_score >= 50) return 'warning';
    return 'primary';
}

// Picks the most recently submitted audience response — used as a fallback when
// the lead has no scored "best" response yet but does have linked campaigns.
function pickMostRecentAudience(
    audiences: AudienceMembership[] | undefined
): AudienceMembership | undefined {
    if (!audiences || audiences.length === 0) return undefined;
    return [...audiences].sort((a, b) => {
        const ta = a.submitted_at ? Date.parse(a.submitted_at) : 0;
        const tb = b.submitted_at ? Date.parse(b.submitted_at) : 0;
        return tb - ta;
    })[0];
}

// ── Score Breakdown ───────────────────────────────────────────────────────────

interface ScoreFactor {
    score: number;
    weight: number;
    contribution: number;
}

interface ScoringFactors {
    source_quality?: ScoreFactor;
    profile_completeness?: ScoreFactor;
    recency?: ScoreFactor;
    engagement?: ScoreFactor;
    initial_score?: { value: number };
}

interface LeadScoreDetail {
    raw_score: number;
    tier: string;
    percentile_rank: number;
    scoring_factors: ScoringFactors;
    last_calculated_at: string;
    is_manual_override: boolean;
}

const FACTOR_META: Record<string, { label: string; color: string }> = {
    source_quality: { label: 'Source Quality', color: 'bg-primary-500' },
    profile_completeness: { label: 'Profile Completeness', color: 'bg-success-500' },
    recency: { label: 'Recency', color: 'bg-warning-500' },
    engagement: { label: 'Engagement', color: 'bg-info-500' },
};

function ManualScoreEditor({ responseId }: { responseId: string }) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');

    const scoreData = queryClient.getQueryData<LeadScoreDetail>([
        'lead-score-breakdown',
        responseId,
    ]);
    const isManual = scoreData?.is_manual_override ?? false;
    const currentScore = scoreData?.raw_score;

    const { mutate, isPending } = useMutation({
        mutationFn: (score: number | null) =>
            authenticatedAxiosInstance.put(SET_MANUAL_LEAD_SCORE(responseId), { score }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lead-score-breakdown', responseId] });
            queryClient.invalidateQueries({ queryKey: ['user-lead-profile'] });
            setEditing(false);
            toast.success('Score updated');
        },
        onError: () => toast.error('Failed to update score'),
    });

    const handleSave = () => {
        const n = Number(value);
        if (!value || isNaN(n) || n < 0 || n > 100) {
            toast.error('Enter a number between 0 and 100');
            return;
        }
        mutate(n);
    };

    const handleClear = () => mutate(null);

    if (editing) {
        return (
            <div className="mt-2 flex items-center gap-1.5">
                <input
                    autoFocus
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-xs tabular-nums focus:border-primary-400 focus:outline-none"
                    placeholder="0–100"
                />
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex size-5 items-center justify-center rounded-full bg-success-500 text-white hover:bg-success-600 disabled:opacity-50"
                >
                    <Check size={11} weight="bold" />
                </button>
                <button
                    onClick={() => setEditing(false)}
                    className="flex size-5 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
                >
                    <X size={11} weight="bold" />
                </button>
            </div>
        );
    }

    return (
        <div className="mt-1.5 flex items-center gap-2">
            <button
                onClick={() => {
                    setValue(currentScore?.toString() ?? '');
                    setEditing(true);
                }}
                className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-primary-600"
            >
                <PencilSimple size={11} />
                {isManual ? `Manual: ${currentScore}` : 'Set score manually'}
            </button>
            {isManual && (
                <button
                    onClick={handleClear}
                    disabled={isPending}
                    className="text-xs text-neutral-300 transition-colors hover:text-danger-500 disabled:opacity-50"
                    title="Clear manual override — restores calculated score"
                >
                    <X size={11} />
                </button>
            )}
        </div>
    );
}

function ScoreBreakdownPanel({ responseId }: { responseId: string }) {
    const [open, setOpen] = useState(false);

    const { data, isLoading } = useQuery<LeadScoreDetail>({
        queryKey: ['lead-score-breakdown', responseId],
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get(GET_LEAD_SCORE(responseId));
            return res.data;
        },
        enabled: open && !!responseId,
        staleTime: 60 * 1000,
    });

    const factors = data?.scoring_factors;
    const isManualData = data?.is_manual_override ?? false;

    return (
        <div className="mt-2">
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-primary-600"
            >
                <ChartBar size={13} weight="bold" />
                {open ? 'Hide breakdown' : 'Score breakdown'}
            </button>

            {open && (
                <div className="mt-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-xs">
                    {isLoading && (
                        <div className="flex items-center gap-2 text-neutral-400">
                            <div className="size-3 animate-spin rounded-full border border-neutral-400 border-t-transparent" />
                            Loading…
                        </div>
                    )}

                    {isManualData && (
                        <div className="mb-2 flex items-center gap-1 rounded-md bg-warning-50 px-2 py-1 text-warning-700">
                            <PencilSimple size={11} weight="bold" />
                            <span>Score was set manually — breakdown is proportional</span>
                        </div>
                    )}

                    {factors && (
                        <div className="flex flex-col gap-2.5">
                            {(
                                Object.entries(FACTOR_META) as [
                                    string,
                                    { label: string; color: string },
                                ][]
                            ).map(([key, meta]) => {
                                const f = factors[key as keyof ScoringFactors] as
                                    | ScoreFactor
                                    | undefined;
                                if (!f) return null;
                                return (
                                    <div key={key}>
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <span className="min-w-0 truncate font-medium text-neutral-600">
                                                {meta.label}
                                            </span>
                                            <span className="shrink-0 tabular-nums text-neutral-500">
                                                {f.contribution}
                                                <span className="text-neutral-300">
                                                    {' '}
                                                    / {f.weight}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                                            {/* dynamic: score-based percentage width, cannot be expressed as a token */}
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all',
                                                    meta.color
                                                )}
                                                style={{ width: `${f.score}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {(factors.initial_score?.value ?? 0) > 0 && (
                                <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                                    <span className="text-neutral-500">Initial Bonus</span>
                                    <span className="font-semibold text-primary-600">
                                        +{factors.initial_score!.value}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                                <span className="font-semibold text-neutral-700">Total</span>
                                <span className="font-bold text-neutral-800">
                                    {data?.raw_score ?? '—'} / 100
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Timeline Action Config ────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: ReactNode; color: string; bgColor: string }> = {
    NOTE: {
        icon: <NotePencil weight="fill" className="size-4" />,
        color: 'text-info-600',
        bgColor: 'bg-info-100',
    },
    CALL_LOG: {
        icon: <Phone weight="fill" className="size-4" />,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
    },
    FOLLOW_UP: {
        icon: <CalendarCheck weight="fill" className="size-4" />,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
    },
    MEETING: {
        icon: <Buildings weight="fill" className="size-4" />,
        color: 'text-warning-600',
        bgColor: 'bg-warning-100',
    },
    NOTE_ADDED: {
        icon: <NotePencil weight="fill" className="size-4" />,
        color: 'text-info-600',
        bgColor: 'bg-info-100',
    },
    STATUS_CHANGE: {
        icon: <ArrowsClockwise weight="fill" className="size-4" />,
        color: 'text-warning-600',
        bgColor: 'bg-warning-100',
    },
    COUNSELOR_ASSIGNED: {
        icon: <User weight="fill" className="size-4" />,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
    },
    APPLICATION_SUBMITTED: {
        icon: <ClipboardText weight="fill" className="size-4" />,
        color: 'text-success-600',
        bgColor: 'bg-success-100',
    },
    APPLICATION_TRANSITIONED: {
        icon: <ArrowRight weight="bold" className="size-4" />,
        color: 'text-info-600',
        bgColor: 'bg-info-100',
    },
    PHONE_CALL: {
        icon: <Phone weight="fill" className="size-4" />,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
    },
    EMAIL_SENT: {
        icon: <EnvelopeSimple weight="fill" className="size-4" />,
        color: 'text-info-600',
        bgColor: 'bg-info-100',
    },
    PAYMENT_SUCCESS: {
        icon: <CurrencyCircleDollar weight="fill" className="size-4" />,
        color: 'text-success-600',
        bgColor: 'bg-success-100',
    },
    CAMPUS_VISIT: {
        icon: <Buildings weight="fill" className="size-4" />,
        color: 'text-warning-600',
        bgColor: 'bg-warning-100',
    },
    DUPLICATE_MERGED: {
        icon: <GitMerge weight="fill" className="size-4" />,
        color: 'text-neutral-600',
        bgColor: 'bg-neutral-100',
    },
    FOLLOW_UP_SCHEDULED: {
        icon: <CalendarDot weight="fill" className="size-4" />,
        color: 'text-primary-600',
        bgColor: 'bg-primary-100',
    },
    FOLLOW_UP_COMPLETED: {
        icon: <CheckCircle weight="fill" className="size-4" />,
        color: 'text-success-600',
        bgColor: 'bg-success-100',
    },
    FOLLOW_UP_CANCELLED: {
        icon: <CalendarCheck weight="fill" className="size-4" />,
        color: 'text-neutral-500',
        bgColor: 'bg-neutral-100',
    },
};

const DEFAULT_ACTION_CONFIG = {
    icon: <PushPin weight="fill" className="size-4" />,
    color: 'text-neutral-600',
    bgColor: 'bg-neutral-100',
};

const NOTE_ACTION_TYPES = [
    { value: 'NOTE', label: 'Note', icon: <NotePencil weight="fill" className="size-3.5" /> },
    { value: 'CALL_LOG', label: 'Call Log', icon: <Phone weight="fill" className="size-3.5" /> },
    {
        value: 'FOLLOW_UP',
        label: 'Follow Up',
        icon: <CalendarCheck weight="fill" className="size-3.5" />,
    },
    { value: 'MEETING', label: 'Meeting', icon: <Buildings weight="fill" className="size-3.5" /> },
];

// ── Timeline Event Item ───────────────────────────────────────────────────────

function TimelineEventItem({ event }: { event: TimelineEvent }) {
    const config = ACTION_CONFIG[event.action_type] ?? DEFAULT_ACTION_CONFIG;
    const [isTextExpanded, setIsTextExpanded] = useState(false);

    const formatTime = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'd MMM yyyy, h:mm a');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="group relative flex gap-3 pb-5 last:pb-0">
            <div className="absolute -bottom-0 left-4 top-9 w-px bg-neutral-200 group-last:hidden" />
            <div
                className={cn(
                    'z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm',
                    config.bgColor,
                    config.color
                )}
            >
                {config.icon}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium leading-tight text-neutral-800">
                        {event.is_pinned && (
                            <PushPin
                                size={12}
                                weight="fill"
                                className="mr-1 inline text-warning-500"
                            />
                        )}
                        {event.title}
                    </h4>
                    <span className="shrink-0 text-caption font-medium tabular-nums text-neutral-400">
                        {formatTime(event.created_at)}
                    </span>
                </div>
                {event.description &&
                    (() => {
                        // Rich text notes are HTML; legacy notes are plain text. Render
                        // HTML safely while preserving plain-text line breaks for older
                        // notes. Length checks use the rendered text.
                        const isHtml = /<\/?[a-z][^>]*>/i.test(event.description);
                        const plain = isHtml
                            ? parseHtmlToString(event.description).trim()
                            : event.description.trim();
                        const isLong = plain.length > 100;
                        const showFull = isTextExpanded || !isLong;
                        return (
                            <div className="mt-1">
                                {showFull && isHtml ? (
                                    <div
                                        className="break-words text-sm leading-relaxed text-neutral-600 [&_a]:text-primary-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-200 [&_blockquote]:pl-2 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:font-medium [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0.5 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(event.description),
                                        }}
                                    />
                                ) : (
                                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-600">
                                        {showFull ? plain : `${plain.slice(0, 100).trim()}...`}
                                    </p>
                                )}
                                {isLong && (
                                    <button
                                        onClick={() => setIsTextExpanded(!isTextExpanded)}
                                        className="mt-1 text-xs font-medium text-primary-600 hover:underline"
                                    >
                                        {isTextExpanded ? 'View less' : 'View more'}
                                    </button>
                                )}
                            </div>
                        );
                    })()}
                {event.actor_name && (
                    <p className="mt-1.5 text-caption text-neutral-400">
                        by <span className="font-medium text-neutral-500">{event.actor_name}</span>
                    </p>
                )}
                {/* Call recording + details (Call Log) */}
                {(() => {
                    const call = callActivityFromMetadata(event.metadata);
                    return call ? <CallRecordingPlayer call={call} /> : null;
                })()}
            </div>
        </div>
    );
}

// ── Add Note Form (for cross-stage) ──────────────────────────────────────────

interface AddNoteFormProps {
    userId: string;
    /** The best audience response id — required to schedule a follow-up. */
    audienceResponseId?: string | null;
    /** Pre-select an action type and expand immediately (presentational only). */
    defaultActionType?: string;
    autoExpand?: boolean;
}

function AddNoteForm({ userId, audienceResponseId, defaultActionType, autoExpand }: AddNoteFormProps) {
    const [noteText, setNoteText] = useState('');
    const [actionType, setActionType] = useState(defaultActionType ?? 'NOTE');
    const [isExpanded, setIsExpanded] = useState(autoExpand ?? false);
    const [callActivity, setCallActivity] = useState<CallActivity | null>(null);
    const [scheduleTime, setScheduleTime] = useState('');
    const queryClient = useQueryClient();

    // The rich text editor emits HTML — check the rendered text for emptiness.
    const isNoteEmpty = !parseHtmlToString(noteText).trim();

    // For Call Log, a recording / call details alone are enough to submit.
    const callMeta =
        actionType === 'CALL_LOG' && !isCallActivityEmpty(callActivity)
            ? callActivityToMetadata(callActivity as CallActivity)
            : undefined;

    // For Follow Up the schedule time is mandatory; content is optional.
    const isFollowUp = actionType === 'FOLLOW_UP';
    const canSubmit = isFollowUp
        ? !!scheduleTime && !!audienceResponseId
        : !isNoteEmpty || callMeta !== undefined;

    function resetForm() {
        setNoteText('');
        setCallActivity(null);
        setScheduleTime('');
        setIsExpanded(false);
    }

    const createFollowUpMutation = useMutation({
        mutationFn: () =>
            authenticatedAxiosInstance.post(CREATE_LEAD_FOLLOWUP, {
                audience_response_id: audienceResponseId,
                schedule_time: scheduleTime ? new Date(scheduleTime).toISOString() : null,
                content: noteText.trim() || null,
            }),
        onSuccess: () => {
            toast.success('Follow-up scheduled');
            resetForm();
            // Invalidate follow-ups list and lead caches.
            if (audienceResponseId) {
                queryClient.invalidateQueries({
                    queryKey: ['lead-followups', audienceResponseId],
                });
            }
            invalidateLeadCaches(queryClient, userId);
        },
        onError: () => toast.error('Failed to schedule follow-up'),
    });

    const createNoteMutation = useMutation({
        mutationFn: () => {
            const label = NOTE_ACTION_TYPES.find((t) => t.value === actionType)?.label || 'Note';
            return createTimelineEventApi({
                type: 'STUDENT',
                type_id: userId,
                action_type: actionType,
                title: label,
                description: noteText.trim(),
                student_user_id: userId,
                metadata: callMeta,
            });
        },
        onSuccess: () => {
            toast.success('Note added');
            resetForm();
            // Invalidate every lead-related cache so the new event count + recomputed
            // best_score show up on the drawer card and across all tables that pull
            // from ['lead-profiles-batch']. The backend recomputes synchronously on
            // timeline insert, so a single round-trip is enough.
            invalidateLeadCaches(queryClient, userId);
        },
        onError: () => toast.error('Failed to add note'),
    });

    const isPending = createNoteMutation.isPending || createFollowUpMutation.isPending;

    function handleSubmit() {
        if (isFollowUp) {
            createFollowUpMutation.mutate();
        } else {
            createNoteMutation.mutate();
        }
    }

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
            >
                <Plus className="size-4" weight="bold" />
                Add a note or log activity…
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {NOTE_ACTION_TYPES.map((type) => (
                    <button
                        key={type.value}
                        onClick={() => setActionType(type.value)}
                        className={cn(
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                            actionType === type.value
                                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                                : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                        )}
                    >
                        {type.icon}
                        {type.label}
                    </button>
                ))}
            </div>

            {isFollowUp ? (
                <div className="flex flex-col gap-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600">
                            Schedule time <span className="text-danger-500">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                    </div>
                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-800 focus-within:border-primary-300 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary-300 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2">
                        <RichTextEditor
                            value={noteText}
                            onChange={setNoteText}
                            placeholder="Add a note for this follow-up (optional)…"
                            minHeight={56}
                            minimalToolbar
                        />
                    </div>
                    {!audienceResponseId && (
                        <p className="text-caption text-warning-600">
                            No campaign response linked — follow-up cannot be scheduled.
                        </p>
                    )}
                </div>
            ) : (
                <div
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-800 focus-within:border-primary-300 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary-300 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            if (canSubmit) handleSubmit();
                        }
                    }}
                >
                    <RichTextEditor
                        value={noteText}
                        onChange={setNoteText}
                        placeholder="Type your note here…"
                        minHeight={64}
                        minimalToolbar
                    />
                </div>
            )}

            {actionType === 'CALL_LOG' && (
                <CallRecordingInput value={callActivity} onChange={setCallActivity} />
            )}
            <div className="mt-2 flex items-center justify-between">
                <span className="text-caption text-neutral-400">
                    {isFollowUp ? 'Schedule time is required' : 'Ctrl+Enter to submit'}
                </span>
                <div className="flex items-center gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={resetForm}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={handleSubmit}
                        disabled={isPending || !canSubmit}
                    >
                        {isPending ? 'Saving…' : isFollowUp ? 'Schedule Follow-up' : 'Add Note'}
                    </MyButton>
                </div>
            </div>
        </div>
    );
}

// ── Audience List Section ─────────────────────────────────────────────────────

function AudienceListSection({ userId }: { userId: string }) {
    const { data: audiences, isLoading } = useQuery({
        queryKey: ['user-audiences', userId],
        queryFn: () => fetchUserAudiences(userId),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
    });

    if (isLoading) {
        return <div className="h-20 animate-pulse rounded-lg bg-neutral-100" />;
    }

    if (!audiences || audiences.length === 0) return null;

    return (
        <ProfileSectionCard icon={Megaphone} heading="Linked Campaigns" action={
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                {audiences.length}
            </span>
        }>
            <div className="flex flex-col gap-1.5">
                {audiences.map((a) => (
                    <div
                        key={a.response_id}
                        className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-800">
                                {a.campaign_name || 'Unnamed Campaign'}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-caption text-neutral-400">
                                {a.source_type && <span>{sourceLabel(a.source_type)}</span>}
                                {a.submitted_at && <span>{formatDate(a.submitted_at)}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {a.lead_score != null && (
                                <LeadScoreBadge score={a.lead_score} size="sm" />
                            )}
                            <span
                                className={cn(
                                    'rounded-full px-2 py-0.5 text-caption font-medium',
                                    campaignStatusChip(a.campaign_status)
                                )}
                            >
                                {a.campaign_status ?? '—'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </ProfileSectionCard>
    );
}

// ── Cross-Stage Timeline Section ──────────────────────────────────────────────

function CrossStageTimeline({
    userId,
    audienceResponseId,
    noteFormProps,
}: {
    userId: string;
    audienceResponseId?: string | null;
    noteFormProps?: Pick<AddNoteFormProps, 'defaultActionType' | 'autoExpand'>;
}) {
    const [page, setPage] = useState(0);
    const pageSize = 5;

    const { data, isLoading } = useQuery({
        queryKey: ['cross-stage-timeline', userId, page, pageSize],
        queryFn: () => fetchCrossStageTimeline(userId, page, pageSize),
        enabled: !!userId,
        staleTime: 60 * 1000,
    });

    return (
        <ProfileSectionCard
            icon={NotePencil}
            heading="Activity & Notes"
            action={
                data?.totalElements !== undefined ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                        {data.totalElements}
                    </span>
                ) : undefined
            }
        >
            <div className="flex flex-col gap-3">
                <AddNoteForm
                    userId={userId}
                    audienceResponseId={audienceResponseId}
                    {...noteFormProps}
                />

                {isLoading && (
                    <div className="flex items-center justify-center py-6">
                        <div className="flex items-center gap-2 text-sm text-neutral-500">
                            <div className="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                            Loading activity…
                        </div>
                    </div>
                )}

                {data && data.content.length > 0 && (
                    <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
                        {data.content.map((event) => (
                            <TimelineEventItem key={event.id} event={event} />
                        ))}

                        {data.totalPages > 1 && (
                            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                                <span className="text-caption text-neutral-400">
                                    Page {page + 1} of {data.totalPages}
                                </span>
                                <div className="flex gap-1.5">
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                    >
                                        Previous
                                    </MyButton>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() =>
                                            setPage((p) => Math.min(data.totalPages - 1, p + 1))
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

                {data && data.content.length === 0 && (
                    <ProfileEmpty
                        icon={ListBullets}
                        title="No activity yet"
                        hint="Notes, status changes, and other events will appear here"
                    />
                )}
            </div>
        </ProfileSectionCard>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface StudentLeadProfileProps {
    userId: string;
}

export function StudentLeadProfile({ userId }: StudentLeadProfileProps) {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();
    const [showAssignCounselor, setShowAssignCounselor] = useState(false);

    // Hero action bar — which note form action type to pre-select when user
    // clicks one of the 3 hero action buttons. Null = no pre-selection (default collapse).
    const [heroNoteAction, setHeroNoteAction] = useState<string | null>(null);

    const queryKey = ['user-lead-profile', userId, instituteId];

    const {
        data: profile,
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey,
        queryFn: () => fetchUserLeadProfile(userId, instituteId),
        enabled: !!userId && !!instituteId,
        staleTime: 2 * 60 * 1000,
        retry: 1,
    });

    // Shared with AudienceListSection via the same query key — TanStack dedupes.
    // We read it here so the follow-up form can fall back to the most-recent
    // linked campaign response when the profile has no `best_score_response_id`
    // yet (common for fresh leads that haven't been scored).
    const { data: audiences } = useQuery({
        queryKey: ['user-audiences', userId],
        queryFn: () => fetchUserAudiences(userId),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
    });
    const effectiveResponseId =
        profile?.best_score_response_id ?? pickMostRecentAudience(audiences)?.response_id ?? null;

    // Institute's configurable lead statuses (table-backed; seeded New/Converted/Lost).
    const { statuses: leadStatuses } = useLeadStatuses();

    const { mutate: changeStatus, isPending: changingStatus } = useMutation({
        mutationFn: (status: string) => updateLeadStatus(userId, instituteId, status),
        onSuccess: (_data, status) => {
            toast.success(`Lead marked as ${status}`);
            invalidateLeadCaches(queryClient, userId);
        },
        onError: () => toast.error('Failed to update lead status'),
    });

    const { mutate: changeTier, isPending: changingTier } = useMutation({
        mutationFn: (tier: string) => updateLeadTier(userId, instituteId, tier),
        onSuccess: (_data, tier) => {
            toast.success(`Lead tier set to ${tier}`);
            invalidateLeadCaches(queryClient, userId);
        },
        onError: () => toast.error('Failed to update lead tier'),
    });

    // ── States ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return <ProfileSkeleton blocks={4} />;
    }

    if (isError) {
        return (
            <div className="flex flex-col gap-4">
                <ProfileError
                    title="Couldn't load lead profile"
                    hint="Something went wrong. Please try again."
                    onRetry={() => refetch()}
                />
                {/* Still show audience list and note form even on error */}
                <AudienceListSection userId={userId} />
                <AddNoteForm userId={userId} audienceResponseId={null} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col gap-4">
                <ProfileEmpty
                    icon={ChartBar}
                    title="No lead profile yet"
                    hint="A profile will appear once this user submits an enquiry or is scored."
                />
                {/* Still show audience list and note form even without a lead profile */}
                <AudienceListSection userId={userId} />
                <AddNoteForm userId={userId} audienceResponseId={effectiveResponseId} />
            </div>
        );
    }

    const { label: sLabel, className: sClass } = statusPill(profile.conversion_status);
    const isConverted = profile.conversion_status === 'CONVERTED';
    const tone = heroTone(profile);
    const nextBestAction = deriveNextBestAction(profile);

    // Tier pill tokens
    const tierPillActive = {
        HOT: 'bg-danger-100 text-danger-700 ring-1 ring-danger-300',
        WARM: 'bg-warning-100 text-warning-700 ring-1 ring-warning-300',
        COLD: 'bg-info-100 text-info-700 ring-1 ring-info-300',
    } as const;
    const tierPillHover = {
        HOT: 'bg-neutral-50 text-neutral-500 hover:bg-danger-50',
        WARM: 'bg-neutral-50 text-neutral-500 hover:bg-warning-50',
        COLD: 'bg-neutral-50 text-neutral-500 hover:bg-info-50',
    } as const;

    // Active tier label (may be null if not yet set — infer from score).
    const activeTier =
        profile.lead_tier ??
        (profile.best_score >= 80 ? 'HOT' : profile.best_score >= 50 ? 'WARM' : 'COLD');

    return (
        <div className="flex flex-col gap-4">

            {/* ── Hero ── */}
            <ProfileHero
                eyebrow="LEAD INTEREST"
                icon={Crosshair}
                tone={tone}
                title={
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums text-neutral-900">
                            {profile.best_score} / 100
                        </span>
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                activeTier === 'HOT'
                                    ? 'bg-danger-100 text-danger-700'
                                    : activeTier === 'WARM'
                                      ? 'bg-warning-100 text-warning-700'
                                      : 'bg-info-100 text-info-700'
                            )}
                        >
                            {activeTier}
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', sClass)}>
                            {sLabel}
                        </span>
                    </div>
                }
                subtitle={nextBestAction}
                action={
                    profile.last_calculated_at ? (
                        <span className="text-xs text-neutral-400" title={new Date(profile.last_calculated_at).toLocaleString()}>
                            Scored {format(new Date(profile.last_calculated_at), 'MMM d')}
                        </span>
                    ) : undefined
                }
            >
                {/* Score bar — data-driven width; cannot be expressed as a static token */}
                <ProfileMiniBar value={profile.best_score} label={`${profile.best_score} / 100`} />
            </ProfileHero>

            {/* ── Action bar ── */}
            <ProfileActionBar>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => {
                        setHeroNoteAction('NOTE');
                        // Scroll to the activity section after a tick
                        setTimeout(() => {
                            document.getElementById('lead-activity-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                    }}
                >
                    <NotePencil className="size-4" weight="fill" />
                    Add Note
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => {
                        setHeroNoteAction('FOLLOW_UP');
                        setTimeout(() => {
                            document.getElementById('lead-activity-section')?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                    }}
                >
                    <CalendarCheck className="size-4" weight="fill" />
                    Schedule Follow-up
                </MyButton>
                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => setShowAssignCounselor(true)}
                >
                    <User className="size-4" weight="fill" />
                    Assign Counsellor
                </MyButton>
            </ProfileActionBar>

            {/* ── 4-stat grid ── */}
            <div className="grid grid-cols-2 gap-2">
                <ProfileHeroStat
                    label="Campaigns"
                    value={profile.campaign_count}
                    icon={Megaphone}
                    tone={profile.campaign_count > 0 ? 'primary' : 'neutral'}
                />
                <ProfileHeroStat
                    label="Timeline Events"
                    value={profile.total_timeline_events}
                    icon={Lightning}
                    tone={profile.total_timeline_events > 0 ? 'primary' : 'neutral'}
                />
                <ProfileHeroStat
                    label="Demo Attendance"
                    value={profile.demo_attendance_count}
                    icon={CalendarCheck}
                    tone={profile.demo_attendance_count > 0 ? 'primary' : 'neutral'}
                />
                <ProfileHeroStat
                    label="Best Source"
                    value={sourceLabel(profile.best_source_type)}
                    icon={Fire}
                    tone={profile.best_source_type ? 'primary' : 'neutral'}
                />
            </div>

            {/* ── Key Dates ── */}
            <ProfileSectionCard heading="Key Dates">
                <dl className="divide-y divide-neutral-100">
                    <ProfileFieldRow label="Last Activity" value={formatDate(profile.last_activity_at)} />
                    <ProfileFieldRow label="Lead Since" value={formatDate(profile.created_at)} />
                    {isConverted && (
                        <ProfileFieldRow
                            label="Converted On"
                            value={
                                <span className="text-success-700">
                                    {formatDate(profile.converted_at)}
                                </span>
                            }
                        />
                    )}
                    <ProfileFieldRow label="Score Updated" value={formatDate(profile.last_calculated_at)} />
                </dl>
            </ProfileSectionCard>

            {/* ── Lead Score detail (manual override + breakdown) ── */}
            <ProfileSectionCard icon={ChartBar} heading="Score Details">
                <div className="flex flex-col gap-3">
                    <div>
                        <LeadScoreBadge
                            score={profile.best_score}
                            tier={profile.lead_tier}
                            size="md"
                        />
                        {profile.best_score_response_id && (
                            <>
                                <ManualScoreEditor responseId={profile.best_score_response_id} />
                                <ScoreBreakdownPanel responseId={profile.best_score_response_id} />
                            </>
                        )}
                    </div>
                </div>
            </ProfileSectionCard>

            {/* ── Lead Status ── */}
            <ProfileSectionCard heading="Lead Status">
                <div className="flex flex-wrap gap-1.5">
                    {leadStatuses.map((s) => {
                        const active = profile.conversion_status === s.status_key;
                        return (
                            <button
                                key={s.id}
                                onClick={() => changeStatus(s.status_key)}
                                disabled={changingStatus}
                                className={cn(
                                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                                    !active && 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                                )}
                                // Inline style: status colour is arbitrary user-picked hex (active state).
                                style={
                                    active
                                        ? {
                                              backgroundColor: `${s.color}1A`,
                                              color: s.color,
                                              boxShadow: `inset 0 0 0 1px ${s.color}55`,
                                          }
                                        : undefined
                                }
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </div>
                {isConverted && (
                    <p className="mt-2 text-caption text-success-600">
                        Score updates are frozen while converted.
                    </p>
                )}
            </ProfileSectionCard>

            {/* ── Tier control ── */}
            <ProfileSectionCard heading="Lead Tier">
                <div className="flex gap-1.5">
                    {(['HOT', 'WARM', 'COLD'] as const).map((tier) => {
                        const isActive =
                            profile.lead_tier === tier ||
                            (!profile.lead_tier &&
                                ((tier === 'HOT' && profile.best_score >= 80) ||
                                    (tier === 'WARM' &&
                                        profile.best_score >= 50 &&
                                        profile.best_score < 80) ||
                                    (tier === 'COLD' && profile.best_score < 50)));
                        return (
                            <button
                                key={tier}
                                onClick={() => changeTier(tier)}
                                disabled={changingTier}
                                className={cn(
                                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                                    isActive ? tierPillActive[tier] : tierPillHover[tier]
                                )}
                            >
                                {tier}
                            </button>
                        );
                    })}
                </div>
            </ProfileSectionCard>

            {/* ── Assigned Counselor ── */}
            <ProfileSectionCard icon={User} heading="Assigned Counselor">
                {profile.assigned_counselor_name ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                                {profile.assigned_counselor_name[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-neutral-800">
                                {profile.assigned_counselor_name}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowAssignCounselor(true)}
                            className="text-caption text-neutral-400 hover:text-primary-600"
                        >
                            Reassign
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAssignCounselor(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-2 text-caption text-muted-foreground transition-colors hover:border-primary-300 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                        <Plus className="size-3.5" />
                        Assign a Counselor
                    </button>
                )}
            </ProfileSectionCard>

            {showAssignCounselor && (
                <AssignCounselorToLeadDialog
                    open={showAssignCounselor}
                    onOpenChange={setShowAssignCounselor}
                    userId={userId}
                    invalidateKeys={[queryKey]}
                    onSuccess={() => invalidateLeadCaches(queryClient, userId)}
                />
            )}

            {/* ── Linked Campaigns ── */}
            <AudienceListSection userId={userId} />

            {/* ── Follow-ups ── */}
            {effectiveResponseId && (
                <FollowUpsWidget audienceResponseId={effectiveResponseId} userId={userId} />
            )}

            {/* ── Activity & Notes ── */}
            <div id="lead-activity-section">
                <CrossStageTimeline
                    userId={userId}
                    audienceResponseId={profile?.best_score_response_id}
                    noteFormProps={
                        heroNoteAction
                            ? { defaultActionType: heroNoteAction, autoExpand: true }
                            : undefined
                    }
                />
            </div>

            {/* ── Lead Journey Timeline ── */}
            <LeadJourneyTimeline userId={userId} responseId={effectiveResponseId} />
        </div>
    );
}
