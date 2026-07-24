/**
 * LeadMeetingsSection — CRM lead ↔ meetings linkage on the lead side-view.
 *
 * Renders on the Lead tab of the student/lead side-view and lists every
 * meeting booked with this lead (matched server-side by audience response id,
 * user id, or email via GET /v1/meetings/by-lead). The header's "Book meeting"
 * button opens the existing create-booking dialog prefilled with the lead's
 * contact details and linkage ids, so the new booking lands back in this list.
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
    ArrowSquareOut,
    CalendarBlank,
    CalendarPlus,
    User,
    WarningCircle,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip } from '@/components/design-system/status-chips';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useBookingsByLead } from '@/routes/meetings/-hooks/use-meetings';
import { parseUtc, statusToChip } from '@/routes/meetings/-utils/meetings-utils';
import { CreateBookingDialog } from '@/routes/meetings/-components/create-booking-dialog';
import { BookingInstanceDTO } from '@/routes/meetings/-types/meetings-types';
import { cn } from '@/lib/utils';

/** Statuses for which the join link is still actionable. */
const JOINABLE_STATUSES = new Set(['CONFIRMED', 'PENDING']);

const MeetingRow = ({ booking }: { booking: BookingInstanceDTO }) => {
    const start = parseUtc(booking.scheduled_start_utc);
    const end = parseUtc(booking.scheduled_end_utc);
    const joinable =
        !!booking.meet_link && JOINABLE_STATUSES.has((booking.status || '').toUpperCase());

    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-neutral-900">
                        {booking.booking_page_title || 'Meeting'}
                    </p>
                    <StatusChip
                        text={booking.status}
                        status={statusToChip(booking.status)}
                        textSize="text-caption"
                        showIcon={false}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-neutral-500">
                    <span>
                        {format(start, 'EEE, MMM d yyyy')} · {format(start, 'h:mm a')} –{' '}
                        {format(end, 'h:mm a')}
                    </span>
                    {booking.host_name && (
                        <span className="flex items-center gap-1">
                            <User className="size-3.5" />
                            {booking.host_name}
                        </span>
                    )}
                </div>
            </div>
            {joinable && (
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="icon"
                    className="shrink-0"
                    title="Open meeting link"
                    aria-label="Open meeting link"
                    onClick={() =>
                        window.open(booking.meet_link ?? '', '_blank', 'noopener,noreferrer')
                    }
                >
                    <ArrowSquareOut className="size-3.5" />
                </MyButton>
            )}
        </div>
    );
};

export const LeadMeetingsSection = ({ className }: { className?: string }) => {
    const { selectedStudent } = useStudentSidebar();
    const [bookOpen, setBookOpen] = useState(false);
    const instituteId = getCurrentInstituteId() ?? undefined;

    // `_response_id` is attached by the lead lists only (see lead-form-response-card).
    const responseId =
        ((selectedStudent as unknown as Record<string, unknown>)?._response_id as
            | string
            | null
            | undefined) ?? undefined;
    const leadUserId = selectedStudent?.user_id || undefined;
    const leadEmail = selectedStudent?.email || undefined;

    const query = useBookingsByLead(instituteId, {
        audienceResponseId: responseId,
        inviteeUserId: leadUserId,
        inviteeEmail: leadEmail,
    });

    // Upcoming first, then past — both chronological within their half.
    const bookings = useMemo(() => {
        const items = [...(query.data ?? [])];
        return items.sort(
            (a, b) => parseUtc(a.scheduled_start_utc).getTime() - parseUtc(b.scheduled_start_utc).getTime()
        );
    }, [query.data]);

    // No lead selected or no identifier to match on — nothing to show.
    if (!selectedStudent || (!responseId && !leadUserId && !leadEmail)) return null;

    return (
        <Card className={cn('border-neutral-200 shadow-none', className)}>
            <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-3 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                    <CalendarBlank className="size-4 text-primary-500" />
                    Meetings
                </CardTitle>
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="small"
                    onClick={() => setBookOpen(true)}
                >
                    <CalendarPlus className="mr-1 size-3.5" />
                    Book meeting
                </MyButton>
            </CardHeader>
            <CardContent className="px-1 pb-3 pt-0">
                {query.isLoading ? (
                    <div className="flex min-h-20 items-center justify-center">
                        <DashboardLoader />
                    </div>
                ) : query.isError ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-caption text-neutral-500">
                        <WarningCircle className="size-4 text-danger-600" />
                        Couldn&apos;t load this lead&apos;s meetings. Try again.
                    </div>
                ) : bookings.length === 0 ? (
                    <p className="px-3 py-2.5 text-sm italic text-neutral-400">No meetings yet</p>
                ) : (
                    <div className="flex flex-col divide-y divide-neutral-100">
                        {bookings.map((booking) => (
                            <MeetingRow key={booking.id} booking={booking} />
                        ))}
                    </div>
                )}
            </CardContent>

            <CreateBookingDialog
                open={bookOpen}
                onOpenChange={setBookOpen}
                prefill={{
                    inviteeName: selectedStudent?.full_name || undefined,
                    inviteeEmail: leadEmail,
                    inviteePhone: selectedStudent?.mobile_number || undefined,
                    audienceResponseId: responseId,
                    inviteeUserId: leadUserId,
                }}
            />
        </Card>
    );
};

export default LeadMeetingsSection;
