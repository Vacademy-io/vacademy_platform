import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MentorSessionDTO } from '@/routes/mentorship/-types/mentorship-types';

const useMentorSessionsMock = vi.fn();
const sessionActionMutate = vi.fn(async () => ({}));
vi.mock('@/routes/mentorship/-hooks/use-mentorship', () => ({
    useMentorSessions: (...args: unknown[]) => useMentorSessionsMock(...args),
    useSessionAction: () => ({ mutateAsync: sessionActionMutate, isPending: false }),
}));

import { MentorSessionsPanel } from '@/routes/mentorship/-components/MentorSessionsPanel';

const session = (over: Partial<MentorSessionDTO> = {}): MentorSessionDTO => ({
    booking_instance_id: 'b1',
    title: '1:1 Session',
    scheduled_start_utc: Date.UTC(2026, 7, 10, 9, 30),
    duration_minutes: 30,
    booking_status: 'CONFIRMED',
    mentor_id: 'm1',
    mentor_name: 'Asha Nair',
    mentor_email: 'asha@example.com',
    student_user_id: 'stu-1',
    student_name: 'Riya Sharma',
    student_email: 'riya@example.com',
    lifecycle: 'COMPLETED',
    ...over,
});

const result = (sessions: MentorSessionDTO[]) => ({
    data: sessions,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
});

describe('MentorSessionsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMentorSessionsMock.mockReturnValue(result([session()]));
    });

    it('lists a session with both parties, as the admin view requires', () => {
        render(<MentorSessionsPanel instituteId="inst-1" />);
        expect(screen.getByText(/Asha Nair.*Riya Sharma/)).toBeInTheDocument();
        expect(screen.getByText(/30 min/)).toBeInTheDocument();
    });

    it('opens on all sessions, not a filtered subset', () => {
        render(<MentorSessionsPanel instituteId="inst-1" />);
        expect(useMentorSessionsMock).toHaveBeenCalledWith('inst-1', {
            mentorId: undefined,
            studentUserId: undefined,
            lifecycle: undefined,
        });
    });

    it('filtering by no-shows asks the server for only no-shows', () => {
        render(<MentorSessionsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByRole('button', { name: 'No-shows' }));
        expect(useMentorSessionsMock).toHaveBeenLastCalledWith(
            'inst-1',
            expect.objectContaining({ lifecycle: 'NO_SHOW' })
        );
    });

    it('scopes to one mentor when asked, for the mentor-wise view', () => {
        render(<MentorSessionsPanel instituteId="inst-1" mentorId="m1" />);
        expect(useMentorSessionsMock).toHaveBeenCalledWith(
            'inst-1',
            expect.objectContaining({ mentorId: 'm1' })
        );
    });

    it('shows a no-show distinctly from a cancellation', () => {
        useMentorSessionsMock.mockReturnValue(
            result([
                session({ lifecycle: 'NO_SHOW' }),
                session({ booking_instance_id: 'b2', lifecycle: 'CANCELLED' }),
            ])
        );
        render(<MentorSessionsPanel instituteId="inst-1" />);
        // Scoped to the badge: "Cancelled" is also a filter tab.
        expect(screen.getByText('No-show', { selector: 'span' })).toBeInTheDocument();
        expect(screen.getByText('Cancelled', { selector: 'span' })).toBeInTheDocument();
    });

    it('flags a held session nobody has recorded yet', () => {
        useMentorSessionsMock.mockReturnValue(result([session({ lifecycle: 'AWAITING_REVIEW' })]));
        render(<MentorSessionsPanel instituteId="inst-1" />);
        expect(screen.getByText('Awaiting review', { selector: 'span' })).toBeInTheDocument();
    });

    it('opening a session shows the full detail, including both emails', async () => {
        useMentorSessionsMock.mockReturnValue(
            result([
                session({ topic: 'Rotational motion', notes: 'Needs torque practice', rating: 5 }),
            ])
        );
        render(<MentorSessionsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByText(/Asha Nair.*Riya Sharma/));

        expect(await screen.findByText('Session details')).toBeInTheDocument();
        expect(screen.getByText('asha@example.com')).toBeInTheDocument();
        expect(screen.getByText('riya@example.com')).toBeInTheDocument();
        expect(screen.getByText('Rotational motion')).toBeInTheDocument();
        expect(screen.getByText('Needs torque practice')).toBeInTheDocument();
        expect(screen.getByText('5/5')).toBeInTheDocument();
    });

    it('offers cancel and reschedule only on a session that can still change', () => {
        useMentorSessionsMock.mockReturnValue(
            result([
                session({ lifecycle: 'UPCOMING' }),
                session({ booking_instance_id: 'b2', lifecycle: 'COMPLETED' }),
            ])
        );
        render(<MentorSessionsPanel instituteId="inst-1" />);

        // One upcoming session → exactly one pair of actions; the completed one gets none.
        expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Reschedule' })).toHaveLength(1);
    });

    it('a past or cancelled session offers no cancel/reschedule at all', () => {
        useMentorSessionsMock.mockReturnValue(
            result([
                session({ lifecycle: 'CANCELLED' }),
                session({ booking_instance_id: 'b2', lifecycle: 'NO_SHOW' }),
            ])
        );
        render(<MentorSessionsPanel instituteId="inst-1" />);
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    });

    it('cancelling opens the confirmation rather than acting immediately', async () => {
        useMentorSessionsMock.mockReturnValue(result([session({ lifecycle: 'UPCOMING' })]));
        render(<MentorSessionsPanel instituteId="inst-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        // Copy unique to the dialog — "Cancel session" is also its submit button.
        expect(await screen.findByText(/calendar entry and reminders are removed/)).toBeInTheDocument();
        // Destructive actions must never fire straight off a row click.
        expect(sessionActionMutate).not.toHaveBeenCalled();
    });

    it('the row action does not also open the detail dialog behind it', async () => {
        useMentorSessionsMock.mockReturnValue(result([session({ lifecycle: 'UPCOMING' })]));
        render(<MentorSessionsPanel instituteId="inst-1" />);

        fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));

        await screen.findByText(/old slot is released/);
        expect(screen.queryByText('Session details')).not.toBeInTheDocument();
    });

    it('an empty state explains where sessions come from', () => {
        useMentorSessionsMock.mockReturnValue(result([]));
        render(<MentorSessionsPanel instituteId="inst-1" />);
        expect(screen.getByText('No mentor sessions yet')).toBeInTheDocument();
    });

    it('offers a retry when the list fails to load', () => {
        const refetch = vi.fn();
        useMentorSessionsMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            refetch,
        });
        render(<MentorSessionsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(refetch).toHaveBeenCalled();
    });
});
