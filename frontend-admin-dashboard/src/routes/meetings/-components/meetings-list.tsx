import { format } from 'date-fns';
import { ArrowSquareOut, CalendarBlank, Envelope, User, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StatusChip } from '@/components/design-system/status-chips';
import { MyButton } from '@/components/design-system/button';
import { BookingInstanceDTO } from '../-types/meetings-types';
import { groupBookingsByDay, parseUtc, statusToChip } from '../-utils/meetings-utils';

interface MeetingsListProps {
    bookings: BookingInstanceDTO[];
    isLoading: boolean;
    error: unknown;
    /** Show the host name on each row (Team Meetings view). */
    showHost?: boolean;
    emptyTitle: string;
    emptyDescription: string;
    /** Extra content under the empty state (e.g. a next-meeting hint). */
    emptyExtra?: React.ReactNode;
}

const bookingTitle = (booking: BookingInstanceDTO): string =>
    booking.booking_page_title || booking.invitee_name || 'Meeting';

const MeetingRow = ({ booking, showHost }: { booking: BookingInstanceDTO; showHost: boolean }) => {
    const start = parseUtc(booking.scheduled_start_utc);
    const end = parseUtc(booking.scheduled_end_utc);
    const cancelled = booking.status === 'CANCELLED';
    // The title is often the invitee's name already — don't repeat it below.
    const showInvitee = !!booking.invitee_name && booking.invitee_name !== bookingTitle(booking);

    return (
        <div
            className={cn(
                'flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between',
                cancelled && 'bg-neutral-50'
            )}
        >
            <div className={cn('flex min-w-0 items-start gap-3', cancelled && 'opacity-60')}>
                <div className="flex w-24 shrink-0 flex-col text-body text-neutral-600">
                    <span className="font-semibold text-neutral-700">
                        {format(start, 'h:mm a')}
                    </span>
                    <span className="text-caption text-neutral-500">{format(end, 'h:mm a')}</span>
                </div>
                <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-neutral-700">
                        {bookingTitle(booking)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-500">
                        {showHost && booking.host_name && (
                            <span className="flex items-center gap-1">
                                <User className="size-3.5" />
                                Hosted by{' '}
                                <span className="font-medium text-neutral-600">
                                    {booking.host_name}
                                </span>
                            </span>
                        )}
                        {showInvitee && (
                            <span className="flex items-center gap-1">
                                with{' '}
                                <span className="font-medium text-neutral-600">
                                    {booking.invitee_name}
                                </span>
                            </span>
                        )}
                        {booking.invitee_email && (
                            <span className="flex items-center gap-1">
                                <Envelope className="size-3.5" />
                                {booking.invitee_email}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <StatusChip
                    text={booking.status}
                    status={statusToChip(booking.status)}
                    textSize="text-caption"
                />
                {booking.meet_link && !cancelled && (
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        className="sm:min-w-0"
                        onClick={() =>
                            window.open(booking.meet_link ?? '', '_blank', 'noopener,noreferrer')
                        }
                    >
                        <ArrowSquareOut className="mr-1 size-3.5" />
                        Join
                    </MyButton>
                )}
            </div>
        </div>
    );
};

export const MeetingsList = ({
    bookings,
    isLoading,
    error,
    showHost = false,
    emptyTitle,
    emptyDescription,
    emptyExtra,
}: MeetingsListProps) => {
    if (isLoading) {
        return (
            <div className="flex min-h-40 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-12 text-center">
                <WarningCircle className="size-8 text-danger-600" />
                <p className="text-body font-semibold text-neutral-700">
                    Couldn&apos;t load meetings
                </p>
                <p className="text-caption text-neutral-500">
                    Something went wrong fetching this calendar. Try again.
                </p>
            </div>
        );
    }

    if (bookings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-12 text-center">
                <CalendarBlank className="size-8 text-neutral-300" />
                <p className="text-body font-semibold text-neutral-700">{emptyTitle}</p>
                <p className="text-caption text-neutral-500">{emptyDescription}</p>
                {emptyExtra}
            </div>
        );
    }

    const days = groupBookingsByDay(bookings);

    return (
        <div className="flex flex-col gap-5">
            {days.map(({ dayKey, date, items }) => (
                <div key={dayKey} className="flex flex-col gap-2">
                    <h3 className="text-body font-semibold text-neutral-600">
                        {format(date, 'EEEE, MMM d')}
                    </h3>
                    <div className="flex flex-col gap-2">
                        {items.map((booking) => (
                            <MeetingRow key={booking.id} booking={booking} showHost={showHost} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
