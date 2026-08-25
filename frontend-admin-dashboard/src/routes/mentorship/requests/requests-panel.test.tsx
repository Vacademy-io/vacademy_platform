import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { MentorDTO, MentorRequestDTO } from '@/routes/mentorship/-types/mentorship-types';

const decideMutate = vi.fn(async () => ({}) as MentorRequestDTO);
const useMentorRequestsMock = vi.fn();
const useMentorsMock = vi.fn();

vi.mock('@/routes/mentorship/-hooks/use-mentorship', () => ({
    useMentorRequests: (...args: unknown[]) => useMentorRequestsMock(...args),
    useMentors: (...args: unknown[]) => useMentorsMock(...args),
    useDecideMentorRequest: () => ({ mutateAsync: decideMutate }),
}));

// The avatar resolves media URLs over the network, and rendering the mentor's
// name inside it would double every name match in these assertions.
vi.mock('@/routes/mentorship/-components/MentorAvatar', () => ({
    MentorAvatar: () => <span data-testid="mentor-avatar" />,
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

// MyTable mounts the shared student-menu dialogs, which reach for a router and a
// QueryClient; neither is part of what this panel is being tested for.
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({ navigate: vi.fn(), invalidate: vi.fn() }),
    useNavigate: () => vi.fn(),
    Link: ({ children, ...rest }: { children?: React.ReactNode; to?: string }) => (
        <a {...rest}>{children}</a>
    ),
}));

/** Every render needs a QueryClient for the dialogs MyTable brings with it. */
const render = (ui: ReactElement) =>
    rtlRender(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    );

import { MentorRequestsPanel } from '@/routes/mentorship/-components/MentorRequestsPanel';

const request = (over: Partial<MentorRequestDTO> = {}): MentorRequestDTO => ({
    id: 'req-1',
    institute_id: 'inst-1',
    student_user_id: 'stu-1',
    mentor_id: 'm1',
    message: 'Need help with rotational motion',
    status: 'PENDING',
    created_at: Date.UTC(2026, 7, 10),
    student_name: 'Riya Sharma',
    student_email: 'riya@example.com',
    mentor_name: 'Asha Nair',
    mentor_available_slots: 3,
    ...over,
});

const mentor = (over: Partial<MentorDTO> = {}): MentorDTO => ({
    id: 'm1',
    institute_id: 'inst-1',
    user_id: 'u1',
    display_name: 'Asha Nair',
    status: 'ACTIVE',
    assigned_student_count: 2,
    expertise_tags: ['JEE Physics'],
    ...over,
});

const pageOf = (content: MentorRequestDTO[]) => ({
    data: {
        content,
        total_pages: 1,
        total_elements: content.length,
        number: 0,
        size: 20,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
});

describe('MentorRequestsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useMentorRequestsMock.mockReturnValue(pageOf([request()]));
        useMentorsMock.mockReturnValue({ data: [mentor()], isLoading: false });
    });

    it('opens on the pending queue and shows who asked for whom', () => {
        render(<MentorRequestsPanel instituteId="inst-1" />);

        expect(useMentorRequestsMock).toHaveBeenCalledWith('inst-1', 'PENDING', 0, 20);
        expect(screen.getByText('Riya Sharma')).toBeInTheDocument();
        expect(screen.getByText('riya@example.com')).toBeInTheDocument();
        expect(screen.getByText('Asha Nair')).toBeInTheDocument();
        expect(screen.getByText('Need help with rotational motion')).toBeInTheDocument();
        // Capacity is surfaced before the admin commits to approving.
        expect(screen.getByText(/3 places left/)).toBeInTheDocument();
    });

    it('switching tabs refetches that status from the first page', () => {
        render(<MentorRequestsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByRole('button', { name: /Declined/ }));
        expect(useMentorRequestsMock).toHaveBeenLastCalledWith('inst-1', 'DECLINED', 0, 20);
    });

    it('approving a request sends the approve decision for that request', async () => {
        render(<MentorRequestsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByRole('button', { name: /Approve$/ }));

        const dialog = await screen.findByText('Approve mentor request');
        expect(dialog).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Approve & assign/ }));

        await waitFor(() =>
            expect(decideMutate).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'req-1', instituteId: 'inst-1', approve: true })
            )
        );
    });

    it('declining passes the reason the learner will see', async () => {
        render(<MentorRequestsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByRole('button', { name: /Decline$/ }));

        await screen.findByText('Decline mentor request');
        const reason = screen.getByPlaceholderText('e.g. Try Bhavya for Biology');
        fireEvent.change(reason, { target: { value: 'Try Bhavya for Biology' } });
        fireEvent.click(screen.getByRole('button', { name: /Decline request/ }));

        await waitFor(() =>
            expect(decideMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    approve: false,
                    decision: expect.objectContaining({ note: 'Try Bhavya for Biology' }),
                })
            )
        );
    });

    it('an "any mentor" request cannot be approved until a mentor is picked', async () => {
        useMentorRequestsMock.mockReturnValue(
            pageOf([request({ mentor_id: null, mentor_name: null })])
        );
        render(<MentorRequestsPanel instituteId="inst-1" />);

        expect(screen.getByText('Any available mentor')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Approve$/ }));
        await screen.findByText('Approve mentor request');

        const approve = screen.getByRole('button', { name: /Approve & assign/ });
        expect(approve).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: /Asha Nair/ }));
        await waitFor(() => expect(approve).not.toBeDisabled());
        fireEvent.click(approve);

        await waitFor(() =>
            expect(decideMutate).toHaveBeenCalledWith(
                expect.objectContaining({ decision: expect.objectContaining({ mentor_id: 'm1' }) })
            )
        );
    });

    it('a mentor at capacity cannot be picked for an open-ended request', async () => {
        useMentorRequestsMock.mockReturnValue(
            pageOf([request({ mentor_id: null, mentor_name: null })])
        );
        useMentorsMock.mockReturnValue({
            data: [mentor({ at_capacity: true, max_mentees: 2 })],
            isLoading: false,
        });
        render(<MentorRequestsPanel instituteId="inst-1" />);
        fireEvent.click(screen.getByRole('button', { name: /Approve$/ }));
        await screen.findByText('Approve mentor request');

        expect(screen.getByRole('button', { name: /Asha Nair/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Approve & assign/ })).toBeDisabled();
    });

    it('decided requests show their outcome instead of decision buttons', () => {
        useMentorRequestsMock.mockReturnValue(
            pageOf([request({ status: 'APPROVED', decided_at: Date.UTC(2026, 7, 11) })])
        );
        render(<MentorRequestsPanel instituteId="inst-1" />);

        // The status badge, not the "Approved" tab button.
        expect(screen.getByText('Approved', { selector: 'span' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Approve$/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Decline$/ })).not.toBeInTheDocument();
    });

    it('an empty pending queue explains where requests come from', () => {
        useMentorRequestsMock.mockReturnValue(pageOf([]));
        render(<MentorRequestsPanel instituteId="inst-1" />);

        expect(screen.getByText('No requests waiting')).toBeInTheDocument();
        expect(screen.getByText(/Find a mentor/)).toBeInTheDocument();
    });

    it('surfaces the server’s reason when a decision is refused', async () => {
        // A real AxiosError, because that is what axios throws and what the error
        // reporter reads the backend message off — a plain object would silently
        // fall back to the generic text and prove nothing.
        const refusal = new AxiosError(
            'Request failed with status code 400',
            'ERR_BAD_REQUEST',
            undefined,
            undefined,
            {
                status: 400,
                data: { message: 'Asha Nair is at capacity (3 mentees).' },
                statusText: 'Bad Request',
                headers: {},
                config: { headers: new AxiosHeaders() },
            }
        );
        decideMutate.mockRejectedValueOnce(refusal);
        const { toast } = await import('sonner');
        render(<MentorRequestsPanel instituteId="inst-1" />);

        fireEvent.click(screen.getByRole('button', { name: /Approve$/ }));
        await screen.findByText('Approve mentor request');
        fireEvent.click(screen.getByRole('button', { name: /Approve & assign/ }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'Asha Nair is at capacity (3 mentees).',
                expect.anything()
            )
        );
    });

    it('falls back to a readable message when the server gives no reason', async () => {
        decideMutate.mockRejectedValueOnce(new Error('Network Error'));
        const { toast } = await import('sonner');
        render(<MentorRequestsPanel instituteId="inst-1" />);

        fireEvent.click(screen.getByRole('button', { name: /Decline$/ }));
        await screen.findByText('Decline mentor request');
        fireEvent.click(screen.getByRole('button', { name: /Decline request/ }));

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                'Failed to decline the request',
                expect.anything()
            )
        );
    });
});
