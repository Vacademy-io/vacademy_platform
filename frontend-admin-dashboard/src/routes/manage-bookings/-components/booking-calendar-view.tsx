import { useState } from 'react';
import { BookingType } from '../-types/booking-types';
import { useUserCalendar, useUserBasicDetails } from '../-hooks/use-booking-data';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

interface BookingCalendarViewProps {
    bookingType: BookingType;
}

export const BookingCalendarView = ({ bookingType }: BookingCalendarViewProps) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const userId = tokenData?.user || '';

    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: events, isLoading } = useUserCalendar(userId, startDate, endDate);

    // Filter events by booking type if needed.
    // The requirement says "Calendar has events for this month".
    // And user drills down from a Booking Type. It implies they want to see events of THIS type.
    const filteredEvents =
        events?.filter((e) => {
            // Depending on backend, we might simulate filtering.
            // Or if the API does not filter, we do it here.
            // Assuming we want to show events related to this booking type mostly.
            return e.booking_type_id === bookingType.id || e.booking_type_name === bookingType.type;
        }) || [];

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth)),
        end: endOfWeek(endOfMonth(currentMonth)),
    });

    // Extract all participant IDs from visible events
    const allParticipantIds = new Set<string>();
    filteredEvents.forEach((e) => {
        if (e.participants) {
            e.participants.forEach((p) => {
                if (p.source_type === 'USER') {
                    allParticipantIds.add(p.source_id);
                }
            });
        }
    });

    const { data: userDetails } = useUserBasicDetails(Array.from(allParticipantIds) as string[]);
    const userMap = new Map((userDetails || []).map((u) => [u.user_id, u]));

    const getParticipantSummary = (event: any, detailed: boolean = false) => {
        const ids: string[] = [];
        if (event.participants) {
            event.participants.forEach((p: any) => {
                if (p.source_type === 'USER') ids.push(p.source_id);
            });
        }

        if (ids.length === 0) return null;

        if (detailed) {
            // Return full list of names for detailed view
            return ids
                .map((id) => userMap.get(id)) // Get the user object
                .filter(Boolean) // Filter out undefined users
                .map((user) => (user ? `${user.first_name} ${user.last_name || ''}`.trim() : ''))
                .join(', ');
        }

        const count = ids.length;
        if (count === 1) {
            const userId = ids[0];
            if (!userId) return null; // Should not happen given logic, but satisfies TS
            const user = userMap.get(userId);
            return user ? `${user.first_name}` : userId;
        }
        return `${count} Participants`;
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    if (selectedDate) {
        const dayEvents = filteredEvents
            .filter((e) => isSameDay(new Date(e.date), selectedDate))
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

        return (
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => setSelectedDate(null)}>
                        <ChevronLeft className="mr-2 size-4" /> Back to Month
                    </Button>
                    <h3 className="text-xl font-semibold">{format(selectedDate, 'PPPP')}</h3>
                </div>

                {dayEvents.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-gray-50 p-10 text-center text-muted-foreground">
                        No events scheduled for this day.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {dayEvents.map((event) => (
                            <div
                                key={event.schedule_id}
                                className="rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-lg font-semibold">{event.title}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {event.subject}
                                        </p>
                                    </div>
                                    <div
                                        className={`rounded px-2 py-1 text-xs font-medium
                                        ${event.status === 'LIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                                    >
                                        {event.status}
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-muted-foreground">Time</div>
                                        <div>
                                            {event.start_time.slice(0, 5)} -{' '}
                                            {event.end_time.slice(0, 5)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">Participants</div>
                                        <div
                                            className="truncate"
                                            title={getParticipantSummary(event, true) || ''}
                                        >
                                            {getParticipantSummary(event, true) || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-10">
                    <Loader2 className="animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-gray-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div
                            key={day}
                            className="border-b border-r bg-gray-50 p-2 text-center font-medium last:border-r-0"
                        >
                            {day}
                        </div>
                    ))}

                    {days.map((day) => {
                        const dayEvents = filteredEvents.filter((e) =>
                            isSameDay(new Date(e.date), day)
                        );
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className={`min-h-[100px] cursor-pointer border-b border-r p-2 transition-colors last:border-r-0 hover:bg-gray-50
                                    ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white'}`}
                            >
                                <div className="mb-1 text-right text-sm">{format(day, 'd')}</div>
                                <div className="space-y-1">
                                    {dayEvents.map((event) => (
                                        <div
                                            key={event.schedule_id}
                                            className="bg-primary/10 text-primary border-primary/20 flex flex-col gap-0.5 truncate rounded border p-1 text-xs"
                                            title={event.title}
                                        >
                                            <span className="font-medium">
                                                {event.start_time.slice(0, 5)} {event.title}
                                            </span>
                                            {getParticipantSummary(event) && (
                                                <span className="truncate text-[10px] opacity-80">
                                                    {getParticipantSummary(event)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
