import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    UsersThree,
    CalendarPlus,
    CalendarX,
    EnvelopeSimple,
    BellRinging,
    DeviceMobile,
    WhatsappLogo,
    Alarm,
    HandWaving,
} from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DashboardLoader } from '@/components/core/dashboard-loader';

import {
    DEFAULT_MENTORSHIP_SETTINGS,
    MENTORSHIP_PLACEHOLDERS,
    getMentorshipSettings,
    saveMentorshipSettings,
    type MentorshipSettings as MentorshipSettingsType,
    type MentorshipTriggerSettings,
    type MentorshipEmailTemplate,
    type MentorshipTextTemplate,
    type MentorshipWhatsappTemplate,
} from '@/services/mentorship-settings';
import { whatsappTemplateService } from '@/services/whatsapp-template-service';
import type { MetaWhatsAppTemplate } from '@/types/message-template-types';

/** Mentorship fields an admin can map a WhatsApp template variable to. '' = auto-match by name. */
const WA_FIELD_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'Auto (match by name)' },
    { value: 'name', label: "Recipient's name" },
    { value: 'mentor_name', label: "Mentor's name" },
    { value: 'student_name', label: "Student's name" },
    { value: 'session_title', label: 'Session title' },
    { value: 'session_datetime', label: 'Session date & time' },
];

/** Extract {{tokens}} from an approved template's BODY text. */
const templateBodyTokens = (template: MetaWhatsAppTemplate | undefined): string[] => {
    if (!template) return [];
    const body = template.components?.find((c) => c.type === 'BODY')?.text ?? '';
    const tokens = Array.from(body.matchAll(/\{\{([^}]+)\}\}/g)).map((m) => m[1]!.trim());
    return Array.from(new Set(tokens));
};

const PlaceholderHint = () => (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-neutral-400">Placeholders:</span>
        {MENTORSHIP_PLACEHOLDERS.map((p) => (
            <code
                key={p.token}
                title={p.label}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600"
            >
                {p.token}
            </code>
        ))}
    </div>
);

/** Email or in-app/push channel: toggle + editable subject/title + body. */
const InlineTemplateBlock = ({
    icon,
    label,
    description,
    enabled,
    onToggle,
    primaryLabel,
    primaryValue,
    onPrimaryChange,
    bodyValue,
    onBodyChange,
    idPrefix,
}: {
    icon: React.ReactNode;
    label: string;
    description?: string;
    enabled: boolean;
    onToggle: (v: boolean) => void;
    primaryLabel: string;
    primaryValue: string;
    onPrimaryChange: (v: string) => void;
    bodyValue: string;
    onBodyChange: (v: string) => void;
    idPrefix: string;
}) => (
    <div className="py-3">
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3">
                <div className="text-neutral-500">{icon}</div>
                <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-800">{label}</div>
                    {description && (
                        <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
                    )}
                </div>
            </div>
            <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
        {enabled && (
            <div className="ml-9 mt-3 space-y-2">
                <div>
                    <Label htmlFor={`${idPrefix}-primary`} className="text-xs text-neutral-600">
                        {primaryLabel}
                    </Label>
                    <Input
                        id={`${idPrefix}-primary`}
                        value={primaryValue}
                        onChange={(e) => onPrimaryChange(e.target.value)}
                        className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor={`${idPrefix}-body`} className="text-xs text-neutral-600">
                        Message
                    </Label>
                    <Textarea
                        id={`${idPrefix}-body`}
                        value={bodyValue}
                        onChange={(e) => onBodyChange(e.target.value)}
                        rows={3}
                        className="mt-1"
                    />
                </div>
            </div>
        )}
    </div>
);

/** WhatsApp channel: toggle + approved-template picker + optional variable mapping. */
const WhatsappBlock = ({
    value,
    onChange,
    templates,
    loading,
}: {
    value: MentorshipWhatsappTemplate;
    onChange: (patch: Partial<MentorshipWhatsappTemplate>) => void;
    templates: MetaWhatsAppTemplate[];
    loading: boolean;
}) => {
    const selected = useMemo(
        () => templates.find((t) => t.name === value.template_name),
        [templates, value.template_name]
    );
    const tokens = useMemo(() => templateBodyTokens(selected), [selected]);

    const setMapping = (token: string, field: string) => {
        const next = { ...value.variable_mapping };
        if (field) next[token] = field;
        else delete next[token];
        onChange({ variable_mapping: next });
    };

    return (
        <div className="py-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-1 items-start gap-3">
                    <div className="mt-0.5 text-neutral-500">
                        <WhatsappLogo size={18} />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-800">WhatsApp</div>
                        <div className="mt-0.5 text-xs text-neutral-500">
                            Requires an approved Meta template.
                        </div>
                    </div>
                </div>
                <Switch checked={value.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
            </div>
            {value.enabled && (
                <div className="ml-9 mt-3 space-y-3">
                    <div>
                        <Label className="text-xs text-neutral-600">Approved template</Label>
                        <Select
                            value={value.template_name || undefined}
                            onValueChange={(name) => {
                                const t = templates.find((x) => x.name === name);
                                onChange({
                                    template_name: name,
                                    language_code: t?.language || value.language_code || 'en',
                                    variable_mapping: {},
                                });
                            }}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue
                                    placeholder={
                                        loading ? 'Loading templates…' : 'Select an approved template'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-neutral-500">
                                        No approved WhatsApp templates found.
                                    </div>
                                ) : (
                                    templates.map((t) => (
                                        <SelectItem key={t.id} value={t.name}>
                                            {t.name} ({t.language})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {selected && tokens.length > 0 && (
                        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                            <div className="text-xs font-medium text-neutral-600">
                                Map template variables
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-400">
                                Leave as “Auto” when the template variable name already matches a
                                mentorship field.
                            </div>
                            <div className="mt-2 space-y-2">
                                {tokens.map((token) => (
                                    <div key={token} className="flex items-center gap-2">
                                        <code className="w-40 shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                                            {`{{${token}}}`}
                                        </code>
                                        <Select
                                            value={value.variable_mapping[token] ?? ''}
                                            onValueChange={(field) => setMapping(token, field)}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {WA_FIELD_OPTIONS.map((o) => (
                                                    <SelectItem key={o.value || 'auto'} value={o.value}>
                                                        {o.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/** One trigger card: the four channel blocks + a shared placeholder hint. */
const TriggerCard = ({
    icon,
    title,
    description,
    idPrefix,
    trigger,
    onChannelChange,
    waTemplates,
    waLoading,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    idPrefix: string;
    trigger: MentorshipTriggerSettings;
    onChannelChange: (
        channel: keyof MentorshipTriggerSettings,
        patch: Record<string, unknown>
    ) => void;
    waTemplates: MetaWhatsAppTemplate[];
    waLoading: boolean;
    children?: React.ReactNode;
}) => (
    <Card>
        <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-2">
            <div className="mt-0.5 rounded-md bg-primary-50 p-2 text-primary-500">{icon}</div>
            <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-0">
            {children}
            <InlineTemplateBlock
                icon={<EnvelopeSimple size={18} />}
                label="Email"
                enabled={trigger.email.enabled}
                onToggle={(v) => onChannelChange('email', { enabled: v })}
                primaryLabel="Subject"
                primaryValue={trigger.email.subject}
                onPrimaryChange={(v) => onChannelChange('email', { subject: v })}
                bodyValue={trigger.email.body}
                onBodyChange={(v) => onChannelChange('email', { body: v })}
                idPrefix={`${idPrefix}-email`}
            />
            <Separator />
            <InlineTemplateBlock
                icon={<BellRinging size={18} />}
                label="In-app alert"
                enabled={trigger.system_alert.enabled}
                onToggle={(v) => onChannelChange('system_alert', { enabled: v })}
                primaryLabel="Title"
                primaryValue={trigger.system_alert.title}
                onPrimaryChange={(v) => onChannelChange('system_alert', { title: v })}
                bodyValue={trigger.system_alert.body}
                onBodyChange={(v) => onChannelChange('system_alert', { body: v })}
                idPrefix={`${idPrefix}-alert`}
            />
            <Separator />
            <InlineTemplateBlock
                icon={<DeviceMobile size={18} />}
                label="Push notification"
                enabled={trigger.push.enabled}
                onToggle={(v) => onChannelChange('push', { enabled: v })}
                primaryLabel="Title"
                primaryValue={trigger.push.title}
                onPrimaryChange={(v) => onChannelChange('push', { title: v })}
                bodyValue={trigger.push.body}
                onBodyChange={(v) => onChannelChange('push', { body: v })}
                idPrefix={`${idPrefix}-push`}
            />
            <Separator />
            <WhatsappBlock
                value={trigger.whatsapp}
                onChange={(patch) => onChannelChange('whatsapp', patch)}
                templates={waTemplates}
                loading={waLoading}
            />
            <PlaceholderHint />
        </CardContent>
    </Card>
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
    const [waTemplates, setWaTemplates] = useState<MetaWhatsAppTemplate[]>([]);
    const [waLoading, setWaLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const fresh = await getMentorshipSettings();
                if (!cancelled) {
                    setSettings(fresh);
                    setInitial(fresh);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        (async () => {
            try {
                const list = await whatsappTemplateService.getMetaTemplates();
                if (!cancelled) setWaTemplates(list.filter((t) => t.status === 'APPROVED'));
            } catch {
                if (!cancelled) setWaTemplates([]);
            } finally {
                if (!cancelled) setWaLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const dirty = JSON.stringify(settings) !== JSON.stringify(initial);

    const updateChannel = (
        triggerKey: keyof MentorshipSettingsType,
        channel: keyof MentorshipTriggerSettings,
        patch: Record<string, unknown>
    ) =>
        setSettings(
            (prev) =>
                ({
                    ...prev,
                    [triggerKey]: {
                        ...prev[triggerKey],
                        [channel]: {
                            ...(prev[triggerKey] as MentorshipTriggerSettings)[channel],
                            ...patch,
                        },
                    },
                }) as MentorshipSettingsType
        );

    const setAssignmentFlag = (key: 'notify_student' | 'notify_mentor', v: boolean) =>
        setSettings((prev) => ({ ...prev, assignment: { ...prev.assignment, [key]: v } }));

    const setReminderField = (key: 'enabled' | 'hours_before', v: boolean | number) =>
        setSettings((prev) => ({
            ...prev,
            session_reminder: { ...prev.session_reminder, [key]: v },
        }));

    const setCheckinField = (key: 'enabled' | 'inactivity_days', v: boolean | number) =>
        setSettings((prev) => ({
            ...prev,
            checkin_reminder: { ...prev.checkin_reminder, [key]: v },
        }));

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
                            Choose how learners are notified for each mentorship event.
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

            <TriggerCard
                icon={<UsersThree size={20} />}
                title="Mentor Assigned"
                description="When a mentor is assigned to a student."
                idPrefix="assignment"
                trigger={settings.assignment}
                onChannelChange={(channel, patch) => updateChannel('assignment', channel, patch)}
                waTemplates={waTemplates}
                waLoading={waLoading}
            >
                <div className="pb-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Who to notify
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-neutral-700">Notify the student</span>
                        <Switch
                            checked={settings.assignment.notify_student}
                            onCheckedChange={(v) => setAssignmentFlag('notify_student', v)}
                        />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-neutral-700">Notify the mentor</span>
                        <Switch
                            checked={settings.assignment.notify_mentor}
                            onCheckedChange={(v) => setAssignmentFlag('notify_mentor', v)}
                        />
                    </div>
                    <Separator />
                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Learner message &amp; channels
                    </div>
                </div>
            </TriggerCard>

            <TriggerCard
                icon={<CalendarPlus size={20} />}
                title="Session Booked"
                description="When a learner books a 1:1 session."
                idPrefix="booking"
                trigger={settings.booking}
                onChannelChange={(channel, patch) => updateChannel('booking', channel, patch)}
                waTemplates={waTemplates}
                waLoading={waLoading}
            />

            <TriggerCard
                icon={<CalendarX size={20} />}
                title="Session Cancelled"
                description="When a session is cancelled."
                idPrefix="cancellation"
                trigger={settings.cancellation}
                onChannelChange={(channel, patch) => updateChannel('cancellation', channel, patch)}
                waTemplates={waTemplates}
                waLoading={waLoading}
            />

            <TriggerCard
                icon={<Alarm size={20} />}
                title="Session Reminder"
                description="Before an upcoming session."
                idPrefix="session-reminder"
                trigger={settings.session_reminder}
                onChannelChange={(channel, patch) =>
                    updateChannel('session_reminder', channel, patch)
                }
                waTemplates={waTemplates}
                waLoading={waLoading}
            >
                <div className="pb-1">
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-neutral-700">Send session reminders</span>
                        <Switch
                            checked={settings.session_reminder.enabled}
                            onCheckedChange={(v) => setReminderField('enabled', v)}
                        />
                    </div>
                    {settings.session_reminder.enabled && (
                        <div className="flex items-center justify-between gap-4 py-2">
                            <Label
                                htmlFor="session-reminder-hours"
                                className="text-sm font-normal text-neutral-700"
                            >
                                Hours before the session
                            </Label>
                            <Input
                                id="session-reminder-hours"
                                type="number"
                                min={1}
                                max={168}
                                value={settings.session_reminder.hours_before}
                                onChange={(e) =>
                                    // Clamp to the backend's accepted range so the UI never
                                    // shows a value the scheduler won't actually use.
                                    setReminderField(
                                        'hours_before',
                                        Math.min(168, Math.max(1, Math.round(Number(e.target.value) || 1)))
                                    )
                                }
                                className="w-24"
                            />
                        </div>
                    )}
                    <Separator />
                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Learner message &amp; channels
                    </div>
                </div>
            </TriggerCard>

            <TriggerCard
                icon={<HandWaving size={20} />}
                title="Check-in Nudge"
                description="When a learner hasn't met their mentor for a while."
                idPrefix="checkin-reminder"
                trigger={settings.checkin_reminder}
                onChannelChange={(channel, patch) =>
                    updateChannel('checkin_reminder', channel, patch)
                }
                waTemplates={waTemplates}
                waLoading={waLoading}
            >
                <div className="pb-1">
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-neutral-700">Send check-in nudges</span>
                        <Switch
                            checked={settings.checkin_reminder.enabled}
                            onCheckedChange={(v) => setCheckinField('enabled', v)}
                        />
                    </div>
                    {settings.checkin_reminder.enabled && (
                        <div className="flex items-center justify-between gap-4 py-2">
                            <Label
                                htmlFor="checkin-days"
                                className="text-sm font-normal text-neutral-700"
                            >
                                Days without a session
                            </Label>
                            <Input
                                id="checkin-days"
                                type="number"
                                min={1}
                                max={365}
                                value={settings.checkin_reminder.inactivity_days}
                                onChange={(e) =>
                                    // Clamp to the backend's accepted range (see intCfg 1..365).
                                    setCheckinField(
                                        'inactivity_days',
                                        Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 1)))
                                    )
                                }
                                className="w-24"
                            />
                        </div>
                    )}
                    <Separator />
                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                        Learner message &amp; channels
                    </div>
                </div>
            </TriggerCard>
        </div>
    );
}
