import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MentorDashboard } from '@/routes/mentorship/-types/mentorship-types';

const useMentorDashboardMock = vi.fn();
const useMentorSessionsMock = vi.fn();

vi.mock('@/routes/mentorship/-hooks/use-mentorship', () => ({
    useMentorDashboard: (...a: unknown[]) => useMentorDashboardMock(...a),
    useMentorSessions: (...a: unknown[]) => useMentorSessionsMock(...a),
}));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));
vi.mock('@/routes/mentorship/-components/MentorAvatar', () => ({
    MentorAvatar: () => <span data-testid="avatar" />,
}));

import { MentorshipDashboard } from '@/routes/mentorship/-components/MentorshipDashboard';

const dashboard = (over: Partial<MentorDashboard> = {}): MentorDashboard => ({
    total_mentors: 4,
    total_active_assignments: 12,
    distinct_mentees: 4,
    upcoming_sessions: 2,
    mentors: [],
    ...over,
});

const ok = (data: MentorDashboard) => ({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
});

describe('MentorshipDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMentorDashboardMock.mockReturnValue(ok(dashboard()));
        useMentorSessionsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    });

    it('leads with the headline numbers', () => {
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText('Mentors')).toBeInTheDocument();
        expect(screen.getByText('Students mentored')).toBeInTheDocument();
        // Mentors and mentees are both 4 here, so assert the count of that value
        // rather than a single match.
        expect(screen.getAllByText('4')).toHaveLength(2);
        expect(screen.getByText('12 active pairings')).toBeInTheDocument();
    });

    it('weights the average rating by how many ratings each mentor has', () => {
        // 5.0 from 1 rating and 3.0 from 9 should land near 3.2, not the naive 4.0.
        useMentorDashboardMock.mockReturnValue(
            ok(
                dashboard({
                    mentors: [
                        {
                            id: 'm1',
                            institute_id: 'i',
                            user_id: 'u1',
                            status: 'ACTIVE',
                            average_rating: 5,
                            rating_count: 1,
                        },
                        {
                            id: 'm2',
                            institute_id: 'i',
                            user_id: 'u2',
                            status: 'ACTIVE',
                            average_rating: 3,
                            rating_count: 9,
                        },
                    ],
                })
            )
        );
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText('3.2')).toBeInTheDocument();
    });

    it('shows a dash, not a zero, when nobody has been rated', () => {
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText('—')).toBeInTheDocument();
        expect(screen.getByText('No ratings yet')).toBeInTheDocument();
    });

    it('surfaces only the things that actually need attention', () => {
        useMentorDashboardMock.mockReturnValue(
            ok(dashboard({ pending_requests: 2, sessions_awaiting_review: 0 }))
        );
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText(/waiting to be paired/)).toBeInTheDocument();
        expect(screen.queryByText(/not recorded/)).not.toBeInTheDocument();
    });

    it('stays quiet when nothing needs attention', () => {
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
    });

    it('uses singular wording for a single item', () => {
        useMentorDashboardMock.mockReturnValue(ok(dashboard({ pending_requests: 1 })));
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText(/1 learner is waiting to be paired/)).toBeInTheDocument();
    });

    it('labels every outcome, so colour is never the only cue', () => {
        useMentorDashboardMock.mockReturnValue(
            ok(
                dashboard({
                    completed_sessions: 6,
                    no_show_sessions: 1,
                    cancelled_sessions: 2,
                    sessions_awaiting_review: 3,
                })
            )
        );
        render(<MentorshipDashboard instituteId="inst-1" />);
        for (const label of ['Completed', 'No-shows', 'Cancelled', 'Awaiting review']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it('explains an empty outcome period instead of drawing an empty bar', () => {
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText(/No sessions yet/)).toBeInTheDocument();
    });

    it('ranks mentors by load and flags anyone at capacity', () => {
        useMentorDashboardMock.mockReturnValue(
            ok(
                dashboard({
                    mentors: [
                        {
                            id: 'm1',
                            institute_id: 'i',
                            user_id: 'u1',
                            status: 'ACTIVE',
                            display_name: 'Quiet',
                            assigned_student_count: 1,
                        },
                        {
                            id: 'm2',
                            institute_id: 'i',
                            user_id: 'u2',
                            status: 'ACTIVE',
                            display_name: 'Busy',
                            assigned_student_count: 8,
                            max_mentees: 8,
                        },
                    ],
                })
            )
        );
        render(<MentorshipDashboard instituteId="inst-1" />);
        const names = screen.getAllByText(/Busy|Quiet/).map((n) => n.textContent);
        expect(names[0]).toBe('Busy');
        expect(screen.getByText(/8 \/ 8 · full/)).toBeInTheDocument();
    });

    it('lists what is coming up', () => {
        useMentorSessionsMock.mockReturnValue({
            data: [
                {
                    booking_instance_id: 'b1',
                    mentor_name: 'Asha',
                    student_name: 'Riya',
                    scheduled_start_utc: Date.UTC(2026, 8, 1, 9, 0),
                },
            ],
            isLoading: false,
            isError: false,
        });
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByText(/Asha.*Riya/)).toBeInTheDocument();
    });

    it('only asks for upcoming sessions, not the whole history', () => {
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(useMentorSessionsMock).toHaveBeenCalledWith('inst-1', { lifecycle: 'UPCOMING' });
    });

    it('offers a retry instead of a blank page when loading fails', () => {
        const refetch = vi.fn();
        useMentorDashboardMock.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            refetch,
        });
        render(<MentorshipDashboard instituteId="inst-1" />);
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
});
