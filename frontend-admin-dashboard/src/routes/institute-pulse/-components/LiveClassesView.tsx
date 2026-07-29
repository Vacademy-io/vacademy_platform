import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Clock, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import {
    LiveStatusLine,
    PulseMessage,
    useSecondsTicker,
} from '@/routes/study-library/courses/course-details/-components/pulse/pulse-shared';
import { instituteLiveClassesQueryOptions } from '../-services/institute-pulse-services';
import type { LiveClassCard } from '../-types/institute-pulse-types';

function clockOf(epoch: number | null): string {
    if (!epoch) return '—';
    return new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function turnoutTone(percent: number): string {
    if (percent >= 70) return 'bg-success-500';
    if (percent >= 40) return 'bg-warning-500';
    return 'bg-danger-500';
}

function OnAirCard({ card }: { card: LiveClassCard }) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-700">
                        {card.title ?? 'Untitled class'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                        {card.subject ?? 'No subject'} · {clockOf(card.startEpoch)} –{' '}
                        {clockOf(card.endEpoch)}
                    </p>
                </div>
                {card.runningOver ? (
                    <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-600">
                        Running over
                    </span>
                ) : card.started ? (
                    <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-600">
                        On air
                    </span>
                ) : (
                    // The scheduled window is open but no attendance row exists yet. Showing
                    // "not started" is honest; a 0% turnout donut would not be.
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                        Not started
                    </span>
                )}
            </div>

            {(card.started || card.runningOver) && (
                <>
                    <div className="flex items-end justify-between gap-2">
                        <div className="flex gap-4">
                            <div>
                                <p className="text-lg font-semibold tabular-nums leading-none text-neutral-700">
                                    {card.joined}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">joined</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold tabular-nums leading-none text-neutral-700">
                                    {card.absent}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">absent</p>
                            </div>
                            <div>
                                <p className="text-lg font-semibold tabular-nums leading-none text-neutral-700">
                                    {card.invited}
                                </p>
                                <p className="mt-1 text-xs text-neutral-500">invited</p>
                            </div>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-neutral-600">
                            {card.turnoutPercent}%
                        </p>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className={cn('h-full rounded-full', turnoutTone(card.turnoutPercent))}
                            // Dynamic data-driven width: turnout is a continuous percentage, so it
                            // cannot map to a spacing token.
                            style={{ width: `${Math.min(100, card.turnoutPercent)}%` }}
                        />
                    </div>

                    {/* `joined` is cumulative (turnout); `inRoomNow` is provider-reported current
                        occupancy. Shown separately because they answer different questions — and
                        omitted entirely when the provider hasn't told us, rather than guessed. */}
                    <p className="text-xs text-neutral-400">
                        {card.inRoomNow !== null
                            ? `${card.inRoomNow} in the room now · ${card.joined} joined in total`
                            : card.attendanceSynced
                              ? `Joined ever · as of ${clockOf(card.lastSyncEpoch)}`
                              : 'Joined ever · live'}
                    </p>
                </>
            )}
        </div>
    );
}

function UpcomingRow({ card }: { card: LiveClassCard }) {
    return (
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0">
            <Clock size={16} className="shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-700">
                    {card.title ?? 'Untitled class'}
                </p>
                <p className="truncate text-xs text-neutral-500">{card.subject ?? 'No subject'}</p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                {clockOf(card.startEpoch)}
            </span>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-400">
                {card.invited} invited
            </span>
        </div>
    );
}

export default function LiveClassesView({
    instituteId,
    scope,
}: {
    instituteId: string;
    scope: string;
}) {
    const [onAirPages, setOnAirPages] = useState(1);
    const [upcomingPages, setUpcomingPages] = useState(1);

    // Each list pages independently. A page request asks for that list's slice; only the
    // first (onAirPage 0 / upcomingPage 0) keeps polling — expanded slices are snapshots.
    const onAirQueries = useQueries({
        queries: Array.from({ length: onAirPages }, (_, i) =>
            instituteLiveClassesQueryOptions(instituteId, true, i, 0, scope)
        ),
    });
    const upcomingQueries = useQueries({
        queries: Array.from({ length: upcomingPages }, (_, i) =>
            instituteLiveClassesQueryOptions(instituteId, true, 0, i, scope)
        ),
    });

    const base = onAirQueries[0];
    const data = base?.data;
    const isLoading = base?.isLoading ?? true;
    const isError = base?.isError ?? false;
    const isFetching = onAirQueries.some((q) => q.isFetching);
    const dataUpdatedAt = base?.dataUpdatedAt ?? 0;
    const refetch = () => onAirQueries.forEach((q) => q.refetch());

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
                    title="Couldn't load live classes."
                    subtitle="Check your connection and try again."
                    action={
                        <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                            Retry
                        </MyButton>
                    }
                />
            </div>
        );
    }

    const onAir = onAirQueries.flatMap((q) => q.data?.onAir ?? []);
    // upcomingQueries[0] duplicates page 0 of onAirQueries[0]; take upcoming only from its own set.
    const upcoming = upcomingQueries.flatMap((q) => q.data?.upcoming ?? []);
    const onAirHasMore = onAirQueries[onAirQueries.length - 1]?.data?.onAirHasMore ?? false;
    const upcomingHasMore =
        upcomingQueries[upcomingQueries.length - 1]?.data?.upcomingHasMore ?? false;
    const anySynced = onAir.some((c) => c.attendanceSynced);

    return (
        <div className="flex flex-col gap-4">
            <LiveStatusLine secondsSinceFetch={secondsSinceFetch} isFetching={isFetching} />

            {anySynced && (
                <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2">
                    <WarningCircle size={16} className="mt-0.5 shrink-0 text-warning-600" />
                    <p className="text-xs text-warning-700">
                        Zoom and Google classes report attendance on a sync, not at join time, so
                        their counts lag the room. Cards are stamped with when they were last
                        synced.
                    </p>
                </div>
            )}

            {onAir.length === 0 ? (
                <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
                    <PulseMessage
                        title="No classes on air right now"
                        subtitle="Sessions appear here once their scheduled window opens."
                    />
                </div>
            ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {onAir.map((card) => (
                            <OnAirCard key={card.scheduleId} card={card} />
                        ))}
                    </div>
                    {onAirHasMore && (
                        <div className="flex items-center justify-center gap-3">
                            <p className="text-xs text-neutral-400">
                                showing {onAir.length} of {data?.onAirCount ?? 0} on air
                            </p>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setOnAirPages((c) => c + 1)}
                            >
                                Show more
                            </MyButton>
                        </div>
                    )}
                </>
            )}

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Starting in the next 60 minutes
                    </p>
                </div>
                {upcoming.length === 0 ? (
                    <PulseMessage title="Nothing scheduled in the next hour" />
                ) : (
                    <>
                        {upcoming.map((card) => (
                            <UpcomingRow key={card.scheduleId} card={card} />
                        ))}
                        {upcomingHasMore && (
                            <div className="flex items-center justify-center gap-3 border-t border-neutral-100 py-2.5">
                                <p className="text-xs text-neutral-400">
                                    showing {upcoming.length} of {data?.upcomingCount ?? 0}
                                </p>
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setUpcomingPages((c) => c + 1)}
                                >
                                    Show more
                                </MyButton>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
