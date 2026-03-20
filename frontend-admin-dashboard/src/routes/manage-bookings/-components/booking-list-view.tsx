import { useState } from 'react';
import { BookingType } from '../-types/booking-types';
import { useSearchBookings, useUserBasicDetails } from '../-hooks/use-booking-data';
import { getInstituteId } from '@/constants/helper';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BookingListViewProps {
    bookingType: BookingType;
}

export const BookingListView = ({ bookingType }: BookingListViewProps) => {
    const [page, setPage] = useState(0);
    const [timeStatus, setTimeStatus] = useState<'UPCOMING' | 'PAST' | 'LIVE'>('UPCOMING');
    const pageSize = 20;
    const instituteId = getInstituteId();

    const { data, isLoading } = useSearchBookings({
        institute_id: instituteId || '',
        booking_type_ids: [bookingType.id],
        time_status: timeStatus,
        page,
        size: pageSize,
    });

    // Cast data response if needed, but assuming useSearchBookings returns matching shape
    const content = data?.content || [];
    const totalPages = data?.total_pages || 0;

    // Extract all participant IDs from visible bookings
    // Assuming structure: booking.participants = [{ source_id: 'user-id', source_type: 'USER' }]
    // Or booking.participant_user_ids = ['user-id']
    const allParticipantIds = new Set<string>();
    content.forEach((booking: any) => {
        if (booking.participant_user_ids) {
            booking.participant_user_ids.forEach((id: string) => allParticipantIds.add(id));
        } else if (booking.participants) {
            booking.participants.forEach((p: any) => {
                if (p.source_type === 'USER') {
                    allParticipantIds.add(p.source_id);
                }
            });
        }
    });

    const { data: userDetails } = useUserBasicDetails(Array.from(allParticipantIds));
    const userMap = new Map((userDetails || []).map((u) => [u.user_id, u]));

    const getParticipantNames = (booking: any) => {
        const ids: string[] = [];
        if (booking.participant_user_ids) {
            ids.push(...booking.participant_user_ids);
        } else if (booking.participants) {
            booking.participants.forEach((p: any) => {
                if (p.source_type === 'USER') ids.push(p.source_id);
            });
        }

        if (ids.length === 0) return '-';

        return ids
            .map((id) => {
                const user = userMap.get(id);
                return user ? `${user.first_name} ${user.last_name || ''}`.trim() : id;
            })
            .join(', ');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filter Status:</span>
                    <Select
                        value={timeStatus}
                        onValueChange={(v: 'UPCOMING' | 'PAST' | 'LIVE') => setTimeStatus(v)}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="UPCOMING">Upcoming</SelectItem>
                            <SelectItem value="LIVE">Live</SelectItem>
                            <SelectItem value="PAST">Past</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bookings List</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="animate-spin" />
                        </div>
                    ) : content.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground">
                            No bookings found.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Participants</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {content.map((booking: any) => (
                                        <TableRow key={booking.schedule_id || booking.session_id}>
                                            <TableCell className="font-medium">
                                                {booking.title}
                                            </TableCell>
                                            <TableCell>
                                                {booking.date || booking.session_end_date}
                                            </TableCell>
                                            <TableCell>
                                                {booking.start_time?.slice(0, 5)} -{' '}
                                                {booking.end_time?.slice(0, 5)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        booking.status === 'LIVE'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {booking.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{booking.source}</TableCell>
                                            <TableCell
                                                className="max-w-[200px] truncate"
                                                title={getParticipantNames(booking)}
                                            >
                                                {getParticipantNames(booking)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <Button
                                variant="ghost"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                            >
                                Previous
                            </Button>
                        </PaginationItem>
                        <PaginationItem>
                            <span className="px-4 text-sm">
                                Page {page + 1} of {totalPages}
                            </span>
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                variant="ghost"
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                            >
                                Next
                            </Button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </div>
    );
};
