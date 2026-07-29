import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import {
    formatDuration,
    initialsOf,
    KpiCard,
    LiveStatusLine,
    PulseMessage,
    slideIconFor,
    useSecondsTicker,
    // Reused rather than duplicated: these are pure presentational helpers already shipped and
    // design-system conformant for Course Pulse.
} from '@/routes/study-library/courses/course-details/-components/pulse/pulse-shared';
import {
    instituteAssessmentsQueryOptions,
    instituteLiveClassesQueryOptions,
    institutePulseSummaryQueryOptions,
} from '../-services/institute-pulse-services';
import type { InstituteRosterRow, PulseState } from '../-types/institute-pulse-types';

const STATE_META: Record<PulseState, { label: string; chip: string; rail: string }> = {
    NEEDS_HELP: {
        label: 'Needs help',
        chip: 'bg-danger-50 text-danger-600',
        rail: 'bg-danger-500',
    },
    IDLE: { label: 'Idle', chip: 'bg-warning-50 text-warning-600', rail: 'bg-warning-500' },
    ACTIVE: { label: 'Active', chip: 'bg-success-50 text-success-600', rail: 'bg-success-500' },
};

function RosterRow({
    row,
    secondsSinceFetch,
}: {
    row: InstituteRosterRow;
    secondsSinceFetch: number;
}) {
    const meta = STATE_META[row.state];
    const Icon = slideIconFor(row.slideType);

    return (
        <div className="relative flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 hover:bg-neutral-50">
            <span className={cn('absolute inset-y-0 left-0 w-1', meta.rail)} />
            <div
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    meta.chip
                )}
            >
                {initialsOf(row.fullName)}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-700">
                    {row.fullName ?? 'Unknown learner'}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    <Icon size={14} className="shrink-0 text-neutral-400" />
                    <span className="truncate">{row.slideTitle ?? 'Untitled slide'}</span>
                </p>
            </div>

            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', meta.chip)}>
                {meta.label}
            </span>

            <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums text-neutral-600">
                {formatDuration(row.onSlideSeconds + secondsSinceFetch)}
            </span>
        </div>
    );
}

export default function OverviewView({
    instituteId,
    scope,
}: {
    instituteId: string;
    scope: string;
}) {
    const [pageCount, setPageCount] = useState(1);

    // The roster is paged. useQueries rather than useInfiniteQuery: an infinite query refetches
    // EVERY loaded page on each poll, which would make pagination cost more than not paginating.
    // Page 0 keeps polling; deeper pages sit frozen as snapshots.
    const summaryPages = useQueries({
        queries: Array.from({ length: pageCount }, (_, i) =>
            institutePulseSummaryQueryOptions(instituteId, true, i, scope)
        ),
    });
    // summaryPages[0] is typed as possibly-undefined, so unpack once with safe fallbacks
    // rather than optional-chaining at every use site.
    const first = summaryPages[0];
    const summaryData = first?.data;
    const summaryLoading = first?.isLoading ?? true;
    const summaryError = first?.isError ?? false;
    const summaryFetching = summaryPages.some((p) => p.isFetching);
    const summaryUpdatedAt = first?.dataUpdatedAt ?? 0;
    const refetchSummary = () => summaryPages.forEach((p) => p.refetch());

    // Live classes and assessments are deliberately separate calls, not one aggregate: a slow or
    // failing assessments rail (5-connection pool, separate service) must not blank the tiles.
    const classes = useQuery(instituteLiveClassesQueryOptions(instituteId, true, 0, 0, scope));
    const assessments = useQuery(instituteAssessmentsQueryOptions(instituteId, true, 0, scope));

    const now = useSecondsTicker();
    const secondsSinceFetch = summaryUpdatedAt
        ? Math.max(0, Math.floor((now - summaryUpdatedAt) / 1000))
        : 0;

    if (summaryLoading) {
        return (
            <div className="flex items-center justify-center rounded-md bg-white p-10 shadow-sm">
                <DashboardLoader />
            </div>
        );
    }

    if (summaryError) {
        return (
            <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
                <PulseMessage
                    tone="danger"
                    title="Couldn't load the institute pulse."
                    subtitle="Check your connection and try again."
                    action={
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => refetchSummary()}
                        >
                            Retry
                        </MyButton>
                    }
                />
            </div>
        );
    }

    // counts/totalPresent are institute-wide window aggregates from the server, so they stay
    // correct no matter how many pages are loaded.
    const counts = summaryData?.counts;
    const roster = summaryPages.flatMap((p) => p.data?.roster ?? []);
    const lastRosterPage = summaryPages[summaryPages.length - 1]?.data;
    const rosterHasMore = lastRosterPage?.hasMore ?? false;
    const rosterLoadingMore = summaryPages[summaryPages.length - 1]?.isLoading ?? false;

    return (
        <div className="flex flex-col gap-4">
            <LiveStatusLine secondsSinceFetch={secondsSinceFetch} isFetching={summaryFetching} />

            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
                <KpiCard
                    label="In content"
                    value={summaryData?.totalPresent ?? 0}
                    hint={`of ${counts?.enrolled ?? 0} enrolled`}
                    tone="bg-primary-500"
                />
                <KpiCard
                    label="Needs help"
                    value={counts?.needHelp ?? 0}
                    hint="stuck on a slide"
                    tone="bg-danger-500"
                />
                <KpiCard
                    label="Classes on air"
                    value={classes.data?.onAirCount ?? 0}
                    hint={
                        classes.isError
                            ? 'unavailable'
                            : `${classes.data?.joinedNow ?? 0} of ${classes.data?.invitedNow ?? 0} joined`
                    }
                    tone="bg-success-500"
                />
                <KpiCard
                    label="Assessments live"
                    value={assessments.data?.totals.liveAssessments ?? 0}
                    hint={
                        assessments.isError
                            ? 'unavailable'
                            : `${assessments.data?.totals.inProgress ?? 0} attempting now`
                    }
                    tone="bg-warning-500"
                />
                <KpiCard
                    label="Next 60 min"
                    value={classes.data?.upcomingCount ?? 0}
                    hint={classes.isError ? 'unavailable' : 'classes starting soon'}
                    tone="bg-neutral-300"
                />
            </div>

            {(classes.isError || assessments.isError) && (
                <p className="text-xs text-warning-600">
                    {classes.isError && assessments.isError
                        ? 'Live classes and assessments are temporarily unavailable.'
                        : classes.isError
                          ? 'Live classes are temporarily unavailable.'
                          : 'Assessments are temporarily unavailable.'}{' '}
                    Everything else on this page is current.
                </p>
            )}

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Learners · needs attention first
                    </p>
                    {summaryData && summaryData.totalPresent > roster.length && (
                        <p className="text-xs text-neutral-400">
                            showing {roster.length} of {summaryData.totalPresent} present
                        </p>
                    )}
                </div>

                {roster.length === 0 ? (
                    <PulseMessage
                        title="No one's in content right now"
                        subtitle="Learners appear here the moment they open a slide."
                    />
                ) : (
                    <>
                        {roster.map((row) => (
                            <RosterRow
                                key={row.userId}
                                row={row}
                                secondsSinceFetch={secondsSinceFetch}
                            />
                        ))}
                        {rosterHasMore && (
                            <div className="flex justify-center border-t border-neutral-100 py-2.5">
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    disable={rosterLoadingMore}
                                    onClick={() => setPageCount((c) => c + 1)}
                                >
                                    {rosterLoadingMore ? 'Loading…' : 'Show more'}
                                </MyButton>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
