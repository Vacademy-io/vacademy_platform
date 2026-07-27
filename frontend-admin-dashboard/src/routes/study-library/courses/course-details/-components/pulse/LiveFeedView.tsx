import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import { pulseFeedQueryOptions } from '../../-services/pulse-services';
import type { PulseFeedEvent } from '../../-types/pulse-types';
import { LiveStatusLine, PulseMessage, slideIconFor } from './pulse-shared';

const VERB: Record<string, string> = {
    SUBMITTED_ASSIGNMENT: 'submitted',
    SUBMITTED_ASSESSMENT: 'submitted',
    CODE_SUBMISSION: 'ran',
    ANSWERED_QUESTION: 'answered',
    ANSWERED_QUIZ: 'answered',
};

/** Tone from the event's detail text (verdict / answer status). */
function toneFor(event: PulseFeedEvent): string {
    const d = (event.detail ?? '').toLowerCase();
    if (/(wrong|incorrect|fail|wa|tle|error|late)/.test(d)) return 'text-danger-600';
    if (/(correct|accept|passed|ac|all )/.test(d)) return 'text-success-600';
    return 'text-neutral-400';
}

function formatClock(epochMs: number): string {
    return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function EventRow({ event }: { event: PulseFeedEvent }) {
    const Icon = slideIconFor(event.slideType);
    const verb = VERB[event.eventType] ?? 'updated';
    return (
        <div className="flex items-baseline gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0">
            <time className="w-12 shrink-0 text-xs tabular-nums text-neutral-400">
                {formatClock(event.occurredAtEpoch)}
            </time>
            <Icon size={15} className="shrink-0 translate-y-0.5 text-neutral-400" />
            <p className="min-w-0 flex-1 text-sm text-neutral-700">
                <span className="font-semibold">{event.fullName ?? 'A learner'}</span> {verb}{' '}
                <span className="text-neutral-500">{event.slideTitle ?? 'a slide'}</span>
                {event.detail && (
                    <span className={cn('font-medium', toneFor(event))}> · {event.detail}</span>
                )}
            </p>
        </div>
    );
}

export default function LiveFeedView({ batchId, active }: { batchId: string; active: boolean }) {
    const { data, isLoading, isError, refetch, dataUpdatedAt, isFetching } = useQuery(
        pulseFeedQueryOptions(batchId, active)
    );

    const secondsSinceFetch = dataUpdatedAt
        ? Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000))
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
                    title="Couldn't load the live feed."
                    action={
                        <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                            Retry
                        </MyButton>
                    }
                />
            </div>
        );
    }

    const events = data?.events ?? [];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <LiveStatusLine secondsSinceFetch={secondsSinceFetch} isFetching={isFetching} />
                <p className="text-xs text-neutral-400">
                    last {data?.windowMinutes ?? 15} min · newest first
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                {events.length === 0 ? (
                    <PulseMessage
                        title="Nothing has happened in this batch yet"
                        subtitle="Submissions, attempts and code runs show up here as they land."
                    />
                ) : (
                    events.map((e, i) => <EventRow key={`${e.userId}-${e.occurredAtEpoch}-${i}`} event={e} />)
                )}
            </div>
        </div>
    );
}
