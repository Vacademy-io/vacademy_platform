import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import {
    formatDuration,
    LiveStatusLine,
    PulseMessage,
    useSecondsTicker,
} from '@/routes/study-library/courses/course-details/-components/pulse/pulse-shared';
import { instituteAssessmentsQueryOptions } from '../-services/institute-pulse-services';
import type {
    AssessmentFunnel,
    AttemptRisk,
    AttemptRiskReason,
    EvaluationPipelineRow,
} from '../-types/institute-pulse-types';

/**
 * Three buckets, not four. "In preview" was dropped as its own stat — opening the preview screen
 * isn't starting the attempt, and it wasn't a number anyone acted on.
 *
 * It is FOLDED into "Not started" rather than simply hidden: the buckets have to sum to
 * `enrolled` for the stacked bar to mean anything, so dropping the segment outright would make
 * a learner in preview silently vanish from a total that still claimed to include them. The
 * backend still returns `inPreview` separately, so restoring it is a UI-only change.
 */
const FUNNEL_SEGMENTS: {
    key: string;
    label: string;
    bar: string;
    dot: string;
    value: (row: AssessmentFunnel) => number;
}[] = [
    {
        key: 'submitted',
        label: 'Submitted',
        bar: 'bg-success-500',
        dot: 'bg-success-500',
        value: (r) => r.submitted,
    },
    {
        key: 'inProgress',
        label: 'In progress',
        bar: 'bg-primary-500',
        dot: 'bg-primary-500',
        value: (r) => r.inProgress,
    },
    {
        key: 'notStarted',
        label: 'Not started',
        bar: 'bg-neutral-300',
        dot: 'bg-neutral-300',
        value: (r) => r.notStarted + r.inPreview,
    },
];

const RISK_META: Record<AttemptRiskReason, { label: string; chip: string }> = {
    OVERRUN: { label: 'Overrun', chip: 'bg-danger-50 text-danger-600' },
    AUTO_SUBMIT_SOON: { label: 'Auto-submit soon', chip: 'bg-warning-50 text-warning-600' },
    STALLED: { label: 'Stalled', chip: 'bg-danger-50 text-danger-600' },
};

function FunnelCard({ row }: { row: AssessmentFunnel }) {
    const total = Math.max(1, row.enrolled);

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-neutral-700">
                    {row.assessmentName ?? 'Untitled assessment'}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                    {row.enrolled} enrolled
                </span>
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                {FUNNEL_SEGMENTS.map((seg) => {
                    const value = seg.value(row);
                    if (value <= 0) return null;
                    return (
                        <div
                            key={seg.key}
                            className={seg.bar}
                            // Dynamic data-driven width: a stacked funnel segment is a continuous
                            // proportion of the enrolled count, so it cannot map to a spacing token.
                            style={{ width: `${(value / total) * 100}%` }}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                {FUNNEL_SEGMENTS.map((seg) => (
                    <div key={seg.key} className="flex items-center gap-1.5">
                        <span className={cn('size-2 shrink-0 rounded-full', seg.dot)} />
                        <span className="truncate text-xs text-neutral-500">{seg.label}</span>
                        <span className="ml-auto text-xs font-semibold tabular-nums text-neutral-700">
                            {seg.value(row)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RiskRow({ risk }: { risk: AttemptRisk }) {
    const meta = risk.primaryReason ? RISK_META[risk.primaryReason] : null;

    return (
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0 hover:bg-neutral-50">
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-700">
                    {risk.participantName ?? 'Unknown learner'}
                </p>
                <p className="truncate text-xs text-neutral-500">
                    {risk.assessmentName ?? 'Untitled assessment'}
                </p>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {risk.reasons.map((reason) => (
                    <span
                        key={reason}
                        className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            RISK_META[reason].chip
                        )}
                    >
                        {RISK_META[reason].label}
                    </span>
                ))}
            </div>

            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                {risk.secondsRemaining === null
                    ? '—'
                    : risk.secondsRemaining < 0
                      ? `+${formatDuration(-risk.secondsRemaining)}`
                      : formatDuration(risk.secondsRemaining)}
            </span>
            {meta && <span className="sr-only">{meta.label}</span>}
        </div>
    );
}

const PIPELINE_STAGES: {
    key: string;
    label: string;
    bar: string;
    dot: string;
    value: (row: EvaluationPipelineRow) => number;
}[] = [
    {
        key: 'evaluated',
        label: 'Evaluated',
        bar: 'bg-success-500',
        dot: 'bg-success-500',
        value: (r) => r.evaluated,
    },
    {
        key: 'evaluating',
        label: 'Evaluating',
        bar: 'bg-primary-500',
        dot: 'bg-primary-500',
        value: (r) => r.evaluating,
    },
    {
        key: 'awaiting',
        label: 'Awaiting',
        bar: 'bg-neutral-300',
        dot: 'bg-neutral-300',
        value: (r) => r.awaiting,
    },
    {
        key: 'failed',
        label: 'Failed',
        bar: 'bg-danger-500',
        dot: 'bg-danger-500',
        value: (r) => r.failed,
    },
];

function endedLabel(epoch: number | null): string {
    if (!epoch) return 'recently';
    const mins = Math.max(0, Math.floor((Date.now() - epoch) / 60000));
    if (mins < 60) return `ended ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `ended ${hours}h ago`;
    return `ended ${Math.floor(hours / 24)}d ago`;
}

function PipelineRow({ row }: { row: EvaluationPipelineRow }) {
    const total = Math.max(1, row.submitted);
    // `released` is a SUBSET of evaluated, so it is reported separately rather than as a bar
    // segment — including it would double-count and the bar would overflow.
    const fullyReleased = row.released >= row.submitted && row.submitted > 0;

    return (
        <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-700">
                        {row.assessmentName ?? 'Untitled assessment'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                        {endedLabel(row.endedAtEpoch)} · {row.submitted} submitted
                    </p>
                </div>
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                        fullyReleased
                            ? 'bg-success-50 text-success-600'
                            : 'bg-warning-50 text-warning-600'
                    )}
                >
                    {row.released}/{row.submitted} released
                </span>
            </div>

            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                {PIPELINE_STAGES.map((stage) => {
                    const value = stage.value(row);
                    if (value <= 0) return null;
                    return (
                        <div
                            key={stage.key}
                            className={stage.bar}
                            // Dynamic data-driven width: a continuous proportion of submitted
                            // attempts, so it cannot map to a spacing token.
                            style={{ width: `${(value / total) * 100}%` }}
                        />
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {PIPELINE_STAGES.filter((stage) => stage.value(row) > 0).map((stage) => (
                    <span key={stage.key} className="flex items-center gap-1.5 text-xs">
                        <span className={cn('size-2 shrink-0 rounded-full', stage.dot)} />
                        <span className="text-neutral-500">{stage.label}</span>
                        <span className="font-semibold tabular-nums text-neutral-700">
                            {stage.value(row)}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function AssessmentsView({
    instituteId,
    scope,
}: {
    instituteId: string;
    scope: string;
}) {
    const [pageCount, setPageCount] = useState(1);

    // useQueries rather than useInfiniteQuery: an infinite query refetches EVERY loaded page on
    // each poll, which would make pagination cost more than not paginating at all. Separate
    // queries let page 0 keep polling while deeper pages sit frozen as snapshots.
    const pages = useQueries({
        queries: Array.from({ length: pageCount }, (_, i) =>
            instituteAssessmentsQueryOptions(instituteId, true, i, scope)
        ),
    });

    const first = pages[0];
    const data = first?.data;
    const isLoading = first?.isLoading ?? true;
    const isError = first?.isError ?? false;
    const isFetching = pages.some((p) => p.isFetching);
    const dataUpdatedAt = first?.dataUpdatedAt ?? 0;
    const refetch = () => pages.forEach((p) => p.refetch());

    const now = useSecondsTicker();
    const secondsSinceFetch = dataUpdatedAt
        ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1000))
        : 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center rounded-md bg-white p-10 shadow-sm">
                <DashboardLoader />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
                <PulseMessage
                    tone="danger"
                    title="Couldn't load assessments."
                    subtitle="This rail is served by the assessment service; the rest of the page is unaffected."
                    action={
                        <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                            Retry
                        </MyButton>
                    }
                />
            </div>
        );
    }

    // Flatten every loaded page; only page 0 is live, the rest are snapshots.
    const assessments = pages.flatMap((p) => p.data?.assessments ?? []);
    const lastPage = pages[pages.length - 1]?.data;
    const hasMore = lastPage?.hasMore ?? false;
    const loadingMore = pages[pages.length - 1]?.isLoading ?? false;
    const risks = data?.risks ?? [];
    const totals = data?.totals;
    const pipeline = data?.evaluationPipeline ?? [];

    return (
        <div className="flex flex-col gap-4">
            <LiveStatusLine secondsSinceFetch={secondsSinceFetch} isFetching={isFetching} />

            {assessments.length === 0 ? (
                <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <PulseMessage
                        title="No assessments are live right now"
                        subtitle="Assessments appear here while their scheduled window is open."
                    />
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {assessments.map((row) => (
                            <FunnelCard key={row.assessmentId} row={row} />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex items-center justify-center gap-3">
                            <p className="text-xs text-neutral-400">
                                showing {assessments.length} of {totals?.liveAssessments ?? 0} live
                                assessments
                            </p>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                disable={loadingMore}
                                onClick={() => setPageCount((c) => c + 1)}
                            >
                                {loadingMore ? 'Loading…' : 'Show more'}
                            </MyButton>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                Attempts needing attention
                            </p>
                            {data?.riskCapped && (
                                <p className="text-xs text-neutral-400">
                                    showing first {risks.length}
                                </p>
                            )}
                        </div>
                        {risks.length === 0 ? (
                            <PulseMessage
                                title="Every live attempt looks healthy"
                                subtitle={`${totals?.inProgress ?? 0} in progress across ${totals?.liveAssessments ?? 0} assessments.`}
                            />
                        ) : (
                            risks.map((risk) => <RiskRow key={risk.attemptId} risk={risk} />)
                        )}
                    </div>
                </>
            )}

            {/* Results pipeline — scoped to assessments that have ENDED, so it is rendered
                outside the "nothing is live" branch: results still need chasing precisely when
                nothing is live any more. Refreshed far less often than the live rail. */}
            {pipeline.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Results pipeline · recently ended
                        </p>
                        <p className="text-xs text-neutral-400">
                            last 48h{data?.evaluationCapped ? ` · first ${pipeline.length}` : ''}
                        </p>
                    </div>
                    {pipeline.map((row) => (
                        <PipelineRow key={row.assessmentId} row={row} />
                    ))}
                </div>
            )}
        </div>
    );
}
