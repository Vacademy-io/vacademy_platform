import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MeetingsCalendar } from '@/routes/meetings/-components/meetings-calendar';
import type { BookingInstanceDTO } from '@/routes/meetings/-types/meetings-types';

/** Fixed month so day math is deterministic regardless of when tests run. */
const MONTH = new Date(2026, 7, 1); // August 2026

const booking = (overrides: Partial<BookingInstanceDTO>): BookingInstanceDTO =>
    ({
        id: Math.random().toString(36).slice(2),
        scheduled_start_utc: '2026-08-10T04:00:00Z',
        scheduled_end_utc: '2026-08-10T04:30:00Z',
        status: 'CONFIRMED',
        ...overrides,
    }) as BookingInstanceDTO;

describe('MeetingsCalendar day popup', () => {
    it('opens a dialog with the clicked day’s meetings, times and join link', () => {
        const bookings = [
            booking({
                id: 'b-1',
                invitee_name: 'Neeraj Hariyale',
                invitee_email: 'neeraj@x.com',
                meet_link: 'https://meet.google.com/abc',
            }),
            booking({
                id: 'b-2',
                scheduled_start_utc: '2026-08-10T04:30:00Z',
                scheduled_end_utc: '2026-08-10T05:00:00Z',
                invitee_name: 'Test Student Two',
                status: 'PENDING',
            }),
        ];
        render(
            <MeetingsCalendar
                bookings={bookings}
                month={MONTH}
                onMonthChange={vi.fn()}
                isLoading={false}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /2 meetings on 10 August 2026/ }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Monday, 10 August 2026')).toBeInTheDocument();
        expect(within(dialog).getByText('Neeraj Hariyale')).toBeInTheDocument();
        expect(within(dialog).getByText('Test Student Two')).toBeInTheDocument();
        expect(within(dialog).getByText('neeraj@x.com')).toBeInTheDocument();
        expect(within(dialog).getByText('CONFIRMED')).toBeInTheDocument();
        expect(within(dialog).getByText('PENDING')).toBeInTheDocument();
        const join = within(dialog).getByRole('link', { name: /Join meeting/ });
        expect(join).toHaveAttribute('href', 'https://meet.google.com/abc');
    });

    it('cancelled meetings and empty days never open a popup', () => {
        render(
            <MeetingsCalendar
                bookings={[booking({ status: 'CANCELLED' })]}
                month={MONTH}
                onMonthChange={vi.fn()}
                isLoading={false}
            />
        );
        // the only booking is cancelled → its day carries no clickable meetings
        expect(screen.queryByRole('button', { name: /meeting/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
