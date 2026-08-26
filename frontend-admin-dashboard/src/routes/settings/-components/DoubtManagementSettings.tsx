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
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

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
    /** Absent = no override; the institute-wide "Default auto-assignment" is the base. */
    source?: QueryTypeAssigneeSource;
    role?: string | null;
    user_ids?: string[];
    /** Roles assigned IN ADDITION to whatever `source` resolves to. */
    also_roles?: string[];
    /** Staff assigned IN ADDITION to whatever `source` resolves to. */
    also_user_ids?: string[];
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

type SubOrgNotifyRecipients = 'ADMINS_ONLY' | 'ALL_TEAM';

interface SubOrgNotificationPrefs {
    /** Also route a sub-org learner's doubt to that sub-org's own staff. */
    enabled: boolean;
    recipients: SubOrgNotifyRecipients;
    /**
     * When true (default), the parent institute's own staff are notified too (additive). When
     * false, only the sub-org is emailed — the parent team gets no notification but still sees the
     * doubt in Doubt Management.
     */
    notify_parent_staff: boolean;
}

interface DoubtManagementSettingsData {
    default_assignee_source: DoubtAssigneeSource;
    fallback_to_batch_when_no_subject_teacher: boolean;
    notifications: DoubtNotificationPrefs;
    learner_query: LearnerQueryPrefs;
    query_types: QueryTypeConfig[];
    sub_org_notifications: SubOrgNotificationPrefs;
}

const DEFAULT_CHANNEL_PREFS: NotificationChannelPrefs = {
    push_enabled: true,
    email_enabled: true,
    system_alert_enabled: true,
    email_template_id: null,
};

// Mirrors the backend default in DoubtManagementSettingDataDto.SubOrgNotificationPrefs: on, and
// the whole sub-org team. A sub-org learner's doubt is otherwise invisible to the sub-org — every
// other route resolves to the parent institute's staff.
const DEFAULT_SUB_ORG_NOTIFICATIONS: SubOrgNotificationPrefs = {
    enabled: true,
    recipients: 'ALL_TEAM',
    notify_parent_staff: true,
};

const DEFAULT_LEARNER_QUERY: LearnerQueryPrefs = {
    enabled: false,
    show_topbar_icon: false,
    show_dashboard_card: false,
    allow_guest: false,
};

// Always-present academic type — cannot be removed (historical rows keep type='DOUBT').
// `assignee: null` = no per-type override, so it follows the global "Default auto-assignment"
// radio. Admins can override it (including to specific staff) from the Query types card.
const SYSTEM_DOUBT_TYPE: QueryTypeConfig = {
    key: 'DOUBT',
    label: 'Doubt',
    enabled: true,
    is_system: true,
    learner_selectable: true,
    assignee: null,
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

const ROLE_CHIP_OPTIONS = ROLE_OPTIONS.map((r) => ({ label: r, value: r }));

/**
 * Frontend-only sentinel for "no per-type override" — the type defers to the institute-wide
 * "Default auto-assignment" radio above. It is never persisted as a source string: picking it
 * clears the type's `assignee` entirely, which is what makes the backend
 * (DoubtsManager.resolveAssigneesForDoubt) fall back to `default_assignee_source`.
 */
const INHERIT_DEFAULT = 'DEFAULT';
type RouteSelectValue = QueryTypeAssigneeSource | typeof INHERIT_DEFAULT;

const ASSIGNEE_SOURCE_OPTIONS: { value: RouteSelectValue; label: string }[] = [
    { value: INHERIT_DEFAULT, label: 'Default auto-assignment (set above)' },
    { value: 'SUBJECT_TEACHER', label: 'Subject teacher' },
    { value: 'BATCH_TEACHER', label: 'Batch teacher' },
    { value: 'ROLE', label: 'A role' },
    { value: 'SPECIFIC_USERS', label: 'Specific staff' },
    { value: 'NONE', label: 'No one (no notifications sent)' },
];

/**
 * Strips empty additive arrays and collapses an assignee that no longer says anything to
 * `undefined`. Sending `also_user_ids: []` would be harmless but writes noise into every institute's
 * settings blob, and an assignee of `{}` reads as "configured" while behaving as "not configured".
 */
const normalizeAssignee = (assignee: QueryTypeAssignee | null | undefined) => {
    if (!assignee) return undefined;
    const alsoRoles = (assignee.also_roles ?? []).filter(Boolean);
    const alsoUsers = (assignee.also_user_ids ?? []).filter(Boolean);
    const next: QueryTypeAssignee = { ...assignee };
    delete next.also_roles;
    delete next.also_user_ids;
    if (alsoRoles.length) next.also_roles = alsoRoles;
    if (alsoUsers.length) next.also_user_ids = alsoUsers;
    if (!next.source && !next.also_roles && !next.also_user_ids) return undefined;
    return next;
};

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
    sub_org_notifications: { ...DEFAULT_SUB_ORG_NOTIFICATIONS },
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
        title: 'Admins only',
        description:
            'Skip teachers entirely — assign every doubt to your institute admins, who are notified and then triage it onward.',
    },
];

// Labels take the institute's own word for a sub-org (Franchise / Center / ...) so the copy reads
// correctly wherever NamingSettings has been customised.
const SUB_ORG_RECIPIENT_OPTIONS: {
    value: SubOrgNotifyRecipients;
    title: (label: string) => string;
    description: (label: string) => string;
}[] = [
    {
        value: 'ALL_TEAM',
        title: (label) => `${label} admins and team`,
        description: (label) =>
            `Everyone with active access to the learner's ${label.toLowerCase()} — its admins plus every team member added under it.`,
    },
    {
        value: 'ADMINS_ONLY',
        title: (label) => `${label} admins only`,
        description: (label) =>
            `Just the admins of the learner's ${label.toLowerCase()}. Quieter, but team members won't see the doubt unless an admin assigns it.`,
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
        // A stored type with no assignee keeps deferring to `default_assignee_source`. Seeding a
        // concrete source here would silently start overriding that global choice on the next save.
        assignee: t.assignee ?? null,
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
        sub_org_notifications: {
            ...DEFAULT_SUB_ORG_NOTIFICATIONS,
            ...(raw.sub_org_notifications ?? {}),
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
    const instituteId = getCurrentInstituteId() ?? undefined;
    const { assignees, isLoading: assigneesLoading } = useInstituteAssignees(instituteId);
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
    const subOrgLabel = getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg);

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
                // Every type — the built-in DOUBT included — may carry its own routing. An
                // assignee that says nothing (no source, no additive handlers) is dropped so the
                // backend keeps falling back to default_assignee_source for that type.
                assignee: normalizeAssignee(t.assignee),
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
                    <CardTitle>{subOrgLabel} routing</CardTitle>
                    <CardDescription>
                        Applies only to doubts raised by a learner who belongs to a{' '}
                        {subOrgLabel.toLowerCase()}. Their {subOrgLabel.toLowerCase()} shares this
                        institute&rsquo;s courses and batches, so none of the rules above can reach
                        its staff — batch-teacher matching skips {subOrgLabel.toLowerCase()} access
                        rows and role lookups run against this institute. Turn this on to notify
                        them as well.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Switch
                            id="sub-org-notify"
                            checked={settings.sub_org_notifications.enabled}
                            onCheckedChange={(v) =>
                                update({
                                    sub_org_notifications: {
                                        ...settings.sub_org_notifications,
                                        enabled: v,
                                    },
                                })
                            }
                        />
                        <div>
                            <Label
                                htmlFor="sub-org-notify"
                                className="cursor-pointer text-sm font-medium text-neutral-800"
                            >
                                Also notify the learner&rsquo;s {subOrgLabel.toLowerCase()}
                            </Label>
                            <p className="mt-0.5 text-xs text-neutral-600">
                                They are added as assignees on top of whoever the rules above
                                picked, so they get the email, push and bell alert and the doubt
                                shows up in their inbox.
                            </p>
                        </div>
                    </div>

                    {settings.sub_org_notifications.enabled && (
                        <div className="space-y-2 border-t border-neutral-200 pt-4">
                            <Label className="text-sm font-medium text-neutral-800">
                                Who receives it
                            </Label>
                            {SUB_ORG_RECIPIENT_OPTIONS.map((opt) => {
                                const selected =
                                    settings.sub_org_notifications.recipients === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() =>
                                            update({
                                                sub_org_notifications: {
                                                    ...settings.sub_org_notifications,
                                                    recipients: opt.value,
                                                },
                                            })
                                        }
                                        className={`w-full rounded-lg border p-3 text-left transition-colors ${
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
                                                    {opt.title(subOrgLabel)}
                                                </div>
                                                <p className="mt-0.5 text-xs text-neutral-600">
                                                    {opt.description(subOrgLabel)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {settings.sub_org_notifications.enabled && (
                        <div className="space-y-3 border-t border-neutral-200 pt-4">
                            <div className="flex items-start gap-3">
                                <Switch
                                    id="sub-org-notify-parent"
                                    checked={settings.sub_org_notifications.notify_parent_staff}
                                    onCheckedChange={(v) =>
                                        update({
                                            sub_org_notifications: {
                                                ...settings.sub_org_notifications,
                                                notify_parent_staff: v,
                                            },
                                        })
                                    }
                                />
                                <div>
                                    <Label
                                        htmlFor="sub-org-notify-parent"
                                        className="cursor-pointer text-sm font-medium text-neutral-800"
                                    >
                                        Also email this institute&rsquo;s own team
                                    </Label>
                                    <p className="mt-0.5 text-xs text-neutral-600">
                                        {settings.sub_org_notifications.notify_parent_staff
                                            ? `On: your teachers/admins are notified alongside the ${subOrgLabel.toLowerCase()}, exactly as they are for a normal doubt.`
                                            : `Off: only the ${subOrgLabel.toLowerCase()} is emailed. Your own team gets no email, push or bell for these doubts — but they still appear in your Doubt Management inbox, so nothing is hidden.`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

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
                assigneesLoading={assigneesLoading}
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
    assigneesLoading,
    onUpdate,
    onAdd,
    onRemove,
}: {
    types: QueryTypeConfig[];
    assignees: AssigneeOption[];
    assigneesLoading: boolean;
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
                    Issue, Payment Issue). Each type routes to its own default handler — including
                    the built-in Doubt type, which you can point at a teacher, a role, or specific
                    staff. The Doubt type can’t be renamed or removed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-3">
                    {types.map((t, i) => {
                        const source: RouteSelectValue = t.assignee?.source ?? INHERIT_DEFAULT;
                        const pickedStaff = t.assignee?.user_ids ?? [];
                        const alsoStaff = t.assignee?.also_user_ids ?? [];
                        const alsoRoles = t.assignee?.also_roles ?? [];
                        // With SPECIFIC_USERS the base list already IS a staff picker; a second one
                        // would just be two lists doing the same job.
                        const showAlsoStaff = source !== 'SPECIFIC_USERS';
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
                                    <select
                                        className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-primary-400 focus:outline-none"
                                        value={source}
                                        onChange={(e) => {
                                            const next = e.target.value as RouteSelectValue;
                                            // The sentinel isn't a source — clear the override so
                                            // the type falls back to the global default again,
                                            // keeping any additive handlers on top of it.
                                            if (next === INHERIT_DEFAULT) {
                                                const keep =
                                                    alsoRoles.length || alsoStaff.length
                                                        ? {
                                                              also_roles: alsoRoles,
                                                              also_user_ids: alsoStaff,
                                                          }
                                                        : null;
                                                onUpdate(i, { assignee: keep });
                                                return;
                                            }
                                            onUpdate(i, {
                                                assignee: { ...t.assignee, source: next },
                                            });
                                        }}
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

                                    {source === INHERIT_DEFAULT && (
                                        <span className="text-xs italic text-neutral-500">
                                            follows “Default auto-assignment” above
                                        </span>
                                    )}
                                </div>

                                {t.is_system && source !== INHERIT_DEFAULT && (
                                    <p className="text-xs text-neutral-500">
                                        This only changes who is auto-assigned and notified. Teacher
                                        inbox visibility still follows “Default auto-assignment”
                                        above.
                                    </p>
                                )}

                                {source === 'SPECIFIC_USERS' && (
                                    <div className="space-y-1">
                                        <span className="text-xs font-semibold text-neutral-600">
                                            Staff handlers
                                        </span>
                                        <SelectChips
                                            options={assigneeOptions}
                                            selected={assigneeOptions.filter((o) =>
                                                pickedStaff.includes(o.value)
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
                                                            ...pickedStaff.filter(
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
                                        {assigneesLoading ? (
                                            <p className="text-xs text-neutral-500">
                                                Loading staff…
                                            </p>
                                        ) : assigneeOptions.length === 0 ? (
                                            <p className="text-xs text-warning-600">
                                                No active staff found. Add team members under Teams
                                                first, then pick them here.
                                            </p>
                                        ) : pickedStaff.length === 0 ? (
                                            <p className="text-xs text-neutral-500">
                                                Nobody picked yet — until you add someone, these
                                                queries fall back to the institute’s admins.
                                            </p>
                                        ) : null}
                                    </div>
                                )}

                                <div className="space-y-2 rounded-md bg-neutral-50 p-2">
                                    <span className="text-xs font-semibold text-neutral-600">
                                        Also always assign
                                    </span>
                                    <p className="text-xs text-neutral-500">
                                        Added on top of “Route to” — pick a teacher route and still
                                        keep these people on every query of this type.
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <SelectChips
                                            placeholder="Roles…"
                                            options={ROLE_CHIP_OPTIONS}
                                            selected={ROLE_CHIP_OPTIONS.filter((o) =>
                                                alsoRoles.includes(o.value)
                                            )}
                                            onChange={(picked) =>
                                                onUpdate(i, {
                                                    assignee: {
                                                        ...t.assignee,
                                                        also_roles: picked.map((p) => p.value),
                                                    },
                                                })
                                            }
                                            multiSelect={true}
                                            hasClearFilter={true}
                                            className="min-w-44"
                                        />
                                        {showAlsoStaff && (
                                            <SelectChips
                                                placeholder="Staff…"
                                                options={assigneeOptions}
                                                selected={assigneeOptions.filter((o) =>
                                                    alsoStaff.includes(o.value)
                                                )}
                                                onChange={(picked) =>
                                                    onUpdate(i, {
                                                        assignee: {
                                                            ...t.assignee,
                                                            // Keep ids that aren't in the loaded
                                                            // staff page so they aren't dropped.
                                                            also_user_ids: [
                                                                ...picked.map((p) => p.value),
                                                                ...alsoStaff.filter(
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
                                                hasClearFilter={true}
                                                className="min-w-60"
                                            />
                                        )}
                                    </div>
                                </div>
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
