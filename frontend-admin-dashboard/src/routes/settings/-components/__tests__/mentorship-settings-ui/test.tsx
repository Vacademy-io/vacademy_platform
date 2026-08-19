import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MentorshipSettings from '@/routes/settings/-components/MentorshipSettings';
import { DEFAULT_MENTORSHIP_SETTINGS } from '@/services/mentorship-settings';

vi.mock('@/services/mentorship-settings', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/mentorship-settings')>();
    return {
        ...actual,
        getMentorshipSettings: vi.fn(async () => structuredClone(actual.DEFAULT_MENTORSHIP_SETTINGS)),
        saveMentorshipSettings: vi.fn(async () => undefined),
    };
});

vi.mock('@/services/whatsapp-template-service', () => ({
    whatsappTemplateService: { getMetaTemplates: vi.fn(async () => []) },
}));

import { saveMentorshipSettings } from '@/services/mentorship-settings';

/** The Switch sitting in the same row as the given label text. */
const switchInRow = (labelText: string): HTMLElement => {
    const row = screen.getByText(labelText).closest('div');
    if (!row) throw new Error(`no row for ${labelText}`);
    return within(row as HTMLElement).getByRole('switch');
};

describe('MentorshipSettings screen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all six trigger cards after loading', async () => {
        render(<MentorshipSettings />);
        expect(await screen.findByText('Mentor Assigned')).toBeInTheDocument();
        expect(screen.getByText('Mentor Request')).toBeInTheDocument();
        expect(screen.getByText('Session Booked')).toBeInTheDocument();
        expect(screen.getByText('Session Cancelled')).toBeInTheDocument();
        expect(screen.getByText('Session Reminder')).toBeInTheDocument();
        expect(screen.getByText('Check-in Nudge')).toBeInTheDocument();
        // decluttered copy: one-line header, no per-channel explainer sentences
        expect(screen.getByText('Choose how learners are notified for each mentorship event.')).toBeInTheDocument();
        expect(screen.queryByText('Send an email notification.')).not.toBeInTheDocument();
    });

    it('mentor-request notifications are on for both sides by default', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Mentor Request');

        expect(switchInRow('Tell the mentor someone requested them')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(switchInRow('Tell the learner when you decline')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    it('spells out that approving sends no extra message', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Mentor Request');
        // Without this the admin would reasonably expect an approval email too.
        expect(screen.getByText(/Approving sends nothing extra/)).toBeInTheDocument();
    });

    it('turning off the mentor notice is saved without touching the learner one', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Mentor Request');

        fireEvent.click(switchInRow('Tell the mentor someone requested them'));
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(saveMentorshipSettings).toHaveBeenCalled());
        const saved = vi.mocked(saveMentorshipSettings).mock.calls[0]![0];
        expect(saved.request.notify_mentor).toBe(false);
        expect(saved.request.notify_student).toBe(true);
    });

    it('check-in nudge is off by default and reveals its config only when enabled', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Check-in Nudge');

        const checkinSwitch = switchInRow('Send check-in nudges');
        expect(checkinSwitch).toHaveAttribute('aria-checked', 'false');
        expect(screen.queryByLabelText('Days without a session')).not.toBeInTheDocument();

        fireEvent.click(checkinSwitch);
        expect(switchInRow('Send check-in nudges')).toHaveAttribute('aria-checked', 'true');
        const days = screen.getByLabelText('Days without a session') as HTMLInputElement;
        expect(days.value).toBe(String(DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder.inactivity_days));
    });

    it('session reminder is on by default with a 24h lead shown', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Session Reminder');
        expect(switchInRow('Send session reminders')).toHaveAttribute('aria-checked', 'true');
        const hours = screen.getByLabelText('Hours before the session') as HTMLInputElement;
        expect(hours.value).toBe('24');
    });

    it('clamps the reminder lead time to the range the scheduler actually uses', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Session Reminder');
        const hours = screen.getByLabelText('Hours before the session') as HTMLInputElement;

        fireEvent.change(hours, { target: { value: '500' } });
        expect(hours.value).toBe('168'); // backend cap

        fireEvent.change(hours, { target: { value: '' } });
        expect(hours.value).toBe('1'); // clearing can't produce 0

        fireEvent.change(hours, { target: { value: '48' } });
        expect(hours.value).toBe('48');
    });

    it('hides system-default message text until the admin customizes', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Mentor Assigned');

        // Default texts stay collapsed — no subject/message editors visible,
        // just the "system default" note per enabled channel.
        expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();
        expect(screen.getAllByText('Uses the system default message.').length).toBeGreaterThan(0);

        // Customize reveals the editors prefilled with the default…
        fireEvent.click(screen.getAllByRole('button', { name: 'Customize' })[0]!);
        const subject = screen.getByLabelText('Subject') as HTMLInputElement;
        expect(subject.value).toBe(DEFAULT_MENTORSHIP_SETTINGS.assignment.email.subject);

        // …and "Reset to system default" collapses them again.
        fireEvent.change(subject, { target: { value: 'My custom subject' } });
        fireEvent.click(screen.getByRole('button', { name: 'Reset to system default' }));
        expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();
    });

    it('saves edited settings with the clamped values', async () => {
        render(<MentorshipSettings />);
        await screen.findByText('Session Reminder');

        const save = screen.getByRole('button', { name: 'Save changes' });
        expect(save).toBeDisabled(); // pristine

        const hours = screen.getByLabelText('Hours before the session') as HTMLInputElement;
        fireEvent.change(hours, { target: { value: '999' } });
        expect(save).toBeEnabled();

        fireEvent.click(save);
        expect(saveMentorshipSettings).toHaveBeenCalledTimes(1);
        const saved = vi.mocked(saveMentorshipSettings).mock.calls[0]![0];
        expect(saved.session_reminder.hours_before).toBe(168);
        // untouched triggers ride along unchanged
        expect(saved.checkin_reminder.enabled).toBe(false);
        expect(saved.assignment.notify_student).toBe(true);
    });
});
