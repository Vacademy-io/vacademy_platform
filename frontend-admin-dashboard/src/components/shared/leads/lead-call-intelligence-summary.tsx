import { useQuery } from '@tanstack/react-query';
import { Sparkle, Star, Target, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { fetchLeadCallIntelligence, type CallIntelligenceDto } from './services/call-intelligence';
import { useCallIntelligenceEnabled } from './use-call-intelligence-enabled';

/**
 * Per-lead Call Intelligence rollup — the AI read across ALL of this lead's
 * analyzed calls: how many, average caller/outcome ratings, sentiment, the
 * latest recommended next step, and the objections that recur for this lead.
 * Self-gates on the feature flag and renders nothing when the lead has no
 * analyzed calls (so it stays out of the way).
 */

interface Props {
    responseId?: string | null;
    className?: string;
}

const fmt = (n?: number | null) => (n == null ? '—' : n.toFixed(1));
function ratingTone(v?: number | null): string {
    if (v == null) return 'bg-neutral-100 text-neutral-600';
    if (v >= 7) return 'bg-success-50 text-success-700';
    if (v >= 4) return 'bg-warning-50 text-warning-700';
    return 'bg-danger-50 text-danger-700';
}
const SENTIMENT_TONE: Record<string, string> = {
    POSITIVE: 'bg-success-50 text-success-700',
    NEUTRAL: 'bg-neutral-100 text-neutral-600',
    NEGATIVE: 'bg-danger-50 text-danger-700',
};

function mean(nums: number[]): number | null {
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

export function LeadCallIntelligenceSummary({ responseId, className }: Props) {
    const featureEnabled = useCallIntelligenceEnabled();
    const { data } = useQuery({
        queryKey: ['lead-call-intelligence', responseId],
        queryFn: () => fetchLeadCallIntelligence(responseId as string),
        enabled: featureEnabled && !!responseId,
        staleTime: 60 * 1000,
    });

    if (!featureEnabled || !responseId) return null;

    const completed = (data ?? []).filter((c) => c.status === 'COMPLETED');
    if (completed.length === 0) return null;

    const avgCaller = mean(
        completed.map((c) => c.callerSelfGoalRating).filter((n): n is number => n != null)
    );
    const avgOutput = mean(
        completed.map((c) => c.callOutputRating).filter((n): n is number => n != null)
    );
    const latest: CallIntelligenceDto = completed[0]!; // backend returns newest-first
    const nextBestAction = latest.analysis?.next_best_action;

    const sentimentCounts = completed.reduce<Record<string, number>>((acc, c) => {
        if (c.leadSentiment) acc[c.leadSentiment] = (acc[c.leadSentiment] ?? 0) + 1;
        return acc;
    }, {});

    // Recurring objections across the lead's calls.
    const objCounts = new Map<string, number>();
    for (const c of completed) {
        for (const o of c.analysis?.call_analysis?.objections ?? []) {
            if (o.objection) objCounts.set(o.objection, (objCounts.get(o.objection) ?? 0) + 1);
        }
    }
    const topObjections = Array.from(objCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    return (
        <div className={cn('rounded-lg border border-primary-100 bg-primary-50/40 p-3', className)}>
            <div className="mb-2 flex items-center gap-1.5 text-body font-medium text-primary-700">
                <Sparkle className="size-4" weight="fill" />
                Call intelligence
                <span className="text-caption font-normal text-neutral-500">
                    · {completed.length} analyzed
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-caption',
                        ratingTone(avgCaller)
                    )}
                >
                    <Star className="size-3.5" weight="fill" /> Caller {fmt(avgCaller)}
                </span>
                <span
                    className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-caption',
                        ratingTone(avgOutput)
                    )}
                >
                    <Star className="size-3.5" weight="fill" /> Outcome {fmt(avgOutput)}
                </span>
                {Object.entries(sentimentCounts).map(([k, v]) => (
                    <span
                        key={k}
                        className={cn(
                            'rounded-full px-2 py-0.5 text-caption',
                            SENTIMENT_TONE[k] ?? 'bg-neutral-100 text-neutral-600'
                        )}
                    >
                        {k.toLowerCase()} {v}
                    </span>
                ))}
            </div>

            {nextBestAction && (
                <div className="mt-2 flex items-start gap-1.5 text-body text-neutral-700">
                    <Target className="mt-0.5 size-4 shrink-0 text-primary-400" />
                    <span>
                        <span className="font-medium text-neutral-700">Next best action:</span>{' '}
                        {nextBestAction}
                    </span>
                </div>
            )}

            {topObjections.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Warning className="size-4 shrink-0 text-warning-500" />
                    {topObjections.map(([o, n]) => (
                        <span
                            key={o}
                            className="rounded-full bg-white px-2 py-0.5 text-caption text-neutral-600"
                        >
                            {o}
                            {n > 1 ? ` ·${n}` : ''}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
