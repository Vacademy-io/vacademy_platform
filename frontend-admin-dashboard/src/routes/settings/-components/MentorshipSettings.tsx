import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UsersThree, CalendarPlus, CalendarX, EnvelopeSimple, BellRinging, DeviceMobile } from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';

import {
    DEFAULT_MENTORSHIP_SETTINGS,
    getMentorshipSettings,
    saveMentorshipSettings,
    type MentorshipSettings as MentorshipSettingsType,
} from '@/services/mentorship-settings';

/** Single labelled toggle row (matches the LiveSessionSettings pattern). */
const RowToggle = ({
    icon,
    title,
    description,
    checked,
    onChange,
    disabled,
}: {
    icon?: React.ReactNode;
    title: string;
    description: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
}) => (
    <div className="flex items-start justify-between gap-4 py-3">
        <div className="flex flex-1 items-start gap-3">
            {icon && <div className="mt-0.5 text-neutral-500">{icon}</div>}
            <div className="flex-1">
                <div className="text-sm font-medium text-neutral-800">{title}</div>
                <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
            </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
);

interface MentorshipSettingsProps {
    /** Rendered inside the quick-access popup rather than the full /settings page. */
    embedded?: boolean;
}

export default function MentorshipSettings({ embedded = false }: MentorshipSettingsProps = {}) {
    const [settings, setSettings] = useState<MentorshipSettingsType>(DEFAULT_MENTORSHIP_SETTINGS);
    const [initial, setInitial] = useState<MentorshipSettingsType>(DEFAULT_MENTORSHIP_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const fresh = await getMentorshipSettings();
                if (cancelled) return;
                setSettings(fresh);
                setInitial(fresh);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

    const setAssignment = (key: keyof MentorshipSettingsType['assignment'], value: boolean) =>
        setSettings((prev) => ({ ...prev, assignment: { ...prev.assignment, [key]: value } }));
    const setBooking = (key: keyof MentorshipSettingsType['booking'], value: boolean) =>
        setSettings((prev) => ({ ...prev, booking: { ...prev.booking, [key]: value } }));
    const setCancellation = (key: keyof MentorshipSettingsType['cancellation'], value: boolean) =>
        setSettings((prev) => ({ ...prev, cancellation: { ...prev.cancellation, [key]: value } }));

    const reset = () => setSettings(initial);

    const save = async () => {
        try {
            setSaving(true);
            await saveMentorshipSettings(settings);
            setInitial(settings);
            toast.success('Mentorship settings saved');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save mentorship settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div
                className={cn(
                    'flex flex-wrap items-center gap-3',
                    embedded ? 'justify-end' : 'justify-between'
                )}
            >
                {!embedded && (
                    <div>
                        <h2 className="text-xl font-semibold text-neutral-800">
                            Mentorship Settings
                        </h2>
                        <p className="text-sm text-neutral-500">
                            Choose which mentorship events send notifications and over which
                            channels. Everything is on by default.
                        </p>
                    </div>
                )}
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={reset} disabled={!dirty || saving}>
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        onClick={save}
                        disabled={!dirty || saving}
                        className="bg-primary-500 hover:bg-primary-600"
                    >
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </div>

            {/* Mentor assigned */}
            <Card>
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="mt-0.5 rounded-md bg-primary-50 p-2 text-primary-500">
                        <UsersThree size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-base">Mentor Assigned</CardTitle>
                        <CardDescription>
                            When a mentor is assigned to a student (manually or via round-robin).
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-2 pt-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Who to notify
                    </div>
                    <RowToggle
                        title="Notify the student"
                        description='Sends a "You have a new mentor" alert to the student.'
                        checked={settings.assignment.notify_student}
                        onChange={(v) => setAssignment('notify_student', v)}
                    />
                    <RowToggle
                        title="Notify the mentor"
                        description='Sends a "New mentee assigned" alert to the mentor.'
                        checked={settings.assignment.notify_mentor}
                        onChange={(v) => setAssignment('notify_mentor', v)}
                    />
                    <Separator className="my-1" />
                    <div className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Channels
                    </div>
                    <RowToggle
                        icon={<EnvelopeSimple size={18} />}
                        title="Email"
                        description="Send an email notification."
                        checked={settings.assignment.email}
                        onChange={(v) => setAssignment('email', v)}
                    />
                    <RowToggle
                        icon={<BellRinging size={18} />}
                        title="In-app alert"
                        description="Show an alert in the notification bell."
                        checked={settings.assignment.system_alert}
                        onChange={(v) => setAssignment('system_alert', v)}
                    />
                    <RowToggle
                        icon={<DeviceMobile size={18} />}
                        title="Push notification"
                        description="Send a push notification to mobile devices."
                        checked={settings.assignment.push}
                        onChange={(v) => setAssignment('push', v)}
                    />
                </CardContent>
            </Card>

            {/* Session booked */}
            <Card>
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="mt-0.5 rounded-md bg-primary-50 p-2 text-primary-500">
                        <CalendarPlus size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-base">Session Booked</CardTitle>
                        <CardDescription>
                            When a learner books a 1:1 session with their mentor. The email
                            confirmation is controlled by the booking page&apos;s own settings.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-2 pt-0">
                    <RowToggle
                        icon={<BellRinging size={18} />}
                        title="In-app alert"
                        description="Show an alert in the notification bell."
                        checked={settings.booking.system_alert}
                        onChange={(v) => setBooking('system_alert', v)}
                    />
                    <RowToggle
                        icon={<DeviceMobile size={18} />}
                        title="Push notification"
                        description="Send a push notification to mobile devices."
                        checked={settings.booking.push}
                        onChange={(v) => setBooking('push', v)}
                    />
                </CardContent>
            </Card>

            {/* Session cancelled */}
            <Card>
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="mt-0.5 rounded-md bg-primary-50 p-2 text-primary-500">
                        <CalendarX size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-base">Session Cancelled</CardTitle>
                        <CardDescription>
                            When a mentorship session is cancelled.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-2 pt-0">
                    <RowToggle
                        icon={<EnvelopeSimple size={18} />}
                        title="Email"
                        description="Send an email notification."
                        checked={settings.cancellation.email}
                        onChange={(v) => setCancellation('email', v)}
                    />
                    <RowToggle
                        icon={<BellRinging size={18} />}
                        title="In-app alert"
                        description="Show an alert in the notification bell."
                        checked={settings.cancellation.system_alert}
                        onChange={(v) => setCancellation('system_alert', v)}
                    />
                    <RowToggle
                        icon={<DeviceMobile size={18} />}
                        title="Push notification"
                        description="Send a push notification to mobile devices."
                        checked={settings.cancellation.push}
                        onChange={(v) => setCancellation('push', v)}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
