/**
 * Call Intelligence tab (Reports Center) — team + call analytics from the AI
 * analysis of call recordings. Shows headline quality KPIs, the outcome + lead-
 * sentiment mix, and a per-counsellor call-quality leaderboard. Scope is the
 * acting user's reporting line (backend resolves the team); the shell's date
 * range applies. Read-only, with the standard loading / empty / deploy-pending
 * states.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkle, Star, ChartBar, Smiley, PhoneCall } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useGetUserBasicDetails } from '@/services/get_user_basic_details';
import {
    fetchTeamCallIntelligence,
    type CallIntelligenceAnalyticsDto,
} from '@/components/shared/leads/services/call-intelligence';
import {
    BreakdownBar,
    BreakdownCard,
    EmptyHint,
    KpiCard,
    ReportErrorState,
    ReportSection,
    ReportTabSkeleton,
    avatarPalette,
    fmtNumber,
    type ReportTabProps,
} from './report-shared';

const toMillis = (d: string, endOfDay = false): number | undefined => {
    const t = new Date(endOfDay ? `${d}T23:59:59` : d).getTime();
    return Number.isNaN(t) ? undefined : t;
};

const fmtRating = (n?: number | null) => (n == null ? '—' : `${n.toFixed(1)}/10`);
const ratingTone = (n?: number | null): 'success' | 'warning' | 'danger' | 'default' => {
    if (n == null) return 'default';
    if (n >= 7) return 'success';
    if (n >= 4) return 'warning';
    return 'danger';
};

const STATUS_LABEL: Record<string, string> = {
    CONNECTED_POSITIVE: 'Positive',
    CONNECTED_NEUTRAL: 'Neutral',
    CONNECTED_NEGATIVE: 'Negative',
    CALLBACK_REQUESTED: 'Callback requested',
    NOT_INTERESTED: 'Not interested',
    INFORMATION_ONLY: 'Info only',
    NO_CLEAR_OUTCOME: 'No clear outcome',
    WRONG_NUMBER: 'Wrong number',
};
const SENTIMENT_COLOR: Record<string, string> = {
    POSITIVE: 'bg-green-600',
    NEUTRAL: 'bg-neutral-400',
    NEGATIVE: 'bg-red-500',
};

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';

export default function CallIntelligenceTab({ instituteId, fromDate, toDate }: ReportTabProps) {
    const from = toMillis(fromDate);
    const to = toMillis(toDate, true);

    const query = useQuery<CallIntelligenceAnalyticsDto>({
        queryKey: ['ci-report-team', instituteId, from, to],
        queryFn: () => fetchTeamCallIntelligence(instituteId, from, to),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });

    const data = query.data;
    const perCounsellor = useMemo(
        () =>
            (data?.perCounsellor ?? [])
                .slice()
                .sort(
                    (a, b) => (b.avgCallerSelfGoalRating ?? 0) - (a.avgCallerSelfGoalRating ?? 0)
                ),
        [data]
    );
    const ids = useMemo(() => perCounsellor.map((c) => c.counsellorUserId), [perCounsellor]);
    const { data: users } = useGetUserBasicDetails(ids);
    const nameById = useMemo(() => {
        const m = new Map<string, string>();
        (users ?? []).forEach((u) => u.id && u.name && m.set(u.id, u.name));
        return m;
    }, [users]);

    if (query.isLoading) return <ReportTabSkeleton />;
    if (query.isError)
        return <ReportErrorState error={query.error} onRetry={() => query.refetch()} />;
    if (!data || data.totalAnalyzed === 0) {
        return (
            <EmptyHint message="No analyzed calls in this range. Enable CRM Intelligence and analyze calls to populate this report." />
        );
    }

    const statusTotal = Object.values(data.statusDistribution ?? {}).reduce((s, v) => s + v, 0);
    const sentimentTotal = Object.values(data.sentimentDistribution ?? {}).reduce(
        (s, v) => s + v,
        0
    );
    const positive = data.sentimentDistribution?.POSITIVE ?? 0;
    const positivePct = sentimentTotal > 0 ? Math.round((positive / sentimentTotal) * 100) : null;

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Calls analyzed"
                    value={fmtNumber(data.totalAnalyzed)}
                    icon={<Sparkle size={18} weight="fill" />}
                    tone="primary"
                />
                <KpiCard
                    label="Avg caller rating"
                    value={fmtRating(data.avgCallerSelfGoalRating)}
                    sub="how well reps advanced their goal"
                    icon={<Star size={18} weight="fill" />}
                    tone={ratingTone(data.avgCallerSelfGoalRating)}
                />
                <KpiCard
                    label="Avg outcome rating"
                    value={fmtRating(data.avgCallOutputRating)}
                    sub="how calls landed for the lead"
                    icon={<PhoneCall size={18} weight="fill" />}
                    tone={ratingTone(data.avgCallOutputRating)}
                />
                <KpiCard
                    label="Positive sentiment"
                    value={positivePct == null ? '—' : `${positivePct}%`}
                    sub={`${positive} of ${sentimentTotal} leads`}
                    icon={<Smiley size={18} weight="fill" />}
                    tone={positivePct != null && positivePct >= 50 ? 'success' : 'default'}
                />
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BreakdownCard title="Call outcomes" icon={<ChartBar size={16} />}>
                    {Object.entries(data.statusDistribution ?? {}).length === 0 ? (
                        <EmptyHint />
                    ) : (
                        Object.entries(data.statusDistribution)
                            .sort((a, b) => b[1] - a[1])
                            .map(([k, v]) => (
                                <BreakdownBar
                                    key={k}
                                    label={STATUS_LABEL[k] ?? k}
                                    count={v}
                                    total={statusTotal}
                                />
                            ))
                    )}
                </BreakdownCard>

                <BreakdownCard title="Lead sentiment" icon={<Smiley size={16} />}>
                    {Object.entries(data.sentimentDistribution ?? {}).length === 0 ? (
                        <EmptyHint />
                    ) : (
                        Object.entries(data.sentimentDistribution)
                            .sort((a, b) => b[1] - a[1])
                            .map(([k, v]) => (
                                <BreakdownBar
                                    key={k}
                                    label={cap(k)}
                                    count={v}
                                    total={sentimentTotal}
                                    colorClass={SENTIMENT_COLOR[k] ?? 'bg-primary-500'}
                                />
                            ))
                    )}
                </BreakdownCard>
            </div>

            {/* Team leaderboard */}
            <ReportSection title="Team — call quality" icon={<ChartBar size={16} />}>
                {perCounsellor.length === 0 ? (
                    <EmptyHint message="No per-counsellor data in this range." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                                    <th className="py-2 text-left">Counsellor</th>
                                    <th className="py-2 text-right">Calls</th>
                                    <th className="py-2 text-right">Avg caller</th>
                                    <th className="py-2 text-right">Avg outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perCounsellor.map((c) => {
                                    const name =
                                        nameById.get(c.counsellorUserId) ?? c.counsellorUserId;
                                    return (
                                        <tr
                                            key={c.counsellorUserId}
                                            className="border-b border-neutral-100 last:border-0"
                                        >
                                            <td className="py-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={cn(
                                                            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                                            avatarPalette(name)
                                                        )}
                                                    >
                                                        {initials(name)}
                                                    </span>
                                                    <span className="truncate text-neutral-800">
                                                        {name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 text-right text-neutral-700">
                                                {c.totalAnalyzed}
                                            </td>
                                            <td
                                                className={cn(
                                                    'py-2 text-right font-medium',
                                                    ratingTone(c.avgCallerSelfGoalRating) ===
                                                        'success'
                                                        ? 'text-green-700'
                                                        : ratingTone(c.avgCallerSelfGoalRating) ===
                                                            'warning'
                                                          ? 'text-amber-700'
                                                          : ratingTone(
                                                                  c.avgCallerSelfGoalRating
                                                              ) === 'danger'
                                                            ? 'text-red-600'
                                                            : 'text-neutral-500'
                                                )}
                                            >
                                                {fmtRating(c.avgCallerSelfGoalRating)}
                                            </td>
                                            <td className="py-2 text-right text-neutral-700">
                                                {fmtRating(c.avgCallOutputRating)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </ReportSection>
        </div>
    );
}
