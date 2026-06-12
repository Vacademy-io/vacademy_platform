import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import SelectChips from '@/components/design-system/SelectChips';
import { toast } from 'sonner';
import { Plus, Trash } from '@phosphor-icons/react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL, GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
    useInstituteAssignees,
    type AssigneeOption,
} from '@/routes/dashboard/-hooks/useInstituteAssignees';

type DoubtAssigneeSource = 'SUBJECT_TEACHER' | 'BATCH_TEACHER' | 'BOTH' | 'NONE';

// Per-type routing can additionally target a role or specific staff, beyond the faculty cascade.
type QueryTypeAssigneeSource =
    | 'SUBJECT_TEACHER'
    | 'BATCH_TEACHER'
    | 'BOTH'
    | 'ROLE'
    | 'SPECIFIC_USERS'
    | 'NONE';

interface QueryTypeAssignee {
    source: QueryTypeAssigneeSource;
    role?: string | null;
    user_ids?: string[];
}

interface QueryTypeConfig {
    key: string;
    label: string;
    enabled?: boolean;
    is_system?: boolean;
    learner_selectable?: boolean;
    assignee?: QueryTypeAssignee | null;
}

interface LearnerQueryPrefs {
    enabled: boolean;
    show_topbar_icon: boolean;
    show_dashboard_card: boolean;
    /** Logged-out visitors can raise queries from the login page; replies go to their email. */
    allow_guest: boolean;
}

interface NotificationChannelPrefs {
    push_enabled: boolean;
    email_enabled: boolean;
    system_alert_enabled: boolean;
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
    learner_query: LearnerQueryPrefs;
    query_types: QueryTypeConfig[];
}

const DEFAULT_CHANNEL_PREFS: NotificationChannelPrefs = {
    push_enabled: true,
    email_enabled: true,
    system_alert_enabled: true,
    email_template_id: null,
};

const DEFAULT_LEARNER_QUERY: LearnerQueryPrefs = {
    enabled: false,
    show_topbar_icon: false,
    show_dashboard_card: false,
    allow_guest: false,
};

// Always-present academic type — cannot be removed (historical rows keep type='DOUBT').
const SYSTEM_DOUBT_TYPE: QueryTypeConfig = {
    key: 'DOUBT',
    label: 'Doubt',
    enabled: true,
    is_system: true,
    learner_selectable: true,
    assignee: { source: 'SUBJECT_TEACHER' },
};

// Seeded defaults shown to institutes that haven't configured types yet. Nothing is persisted (or
// shown to learners) until the admin enables learner intake and hits Save.
const DEFAULT_QUERY_TYPES: QueryTypeConfig[] = [
    SYSTEM_DOUBT_TYPE,
    {
        key: 'TECHNICAL',
        label: 'Technical Issue',
        enabled: true,
        learner_selectable: true,
        assignee: { source: 'ROLE', role: 'ADMIN' },
    },
    {
        key: 'PAYMENT',
        label: 'Payment Issue',
        enabled: true,
        learner_selectable: true,
        assignee: { source: 'ROLE', role: 'ADMIN' },
    },
];

// Roles offered when a type routes by ROLE.
const ROLE_OPTIONS = ['ADMIN', 'TEACHER', 'EVALUATOR', 'CONTENT CREATOR', 'ASSESSMENT CREATOR'];

const ASSIGNEE_SOURCE_OPTIONS: { value: QueryTypeAssigneeSource; label: string }[] = [
    { value: 'SUBJECT_TEACHER', label: 'Subject teacher' },
    { value: 'BATCH_TEACHER', label: 'Batch teacher' },
    { value: 'ROLE', label: 'A role' },
    { value: 'SPECIFIC_USERS', label: 'Specific staff' },
    { value: 'NONE', label: 'No auto-assign (manual)' },
];

/** UPPER_SNAKE slug used as a stable type key when the admin adds a new type. */
const slugifyKey = (label: string): string =>
    label
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'TYPE';

const DEFAULT_SETTINGS: DoubtManagementSettingsData = {
    default_assignee_source: 'BATCH_TEACHER',
    fallback_to_batch_when_no_subject_teacher: true,
    notifications: {
        on_doubt_raised: { ...DEFAULT_CHANNEL_PREFS },
        on_doubt_resolved: { ...DEFAULT_CHANNEL_PREFS },
    },
    learner_query: { ...DEFAULT_LEARNER_QUERY },
    query_types: DEFAULT_QUERY_TYPES.map((t) => ({ ...t })),
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
function mergeWithDefaults(
    raw: Partial<DoubtManagementSettingsData> | null
): DoubtManagementSettingsData {
    if (!raw) return DEFAULT_SETTINGS;
    // Existing institutes may have a payload without query_types/learner_query — seed defaults so
    // the editors render, but leave learner intake OFF so nothing changes for them until they save.
    const storedTypes =
        Array.isArray(raw.query_types) && raw.query_types.length > 0
            ? raw.query_types
            : DEFAULT_QUERY_TYPES;
    const hasDoubt = storedTypes.some((t) => t?.key?.toUpperCase() === 'DOUBT');
    const query_types = (hasDoubt ? storedTypes : [SYSTEM_DOUBT_TYPE, ...storedTypes]).map((t) => ({
        ...t,
        enabled: t.enabled ?? true,
        learner_selectable: t.learner_selectable ?? true,
        is_system: t.key?.toUpperCase() === 'DOUBT' ? true : t.is_system ?? false,
        assignee: t.assignee ?? { source: 'SUBJECT_TEACHER' },
    }));
    return {
        default_assignee_source:
            raw.default_assignee_source ?? DEFAULT_SETTINGS.default_assignee_source,
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
        learner_query: { ...DEFAULT_LEARNER_QUERY, ...(raw.learner_query ?? {}) },
        query_types,
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
    const instituteId = getCurrentInstituteId() ?? undefined;
    const { assignees } = useInstituteAssignees(instituteId);
    const [settings, setSettings] = useState<DoubtManagementSettingsData>(DEFAULT_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const { ensurePermission } = usePushNotifications();
    const [browserPushStatus, setBrowserPushStatus] = useState<
        NotificationPermission | 'unsupported'
    >(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

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

    const updateLearnerQuery = (patch: Partial<LearnerQueryPrefs>) => {
        setSettings((prev) => ({ ...prev, learner_query: { ...prev.learner_query, ...patch } }));
        setHasChanges(true);
    };

    const updateQueryType = (index: number, patch: Partial<QueryTypeConfig>) => {
        setSettings((prev) => ({
            ...prev,
            query_types: prev.query_types.map((t, i) => (i === index ? { ...t, ...patch } : t)),
        }));
        setHasChanges(true);
    };

    const addQueryType = () => {
        setSettings((prev) => ({
            ...prev,
            query_types: [
                ...prev.query_types,
                {
                    key: '',
                    label: '',
                    enabled: true,
                    learner_selectable: true,
                    assignee: { source: 'ROLE', role: 'ADMIN' },
                },
            ],
        }));
        setHasChanges(true);
    };

    const removeQueryType = (index: number) => {
        setSettings((prev) => ({
            ...prev,
            query_types: prev.query_types.filter((_, i) => i !== index),
        }));
        setHasChanges(true);
    };

    const showFallbackToggle = settings.default_assignee_source === 'SUBJECT_TEACHER';

    // Email can be turned on without explicitly picking a template — the backend resolves through
    // three layers: admin-configured id → institute-specific override row → global DEFAULT row
    // seeded by V215 (see DoubtNotificationService.resolveTemplateId). Email defaults to ON;
    // admins can turn it off per-event below.
    const handleSave = () => {
        // Drop blank rows, assign a stable UPPER_SNAKE key to new types (the system DOUBT key is
        // fixed), and de-duplicate by key so the per-type routing lookup is unambiguous.
        const seen = new Set<string>();
        const normalizedTypes: QueryTypeConfig[] = [];
        for (const t of settings.query_types) {
            const label = t.label.trim();
            if (!label && !t.is_system) continue;
            const key = (t.is_system ? 'DOUBT' : t.key || slugifyKey(label)).toUpperCase();
            if (seen.has(key)) {
                toast.error(`Duplicate query type key "${key}". Rename one of them.`);
                return;
            }
            seen.add(key);
            normalizedTypes.push({
                ...t,
                key,
                label: label || t.label,
                // The built-in DOUBT type always defers to the global "Default auto-assignment"
                // radio above — never persist a per-type assignee for it, otherwise it would
                // silently override default_assignee_source on the backend.
                assignee: t.is_system ? undefined : t.assignee,
            });
        }
        save({ ...settings, query_types: normalizedTypes });
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
                        push toggles below do nothing for this user — the backend sends, the browser
                        silently drops.
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
                            {browserPushStatus === 'granted' ? 'Already enabled' : 'Enable push'}
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

            <QueryTypesCard
                types={settings.query_types}
                assignees={assignees}
                onUpdate={updateQueryType}
                onAdd={addQueryType}
                onRemove={removeQueryType}
            />

            <LearnerQueryCard prefs={settings.learner_query} onChange={updateLearnerQuery} />

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
    const systemAlertId = `${idPrefix}-system-alert`;
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
                        id={systemAlertId}
                        checked={prefs.system_alert_enabled}
                        onCheckedChange={(v) => onChange({ system_alert_enabled: v })}
                    />
                    <div>
                        <Label
                            htmlFor={systemAlertId}
                            className="cursor-pointer text-sm font-medium text-neutral-800"
                        >
                            In-app bell alert
                        </Label>
                        <p className="mt-0.5 text-xs text-neutral-600">
                            Default on. Shows a persistent entry in the recipient’s bell icon —
                            stays visible when the user returns to the app even if they missed the
                            push.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Switch
                        id={emailId}
                        checked={prefs.email_enabled}
                        onCheckedChange={(v) =>
                            onChange({
                                email_enabled: v,
                                ...(v ? {} : { email_template_id: null }),
                            })
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
                            On by default. Sent alongside the push — turn off to suppress. Uses the
                            seeded default template unless you pick a custom one below.
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
                                <p className="text-caption text-neutral-500">
                                    Leave as <em>Default template (auto)</em> to use the seeded
                                    institute template — it automatically picks up your institute
                                    theme color, name, and support email. Pick a custom template
                                    here only if you want different copy.
                                </p>
                                <p className="text-caption text-neutral-500">
                                    Placeholders available: <code>{'{{institute_name}}'}</code>,{' '}
                                    <code>{'{{institute_theme_color}}'}</code>,{' '}
                                    <code>{'{{recipient_name}}'}</code>,{' '}
                                    <code>{'{{doubt_text}}'}</code>, <code>{'{{doubt_id}}'}</code>,{' '}
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

function QueryTypesCard({
    types,
    assignees,
    onUpdate,
    onAdd,
    onRemove,
}: {
    types: QueryTypeConfig[];
    assignees: AssigneeOption[];
    onUpdate: (index: number, patch: Partial<QueryTypeConfig>) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
}) {
    const assigneeOptions = assignees.map((a) => ({
        label: a.subtitle ? `${a.name} · ${a.subtitle}` : a.name,
        value: a.id,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Query types</CardTitle>
                <CardDescription>
                    The categories a learner can pick when raising a query (e.g. Doubt, Technical
                    Issue, Payment Issue). Each type routes to its own default handler. The Doubt
                    type is built-in and can’t be removed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-3">
                    {types.map((t, i) => {
                        const source = t.assignee?.source ?? 'SUBJECT_TEACHER';
                        return (
                            <div
                                key={i}
                                className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <Input
                                        placeholder="Type name (e.g. Technical Issue)"
                                        value={t.label}
                                        disabled={t.is_system}
                                        onChange={(e) => onUpdate(i, { label: e.target.value })}
                                        className="h-9 flex-1"
                                    />
                                    {t.is_system ? (
                                        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                                            Built-in
                                        </span>
                                    ) : (
                                        <MyButton
                                            buttonType="text"
                                            layoutVariant="icon"
                                            scale="small"
                                            aria-label="Remove type"
                                            onClick={() => onRemove(i)}
                                            className="shrink-0 !text-neutral-400 hover:!text-danger-500"
                                        >
                                            <Trash className="size-4" />
                                        </MyButton>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                    <label className="flex items-center gap-2">
                                        <Switch
                                            checked={t.enabled !== false}
                                            onCheckedChange={(v) => onUpdate(i, { enabled: v })}
                                        />
                                        <span className="text-xs text-neutral-700">Enabled</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <Switch
                                            checked={t.learner_selectable !== false}
                                            onCheckedChange={(v) =>
                                                onUpdate(i, { learner_selectable: v })
                                            }
                                        />
                                        <span className="text-xs text-neutral-700">
                                            Learner can pick
                                        </span>
                                    </label>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs font-semibold text-neutral-600">
                                        Route to
                                    </span>
                                    {t.is_system && (
                                        <span className="text-xs italic text-neutral-500">
                                            uses “Default auto-assignment” above
                                        </span>
                                    )}
                                    <select
                                        className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                        value={source}
                                        disabled={t.is_system}
                                        onChange={(e) =>
                                            onUpdate(i, {
                                                assignee: {
                                                    ...t.assignee,
                                                    source: e.target
                                                        .value as QueryTypeAssigneeSource,
                                                },
                                            })
                                        }
                                    >
                                        {ASSIGNEE_SOURCE_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>

                                    {source === 'ROLE' && (
                                        <select
                                            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none"
                                            value={t.assignee?.role ?? 'ADMIN'}
                                            onChange={(e) =>
                                                onUpdate(i, {
                                                    assignee: {
                                                        ...t.assignee,
                                                        source: 'ROLE',
                                                        role: e.target.value,
                                                    },
                                                })
                                            }
                                        >
                                            {ROLE_OPTIONS.map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {source === 'SPECIFIC_USERS' && (
                                    <div className="space-y-1">
                                        <span className="text-xs font-semibold text-neutral-600">
                                            Staff handlers
                                        </span>
                                        <SelectChips
                                            options={assigneeOptions}
                                            selected={assigneeOptions.filter((o) =>
                                                (t.assignee?.user_ids ?? []).includes(o.value)
                                            )}
                                            onChange={(
                                                picked: { label: string; value: string }[]
                                            ) =>
                                                onUpdate(i, {
                                                    assignee: {
                                                        ...t.assignee,
                                                        source: 'SPECIFIC_USERS',
                                                        // Preserve already-saved ids that aren't in
                                                        // the loaded staff page (beyond the first
                                                        // 200, or now inactive) so they aren't
                                                        // silently dropped on save.
                                                        user_ids: [
                                                            ...picked.map((p) => p.value),
                                                            ...(t.assignee?.user_ids ?? []).filter(
                                                                (id) =>
                                                                    !assigneeOptions.some(
                                                                        (o) => o.value === id
                                                                    )
                                                            ),
                                                        ],
                                                    },
                                                })
                                            }
                                            multiSelect={true}
                                            hasClearFilter={false}
                                            className="min-w-60"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <MyButton buttonType="secondary" onClick={onAdd} className="w-full border-dashed">
                    <span className="flex items-center gap-2">
                        <Plus className="size-4" />
                        Add query type
                    </span>
                </MyButton>
            </CardContent>
        </Card>
    );
}

function LearnerQueryCard({
    prefs,
    onChange,
}: {
    prefs: LearnerQueryPrefs;
    onChange: (patch: Partial<LearnerQueryPrefs>) => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Learner query intake</CardTitle>
                <CardDescription>
                    Let learners raise queries from outside a course. Off by default — turning this
                    on does not affect the in-course doubt flow. Learners only see the types you
                    marked “Learner can pick” above.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                    <Switch
                        id="learner-query-enabled"
                        checked={prefs.enabled}
                        onCheckedChange={(v) => onChange({ enabled: v })}
                    />
                    <div>
                        <Label
                            htmlFor="learner-query-enabled"
                            className="cursor-pointer text-sm font-medium text-neutral-800"
                        >
                            Enable learner query intake
                        </Label>
                        <p className="mt-0.5 text-xs text-neutral-600">
                            Master switch for the entry points below.
                        </p>
                    </div>
                </div>

                {prefs.enabled && (
                    <>
                        <div className="flex items-start gap-3">
                            <Switch
                                id="learner-query-topbar"
                                checked={prefs.show_topbar_icon}
                                onCheckedChange={(v) => onChange({ show_topbar_icon: v })}
                            />
                            <div>
                                <Label
                                    htmlFor="learner-query-topbar"
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    Show “?” icon in the top bar
                                </Label>
                                <p className="mt-0.5 text-xs text-neutral-600">
                                    A quick-access question-mark button visible across the learner
                                    app.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Switch
                                id="learner-query-dashboard"
                                checked={prefs.show_dashboard_card}
                                onCheckedChange={(v) => onChange({ show_dashboard_card: v })}
                            />
                            <div>
                                <Label
                                    htmlFor="learner-query-dashboard"
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    Show “Raise a query” card on the dashboard
                                </Label>
                                <p className="mt-0.5 text-xs text-neutral-600">
                                    A help card on the learner home screen.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Switch
                                id="learner-query-guest"
                                checked={prefs.allow_guest}
                                onCheckedChange={(v) => onChange({ allow_guest: v })}
                            />
                            <div>
                                <Label
                                    htmlFor="learner-query-guest"
                                    className="cursor-pointer text-sm font-medium text-neutral-800"
                                >
                                    Allow logged-out visitors to raise queries
                                </Label>
                                <p className="mt-0.5 text-xs text-neutral-600">
                                    Adds a “Need help?” button to the learner login page. Visitors
                                    leave their name and email — staff replies are emailed to that
                                    address.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
