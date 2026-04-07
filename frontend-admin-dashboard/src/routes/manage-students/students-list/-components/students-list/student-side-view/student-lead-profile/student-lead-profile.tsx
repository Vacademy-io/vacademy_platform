import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_USER_LEAD_PROFILE,
    UPDATE_LEAD_STATUS,
    UPDATE_LEAD_TIER,
    GET_USER_AUDIENCES,
    GET_CROSS_STAGE_TIMELINE,
    CREATE_TIMELINE_EVENT,
} from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { LeadScoreBadge } from '@/components/shared/lead-score-badge';
import { MyButton } from '@/components/design-system/button';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    ChartBar,
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
} from '@phosphor-icons/react';

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

function statusLabel(status: string): { label: string; className: string } {
    switch (status) {
        case 'CONVERTED':
            return { label: 'Converted', className: 'bg-green-100 text-green-700' };
        case 'LOST':
            return { label: 'Lost', className: 'bg-red-100 text-red-700' };
        default:
            return { label: 'Lead', className: 'bg-blue-100 text-blue-700' };
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
        ACTIVE: 'bg-green-100 text-green-700',
        PAUSED: 'bg-amber-100 text-amber-700',
        COMPLETED: 'bg-neutral-100 text-neutral-600',
        ARCHIVED: 'bg-neutral-100 text-neutral-500',
    };
    return map[s] ?? 'bg-neutral-100 text-neutral-500';
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-500 shadow-sm">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="truncate text-sm font-semibold text-neutral-800">{value}</p>
            </div>
        </div>
    );
}

// ── Timeline Action Config ────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: ReactNode; color: string; bgColor: string }> = {
    NOTE: {
        icon: <NotePencil weight="fill" className="size-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
    },
    CALL_LOG: {
        icon: <Phone weight="fill" className="size-4" />,
        color: 'text-teal-600',
        bgColor: 'bg-teal-100',
    },
    FOLLOW_UP: {
        icon: <CalendarCheck weight="fill" className="size-4" />,
        color: 'text-violet-600',
        bgColor: 'bg-violet-100',
    },
    MEETING: {
        icon: <Buildings weight="fill" className="size-4" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
    },
    NOTE_ADDED: {
        icon: <NotePencil weight="fill" className="size-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
    },
    STATUS_CHANGE: {
        icon: <ArrowsClockwise weight="fill" className="size-4" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
    },
    COUNSELOR_ASSIGNED: {
        icon: <User weight="fill" className="size-4" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
    },
    APPLICATION_SUBMITTED: {
        icon: <ClipboardText weight="fill" className="size-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
    },
    APPLICATION_TRANSITIONED: {
        icon: <ArrowRight weight="bold" className="size-4" />,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100',
    },
    PHONE_CALL: {
        icon: <Phone weight="fill" className="size-4" />,
        color: 'text-teal-600',
        bgColor: 'bg-teal-100',
    },
    EMAIL_SENT: {
        icon: <EnvelopeSimple weight="fill" className="size-4" />,
        color: 'text-sky-600',
        bgColor: 'bg-sky-100',
    },
    PAYMENT_SUCCESS: {
        icon: <CurrencyCircleDollar weight="fill" className="size-4" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
    },
    CAMPUS_VISIT: {
        icon: <Buildings weight="fill" className="size-4" />,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
    },
    DUPLICATE_MERGED: {
        icon: <GitMerge weight="fill" className="size-4" />,
        color: 'text-neutral-600',
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
            <div className="absolute -bottom-0 left-[17px] top-[36px] w-px bg-neutral-200 group-last:hidden" />
            <div
                className={`z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm ${config.bgColor} ${config.color}`}
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
                                className="mr-1 inline text-amber-500"
                            />
                        )}
                        {event.title}
                    </h4>
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-neutral-400">
                        {formatTime(event.created_at)}
                    </span>
                </div>
                {event.description && (
                    <div className="mt-1">
                        <p className="whitespace-pre-wrap break-all text-sm leading-relaxed text-neutral-600 sm:break-normal">
                            {isTextExpanded || event.description.length <= 100
                                ? event.description
                                : `${event.description.slice(0, 100).trim()}...`}
                        </p>
                        {event.description.length > 100 && (
                            <button
                                onClick={() => setIsTextExpanded(!isTextExpanded)}
                                className="mt-1 text-xs font-medium text-primary-600 hover:underline"
                            >
                                {isTextExpanded ? 'View less' : 'View more'}
                            </button>
                        )}
                    </div>
                )}
                {event.actor_name && (
                    <p className="mt-1.5 text-[11px] text-neutral-400">
                        by <span className="font-medium text-neutral-500">{event.actor_name}</span>
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Add Note Form (for cross-stage) ──────────────────────────────────────────

function AddNoteForm({ userId }: { userId: string }) {
    const [noteText, setNoteText] = useState('');
    const [actionType, setActionType] = useState('NOTE');
    const [isExpanded, setIsExpanded] = useState(false);
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: () => {
            const label = NOTE_ACTION_TYPES.find((t) => t.value === actionType)?.label || 'Note';
            return createTimelineEventApi({
                type: 'STUDENT',
                type_id: userId,
                action_type: actionType,
                title: label,
                description: noteText.trim(),
                student_user_id: userId,
            });
        },
        onSuccess: () => {
            toast.success('Note added');
            setNoteText('');
            setIsExpanded(false);
            queryClient.invalidateQueries({ queryKey: ['cross-stage-timeline', userId] });
        },
        onError: () => toast.error('Failed to add note'),
    });

    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-sm text-neutral-500 transition-all hover:border-primary-300 hover:bg-primary-50/30 hover:text-primary-600"
            >
                <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add a note or log activity…
            </button>
        );
    }

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {NOTE_ACTION_TYPES.map((type) => (
                    <button
                        key={type.value}
                        onClick={() => setActionType(type.value)}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                            actionType === type.value
                                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                                : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
                        }`}
                    >
                        {type.icon}
                        {type.label}
                    </button>
                ))}
            </div>
            <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Type your note here…"
                rows={3}
                autoFocus
                className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) createMutation.mutate();
                }}
            />
            <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-neutral-400">Ctrl+Enter to submit</span>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-neutral-500"
                        onClick={() => {
                            setIsExpanded(false);
                            setNoteText('');
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        className="h-7 bg-primary-500 px-3 text-xs text-white hover:bg-primary-600"
                        onClick={() => createMutation.mutate()}
                        disabled={createMutation.isPending || !noteText.trim()}
                    >
                        {createMutation.isPending ? 'Saving…' : 'Add Note'}
                    </Button>
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
        return <div className="h-20 animate-pulse rounded-xl bg-neutral-100" />;
    }

    if (!audiences || audiences.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="h-3.5 w-1 rounded-full bg-primary-500" />
                <h4 className="text-sm font-semibold text-neutral-700">Linked Campaigns</h4>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                    {audiences.length}
                </span>
            </div>
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
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400">
                                {a.source_type && <span>{sourceLabel(a.source_type)}</span>}
                                {a.submitted_at && <span>{formatDate(a.submitted_at)}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {a.lead_score != null && (
                                <LeadScoreBadge score={a.lead_score} size="sm" />
                            )}
                            <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${campaignStatusChip(a.campaign_status)}`}
                            >
                                {a.campaign_status ?? '—'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Cross-Stage Timeline Section ──────────────────────────────────────────────

function CrossStageTimeline({ userId }: { userId: string }) {
    const [page, setPage] = useState(0);
    const pageSize = 5;

    const { data, isLoading } = useQuery({
        queryKey: ['cross-stage-timeline', userId, page, pageSize],
        queryFn: () => fetchCrossStageTimeline(userId, page, pageSize),
        enabled: !!userId,
        staleTime: 60 * 1000,
    });

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="h-3.5 w-1 rounded-full bg-primary-500" />
                <h4 className="text-sm font-semibold text-neutral-700">Activity & Notes</h4>
                {data?.totalElements !== undefined && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                        {data.totalElements}
                    </span>
                )}
            </div>

            <AddNoteForm userId={userId} />

            {isLoading && (
                <div className="flex items-center justify-center py-6">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <div className="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                        Loading activity…
                    </div>
                </div>
            )}

            {data && data.content.length > 0 && (
                <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                    {data.content.map((event) => (
                        <TimelineEventItem key={event.id} event={event} />
                    ))}

                    {data.totalPages > 1 && (
                        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                            <span className="text-[11px] text-neutral-400">
                                Page {page + 1} of {data.totalPages}
                            </span>
                            <div className="flex gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={() =>
                                        setPage((p) => Math.min(data.totalPages - 1, p + 1))
                                    }
                                    disabled={page >= data.totalPages - 1}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {data && data.content.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-6 text-center">
                    <ListBullets weight="fill" className="size-8 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-500">No activity yet</p>
                    <p className="text-xs text-neutral-400">
                        Notes, status changes, and other events will appear here
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface StudentLeadProfileProps {
    userId: string;
}

export function StudentLeadProfile({ userId }: StudentLeadProfileProps) {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const queryKey = ['user-lead-profile', userId, instituteId];

    const {
        data: profile,
        isLoading,
        isError,
    } = useQuery({
        queryKey,
        queryFn: () => fetchUserLeadProfile(userId, instituteId),
        enabled: !!userId && !!instituteId,
        staleTime: 2 * 60 * 1000,
        retry: 1,
    });

    const { mutate: changeStatus, isPending: changingStatus } = useMutation({
        mutationFn: (status: string) => updateLeadStatus(userId, instituteId, status),
        onSuccess: (_data, status) => {
            toast.success(`Lead marked as ${status}`);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => toast.error('Failed to update lead status'),
    });

    const { mutate: changeTier, isPending: changingTier } = useMutation({
        mutationFn: (tier: string) => updateLeadTier(userId, instituteId, tier),
        onSuccess: (_data, tier) => {
            toast.success(`Lead tier set to ${tier}`);
            queryClient.invalidateQueries({ queryKey });
        },
        onError: () => toast.error('Failed to update lead tier'),
    });

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 p-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-100" />
                ))}
            </div>
        );
    }

    if (isError || !profile) {
        return (
            <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-10 text-center">
                    <ChartBar weight="fill" className="size-10 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-500">No lead profile yet</p>
                    <p className="text-xs text-neutral-400">
                        A profile will appear once this user submits an enquiry or is scored.
                    </p>
                </div>
                {/* Still show audience list and timeline even without a lead profile */}
                <AudienceListSection userId={userId} />
                <CrossStageTimeline userId={userId} />
            </div>
        );
    }

    const { label: sLabel, className: sClass } = statusLabel(profile.conversion_status);
    const isConverted = profile.conversion_status === 'CONVERTED';

    return (
        <div className="flex flex-col gap-5">
            {/* ── Score + Tier control ── */}
            <div className="rounded-xl border border-neutral-100 bg-gradient-to-r from-neutral-50 to-white p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="mb-1 text-xs text-muted-foreground">Lead Interest Score</p>
                        <LeadScoreBadge score={profile.best_score} size="md" />
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${sClass}`}>
                        {sLabel}
                    </span>
                </div>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                    <p className="mb-1.5 text-xs text-muted-foreground">Set Tier</p>
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
                            const colors = {
                                HOT: isActive
                                    ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                                    : 'bg-neutral-50 text-neutral-500 hover:bg-red-50',
                                WARM: isActive
                                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                                    : 'bg-neutral-50 text-neutral-500 hover:bg-amber-50',
                                COLD: isActive
                                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                                    : 'bg-neutral-50 text-neutral-500 hover:bg-blue-50',
                            };
                            return (
                                <button
                                    key={tier}
                                    onClick={() => changeTier(tier)}
                                    disabled={changingTier}
                                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${colors[tier]}`}
                                >
                                    {tier}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Stat grid ── */}
            <div className="grid grid-cols-2 gap-2">
                <StatCard
                    icon={<Megaphone size={18} />}
                    label="Campaigns"
                    value={profile.campaign_count}
                />
                <StatCard
                    icon={<Lightning size={18} />}
                    label="Timeline Events"
                    value={profile.total_timeline_events}
                />
                <StatCard
                    icon={<CalendarCheck size={18} />}
                    label="Demo Attendance"
                    value={profile.demo_attendance_count}
                />
                <StatCard
                    icon={<ChartBar size={18} />}
                    label="Best Source"
                    value={sourceLabel(profile.best_source_type)}
                />
            </div>

            {/* ── Dates ── */}
            <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Activity</span>
                    <span className="font-medium">{formatDate(profile.last_activity_at)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead Since</span>
                    <span className="font-medium">{formatDate(profile.created_at)}</span>
                </div>
                {isConverted && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Converted On</span>
                        <span className="font-medium text-green-700">
                            {formatDate(profile.converted_at)}
                        </span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Score Updated</span>
                    <span className="font-medium">{formatDate(profile.last_calculated_at)}</span>
                </div>
            </div>

            {/* ── Status control ── */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                <p className="mb-1.5 text-xs text-muted-foreground">Lead Status</p>
                <div className="flex gap-1.5">
                    {(
                        [
                            {
                                value: 'LEAD',
                                label: 'Lead',
                                active: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
                                hover: 'hover:bg-blue-50',
                            },
                            {
                                value: 'CONVERTED',
                                label: 'Converted',
                                active: 'bg-green-100 text-green-700 ring-1 ring-green-300',
                                hover: 'hover:bg-green-50',
                            },
                            {
                                value: 'LOST',
                                label: 'Lost',
                                active: 'bg-red-100 text-red-700 ring-1 ring-red-300',
                                hover: 'hover:bg-red-50',
                            },
                        ] as const
                    ).map((s) => (
                        <button
                            key={s.value}
                            onClick={() => changeStatus(s.value)}
                            disabled={changingStatus}
                            className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                                profile.conversion_status === s.value
                                    ? s.active
                                    : `bg-neutral-50 text-neutral-500 ${s.hover}`
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                {isConverted && (
                    <p className="mt-2 text-[11px] text-green-600">
                        Score updates are frozen while converted.
                    </p>
                )}
            </div>

            {/* ── Linked Campaigns ── */}
            <AudienceListSection userId={userId} />

            {/* ── Cross-Stage Timeline ── */}
            <CrossStageTimeline userId={userId} />
        </div>
    );
}
