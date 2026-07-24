import { useEffect, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { addWeeks } from 'date-fns';
import { LinkSimple, Plus } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { MyButton } from '@/components/design-system/button';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { useMyCalendar } from '../-hooks/use-meetings';
import { toIsoWithOffset } from '../-utils/meetings-utils';
import { MeetingsList } from '../-components/meetings-list';
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

function MySchedulePage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">My Schedule</h1>);
    }, [setNavHeading]);

    const instituteId = getInstituteId();
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const { start } = weekBoundsFor(weekAnchor);

    // Exact local week window as ISO offset datetimes: start = local week
    // start 00:00, end = exclusive next week start 00:00 — so boundary
    // meetings land in the right week for non-UTC users.
    const {
        data: bookings,
        isLoading,
        error,
    } = useMyCalendar(instituteId, toIsoWithOffset(start), toIsoWithOffset(addWeeks(start, 1)));

    const [createOpen, setCreateOpen] = useState(false);
    const [managerOpen, setManagerOpen] = useState(false);

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">My Schedule</h1>
                    <p className="mt-0.5 text-sm text-neutral-500">
                        Meetings where you are the host
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        className="sm:min-w-0"
                        onClick={() => setManagerOpen(true)}
                    >
                        <LinkSimple className="mr-1.5 size-4" />
                        Share Booking Link
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

            <WeekNavigator weekStart={start} onChange={setWeekAnchor} />

            <MeetingsList
                bookings={bookings ?? []}
                isLoading={isLoading}
                error={error}
                emptyTitle="No meetings this week"
                emptyDescription="Schedule a meeting or share your booking link to fill your calendar."
            />

            <CreateBookingDialog open={createOpen} onOpenChange={setCreateOpen} />
            <BookingPagesManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
        </div>
    );
}
