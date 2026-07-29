import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardText, VideoCamera } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import {
    initialsOf,
    LiveStatusLine,
    PulseMessage,
    slideIconFor,
    useSecondsTicker,
} from '@/routes/study-library/courses/course-details/-components/pulse/pulse-shared';
import {
    instituteAssessmentsQueryOptions,
    institutePulseFeedQueryOptions,
} from '../-services/institute-pulse-services';
import type {
    FeedRail,
    InstituteFeedEvent,
    InstituteFeedEventType,
} from '../-types/institute-pulse-types';

const EVENT_LABEL: Record<InstituteFeedEventType, string> = {
    SUBMITTED_ASSIGNMENT: 'submitted an assignment',
    // An assessment SLIDE inside a chapter (admin_core, assessment_slide_tracked) — not the same
    // thing as a standalone assessment, which is SUBMITTED_ASSESSMENT_ATTEMPT below.
    SUBMITTED_ASSESSMENT: 'submitted an assessment slide',
    CODE_SUBMISSION: 'ran code',
    ANSWERED_QUESTION: 'answered a question',
    ANSWERED_QUIZ: 'answered a quiz',
    JOINED_CLASS: 'joined a live class',
    SUBMITTED_ASSESSMENT_ATTEMPT: 'submitted an assessment',
    // Inferred by diffing provider polls, so the actor is a provider participant id we cannot
    // yet map to a name — see the deferred customerKey correlation.
    JOINED_ROOM: 'entered the room',
    LEFT_ROOM: 'left the room',
};

function agoLabel(epoch: number, now: number): string {
    const seconds = Math.max(0, Math.floor((now - epoch) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * One visual identity per rail, so the three event sources are separable at a glance instead of
 * being one undifferentiated grey list. Colour is carried by a left edge stripe AND the avatar
 * tint — the stripe scans vertically, the tint reads next to the name.
 */
const RAIL_META: Record<FeedRail, { rail: string; avatar: string; icon: string; label: string }> = {
    CONTENT: {
        rail: 'bg-neutral-300',
        avatar: 'bg-neutral-100 text-neutral-600',
        icon: 'text-neutral-400',
        label: 'Content',
    },
    LIVE_CLASS: {
        rail: 'bg-primary-500',
        avatar: 'bg-primary-50 text-primary-600',
        icon: 'text-primary-500',
        label: 'Live class',
    },
    ASSESSMENT: {
        rail: 'bg-warning-500',
        avatar: 'bg-warning-50 text-warning-600',
        icon: 'text-warning-600',
        label: 'Assessment',
    },
};

function FeedRow({ event, now }: { event: InstituteFeedEvent; now: number }) {
    const meta = RAIL_META[event.rail] ?? RAIL_META.CONTENT;
    const Icon =
        event.rail === 'LIVE_CLASS'
            ? VideoCamera
            : event.rail === 'ASSESSMENT'
              ? ClipboardText
              : slideIconFor(event.slideType ?? '');

    return (
        <div className="relative flex items-center gap-3 border-b border-neutral-100 py-2.5 pl-5 pr-4 last:border-b-0 hover:bg-neutral-50">
            <span className={cn('absolute inset-y-0 left-0 w-1', meta.rail)} />
            <div
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    meta.avatar
                )}
            >
                {initialsOf(event.fullName)}
            </div>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-700">
                    <span className="font-medium">
                        {event.fullName ??
                            (event.rail === 'LIVE_CLASS' ? 'A participant' : 'Unknown learner')}
                    </span>{' '}
                    <span className="text-neutral-500">{EVENT_LABEL[event.eventType]}</span>
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                    <Icon size={13} className={cn('shrink-0', meta.icon)} />
                    <span className="truncate">{event.slideTitle ?? '—'}</span>
                </p>
            </div>

            {event.detail && (
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                        event.detail === 'INCORRECT'
                            ? 'bg-danger-50 text-danger-600'
                            : event.detail === 'CORRECT'
                              ? 'bg-success-50 text-success-600'
                              : 'bg-neutral-100 text-neutral-600'
                    )}
                >
                    {event.detail}
                </span>
            )}

            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-400">
                {agoLabel(event.occurredAtEpoch, now)}
            </span>
        </div>
    );
}

export default function FeedView({ instituteId, scope }: { instituteId: string; scope: string }) {
    // The feed grows its limit rather than paging — see institutePulseFeedQueryOptions.
    const [feedLimit, setFeedLimit] = useState(10);

    const { data, isLoading, isError, refetch, dataUpdatedAt, isFetching } = useQuery(
        institutePulseFeedQueryOptions(instituteId, true, feedLimit, scope)
    );

    // Standalone assessment submissions live in a different service and database, so the
    // admin_core feed is structurally blind to them. Fetch them alongside and merge by
    // timestamp. This query is already in flight for the Assessments tab, so TanStack serves it
    // from the same cache entry rather than issuing a second request.
    const assessments = useQuery(instituteAssessmentsQueryOptions(instituteId, true, 0, scope));

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
                    title="Couldn't load the live feed."
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

    const contentEvents = data?.events ?? [];
    const submissionEvents: InstituteFeedEvent[] = (assessments.data?.recentSubmissions ?? [])
        .filter((sub) => sub.submittedAtEpoch != null)
        .map((sub) => ({
            occurredAtEpoch: sub.submittedAtEpoch as number,
            userId: sub.userId,
            fullName: sub.participantName,
            slideId: null,
            slideTitle: sub.assessmentName,
            slideType: null,
            rail: 'ASSESSMENT' as const,
            eventType: 'SUBMITTED_ASSESSMENT_ATTEMPT' as const,
            detail: null,
            actorRole: null,
        }));

    // Re-cap to the requested limit after merging, so "show 10" stays 10 once assessment
    // submissions are folded in rather than silently becoming 10 + however many arrived.
    const merged = [...contentEvents, ...submissionEvents].sort(
        (a, b) => b.occurredAtEpoch - a.occurredAtEpoch
    );
    const events = merged.slice(0, feedLimit);
    const hasMore = (data?.hasMore ?? false) || merged.length > feedLimit;

    return (
        <div className="flex flex-col gap-4">
            <LiveStatusLine secondsSinceFetch={secondsSinceFetch} isFetching={isFetching} />

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Live feed · content and classes
                    </p>
                    <div className="flex items-center gap-3">
                        {(Object.keys(RAIL_META) as FeedRail[]).map((rail) => (
                            <span
                                key={rail}
                                className="flex items-center gap-1.5 text-xs text-neutral-500"
                            >
                                <span
                                    className={cn(
                                        'size-2 shrink-0 rounded-full',
                                        RAIL_META[rail].rail
                                    )}
                                />
                                {RAIL_META[rail].label}
                            </span>
                        ))}
                        <span className="text-xs text-neutral-400">
                            last {data?.windowMinutes ?? 15} min
                        </span>
                    </div>
                </div>

                {events.length === 0 ? (
                    <PulseMessage
                        title="Nothing has happened in the last few minutes"
                        subtitle="Submissions, answers and class joins show up here as they happen."
                    />
                ) : (
                    <>
                        {events.map((event) => (
                            <FeedRow
                                key={`${event.userId}-${event.occurredAtEpoch}-${event.eventType}`}
                                event={event}
                                now={now}
                            />
                        ))}
                        {hasMore && (
                            <div className="flex justify-center border-t border-neutral-100 py-2.5">
                                <MyButton
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => setFeedLimit((l) => l + 10)}
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
