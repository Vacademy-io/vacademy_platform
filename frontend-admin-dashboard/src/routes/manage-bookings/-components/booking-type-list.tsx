import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBookingTypes } from '../-hooks/use-booking-data';
import { BookingType } from '../-types/booking-types';
import { getInstituteId } from '@/constants/helper';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { AddBookingTypeDialog } from './add-booking-type-dialog'; // Assuming this import path

interface BookingTypeListProps {
    onSelect: (type: BookingType) => void;
}

export const BookingTypeList = ({ onSelect }: BookingTypeListProps) => {
    const [page, setPage] = useState(0);
    const pageSize = 20;
    const instituteId = getInstituteId();

    // Cast data response if needed, but assuming useBookingTypes returns matching shape
    const { data, isLoading } = useBookingTypes(instituteId, page, pageSize);
    const [isAddOpen, setIsAddOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                ))}
            </div>
        );
    }

    // Cast data response if needed, but assuming useBookingTypes returns matching shape
    const content = data?.content || [];
    const totalPages = data?.total_pages || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Select Booking Type</h2>
                <Button onClick={() => setIsAddOpen(true)}>+ Add Booking Type</Button>
            </div>

            {!content || content.length === 0 ? (
                <div className="rounded-lg border bg-gray-50 p-10 text-center">
                    <p className="mb-4 text-gray-500">
                        No booking types found. Create your first one!
                    </p>
                    <Button onClick={() => setIsAddOpen(true)}>Create Booking Type</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {content.map((type: BookingType) => (
                        <Card
                            key={type.id}
                            className="cursor-pointer transition-shadow hover:shadow-lg"
                            onClick={() => onSelect(type)}
                        >
                            <CardHeader>
                                <CardTitle>{type.type}</CardTitle>
                                <CardDescription>{type.code}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">
                                    {type.description || 'No description'}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

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

            <AddBookingTypeDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
        </div>
    );
};
