import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MentorDTO } from '@/routes/mentorship/-types/mentorship-types';

const useMentorMenteesMock = vi.fn();
const useMentorAvailabilityMock = vi.fn();
const useMentorFeedbackMock = vi.fn();

vi.mock('@/routes/mentorship/-hooks/use-mentorship', () => ({
    useMentorMentees: (...a: unknown[]) => useMentorMenteesMock(...a),
    useMentorAvailability: (...a: unknown[]) => useMentorAvailabilityMock(...a),
    useMentorFeedback: (...a: unknown[]) => useMentorFeedbackMock(...a),
    useMentorSessions: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
    useSessionAction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/routes/mentorship/-components/MentorAvatar', () => ({
    MentorAvatar: () => <span data-testid="avatar" />,
}));

import { MentorDetailDialog } from '@/routes/mentorship/-components/MentorDetailDialog';

const mentor = (over: Partial<MentorDTO> = {}): MentorDTO => ({
    id: 'm1',
    institute_id: 'inst-1',
    user_id: 'u1',
    display_name: 'Asha Nair',
    title: 'Senior Physics Mentor',
    email: 'asha@example.com',
    status: 'ACTIVE',
    assigned_student_count: 3,
    ...over,
});

const idle = { data: undefined, isLoading: false, isError: false };

describe('MentorDetailDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMentorMenteesMock.mockReturnValue({ ...idle, data: [] });
        useMentorAvailabilityMock.mockReturnValue({ ...idle, data: null });
        useMentorFeedbackMock.mockReturnValue({ ...idle, data: [] });
    });

    const open = (m: MentorDTO = mentor()) =>
        render(<MentorDetailDialog mentor={m} instituteId="inst-1" open onOpenChange={vi.fn()} />);

    it('shows the profile and email the admin brief asks for', () => {
        open();
        expect(screen.getByText('Senior Physics Mentor')).toBeInTheDocument();
        expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    });

    it('shows load against capacity when a cap is set', () => {
        open(mentor({ assigned_student_count: 3, max_mentees: 10 }));
        expect(screen.getByText('3/10 students')).toBeInTheDocument();
    });

    it('shows a bare count when the mentor is uncapped', () => {
        open(mentor({ assigned_student_count: 4, max_mentees: null }));
        expect(screen.getByText('4 students')).toBeInTheDocument();
    });

    it('shows the rating only when someone has actually rated them', () => {
        open(mentor({ average_rating: 4.6, rating_count: 9 }));
        expect(screen.getByText('4.6 (9)')).toBeInTheDocument();
    });

    it('hides the rating when the count is zero, rather than implying a score', () => {
        open(mentor({ average_rating: 4.6, rating_count: 0 }));
        expect(screen.queryByText(/4\.6/)).not.toBeInTheDocument();
    });

    it('summarises weekly availability in day order', () => {
        useMentorAvailabilityMock.mockReturnValue({
            ...idle,
            data: {
                duration_minutes: 30,
                timezone: 'Asia/Kolkata',
                availability: {
                    weekly_windows: [
                        { day_of_week: 'WEDNESDAY', start_time: '14:00', end_time: '17:00' },
                        { day_of_week: 'MONDAY', start_time: '09:00', end_time: '12:00' },
                    ],
                },
            },
        });
        open();
        const rows = screen.getAllByText(/monday|wednesday/i);
        expect(rows[0]?.textContent?.toLowerCase()).toContain('monday');
        expect(screen.getByText('09:00–12:00')).toBeInTheDocument();
        expect(screen.getByText(/30-minute sessions/)).toBeInTheDocument();
    });

    it('says plainly when a mentor has no booking set up', () => {
        useMentorAvailabilityMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        });
        open();
        expect(screen.getByText(/hasn't set up booking yet/)).toBeInTheDocument();
    });

    it('lists assigned students on the Students tab', () => {
        useMentorMenteesMock.mockReturnValue({
            ...idle,
            data: [
                {
                    assignment_id: 'a1',
                    mentor_id: 'm1',
                    student_user_id: 'stu-1',
                    name: 'Riya Sharma',
                    email: 'riya@example.com',
                    assignment_method: 'ROUND_ROBIN',
                },
            ],
        });
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Students' }));
        expect(screen.getByText('Riya Sharma')).toBeInTheDocument();
        expect(screen.getByText('Auto-assigned')).toBeInTheDocument();
    });

    it('feedback is only fetched once that tab is opened', () => {
        open();
        // Overview is showing: the feedback hook must be told not to fetch.
        expect(useMentorFeedbackMock).toHaveBeenLastCalledWith(undefined, 'inst-1');

        fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
        expect(useMentorFeedbackMock).toHaveBeenLastCalledWith('m1', 'inst-1');
    });

    it('the sessions tab reuses the shared panel scoped to this mentor', () => {
        open();
        fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
        // The panel's own filter row proves it rendered rather than a bespoke list.
        expect(screen.getByRole('button', { name: 'Awaiting review' })).toBeInTheDocument();
    });

    it('renders nothing at all without a mentor', () => {
        const { container } = render(
            <MentorDetailDialog mentor={null} instituteId="inst-1" open onOpenChange={vi.fn()} />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
