import { describe, expect, it } from 'vitest';
import {
    DEFAULT_MENTORSHIP_SETTINGS,
    mergeChannel,
    mergeTrigger,
} from '@/services/mentorship-settings';

/**
 * The MENTORSHIP_SETTING blob is written by this app and read by
 * MentorshipNotificationService on admin_core_service — these tests pin the
 * defaults the backend mirrors and the merge behavior for legacy saved blobs.
 */
describe('mentorship settings defaults', () => {
    it('mirrors the backend defaults for the scheduler triggers', () => {
        // session_reminder: ON, 24h lead — matches triggerEnabled(.., true) + intCfg default 24
        expect(DEFAULT_MENTORSHIP_SETTINGS.session_reminder.enabled).toBe(true);
        expect(DEFAULT_MENTORSHIP_SETTINGS.session_reminder.hours_before).toBe(24);
        // checkin_reminder: opt-in OFF, 14 days — matches triggerEnabled(.., false) + intCfg default 14
        expect(DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder.enabled).toBe(false);
        expect(DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder.inactivity_days).toBe(14);
        // booking email stays off (the booking page sends its own confirmation)
        expect(DEFAULT_MENTORSHIP_SETTINGS.booking.email.enabled).toBe(false);
        // whatsapp is opt-in everywhere
        expect(DEFAULT_MENTORSHIP_SETTINGS.session_reminder.whatsapp.enabled).toBe(false);
        expect(DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder.whatsapp.enabled).toBe(false);
    });

    it('mirrors the backend defaults for the mentor-request trigger', () => {
        // Both sides notified by default — matches flag(trigger, "notify_*", true).
        expect(DEFAULT_MENTORSHIP_SETTINGS.request.notify_student).toBe(true);
        expect(DEFAULT_MENTORSHIP_SETTINGS.request.notify_mentor).toBe(true);
        // The editable message is the DECLINE notice; REQUEST_DECLINED has emailDefault=true.
        expect(DEFAULT_MENTORSHIP_SETTINGS.request.email.enabled).toBe(true);
        expect(DEFAULT_MENTORSHIP_SETTINGS.request.whatsapp.enabled).toBe(false);
        // The decline reason is injected by the backend as an escaped, pre-wrapped
        // fragment, so the shipped body must keep that exact token.
        expect(DEFAULT_MENTORSHIP_SETTINGS.request.email.body).toContain('{{decision_note_html}}');
    });
});

describe('mentor-request trigger merge', () => {
    it('fills the whole trigger for a blob saved before mentor requests existed', () => {
        const merged = mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.request, undefined);
        expect(merged).toEqual(DEFAULT_MENTORSHIP_SETTINGS.request);
    });

    it('keeps a saved notify flag while filling the channels', () => {
        const merged = mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.request, {
            notify_mentor: false,
            push: { enabled: false },
        });
        expect(merged.notify_mentor).toBe(false);
        expect(merged.notify_student).toBe(true);
        expect(merged.push.enabled).toBe(false);
        expect(merged.push.title).toBe(DEFAULT_MENTORSHIP_SETTINGS.request.push.title);
        expect(merged.email).toEqual(DEFAULT_MENTORSHIP_SETTINGS.request.email);
    });
});

describe('mergeTrigger', () => {
    it('returns full defaults for a legacy blob that predates the reminder triggers', () => {
        const merged = mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.session_reminder, undefined);
        expect(merged).toEqual(DEFAULT_MENTORSHIP_SETTINGS.session_reminder);
    });

    it('keeps saved scalars (enabled / hours_before) while filling missing channels', () => {
        const merged = mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.session_reminder, {
            enabled: false,
            hours_before: 48,
            email: { enabled: false },
        });
        expect(merged.enabled).toBe(false);
        expect(merged.hours_before).toBe(48);
        expect(merged.email.enabled).toBe(false);
        // unspecified pieces of the email channel keep their defaults
        expect(merged.email.subject).toBe(
            DEFAULT_MENTORSHIP_SETTINGS.session_reminder.email.subject
        );
        // untouched channels stay at defaults
        expect(merged.push).toEqual(DEFAULT_MENTORSHIP_SETTINGS.session_reminder.push);
        expect(merged.whatsapp.enabled).toBe(false);
    });

    it('keeps checkin_reminder opt-out when only inactivity_days was saved', () => {
        const merged = mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder, {
            inactivity_days: 30,
        });
        expect(merged.inactivity_days).toBe(30);
        expect(merged.enabled).toBe(false); // stays opt-in
    });

    it('tolerates the legacy boolean channel form', () => {
        const merged = mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder, {
            email: true,
        });
        expect(merged.email.enabled).toBe(true);
        expect(merged.email.subject).toBe(
            DEFAULT_MENTORSHIP_SETTINGS.checkin_reminder.email.subject
        );
    });

    it('ignores junk blobs without crashing', () => {
        expect(mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.session_reminder, 'garbage')).toEqual(
            DEFAULT_MENTORSHIP_SETTINGS.session_reminder
        );
        expect(mergeTrigger(DEFAULT_MENTORSHIP_SETTINGS.session_reminder, 42)).toEqual(
            DEFAULT_MENTORSHIP_SETTINGS.session_reminder
        );
    });
});

describe('mergeChannel', () => {
    it('spreads a partial saved channel over the default', () => {
        const merged = mergeChannel(DEFAULT_MENTORSHIP_SETTINGS.assignment.email, {
            subject: 'Custom subject',
        });
        expect(merged.subject).toBe('Custom subject');
        expect(merged.enabled).toBe(true);
        expect(merged.body).toBe(DEFAULT_MENTORSHIP_SETTINGS.assignment.email.body);
    });

    it('treats a bare boolean as the enabled flag', () => {
        expect(mergeChannel(DEFAULT_MENTORSHIP_SETTINGS.assignment.email, false).enabled).toBe(
            false
        );
    });
});
