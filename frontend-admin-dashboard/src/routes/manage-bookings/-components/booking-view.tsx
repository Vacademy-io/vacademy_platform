import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { BookingType } from '../-types/booking-types';
import { BookingCalendarView } from './booking-calendar-view';
import { BookingListView } from './booking-list-view';

import { useState } from 'react';
import { AddEventDialog } from './add-event-dialog';

interface BookingViewProps {
    bookingType: BookingType;
    onBack: () => void;
}

export const BookingView = ({ bookingType, onBack }: BookingViewProps) => {
    const [isAddEventOpen, setIsAddEventOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="size-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold">{bookingType.type}</h2>
                        <p className="text-muted-foreground">{bookingType.description}</p>
                    </div>
                </div>
                <Button onClick={() => setIsAddEventOpen(true)}>+ Quick Add Event</Button>
            </div>

            <Tabs defaultValue="calendar">
                <TabsList>
                    <TabsTrigger value="calendar">Calendar</TabsTrigger>
                    <TabsTrigger value="list">List View</TabsTrigger>
                </TabsList>
                <TabsContent value="calendar" className="mt-4">
                    <BookingCalendarView bookingType={bookingType} />
                </TabsContent>
                <TabsContent value="list" className="mt-4">
                    <BookingListView bookingType={bookingType} />
                </TabsContent>
            </Tabs>

            <AddEventDialog
                open={isAddEventOpen}
                onOpenChange={setIsAddEventOpen}
                bookingType={bookingType}
            />
        </div>
    );
};
