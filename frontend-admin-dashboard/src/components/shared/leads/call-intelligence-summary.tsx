import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkle, Star, ChartBar } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useGetUserBasicDetails } from '@/services/get_user_basic_details';
import {
    fetchCounsellorCallIntelligence,
    fetchTeamCallIntelligence,
    type CallIntelligenceAnalyticsDto,
} from './services/call-intelligence';

/**
 * Compact Call-Intelligence roll-up card. Two modes:
 *   - counsellor: one counsellor's analyzed calls (their workbench).
 *   - team: the acting sales head's whole reporting line, with a per-counsellor
 *     leaderboard. Backend scopes "team" to the caller's descendants.
 * Renders nothing when there are no analyzed calls (so it stays out of the way
 * for institutes that haven't enabled Call Intelligence).
 */

interface CounsellorProps {
    mode: 'counsellor';
    counsellorUserId: string;
    fromMillis?: number;
    toMillis?: number;
    className?: string;
    nameByUserId?: Map<string, string>;
}
interface TeamProps {
    mode: 'team';
    instituteId: string;
    fromMillis?: number;
    toMillis?: number;
    className?: string;
    nameByUserId?: Map<string, string>;
}
type Props = CounsellorProps | TeamProps;

const fmt = (n?: number | null): string => (n == null ? '—' : n.toFixed(1));

function ratingTone(score?: number | null): string {
    if (score == null) return 'text-neutral-500';
    if (score >= 7) return 'text-success-600';
    if (score >= 4) return 'text-warning-600';
    return 'text-danger-600';
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="flex flex-col">
            <span className={cn('text-h3 font-semibold', tone ?? 'text-neutral-900')}>{value}</span>
            <span className="text-caption text-neutral-500">{label}</span>
        </div>
    );
}

export function CallIntelligenceSummary(props: Props) {
    const { mode, fromMillis, toMillis, className, nameByUserId } = props;
    const counsellorUserId = mode === 'counsellor' ? props.counsellorUserId : undefined;
    const instituteId = mode === 'team' ? props.instituteId : undefined;

    const query = useQuery<CallIntelligenceAnalyticsDto>({
        queryKey: [
            'call-intel-analytics',
            mode,
            counsellorUserId,
            instituteId,
            fromMillis,
            toMillis,
        ],
        queryFn: () =>
            mode === 'counsellor'
                ? fetchCounsellorCallIntelligence(counsellorUserId, fromMillis, toMillis)
                : fetchTeamCallIntelligence(instituteId as string, fromMillis, toMillis),
        enabled: mode === 'counsellor' ? !!counsellorUserId : !!instituteId,
        staleTime: 60 * 1000,
    });

    const data = query.data;

    // Resolve counsellor names for the team leaderboard (hook must run every render).
    const perCounsellorIds = useMemo(
        () => (data?.perCounsellor ?? []).map((c) => c.counsellorUserId).filter(Boolean),
        [data]
    );
    const { data: counsellorUsers } = useGetUserBasicDetails(perCounsellorIds);
    const resolvedNames = useMemo(() => {
        const m = new Map<string, string>(nameByUserId ?? []);
        (counsellorUsers ?? []).forEach((u) => {
            if (u.id && u.name && !m.has(u.id)) m.set(u.id, u.name);
        });
        return m;
    }, [counsellorUsers, nameByUserId]);

    if (query.isLoading || !data || data.totalAnalyzed === 0) return null;

    const perCounsellor = (data.perCounsellor ?? [])
        .slice()
        .sort((a, b) => (b.avgCallerSelfGoalRating ?? 0) - (a.avgCallerSelfGoalRating ?? 0));

    return (
        <div className={cn('rounded-lg border border-primary-100 bg-primary-50/40 p-4', className)}>
            <div className="mb-3 flex items-center gap-1.5 text-body font-medium text-primary-700">
                <Sparkle className="size-4" weight="fill" />
                Call intelligence
                <span className="text-caption font-normal text-neutral-500">
                    · {data.totalAnalyzed} analyzed
                </span>
            </div>

            <div className="flex flex-wrap gap-6">
                <Metric label="Analyzed calls" value={String(data.totalAnalyzed)} />
                <Metric
                    label="Avg caller rating"
                    value={fmt(data.avgCallerSelfGoalRating)}
                    tone={ratingTone(data.avgCallerSelfGoalRating)}
                />
                <Metric
                    label="Avg outcome rating"
                    value={fmt(data.avgCallOutputRating)}
                    tone={ratingTone(data.avgCallOutputRating)}
                />
            </div>

            {Object.keys(data.statusDistribution ?? {}).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(data.statusDistribution).map(([k, v]) => (
                        <span
                            key={k}
                            className="rounded-full bg-white px-2 py-0.5 text-caption text-neutral-600"
                        >
                            {k.replace(/_/g, ' ').toLowerCase()}: {v}
                        </span>
                    ))}
                </div>
            )}

            {mode === 'team' && perCounsellor.length > 0 && (
                <div className="mt-4">
                    <div className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                        <ChartBar className="size-3.5" />
                        By counsellor
                    </div>
                    <ul className="divide-y divide-neutral-100">
                        {perCounsellor.map((c) => (
                            <li
                                key={c.counsellorUserId}
                                className="flex items-center justify-between py-1.5 text-body"
                            >
                                <span className="truncate text-neutral-700">
                                    {resolvedNames.get(c.counsellorUserId) ?? c.counsellorUserId}
                                </span>
                                <span className="flex items-center gap-3 text-caption text-neutral-500">
                                    <span>{c.totalAnalyzed} calls</span>
                                    <span
                                        className={cn(
                                            'flex items-center gap-1',
                                            ratingTone(c.avgCallerSelfGoalRating)
                                        )}
                                    >
                                        <Star className="size-3.5" weight="fill" />
                                        {fmt(c.avgCallerSelfGoalRating)}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
