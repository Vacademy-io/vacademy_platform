import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { MentorSessionDTO } from '@/routes/mentorship/-types/mentorship-types';

vi.mock('@/routes/mentorship/-hooks/use-mentorship', () => ({
    useMentorSessions: () => ({
        data: [
            {
                booking_instance_id: 'b1',
                title: 'A deliberately long mentorship session title that would overflow a phone',
                scheduled_start_utc: Date.UTC(2026, 7, 10, 9, 30),
                duration_minutes: 30,
                booking_status: 'CONFIRMED',
                mentor_name: 'Asha Nair',
                student_name: 'Riya Sharma',
                lifecycle: 'UPCOMING',
            } as MentorSessionDTO,
        ],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    }),
    useSessionAction: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMentorDashboard: () => ({ data: { mentors: [] } }),
    // The reschedule dialog resolves the host mentor's booking slug to show real slots;
    // for an admin it reads the mentor list, for a mentor their own profile.
    useMyMentorProfile: () => ({ data: null }),
    useMentorSlots: () => ({ data: { slots: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock('@/routes/mentorship/-components/MentorAvatar', () => ({
    MentorAvatar: () => <span data-testid="avatar" />,
}));

import { MentorSessionsPanel } from '@/routes/mentorship/-components/MentorSessionsPanel';

/**
 * happy-dom has no layout engine, so this cannot prove how the page LOOKS on a
 * phone. What it can do is pin the structural choices that keep it usable there —
 * rows and filter bars that wrap instead of overflowing, and long text that
 * truncates instead of pushing the row wide. Those are exactly the things a later
 * edit removes by accident.
 */
/** MyTable mounts shared dialogs that expect a QueryClient, so every render needs one. */
const render = (ui: ReactElement) =>
    rtlRender(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    );

describe('sessions panel — mobile-safe layout', () => {
    it('the filter bar wraps rather than overflowing a narrow screen', () => {
        const { container } = render(<MentorSessionsPanel instituteId="inst-1" />);
        const tabBar = container.querySelector('.border-b');
        expect(tabBar?.className).toContain('flex-wrap');
    });

    it('the session table scrolls inside its own box, not the whole page', () => {
        const { container } = render(<MentorSessionsPanel instituteId="inst-1" />);
        // A data table is wider than a phone by nature. The rule is that the
        // overflow stays inside the table's container so the page body never
        // scrolls sideways.
        const shell = container.querySelector('.overflow-hidden');
        expect(shell).not.toBeNull();
        // Exact name: the row's join action also carries the mentor's name.
        expect(screen.getByRole('button', { name: 'Asha Nair' })).toBeInTheDocument();
    });

    it('long titles truncate, so one session cannot widen the whole list', () => {
        const { container } = render(<MentorSessionsPanel instituteId="inst-1" />);
        // min-w-0 is what actually lets a flex child shrink enough to truncate.
        const shrinkable = container.querySelector('.min-w-0');
        expect(shrinkable).not.toBeNull();
        expect(container.querySelector('.truncate')).not.toBeNull();
    });

    it('uses no fixed pixel widths, which are the usual cause of phone overflow', () => {
        const { container } = render(<MentorSessionsPanel instituteId="inst-1" />);
        expect(container.innerHTML).not.toMatch(/w-\[\d+px\]/);
    });
});
