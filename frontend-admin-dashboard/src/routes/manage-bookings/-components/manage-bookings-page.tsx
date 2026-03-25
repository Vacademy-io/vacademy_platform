import { useState } from 'react';
import { BookingTypeList } from './booking-type-list';
import { BookingView } from './booking-view';
import { BookingType } from '../-types/booking-types';

const ManageBookingsPage = () => {
    const [selectedType, setSelectedType] = useState<BookingType | null>(null);

    return (
        <div className="container mx-auto py-6">
            <h1 className="text-3xl font-bold mb-6 text-foreground">Manage Bookings</h1>
            {selectedType ? (
                <BookingView bookingType={selectedType} onBack={() => setSelectedType(null)} />
            ) : (
                <BookingTypeList onSelect={setSelectedType} />
            )}
        </div>
    );
};

export default ManageBookingsPage;
