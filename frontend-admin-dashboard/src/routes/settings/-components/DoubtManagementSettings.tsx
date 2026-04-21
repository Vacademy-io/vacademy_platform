import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL, GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

type DoubtAssigneeSource = 'SUBJECT_TEACHER' | 'BATCH_TEACHER' | 'BOTH' | 'NONE';

interface NotificationChannelPrefs {
    push_enabled: boolean;
    email_enabled: boolean;
    email_template_id: string | null;
}

interface DoubtNotificationPrefs {
    on_doubt_raised: NotificationChannelPrefs;
    on_doubt_resolved: NotificationChannelPrefs;
}

interface DoubtManagementSettingsData {
    default_assignee_source: DoubtAssigneeSource;
    fallback_to_batch_when_no_subject_teacher: boolean;
    notifications: DoubtNotificationPrefs;
}

const DEFAULT_CHANNEL_PREFS: NotificationChannelPrefs = {
    push_enabled: true,
    email_enabled: false,
    email_template_id: null,
};

const DEFAULT_SETTINGS: DoubtManagementSettingsData = {
    default_assignee_source: 'BATCH_TEACHER',
    fallback_to_batch_when_no_subject_teacher: true,
    notifications: {
        on_doubt_raised: { ...DEFAULT_CHANNEL_PREFS },
        on_doubt_resolved: { ...DEFAULT_CHANNEL_PREFS },
    },
};

const SETTING_KEY = 'DOUBT_MANAGEMENT_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');
const TEMPLATES_BY_TYPE_URL = (instituteId: string, type: string) =>
    `${BASE_URL}/admin-core-service/institute/template/v1/institute/${instituteId}/type/${type}`;

const OPTIONS: { value: DoubtAssigneeSource; title: string; description: string }[] = [
    {
        value: 'SUBJECT_TEACHER',
        title: 'Subject teacher',
        description:
            'Auto-assign to faculty mapped to the doubt’s subject (narrowest match). Ideal for slide-level doubts where the subject is unambiguous.',
    },
    {
        value: 'BATCH_TEACHER',
        title: 'Batch teacher',
        description:
            'Auto-assign to every faculty mapped to the batch, regardless of subject. This is the legacy behavior.',
    },
    {
        value: 'BOTH',
        title: 'Both',
        description: 'Union of subject-mapped and batch-mapped faculty.',
    },
    {
        value: 'NONE',
        title: 'None (manual)',
        description: 'No auto-assign. Admins assign each doubt manually.',
    },
];

type EmailTemplateOption = { id: string; name: string };

const fetchSettings = async (): Promise<DoubtManagementSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    // `/get` returns a SettingDto shape: { key, name, data }. `data` is the typed payload.
    const stored = response.data?.data ?? null;
    return mergeWithDefaults(stored);
};

/**
 * Merges whatever is stored server-side with DEFAULT_SETTINGS so missing fields don't render
 * uncontrolled inputs. This also handles the case where an institute has a pre-notifications
 * payload saved (no `notifications` block yet).
 */
function mergeWithDefaults(raw: Partial<DoubtManagementSettingsData> | null): DoubtManagementSettingsData {
    if (!raw) return DEFAULT_SETTINGS;
    return {
        default_assignee_source: raw.default_assignee_source ?? DEFAULT_SETTINGS.default_assignee_source,
        fallback_to_batch_when_no_subject_teacher:
            raw.fallback_to_batch_when_no_subject_teacher ??
            DEFAULT_SETTINGS.fallback_to_batch_when_no_subject_teacher,
        notifications: {
            on_doubt_raised: {
                ...DEFAULT_CHANNEL_PREFS,
                ...(raw.notifications?.on_doubt_raised ?? {}),
            },
            on_doubt_resolved: {
                ...DEFAULT_CHANNEL_PREFS,
                ...(raw.notifications?.on_doubt_resolved ?? {}),
            },
        },
    };
}

const saveSettings = async (data: DoubtManagementSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Doubt Management Settings', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

const fetchEmailTemplates = async (): Promise<EmailTemplateOption[]> => {
    const instituteId = getCurrentInstituteId();
    if (!instituteId) return [];
    try {
        const response = await authenticatedAxiosInstance.get(
            TEMPLATES_BY_TYPE_URL(instituteId, 'EMAIL')
        );
        const rows = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
        return rows
            .filter((t: { id?: string; name?: string }) => !!t?.id && !!t?.name)
            .map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }));
    } catch {
        return [];
    }
};

export default function DoubtManagementSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<DoubtManagementSettingsData>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const { ensurePermission } = usePushNotifications();
    const [browserPushStatus, setBrowserPushStatus] = useState<NotificationPermission | 'unsupported'>(
        typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
    );

    const handleEnablePush = async () => {
        if (browserPushStatus === 'unsupported') {
            toast.error('This browser does not support push notifications.');
            return;
        }
        await ensurePermission();
        // Permission state may have changed; re-read to reflect in UI.
        if (typeof Notification !== 'undefined') {
            setBrowserPushStatus(Notification.permission);
            if (Notification.permission === 'granted') {
                toast.success('Push notifications enabled on this device.');
            } else if (Notification.permission === 'denied') {
                toast.error(
                    'Notifications blocked. Unblock them from the browser padlock icon, then retry.'
                );
            }
        }
    };

    const { data, isLoading } = useQuery({
        queryKey: ['doubt-management-settings'],
        queryFn: fetchSettings,
        staleTime: 5 * 60 * 1000,
    });

    const { data: emailTemplates = [] } = useQuery({
        queryKey: ['doubt-management-email-templates'],
        queryFn: fetchEmailTemplates,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
        }
    }, [data]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveSettings,
        onSuccess: () => {
            toast.success('Doubt management settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['doubt-management-settings'] });
        },
        onError: () => {
            toast.error('Failed to save doubt management settings');
        },
    });

    const update = (patch: Partial<DoubtManagementSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const updateNotificationEvent = (
        event: keyof DoubtNotificationPrefs,
        patch: Partial<NotificationChannelPrefs>
    ) => {
        setSettings((prev) => ({
            ...prev,
            notifications: {
                ...prev.notifications,
                [event]: { ...prev.notifications[event], ...patch },
            },
        }));
        setHasChanges(true);
    };

    const showFallbackToggle = settings.default_assignee_source === 'SUBJECT_TEACHER';

    // Email can be turned on without explicitly picking a template — the backend falls back to the
    // institute's seeded default (doubt-raised-tpl-<instituteId> / doubt-resolved-tpl-<instituteId>)
    // from migration V214.
    const handleSave = () => {
        save(settings);
    };

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Default auto-assignment</CardTitle>
                    <CardDescription>
                        Controls who gets pre-assigned when a learner raises a new doubt. Only
                        affects new doubts — existing doubts keep their current assignees.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {OPTIONS.map((opt) => {
                        const selected = settings.default_assignee_source === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => update({ default_assignee_source: opt.value })}
                                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                                    selected
                                        ? 'border-primary-400 bg-primary-50'
                                        : 'border-neutral-200 hover:border-neutral-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        aria-hidden
                                        className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                            selected
                                                ? 'border-primary-500 bg-primary-500'
                                                : 'border-neutral-300 bg-white'
                                        }`}
                                    >
                                        {selected && (
                                            <span className="size-1.5 rounded-full bg-white" />
                                        )}
                                    </span>
                                    <div>
                                        <div className="text-sm font-medium text-neutral-800">
                                            {opt.title}
                                        </div>
                                        <p className="mt-0.5 text-xs text-neutral-600">
                                            {opt.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </CardContent>
            </Card>

            {showFallbackToggle && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fallback behavior</CardTitle>
                        <CardDescription>
                            What to do when a doubt’s subject has no mapped faculty.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-start gap-3">
                            <Switch
                                id="fallback-to-batch"
                                checked={settings.fallback_to_batch_when_no_subject_teacher}
                                onCheckedChange={(v) =>
                                    update({ fallback_to_batch_when_no_subject_teacher: v })
                                }
                            />
                            <div>
                                <Label
                                    htmlFor="fallback-to-batch"
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    Fall back to batch teachers when no subject teacher exists
                                </Label>
                                <p className="mt-0.5 text-xs text-neutral-600">
                                    If off, doubts with no subject-mapped faculty will be left
                                    unassigned and require manual attention.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Push notifications on this device</CardTitle>
                    <CardDescription>
                        Each admin/teacher enables push on their own browser. Without this step, the
                        push toggles below do nothing for this user — the backend sends, the
                        browser silently drops.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-sm">
                            <div className="font-medium text-neutral-800">
                                {browserPushStatus === 'granted'
                                    ? 'Enabled'
                                    : browserPushStatus === 'denied'
                                      ? 'Blocked by browser'
                                      : browserPushStatus === 'unsupported'
                                        ? 'Not supported'
                                        : 'Not enabled yet'}
                            </div>
                            <p className="mt-0.5 text-xs text-neutral-600">
                                {browserPushStatus === 'granted' &&
                                    'This device will receive FCM pushes for doubt events.'}
                                {browserPushStatus === 'denied' &&
                                    'Click the padlock icon in the URL bar → Notifications → Allow, then reload.'}
                                {browserPushStatus === 'default' &&
                                    'Click the button to prompt for notification permission.'}
                                {browserPushStatus === 'unsupported' &&
                                    'Your browser doesn’t expose the Notification API.'}
                            </p>
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={handleEnablePush}
                            disable={
                                browserPushStatus === 'granted' ||
                                browserPushStatus === 'unsupported'
                            }
                        >
                            {browserPushStatus === 'granted'
                                ? 'Already enabled'
                                : 'Enable push'}
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            <NotificationEventCard
                title="When a doubt is raised"
                description="Notifies the assigned teacher(s). Push is delivered via the same FCM pipeline already used elsewhere — browsers that haven’t granted notification permission will silently skip."
                idPrefix="raised"
                prefs={settings.notifications.on_doubt_raised}
                templates={emailTemplates}
                onChange={(patch) => updateNotificationEvent('on_doubt_raised', patch)}
            />

            <NotificationEventCard
                title="When a doubt is resolved"
                description="Notifies the learner who raised the doubt."
                idPrefix="resolved"
                prefs={settings.notifications.on_doubt_resolved}
                templates={emailTemplates}
                onChange={(patch) => updateNotificationEvent('on_doubt_resolved', patch)}
            />

            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !hasChanges}
                >
                    {saving ? 'Saving…' : 'Save settings'}
                </MyButton>
            </div>
        </div>
    );
}

function NotificationEventCard({
    title,
    description,
    idPrefix,
    prefs,
    templates,
    onChange,
}: {
    title: string;
    description: string;
    idPrefix: string;
    prefs: NotificationChannelPrefs;
    templates: EmailTemplateOption[];
    onChange: (patch: Partial<NotificationChannelPrefs>) => void;
}) {
    const pushId = `${idPrefix}-push`;
    const emailId = `${idPrefix}-email`;
    const templateId = `${idPrefix}-template`;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                    <Switch
                        id={pushId}
                        checked={prefs.push_enabled}
                        onCheckedChange={(v) => onChange({ push_enabled: v })}
                    />
                    <div>
                        <Label
                            htmlFor={pushId}
                            className="cursor-pointer text-sm font-medium text-neutral-800"
                        >
                            Push notification
                        </Label>
                        <p className="mt-0.5 text-xs text-neutral-600">
                            Default on. Uses FCM — recipients must have granted notification
                            permission and registered a device token.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Switch
                        id={emailId}
                        checked={prefs.email_enabled}
                        onCheckedChange={(v) =>
                            onChange({ email_enabled: v, ...(v ? {} : { email_template_id: null }) })
                        }
                    />
                    <div className="flex-1">
                        <Label
                            htmlFor={emailId}
                            className="cursor-pointer text-sm font-medium text-neutral-800"
                        >
                            Email notification
                        </Label>
                        <p className="mt-0.5 text-xs text-neutral-600">
                            Off by default. Pick an email template to send alongside (or instead of)
                            the push.
                        </p>

                        {prefs.email_enabled && (
                            <div className="mt-2 space-y-1">
                                <Label htmlFor={templateId} className="text-xs text-neutral-700">
                                    Email template
                                </Label>
                                <select
                                    id={templateId}
                                    className="w-full max-w-md rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none"
                                    value={prefs.email_template_id ?? ''}
                                    onChange={(e) =>
                                        onChange({
                                            email_template_id: e.target.value || null,
                                        })
                                    }
                                >
                                    <option value="">Default template (auto)</option>
                                    {templates.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-neutral-500">
                                    Leave as <em>Default template (auto)</em> to use the seeded
                                    institute template — it automatically picks up your institute
                                    theme color, name, and support email. Pick a custom template
                                    here only if you want different copy.
                                </p>
                                <p className="text-[11px] text-neutral-500">
                                    Placeholders available:{' '}
                                    <code>{'{{institute_name}}'}</code>,{' '}
                                    <code>{'{{institute_theme_color}}'}</code>,{' '}
                                    <code>{'{{recipient_name}}'}</code>,{' '}
                                    <code>{'{{doubt_text}}'}</code>,{' '}
                                    <code>{'{{doubt_id}}'}</code>,{' '}
                                    <code>{'{{support_email}}'}</code>.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
