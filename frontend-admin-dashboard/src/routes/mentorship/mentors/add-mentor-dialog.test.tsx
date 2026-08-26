import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const inviteUsers = vi.fn(async () => ({ id: 'new-user-1' }));
const createMentor = vi.fn(async () => ({}));
const fetchEligibleOrgUsers = vi.fn(async () => [
    { id: 'u1', full_name: 'Asha Nair', email: 'asha@example.com', roles: ['TEACHER'] },
]);
const reportApiError = vi.fn();

vi.mock('@/routes/dashboard/-services/dashboard-services', () => ({
    handleInviteUsers: (...a: unknown[]) => inviteUsers(...(a as [])),
}));
vi.mock('@/routes/manage-institute/teams/-services/institute-users-service', () => ({
    fetchEligibleOrgUsers: (...a: unknown[]) => fetchEligibleOrgUsers(...(a as [])),
}));
vi.mock('@/routes/mentorship/-hooks/use-mentorship', () => ({
    useCreateMentor: () => ({ mutateAsync: createMentor, isPending: false }),
}));
vi.mock('@/hooks/use-file-upload', () => ({
    useFileUpload: () => ({ uploadFile: vi.fn(), getPublicUrl: vi.fn(async () => '') }),
}));
vi.mock('@/lib/report-api-error', () => ({
    reportApiError: (...a: unknown[]) => reportApiError(...(a as [])),
}));
vi.mock('@/utils/userDetails', () => ({ getUserId: () => 'admin-1' }));

import { AddMentorDialog } from '@/routes/mentorship/-components/AddMentorDialog';

function open() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AddMentorDialog instituteId="inst-1" open onOpenChange={vi.fn()} />
        </QueryClientProvider>
    );
}

const inviteMode = () => fireEvent.click(screen.getByRole('button', { name: 'Invite by email' }));
const type = (placeholder: string, value: string) =>
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

describe('AddMentorDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens on the team picker, so the common path costs no extra clicks', async () => {
        open();
        expect(await screen.findByText('Asha Nair')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('asha@example.com')).not.toBeInTheDocument();
    });

    it('keeps the optional profile fields folded away until asked', async () => {
        open();
        fireEvent.click(await screen.findByRole('button', { name: /Asha Nair/ }));

        expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Add photo, expertise and capacity/ }));
        expect(screen.getByPlaceholderText('e.g. Senior Career Mentor')).toBeInTheDocument();
    });

    it('invites an external mentor without a trip to the Teams tab', async () => {
        open();
        inviteMode();
        type('e.g. Asha Nair', 'Ravi Kumar');
        type('asha@example.com', 'ravi@example.com');
        fireEvent.click(screen.getByRole('button', { name: 'Invite as mentor' }));

        await waitFor(() => expect(inviteUsers).toHaveBeenCalled());
        // The invite must carry the mentor role, else they land as a plain team member.
        expect(inviteUsers).toHaveBeenCalledWith('inst-1', {
            name: 'Ravi Kumar',
            email: 'ravi@example.com',
            roleType: ['MENTOR'],
        });
        // …and the returned user id is what the mentor row is created against.
        await waitFor(() =>
            expect(createMentor).toHaveBeenCalledWith(
                expect.objectContaining({ user_id: 'new-user-1', display_name: 'Ravi Kumar' })
            )
        );
    });

    it('will not spend an invitation on a malformed email', async () => {
        open();
        inviteMode();
        type('e.g. Asha Nair', 'Ravi Kumar');
        type('asha@example.com', 'ravi@');

        const submit = screen.getByRole('button', { name: 'Invite as mentor' });
        fireEvent.click(submit);
        expect(inviteUsers).not.toHaveBeenCalled();
    });

    it('never creates a mentor row when the invitation returns no user', async () => {
        inviteUsers.mockResolvedValueOnce(undefined as never);
        open();
        inviteMode();
        type('e.g. Asha Nair', 'Ravi Kumar');
        type('asha@example.com', 'ravi@example.com');
        fireEvent.click(screen.getByRole('button', { name: 'Invite as mentor' }));

        await waitFor(() => expect(reportApiError).toHaveBeenCalled());
        expect(createMentor).not.toHaveBeenCalled();
    });

    it('keeps what was typed when the admin flips modes to check the team list', async () => {
        open();
        inviteMode();
        type('e.g. Asha Nair', 'Ravi Kumar');

        fireEvent.click(screen.getByRole('button', { name: 'From your team' }));
        expect(await screen.findByText('Asha Nair')).toBeInTheDocument();

        inviteMode();
        expect((screen.getByPlaceholderText('e.g. Asha Nair') as HTMLInputElement).value).toBe(
            'Ravi Kumar'
        );
    });

    it('a team-mode add ignores anything left in the invite fields', async () => {
        open();
        inviteMode();
        type('e.g. Asha Nair', 'Ravi Kumar');
        type('asha@example.com', 'ravi@example.com');

        fireEvent.click(screen.getByRole('button', { name: 'From your team' }));
        fireEvent.click(await screen.findByRole('button', { name: /Asha Nair/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Add mentor' }));

        await waitFor(() => expect(createMentor).toHaveBeenCalled());
        expect(inviteUsers).not.toHaveBeenCalled();
        expect(createMentor).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: 'u1', display_name: 'Asha Nair' })
        );
    });
});
