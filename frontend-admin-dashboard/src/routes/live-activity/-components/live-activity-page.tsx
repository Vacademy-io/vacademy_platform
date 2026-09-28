import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Broadcast, Pause, Play } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import {
    markLiveActivitySeen,
    useLiveActivityBackfill,
    useLiveActivityCounts,
    type LiveActivityCategory,
} from '../-services/live-activity-service';
import { useLiveActivityStream } from '../-hooks/useLiveActivityStream';
import { collapseEvents } from './collapse-events';
import { ActivityRow } from './ActivityRow';

const ALL_TAB = 'ALL';

const ALL_CATEGORIES: LiveActivityCategory[] = [
    'INVITE_FORM',
    'LEAD_FORM',
    'CALL',
    'PAYMENT',
    'COUNSELLOR',
];

const CATEGORY_LABELS: Record<LiveActivityCategory, string> = {
    INVITE_FORM: 'Enrolments',
    LEAD_FORM: 'Leads',
    CALL: 'Calls',
    PAYMENT: 'Payments',
    COUNSELLOR: 'Counsellors',
};

const START_OF_TODAY = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
};

export function LiveActivityPage() {
    const { setNavHeading } = useNavHeadingStore();
    const search = useSearch({ from: '/live-activity/' });
    const navigate = useNavigate({ from: '/live-activity/' });
    const instituteId = getInstituteId() ?? '';

    const [paused, setPaused] = useState(false);
    const activeTab = search.category ?? ALL_TAB;
    const since = useMemo(START_OF_TODAY, []);

    const { events, bufferedCount, status, allowedCategories, releaseBuffer, seed } =
        useLiveActivityStream({ instituteId, paused });

    const backfill = useLiveActivityBackfill(instituteId, { size: 100 });
    const counts = useLiveActivityCounts(instituteId, since);

    useEffect(() => {
        setNavHeading(<h1 className="text-subtitle font-medium">Live Activity</h1>);
    }, [setNavHeading]);

    // Seed once from the backfill, then let the stream take over. Ordering matters: the
    // hook dedupes by eventId, so an event arriving during the handoff is not shown twice.
    useEffect(() => {
        if (backfill.data?.content) {
            seed(backfill.data.content);
        }
    }, [backfill.data, seed]);

    // Opening the page clears the sidebar badge.
    useEffect(() => {
        if (instituteId) {
            void markLiveActivitySeen(instituteId).catch(() => {
                // A failed mark-seen only means the badge lingers -- not worth surfacing.
            });
        }
    }, [instituteId]);

    // Render every category tab regardless of what the token reported.
    //
    // These were previously driven by allowedCategories, which only arrives after the
    // stream token is minted -- so a slow or failed mint left the page with no tabs at
    // all, which reads as broken rather than degraded. Access is enforced server-side
    // anyway: the token carries the permitted set and the bus filters each frame against
    // it, so a tab the caller may not see simply stays empty. allowedCategories is still
    // consulted below, purely to hide a tab that genuinely returns nothing for this role.
    const visibleCategories: LiveActivityCategory[] =
        allowedCategories.length > 0 ? allowedCategories : ALL_CATEGORIES;

    const filtered = useMemo(() => {
        if (activeTab === ALL_TAB) return events;
        return events.filter((event) => event.category === activeTab);
    }, [events, activeTab]);

    const collapsed = useMemo(() => collapseEvents(filtered), [filtered]);

    const setTab = (tab: string) => {
        navigate({
            search: (prev) => ({
                ...prev,
                category: tab === ALL_TAB ? undefined : tab,
            }),
            replace: true,
        });
    };

    return (
        <>
            <Helmet>
                <title>Live Activity</title>
                <meta
                    name="description"
                    content="See enrolments, leads, calls and payments as they happen."
                />
            </Helmet>

            <header className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                        <Broadcast className="size-5" weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-h3 font-semibold tracking-tight text-neutral-700">
                            Live Activity
                        </h1>
                        <p className="mt-0.5 text-body text-neutral-600">
                            Enrolments, leads, calls and payments as they happen.
                        </p>
                    </div>
                </div>
                <StreamStatusBadge status={status} />
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs value={activeTab} onValueChange={setTab}>
                    <TabsList>
                        <TabsTrigger value={ALL_TAB}>All</TabsTrigger>
                        {visibleCategories.map((category) => (
                            <TabsTrigger key={category} value={category} className="gap-1.5">
                                {CATEGORY_LABELS[category]}
                                {counts.data?.[category] != null && (
                                    <span className="text-caption text-neutral-500">
                                        {counts.data[category]}
                                    </span>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <MyButton
                    buttonType="secondary"
                    scale="small"
                    onClick={() => {
                        if (paused) releaseBuffer();
                        setPaused(!paused);
                    }}
                >
                    {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    {paused ? 'Resume' : 'Pause'}
                </MyButton>
            </div>

            {/*
             * Release pill. A live list that reorders under the cursor is unusable, so new
             * events buffer while paused rather than pushing the row being read off-screen.
             */}
            {paused && bufferedCount > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        releaseBuffer();
                        setPaused(false);
                    }}
                    className="mt-3 w-full rounded-lg bg-primary-50 px-3 py-2 text-body text-primary-600 hover:bg-primary-100"
                >
                    {bufferedCount} new {bufferedCount === 1 ? 'event' : 'events'} — show
                </button>
            )}

            <div
                className="mt-4 flex flex-col gap-2"
                // Pausing on hover keeps the row under the pointer still while it is read.
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => {
                    releaseBuffer();
                    setPaused(false);
                }}
            >
                {collapsed.length === 0 ? (
                    <EmptyState loading={backfill.isLoading} />
                ) : (
                    collapsed.map((group) => <ActivityRow key={group.key} group={group} />)
                )}
            </div>
        </>
    );
}

function StreamStatusBadge({ status }: { status: string }) {
    const label =
        status === 'live'
            ? 'Live'
            : status === 'reconnecting'
              ? 'Reconnecting…'
              : status === 'error'
                ? 'Disconnected'
                : 'Connecting…';
    const tone =
        status === 'live'
            ? 'bg-success-50 text-success-600'
            : status === 'error'
              ? 'bg-danger-50 text-danger-600'
              : 'bg-neutral-100 text-neutral-600';

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption ${tone}`}
        >
            <span className="size-1.5 rounded-full bg-current" />
            {label}
        </span>
    );
}

function EmptyState({ loading }: { loading: boolean }) {
    return (
        <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center">
            <p className="text-body text-neutral-600">
                {loading ? 'Loading recent activity…' : 'Nothing yet.'}
            </p>
            {!loading && (
                // Say this plainly. An empty feed genuinely does not mean nothing is
                // happening -- calls placed from a personal phone, messages sent outside
                // the platform and in-person conversations are all invisible here.
                <p className="mt-1 text-caption text-neutral-500">
                    Activity outside the platform (personal-phone calls, direct WhatsApp) will not
                    appear here.
                </p>
            )}
        </div>
    );
}
