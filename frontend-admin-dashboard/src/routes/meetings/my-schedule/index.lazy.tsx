import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import {
    addDays,
    addWeeks,
    endOfMonth,
    endOfWeek,
    format,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { ArrowRight, Browsers, CalendarBlank, ListBullets, Plus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { useMyCalendar } from '../-hooks/use-meetings';
import { parseUtc, toIsoWithOffset } from '../-utils/meetings-utils';
import { MeetingsList } from '../-components/meetings-list';
import { MeetingsCalendar } from '../-components/meetings-calendar';
import { WeekNavigator, weekBoundsFor } from '../-components/week-navigator';
import { CreateBookingDialog } from '../-components/create-booking-dialog';
import { BookingPagesManagerDialog } from '../-components/booking-pages-manager-dialog';

export const Route = createLazyFileRoute('/meetings/my-schedule/')({
    component: MyScheduleRoute,
});

function MyScheduleRoute() {
    return (
        <LayoutContainer>
            <MySchedulePage />
        </LayoutContainer>
    );
}

type ScheduleView = 'list' | 'calendar';

function MySchedulePage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Schedule</h1>);
    }, [setNavHeading]);

    const instituteId = getInstituteId();
    const [view, setView] = useState<ScheduleView>('list');
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const [monthAnchor, setMonthAnchor] = useState(() => new Date());

    const { start: weekStart } = weekBoundsFor(weekAnchor);
    // Month grid window (week-aligned) so the calendar's leading/trailing days have data.
    const gridStart = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 0 });

    // One fetch, windowed by the active view (both as ISO offset datetimes so
    // boundary meetings land in the right day/week for non-UTC users).
    const windowStart = view === 'calendar' ? gridStart : weekStart;
    const windowEnd = view === 'calendar' ? addDays(gridEnd, 1) : addWeeks(weekStart, 1);
    const {
        data: bookings,
        isLoading,
        error,
    } = useMyCalendar(instituteId, toIsoWithOffset(windowStart), toIsoWithOffset(windowEnd));

    // 60-day lookahead so an empty week can still point at the next meeting
    // instead of dead-ending. Window is frozen on mount to keep the query key stable.
    const [lookaheadWindow] = useState(() => ({
        start: toIsoWithOffset(new Date()),
        end: toIsoWithOffset(addDays(new Date(), 60)),
    }));
    const lookahead = useMyCalendar(instituteId, lookaheadWindow.start, lookaheadWindow.end);
    const nextUpcoming = useMemo(() => {
        const now = Date.now();
        return (lookahead.data ?? [])
            .filter(
                (b) =>
                    b.status !== 'CANCELLED' &&
                    b.status !== 'RESCHEDULED' &&
                    parseUtc(b.scheduled_start_utc).getTime() >= now
            )
            .sort(
                (a, b) =>
                    parseUtc(a.scheduled_start_utc).getTime() -
                    parseUtc(b.scheduled_start_utc).getTime()
            )[0];
    }, [lookahead.data]);

    const [createOpen, setCreateOpen] = useState(false);
    const [managerOpen, setManagerOpen] = useState(false);

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">My Schedule</h1>
                    <p className="mt-0.5 text-sm text-neutral-500">Meetings where you are the host</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* List / Calendar toggle */}
                    <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 p-0.5">
                        <button
                            type="button"
                            onClick={() => setView('list')}
                            className={cn(
                                'flex items-center gap-1 rounded px-2.5 py-1 text-caption font-medium',
                                view === 'list'
                                    ? 'bg-primary-50 text-primary-600'
                                    : 'text-neutral-500 hover:text-neutral-700'
                            )}
                        >
                            <ListBullets size={14} /> List
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('calendar')}
                            className={cn(
                                'flex items-center gap-1 rounded px-2.5 py-1 text-caption font-medium',
                                view === 'calendar'
                                    ? 'bg-primary-50 text-primary-600'
                                    : 'text-neutral-500 hover:text-neutral-700'
                            )}
                        >
                            <CalendarBlank size={14} /> Calendar
                        </button>
                    </div>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        className="sm:min-w-0"
                        title="Create and manage your booking pages"
                        onClick={() => setManagerOpen(true)}
                    >
                        <Browsers className="mr-1.5 size-4" />
                        Booking Pages
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        className="sm:min-w-0"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="mr-1.5 size-4" />
                        New Meeting
                    </MyButton>
                </div>
            </div>

            {view === 'list' ? (
                <>
                    <WeekNavigator weekStart={weekStart} onChange={setWeekAnchor} />
                    <MeetingsList
                        bookings={bookings ?? []}
                        isLoading={isLoading}
                        error={error}
                        emptyTitle="No meetings this week"
                        emptyDescription="Schedule a meeting or share your booking link to fill your calendar."
                        emptyExtra={
                            nextUpcoming ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setWeekAnchor(parseUtc(nextUpcoming.scheduled_start_utc))
                                    }
                                    className="mt-2 flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-caption text-primary-700 transition-colors hover:bg-primary-100"
                                >
                                    <span>
                                        Next meeting:{' '}
                                        <span className="font-semibold">
                                            {format(
                                                parseUtc(nextUpcoming.scheduled_start_utc),
                                                'EEE, d MMM · h:mm a'
                                            )}
                                        </span>
                                        {nextUpcoming.invitee_name
                                            ? ` — ${nextUpcoming.invitee_name}`
                                            : ''}
                                    </span>
                                    <span className="flex items-center gap-1 font-medium">
                                        Go to that week <ArrowRight size={14} />
                                    </span>
                                </button>
                            ) : undefined
                        }
                    />
                </>
            ) : (
                <MeetingsCalendar
                    bookings={bookings ?? []}
                    month={monthAnchor}
                    onMonthChange={setMonthAnchor}
                    isLoading={isLoading}
                />
            )}

            <CreateBookingDialog open={createOpen} onOpenChange={setCreateOpen} />
            <BookingPagesManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
        </div>
    );
}
