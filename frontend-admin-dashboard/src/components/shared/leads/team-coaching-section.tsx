import { useQuery } from '@tanstack/react-query';
import { Sparkle, Star, Lightbulb, Warning, ChartBar } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { fetchTeamCoaching } from './services/call-intelligence';
import { useCallIntelligenceEnabled } from './use-call-intelligence-enabled';

/**
 * Whole-team call-quality coaching — the same transcript-derived coaching insights
 * aggregated across the acting user's entire team (backend scopes to the caller's
 * reporting line): average ratings, the team's weakest skills, the coaching themes
 * that recur most, and the objections the team hits most. Self-gates on the
 * feature flag; renders nothing when there are no analyzed calls in range.
 */

interface Props {
    instituteId: string;
    fromMillis?: number;
    toMillis?: number;
    className?: string;
}

const fmt = (n?: number | null) => (n == null ? '—' : n.toFixed(1));
function scoreTone(v?: number | null): { text: string; bar: string } {
    if (v == null) return { text: 'text-neutral-500', bar: 'bg-neutral-300' };
    if (v >= 7) return { text: 'text-success-600', bar: 'bg-success-500' };
    if (v >= 4) return { text: 'text-warning-600', bar: 'bg-warning-500' };
    return { text: 'text-danger-600', bar: 'bg-danger-500' };
}
const prettify = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export function TeamCoachingSection({ instituteId, fromMillis, toMillis, className }: Props) {
    const featureEnabled = useCallIntelligenceEnabled();
    const { data } = useQuery({
        queryKey: ['team-coaching', instituteId, fromMillis, toMillis],
        queryFn: () => fetchTeamCoaching(instituteId, fromMillis, toMillis),
        enabled: featureEnabled && !!instituteId,
        staleTime: 60 * 1000,
    });

    if (!featureEnabled || !data || data.totalAnalyzed === 0) return null;

    const qualities = data.qualityAverages ?? [];
    const tips = data.topCoachingTips ?? [];
    const objections = data.topObjections ?? [];

    return (
        <section
            className={cn('rounded-lg border border-primary-100 bg-primary-50/40 p-4', className)}
        >
            <div className="mb-3 flex items-center gap-1.5 text-body font-medium text-primary-700">
                <Sparkle className="size-4" weight="fill" />
                Team coaching
                <span className="text-caption font-normal text-neutral-500">
                    · {data.totalAnalyzed} calls analyzed across the team
                </span>
            </div>

            {/* Headline ratings */}
            <div className="flex flex-wrap gap-2">
                <span
                    className={cn(
                        'flex items-center gap-1 rounded-md bg-white px-2 py-1 text-caption',
                        scoreTone(data.avgCallerSelfGoalRating).text
                    )}
                >
                    <Star className="size-3.5" weight="fill" /> Avg caller{' '}
                    {fmt(data.avgCallerSelfGoalRating)}
                </span>
                <span
                    className={cn(
                        'flex items-center gap-1 rounded-md bg-white px-2 py-1 text-caption',
                        scoreTone(data.avgCallOutputRating).text
                    )}
                >
                    <Star className="size-3.5" weight="fill" /> Avg outcome{' '}
                    {fmt(data.avgCallOutputRating)}
                </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Team skill breakdown — weakest first */}
                {qualities.length > 0 && (
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                            <ChartBar size={13} /> Where the team can improve
                        </p>
                        <div className="space-y-2">
                            {qualities.map((q) => {
                                const pct =
                                    q.avgScore == null ? 0 : Math.max(4, (q.avgScore / 10) * 100);
                                const tone = scoreTone(q.avgScore);
                                const weak = (q.weakCounsellors ?? []).filter((w) =>
                                    (w.name ?? w.counsellorUserId)?.trim()
                                );
                                return (
                                    <div key={q.key} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-3">
                                            <span className="w-36 shrink-0 truncate text-caption text-neutral-600">
                                                {prettify(q.key)}
                                            </span>
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                                                <div
                                                    className={cn('h-full rounded-full', tone.bar)}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span
                                                className={cn(
                                                    'w-8 shrink-0 text-right text-caption font-medium',
                                                    tone.text
                                                )}
                                            >
                                                {fmt(q.avgScore)}
                                            </span>
                                        </div>
                                        {weak.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1 pl-36 text-caption text-neutral-500">
                                                <span>Can improve:</span>
                                                {weak.map((w) => (
                                                    <span
                                                        key={w.counsellorUserId}
                                                        className="rounded-full bg-white px-2 py-0.5 text-neutral-600"
                                                    >
                                                        {w.name ?? w.counsellorUserId}
                                                        {w.avgScore != null && (
                                                            <span className="text-neutral-400">
                                                                {' '}
                                                                · {w.avgScore.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {tips.length > 0 && (
                        <div>
                            <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                                <Lightbulb size={13} /> Recurring coaching themes
                            </p>
                            <ul className="space-y-1.5">
                                {tips.slice(0, 5).map((t, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 text-body text-neutral-700"
                                    >
                                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-400" />
                                        <span className="flex-1">{t.text}</span>
                                        {t.count > 1 && (
                                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-caption text-neutral-500">
                                                {t.count}×
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {objections.length > 0 && (
                        <div>
                            <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                                <Warning size={13} /> Objections the team hits most
                            </p>
                            <ul className="space-y-1.5">
                                {objections.slice(0, 5).map((o, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-2 text-body text-neutral-700"
                                    >
                                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning-400" />
                                        <span className="flex-1">{o.objection}</span>
                                        <span className="shrink-0 text-caption text-neutral-500">
                                            handled {o.handledCount}/{o.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
