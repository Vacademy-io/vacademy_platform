import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
    Sparkle,
    Star,
    Lightbulb,
    Warning,
    Target,
    ChartBar,
    ArrowsLeftRight,
    PhoneCall,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { CallIntelligencePanel } from '@/components/shared/leads';
import { fetchCounsellorCoaching } from '@/components/shared/leads/services/call-intelligence';
import { fetchDispositions } from '@/routes/audience-manager/reports/-services/get-crm-reports';

/**
 * CounsellorInsightsTab — the team-head coaching view for one counsellor. Two
 * halves:
 *   1. Work summary (always shown): what they DID over the window — leads
 *      dispositioned (status changes, broken down by the status moved to) and
 *      call reach (dials / connected). From the dispositions report endpoint.
 *   2. AI coaching (when calls have been analyzed): overall ratings, weakest
 *      rubric skills, recurring coaching tips, common objections, and recent
 *      calls to drill into.
 */

interface Props {
    instituteId: string;
    counsellorUserId: string;
}

const WINDOW_DAYS = 30;

const fmt = (n?: number | null) => (n == null ? '—' : n.toFixed(1));

/** 0–10 → tone for text/bar. */
function scoreTone(v?: number | null): { text: string; bar: string } {
    if (v == null) return { text: 'text-neutral-500', bar: 'bg-neutral-300' };
    if (v >= 7) return { text: 'text-success-600', bar: 'bg-success-500' };
    if (v >= 4) return { text: 'text-warning-600', bar: 'bg-warning-500' };
    return { text: 'text-danger-600', bar: 'bg-danger-500' };
}

const prettify = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="flex flex-col rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <span className={cn('text-h2 font-semibold', tone ?? 'text-neutral-900')}>{value}</span>
            <span className="text-caption text-neutral-500">{label}</span>
        </div>
    );
}

export function CounsellorInsightsTab({ instituteId, counsellorUserId }: Props) {
    return (
        <div className="flex flex-col gap-5">
            <WorkSummarySection instituteId={instituteId} counsellorUserId={counsellorUserId} />
            <CoachingInsights instituteId={instituteId} counsellorUserId={counsellorUserId} />
        </div>
    );
}

// ── Work summary: what the counsellor DID (dispositions + call reach) ──────────

function WorkSummarySection({ instituteId, counsellorUserId }: Props) {
    // Stable yyyy-MM-dd strings (constant within the day) so the query key doesn't
    // churn every render.
    const toDate = format(new Date(), 'yyyy-MM-dd');
    const fromDate = format(subDays(new Date(), WINDOW_DAYS - 1), 'yyyy-MM-dd');
    const { data } = useQuery({
        queryKey: ['counsellor-work-summary', instituteId, counsellorUserId, fromDate, toDate],
        queryFn: () => fetchDispositions({ instituteId, counsellorUserId, fromDate, toDate }),
        enabled: !!instituteId && !!counsellorUserId,
        staleTime: 60 * 1000,
    });

    if (!data) return null;
    const row = data.rows.find((r) => r.user_id === counsellorUserId);
    const co = data.call_outcomes.find((r) => r.user_id === counsellorUserId);
    const dials = co ? Object.values(co.outcomes).reduce((s, n) => s + n, 0) : 0;
    const connected = co?.outcomes.COMPLETED ?? 0;
    const reach = dials > 0 ? Math.round((connected / dials) * 100) : null;
    const totalChanges = row?.total_changes ?? 0;
    const changes = row?.changes ?? {};
    if (totalChanges === 0 && dials === 0) return null;

    const statusLabel = new Map(data.statuses.map((s) => [s.status_key, s.label]));
    const changeRows = Object.entries(changes).sort((a, b) => b[1] - a[1]);

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-1.5 text-body font-medium text-neutral-800">
                <ArrowsLeftRight size={16} className="text-primary-500" />
                Work summary
                <span className="text-caption font-normal text-neutral-400">
                    · last {WINDOW_DAYS} days
                </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Status changes" value={String(totalChanges)} />
                <Metric label="Calls made" value={String(dials)} />
                <Metric label="Connected" value={String(connected)} />
                <Metric
                    label="Reach"
                    value={reach == null ? '—' : `${reach}%`}
                    tone={
                        reach == null
                            ? undefined
                            : reach >= 40
                              ? 'text-success-600'
                              : reach >= 20
                                ? 'text-warning-600'
                                : 'text-danger-600'
                    }
                />
            </div>
            {changeRows.length > 0 && (
                <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-neutral-500">
                        <PhoneCall size={13} /> Statuses moved to
                    </p>
                    <div className="space-y-2">
                        {changeRows.map(([key, count]) => {
                            const pct =
                                totalChanges > 0 ? Math.max(4, (count / totalChanges) * 100) : 0;
                            return (
                                <div key={key} className="flex items-center gap-3">
                                    <span className="w-40 shrink-0 truncate text-caption text-neutral-600">
                                        {statusLabel.get(key) ?? prettify(key)}
                                    </span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                                        <div
                                            className="h-full rounded-full bg-primary-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-caption font-medium text-neutral-700">
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

// ── AI coaching from call transcripts ─────────────────────────────────────────

function CoachingInsights({ instituteId, counsellorUserId }: Props) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['counsellor-coaching', counsellorUserId, instituteId],
        queryFn: () => fetchCounsellorCoaching(counsellorUserId),
        enabled: !!counsellorUserId && !!instituteId,
        staleTime: 60 * 1000,
    });

    if (isLoading) {
        return <div className="p-4 text-subtitle text-neutral-500">Loading coaching insights…</div>;
    }
    if (isError) {
        return (
            <div className="p-4 text-subtitle text-danger-600">
                Couldn’t load insights. If Call Intelligence isn’t deployed on this backend, this
                won’t be available yet.
            </div>
        );
    }
    if (!data || data.totalAnalyzed === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-neutral-300 p-8 text-center text-subtitle text-neutral-500">
                <Sparkle size={22} className="text-neutral-400" />
                No AI-analyzed calls yet for this counsellor.
                <span className="text-caption text-neutral-400">
                    Enable CRM Intelligence and analyze some calls to see call-quality coaching.
                </span>
            </div>
        );
    }

    const focusAreas = data.qualityAverages.slice(0, 2).map((q) => q.key);

    return (
        <div className="flex flex-col gap-5">
            {/* Headline metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Calls analyzed" value={String(data.totalAnalyzed)} />
                <Metric
                    label="Avg caller rating"
                    value={fmt(data.avgCallerSelfGoalRating)}
                    tone={scoreTone(data.avgCallerSelfGoalRating).text}
                />
                <Metric
                    label="Avg outcome rating"
                    value={fmt(data.avgCallOutputRating)}
                    tone={scoreTone(data.avgCallOutputRating).text}
                />
                <Metric
                    label="Focus areas"
                    value={focusAreas.length ? String(focusAreas.length) : '—'}
                />
            </div>

            {/* Skill breakdown — weakest first */}
            {data.qualityAverages.length > 0 && (
                <section className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-1.5 text-body font-medium text-neutral-800">
                        <ChartBar size={16} className="text-primary-500" />
                        Skill breakdown
                        <span className="text-caption font-normal text-neutral-400">
                            · weakest first
                        </span>
                    </div>
                    <div className="space-y-2.5">
                        {data.qualityAverages.map((q) => {
                            const pct =
                                q.avgScore == null ? 0 : Math.max(4, (q.avgScore / 10) * 100);
                            const tone = scoreTone(q.avgScore);
                            return (
                                <div key={q.key} className="flex items-center gap-3">
                                    <span className="w-40 shrink-0 truncate text-caption text-neutral-600">
                                        {prettify(q.key)}
                                    </span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                                        <div
                                            className={cn('h-full rounded-full', tone.bar)}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span
                                        className={cn(
                                            'w-10 shrink-0 text-right text-caption font-medium',
                                            tone.text
                                        )}
                                    >
                                        {fmt(q.avgScore)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* What to improve — recurring coaching tips */}
            {data.topCoachingTips.length > 0 && (
                <section className="rounded-lg border border-primary-100 bg-primary-50/40 p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-body font-medium text-primary-700">
                        <Lightbulb size={16} weight="fill" />
                        What to improve
                    </div>
                    <ul className="space-y-1.5">
                        {data.topCoachingTips.map((t, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-2 text-body text-neutral-700"
                            >
                                <Target className="mt-0.5 size-4 shrink-0 text-primary-400" />
                                <span className="flex-1">{t.text}</span>
                                {t.count > 1 && (
                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-caption text-neutral-500">
                                        {t.count}× calls
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Common objections */}
            {data.topObjections.length > 0 && (
                <section className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-body font-medium text-neutral-800">
                        <Warning size={16} className="text-warning-500" />
                        Objections they hit most
                    </div>
                    <ul className="space-y-1.5">
                        {data.topObjections.map((o, i) => (
                            <li
                                key={i}
                                className="flex items-start gap-2 text-body text-neutral-700"
                            >
                                <span className="flex-1">{o.objection}</span>
                                <span className="shrink-0 text-caption text-neutral-500">
                                    handled {o.handledCount}/{o.count}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Recent calls — drill into the transcript analysis */}
            {data.recentCalls.length > 0 && (
                <section>
                    <div className="mb-2 flex items-center gap-1.5 text-body font-medium text-neutral-800">
                        <Star size={16} weight="fill" className="text-neutral-400" />
                        Recent analyzed calls
                    </div>
                    <ul className="space-y-1.5">
                        {data.recentCalls.map((c) => (
                            <li
                                key={c.callLogId}
                                className="rounded-md border border-neutral-200 bg-white p-3"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-caption text-neutral-500">
                                        <span
                                            className={cn(
                                                'font-medium',
                                                scoreTone(c.callerSelfGoalRating).text
                                            )}
                                        >
                                            Caller {fmt(c.callerSelfGoalRating)}
                                        </span>
                                        <span
                                            className={cn(
                                                'font-medium',
                                                scoreTone(c.callOutputRating).text
                                            )}
                                        >
                                            Outcome {fmt(c.callOutputRating)}
                                        </span>
                                        {c.genericStatus && (
                                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                                                {prettify(c.genericStatus.toLowerCase())}
                                            </span>
                                        )}
                                    </div>
                                    <time className="text-caption text-neutral-400">
                                        {c.callStartedAt
                                            ? format(new Date(c.callStartedAt), 'd MMM, h:mm a')
                                            : ''}
                                    </time>
                                </div>
                                {c.summary && (
                                    <p className="mt-1 line-clamp-2 text-caption text-neutral-600">
                                        {c.summary}
                                    </p>
                                )}
                                <div className="mt-2">
                                    <CallIntelligencePanel callLogId={c.callLogId} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
