import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { addWeeks } from 'date-fns';
import { UsersThree } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { useMeetingsScope, useTeamCalendar } from '../-hooks/use-meetings';
import { toIsoWithOffset } from '../-utils/meetings-utils';
import { MeetingsList } from '../-components/meetings-list';
import { WeekNavigator, weekBoundsFor } from '../-components/week-navigator';

export const Route = createLazyFileRoute('/meetings/team/')({
    component: TeamMeetingsRoute,
});

const ALL_HOSTS_VALUE = '__ALL_HOSTS__';

function TeamMeetingsRoute() {
    return (
        <LayoutContainer>
            <TeamMeetingsPage />
        </LayoutContainer>
    );
}

function TeamMeetingsPage() {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">Team Meetings</h1>);
    }, [setNavHeading]);

    const instituteId = getInstituteId();
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const [hostFilter, setHostFilter] = useState(ALL_HOSTS_VALUE);
    const { start } = weekBoundsFor(weekAnchor);

    // Host options derive from the visible week's bookings — a filter carried
    // across navigation could point at a host with no rows and strand the page.
    const handleWeekChange = (anchor: Date) => {
        setWeekAnchor(anchor);
        setHostFilter(ALL_HOSTS_VALUE);
    };

    const { data: scope, isLoading: scopeLoading, error: scopeError } = useMeetingsScope(instituteId);
    const canViewTeam = !!scope && (scope.is_admin || scope.is_team_manager);

    // Exact local week window as ISO offset datetimes: start = local week
    // start 00:00, end = exclusive next week start 00:00.
    const {
        data: bookings,
        isLoading,
        error,
    } = useTeamCalendar(
        instituteId,
        toIsoWithOffset(start),
        toIsoWithOffset(addWeeks(start, 1)),
        canViewTeam
    );

    // Host filter options built from the distinct hosts in the current result.
    const hostOptions = useMemo(() => {
        const byId = new Map<string, string>();
        for (const booking of bookings ?? []) {
            if (booking.host_user_id) {
                byId.set(booking.host_user_id, booking.host_name || 'Unknown host');
            }
        }
        return [...byId.entries()].map(([id, name]) => ({ id, name }));
    }, [bookings]);

    const filteredBookings = useMemo(() => {
        const all = bookings ?? [];
        if (hostFilter === ALL_HOSTS_VALUE) return all;
        return all.filter((booking) => booking.host_user_id === hostFilter);
    }, [bookings, hostFilter]);

    if (scopeLoading) {
        return (
            <div className="flex min-h-60 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    if (!scopeError && !canViewTeam) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-16 text-center">
                <UsersThree className="size-10 text-neutral-300" />
                <p className="text-body font-semibold text-neutral-700">
                    You don&apos;t manage a team yet
                </p>
                <p className="max-w-md text-caption text-neutral-500">
                    Team Meetings shows the schedules of everyone reporting to you. Once team members
                    report to you, their meetings will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">Team Meetings</h1>
                    <p className="mt-0.5 text-sm text-neutral-500">
                        Meetings hosted by you and your team
                    </p>
                </div>
                {hostOptions.length > 0 && (
                    <Select value={hostFilter} onValueChange={setHostFilter}>
                        <SelectTrigger className="w-full sm:w-56">
                            <SelectValue placeholder="Filter by host" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_HOSTS_VALUE}>All hosts</SelectItem>
                            {hostOptions.map((host) => (
                                <SelectItem key={host.id} value={host.id}>
                                    {host.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <WeekNavigator weekStart={start} onChange={handleWeekChange} />

            <MeetingsList
                bookings={filteredBookings}
                isLoading={isLoading}
                error={scopeError ?? error}
                showHost
                emptyTitle="No team meetings this week"
                emptyDescription="Meetings hosted by you or your team will appear here."
            />
        </div>
    );
}
