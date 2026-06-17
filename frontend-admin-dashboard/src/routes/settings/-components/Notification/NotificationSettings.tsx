import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Bell, Settings } from 'lucide-react';
import { Info, Trash } from '@phosphor-icons/react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Friendly purposes for an email address. Each option maps to the storage `type`
// key used inside institute.setting.EMAIL_SETTING.data on the backend. The
// dropdown shows the friendly label; the backend persists the code.
//
// `UTILITY_EMAIL` is the system-wide fallback used when no type matches, so it
// stays as the default for new addresses.
const EMAIL_PURPOSES = [
    {
        code: 'UTILITY_EMAIL',
        label: 'System notifications & updates',
        hint: 'Account alerts, password resets, reminders',
    },
    {
        code: 'INFO_EMAIL',
        label: 'Announcements & general info',
        hint: 'News, newsletters, broadcast updates',
    },
    {
        code: 'TRANSACTIONAL_EMAIL',
        label: 'Receipts & confirmations',
        hint: 'Payment receipts, enrollment confirmations',
    },
    {
        code: 'MARKETING_EMAIL',
        label: 'Marketing & promotions',
        hint: 'Campaigns, offers, promotional content',
    },
    {
        code: 'SUPPORT_EMAIL',
        label: 'Support & help',
        hint: 'Replies to learners or staff who need help',
    },
] as const;

const CUSTOM_PURPOSE_OPTION = '__custom__';

function purposeLabelFor(code: string): string {
    const match = EMAIL_PURPOSES.find((p) => p.code === code);
    if (match) return match.label;
    // Custom / unknown type — turn UTILITY_EMAIL into "Utility email" for display.
    return code
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
import type {
    NotificationSettings,
    NotificationSettingsResponse,
    ChatSettings,
    ChatDirectRole,
    ChatModerationAction,
} from '@/services/notification-settings';
import {
    createUpsertRequest,
    getNotificationDefaultTemplate,
    getNotificationSettings,
    upsertNotificationSettings,
    mergeChatSettings,
} from '@/services/notification-settings';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    getEmailConfigurations,
    createEmailConfiguration,
    updateEmailConfiguration,
    deleteEmailConfiguration,
    type EmailConfiguration,
    type CreateEmailConfigurationRequest,
} from '@/services/email-configuration-service';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { Textarea } from '@/components/ui/textarea';
import {
    FIREBASE_CREDENTIALS_LABEL,
    FIREBASE_CREDENTIALS_HELPER_TEXT,
    FIREBASE_CREDENTIALS_PLACEHOLDER,
    FIREBASE_CREDENTIALS_TOOLTIP,
    FIREBASE_VALIDATION_MESSAGES,
    normalizeServiceAccountInput,
    validateFirebaseServiceAccountJson,
} from '@/services/notification-settings';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

type Props = { isTab?: boolean };

export default function NotificationSettings({ isTab = false }: Props) {
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Email configurations state
    const [emailConfigurations, setEmailConfigurations] = useState<EmailConfiguration[]>([]);
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    getInstituteId();

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const data: NotificationSettingsResponse = await getNotificationSettings();
                if (!data?.id) {
                    const template = await getNotificationDefaultTemplate();
                    setSettings({
                        ...template.settings,
                        emails: template.settings.emails || []
                    });
                } else {
                    setSettings({
                        ...data.settings,
                        emails: data.settings.emails || []
                    });
                }
            } catch (e) {
                console.error(e);
                setError('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Load email configurations
    useEffect(() => {
        const loadEmailConfigurations = async () => {
            setEmailLoading(true);
            setEmailError(null);
            try {
                const configs = await getEmailConfigurations();
                setEmailConfigurations(configs);
            } catch (e) {
                console.error('Error loading email configurations:', e);
                setEmailError('Failed to load email configurations');
            } finally {
                setEmailLoading(false);
            }
        };
        loadEmailConfigurations();
    }, []);

    const update = <K extends keyof NotificationSettings>(
        key: K,
        updater: (prev: NotificationSettings[K]) => NotificationSettings[K]
    ) => {
        setSettings((prev) => {
            if (!prev) return prev;
            setHasChanges(true);
            return { ...prev, [key]: updater(prev[key]) } as NotificationSettings;
        });
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            // Create a copy of settings without the emails field for API compatibility
            const { emails, ...settingsForApi } = settings;
            const req = createUpsertRequest(settingsForApi);
            await upsertNotificationSettings(req);
            toast.success('Notification settings saved');
            setHasChanges(false);
        } catch (e) {
            console.error(e);
            toast.error('Failed to save notification settings');
        } finally {
            setSaving(false);
        }
    };

    const handleValidateAndSaveFirebase = async () => {
        if (!settings) return;
        const firebase = settings.firebase || {};
        const normalized = normalizeServiceAccountInput({
            jsonString: firebase.serviceAccountJson || null,
            base64String: firebase.serviceAccountJsonBase64 || null,
        });
        if (!normalized || normalized.trim().length === 0) {
            toast.error(FIREBASE_VALIDATION_MESSAGES.required);
            return;
        }
        const result = validateFirebaseServiceAccountJson(normalized);
        if (!result.valid) {
            toast.error(result.errorMessage || FIREBASE_VALIDATION_MESSAGES.invalidJson);
            return;
        }
        await handleSave();
    };

    if (loading || !settings) {
        return <div className="flex items-center justify-center p-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {isTab && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold ">Notification Settings</h2>
                        <p className="text-sm text-gray-600">
                            Configure institute-wide announcement permissions
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <MyButton
                            buttonType="primary"
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                        >
                            Save Settings
                        </MyButton>
                    </div>
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* General */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="size-5" /> General
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <Label>Approval required</Label>
                                <div className="text-xs text-muted-foreground">
                                    Require admin approval before announcements are visible
                                </div>
                            </div>
                            <Switch
                                checked={settings.general.announcement_approval_required}
                                onCheckedChange={(checked) =>
                                    update('general', (g) => ({
                                        ...g,
                                        announcement_approval_required: checked,
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <Label>Max announcements/day</Label>
                                <div className="text-xs text-muted-foreground">Limit per user</div>
                            </div>
                            <Input
                                type="number"
                                className="w-28"
                                value={settings.general.max_announcements_per_day}
                                onChange={(e) =>
                                    update('general', (g) => ({
                                        ...g,
                                        max_announcements_per_day: Number(e.target.value || 0),
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <Label>Retention (days)</Label>
                                <div className="text-xs text-muted-foreground">
                                    Auto cleanup period
                                </div>
                            </div>
                            <Input
                                type="number"
                                className="w-28"
                                value={settings.general.retention_days}
                                onChange={(e) =>
                                    update('general', (g) => ({
                                        ...g,
                                        retention_days: Number(e.target.value || 0),
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <Label>Default timezone</Label>
                                <div className="text-xs text-muted-foreground">
                                    Used for scheduling and reminders
                                </div>
                            </div>
                            <Input
                                className="w-56"
                                value={settings.general.default_timezone}
                                onChange={(e) =>
                                    update('general', (g) => ({
                                        ...g,
                                        default_timezone: e.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Community */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bell className="size-5" /> Community
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <ToggleRow
                            label="Students can send"
                            checked={settings.community.students_can_send}
                            onChange={(checked) =>
                                update('community', (c) => ({ ...c, students_can_send: checked }))
                            }
                        />
                        <ToggleRow
                            label="Admins can moderate"
                            checked={!!settings.community.moderation_enabled}
                            onChange={(checked) =>
                                update('community', (c) => ({ ...c, moderation_enabled: checked }))
                            }
                        />
                        <ToggleRow
                            label="Allow replies"
                            checked={!!settings.community.allow_replies}
                            onChange={(checked) =>
                                update('community', (c) => ({ ...c, allow_replies: checked }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Allowed tags</Label>
                        <TagEditor
                            value={settings.community.allowed_tags || []}
                            onChange={(tags) =>
                                update('community', (c) => ({ ...c, allowed_tags: tags }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Chat */}
            <ChatSection
                chat={mergeChatSettings(settings.chat)}
                onChange={(updater) =>
                    update('chat', (prev) => updater(mergeChatSettings(prev)))
                }
            />

            {/* System Alerts */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">System Alerts</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <ToggleRow
                        label="Teachers can send"
                        checked={!!settings.systemAlerts.teachers_can_send}
                        onChange={(checked) =>
                            update('systemAlerts', (s) => ({ ...s, teachers_can_send: checked }))
                        }
                    />
                    <ToggleRow
                        label="Admins can send"
                        checked={!!settings.systemAlerts.admins_can_send}
                        onChange={(checked) =>
                            update('systemAlerts', (s) => ({ ...s, admins_can_send: checked }))
                        }
                    />
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label>Auto dismiss (hours)</Label>
                            <div className="text-xs text-muted-foreground">Auto clear after</div>
                        </div>
                        <Input
                            type="number"
                            className="w-28"
                            value={settings.systemAlerts.auto_dismiss_hours}
                            onChange={(e) =>
                                update('systemAlerts', (s) => ({
                                    ...s,
                                    auto_dismiss_hours: Number(e.target.value || 0),
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Dashboard Pins */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Dashboard Pins</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <ToggleRow
                        label="Students can create"
                        checked={settings.dashboardPins.students_can_create}
                        onChange={(checked) =>
                            update('dashboardPins', (d) => ({ ...d, students_can_create: checked }))
                        }
                    />
                    <ToggleRow
                        label="Teachers can create"
                        checked={!!settings.dashboardPins.teachers_can_create}
                        onChange={(checked) =>
                            update('dashboardPins', (d) => ({ ...d, teachers_can_create: checked }))
                        }
                    />
                    <ToggleRow
                        label="Admins can create"
                        checked={!!settings.dashboardPins.admins_can_create}
                        onChange={(checked) =>
                            update('dashboardPins', (d) => ({ ...d, admins_can_create: checked }))
                        }
                    />
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label>Max duration (hours)</Label>
                            <div className="text-xs text-muted-foreground">Pin lifetime</div>
                        </div>
                        <Input
                            type="number"
                            className="w-28"
                            value={settings.dashboardPins.max_duration_hours}
                            onChange={(e) =>
                                update('dashboardPins', (d) => ({
                                    ...d,
                                    max_duration_hours: Number(e.target.value || 0),
                                }))
                            }
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label>Max pins per user</Label>
                            <div className="text-xs text-muted-foreground">Creation limit</div>
                        </div>
                        <Input
                            type="number"
                            className="w-28"
                            value={settings.dashboardPins.max_pins_per_user}
                            onChange={(e) =>
                                update('dashboardPins', (d) => ({
                                    ...d,
                                    max_pins_per_user: Number(e.target.value || 0),
                                }))
                            }
                        />
                    </div>
                    <ToggleRow
                        label="Require approval"
                        checked={!!settings.dashboardPins.require_approval}
                        onChange={(checked) =>
                            update('dashboardPins', (d) => ({ ...d, require_approval: checked }))
                        }
                    />
                </CardContent>
            </Card>

            {/* Direct Messages */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Direct Messages</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <ToggleRow
                        label="Students can send"
                        checked={settings.directMessages.students_can_send}
                        onChange={(checked) =>
                            update('directMessages', (s) => ({ ...s, students_can_send: checked }))
                        }
                    />
                    <ToggleRow
                        label="Allow replies"
                        checked={settings.directMessages.allow_replies}
                        onChange={(checked) =>
                            update('directMessages', (s) => ({ ...s, allow_replies: checked }))
                        }
                    />
                    <ToggleRow
                        label="Moderation enabled"
                        checked={settings.directMessages.moderation_enabled}
                        onChange={(checked) =>
                            update('directMessages', (s) => ({ ...s, moderation_enabled: checked }))
                        }
                    />
                </CardContent>
            </Card>

            {/* Push Notifications (Firebase) */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Push Notifications (Firebase)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label>Enable Push Notifications</Label>
                            <div className="text-xs text-muted-foreground">
                                Requires valid Firebase service account JSON
                            </div>
                        </div>
                        <Switch
                            checked={!!settings.firebase?.enabled}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    const normalized = normalizeServiceAccountInput({
                                        jsonString: settings.firebase?.serviceAccountJson || null,
                                        base64String:
                                            settings.firebase?.serviceAccountJsonBase64 || null,
                                    });
                                    if (!normalized) {
                                        toast.error(FIREBASE_VALIDATION_MESSAGES.required);
                                        return;
                                    }
                                    const res = validateFirebaseServiceAccountJson(normalized);
                                    if (!res.valid) {
                                        toast.error(
                                            res.errorMessage ||
                                                FIREBASE_VALIDATION_MESSAGES.invalidJson
                                        );
                                        return;
                                    }
                                }
                                update(
                                    'firebase',
                                    (f) =>
                                        ({
                                            ...(f || {}),
                                            enabled: checked,
                                        }) as NonNullable<NotificationSettings['firebase']>
                                );
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label>{FIREBASE_CREDENTIALS_LABEL}</Label>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground">
                                            <HelpCircle className="size-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <ul className="list-disc pl-4">
                                            {FIREBASE_CREDENTIALS_TOOLTIP.map((t) => (
                                                <li key={t}>{t}</li>
                                            ))}
                                        </ul>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {FIREBASE_CREDENTIALS_HELPER_TEXT}
                        </div>
                        <Textarea
                            className="min-h-[160px] font-mono"
                            placeholder={FIREBASE_CREDENTIALS_PLACEHOLDER}
                            value={settings.firebase?.serviceAccountJson || ''}
                            onChange={(e) =>
                                update(
                                    'firebase',
                                    (f) =>
                                        ({
                                            ...(f || {}),
                                            serviceAccountJson: e.target.value,
                                        }) as NonNullable<NotificationSettings['firebase']>
                                )
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Or paste Base64-encoded JSON</Label>
                        <Input
                            placeholder="Base64 string"
                            value={settings.firebase?.serviceAccountJsonBase64 || ''}
                            onChange={(e) =>
                                update(
                                    'firebase',
                                    (f) =>
                                        ({
                                            ...(f || {}),
                                            serviceAccountJsonBase64: e.target.value,
                                        }) as NonNullable<NotificationSettings['firebase']>
                                )
                            }
                        />
                    </div>

                    <div className="flex items-center justify-end">
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={handleValidateAndSaveFirebase}
                        >
                            Validate & Save
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            {/* Streams */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Streams</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <ToggleRow
                        label="Teachers can send"
                        checked={settings.streams.teachers_can_send}
                        onChange={(checked) =>
                            update('streams', (s) => ({ ...s, teachers_can_send: checked }))
                        }
                    />
                    <ToggleRow
                        label="Allow during class"
                        checked={settings.streams.allow_during_class}
                        onChange={(checked) =>
                            update('streams', (s) => ({ ...s, allow_during_class: checked }))
                        }
                    />
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label>Auto archive (hours)</Label>
                            <div className="text-xs text-muted-foreground">
                                Auto move to archive
                            </div>
                        </div>
                        <Input
                            type="number"
                            className="w-28"
                            value={settings.streams.auto_archive_hours}
                            onChange={(e) =>
                                update('streams', (s) => ({
                                    ...s,
                                    auto_archive_hours: Number(e.target.value || 0),
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>
            {/* Resources */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Resources</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <ToggleRow
                        label="Students can upload"
                        checked={settings.resources.students_can_upload}
                        onChange={(checked) =>
                            update('resources', (r) => ({ ...r, students_can_upload: checked }))
                        }
                    />
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <Label>Max file size (MB)</Label>
                            <div className="text-xs text-muted-foreground">Upload limit</div>
                        </div>
                        <Input
                            type="number"
                            className="w-28"
                            value={settings.resources.max_file_size_mb}
                            onChange={(e) =>
                                update('resources', (r) => ({
                                    ...r,
                                    max_file_size_mb: Number(e.target.value || 0),
                                }))
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Email Settings */}
            <Card className="rounded-lg border-gray-200">
                <CardHeader className="py-3">
                    <CardTitle className="text-base">Email Addresses</CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">
                        These are the email addresses your institute uses to send messages
                        to learners and staff. Each address has a purpose — for example, one
                        for marketing campaigns, another for support replies.
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <EmailListEditor
                        emailConfigurations={emailConfigurations}
                        loading={emailLoading}
                        error={emailError}
                        onAdd={async (config) => {
                            try {
                                const newConfig = await createEmailConfiguration(config);
                                setEmailConfigurations(prev => [...prev, newConfig]);
                                // Detailed verification toast is shown by the editor.
                            } catch (error) {
                                toast.error("Couldn't add this email address. Please try again.");
                            }
                        }}
                        onUpdate={async (emailType, config) => {
                            try {
                                const updatedConfig = await updateEmailConfiguration(emailType, config);
                                setEmailConfigurations(prev =>
                                    prev.map(c => c.type === emailType ? updatedConfig : c)
                                );
                                toast.success('Saved. New emails sent from this address will use the updated details.');
                            } catch (error) {
                                toast.error("Couldn't save your changes. Please try again.");
                            }
                        }}
                        onDelete={async (emailType) => {
                            try {
                                await deleteEmailConfiguration(emailType);
                                setEmailConfigurations(prev => prev.filter(c => c.type !== emailType));
                                toast.success('Email address removed.');
                            } catch (error) {
                                toast.error("Couldn't remove this email address. Please try again.");
                            }
                        }}
                    />
                </CardContent>
            </Card>

            {!isTab && (
                <div className="flex items-center justify-end gap-2">
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                    >
                        Save
                    </MyButton>
                </div>
            )}
        </div>
    );
}

function ToggleRow({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-md border p-3">
            <Label>{label}</Label>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

function NumberRow({
    label,
    hint,
    value,
    onChange,
}: {
    label: string;
    hint?: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-md border p-3">
            <div>
                <Label>{label}</Label>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            <Input
                type="number"
                className="w-28"
                value={value}
                onChange={(e) => onChange(Number(e.target.value || 0))}
            />
        </div>
    );
}

const CHAT_DIRECT_ROLES: ChatDirectRole[] = ['student', 'teacher', 'admin'];

// Maps the API role code (kept unchanged) to its configured singular/plural term.
const CHAT_ROLE_TERMS: Record<ChatDirectRole, { term: RoleTerms; system: SystemTerms }> = {
    student: { term: RoleTerms.Learner, system: SystemTerms.Learner },
    teacher: { term: RoleTerms.Teacher, system: SystemTerms.Teacher },
    admin: { term: RoleTerms.Admin, system: SystemTerms.Admin },
};

const chatRoleLabel = (role: ChatDirectRole): string =>
    getTerminology(CHAT_ROLE_TERMS[role].term, CHAT_ROLE_TERMS[role].system);

const chatRoleLabelPlural = (role: ChatDirectRole): string =>
    getTerminologyPlural(CHAT_ROLE_TERMS[role].term, CHAT_ROLE_TERMS[role].system);

function ChatSection({
    chat,
    onChange,
}: {
    chat: ChatSettings;
    onChange: (updater: (prev: ChatSettings) => ChatSettings) => void;
}) {
    const batchLabel = getTerminology(ContentTerms.Batch, SystemTerms.Batch);
    const rules = chat.community.rules;

    return (
        <Card className="rounded-lg border-gray-200">
            <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="size-5" /> In-App Messages
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Master toggle */}
                <ToggleRow
                    label="In-App Messages enabled"
                    checked={chat.enabled}
                    onChange={(checked) => onChange((c) => ({ ...c, enabled: checked }))}
                />

                {/* Batch groups */}
                <div className="space-y-2">
                    <div className="text-sm font-medium">{batchLabel} groups</div>
                    <div className="grid gap-4 md:grid-cols-2">
                        <ToggleRow
                            label={`${chatRoleLabelPlural('student')} can post`}
                            checked={chat.batch_group.students_can_post}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    batch_group: {
                                        ...c.batch_group,
                                        students_can_post: checked,
                                    },
                                }))
                            }
                        />
                        <ToggleRow
                            label={`${chatRoleLabelPlural('teacher')} can post`}
                            checked={chat.batch_group.teachers_can_post}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    batch_group: {
                                        ...c.batch_group,
                                        teachers_can_post: checked,
                                    },
                                }))
                            }
                        />
                    </div>
                </div>

                {/* Community */}
                <div className="space-y-2">
                    <div className="text-sm font-medium">Community</div>
                    <ToggleRow
                        label="Community channel enabled"
                        checked={chat.community.enabled}
                        onChange={(checked) =>
                            onChange((c) => ({
                                ...c,
                                community: {
                                    ...c.community,
                                    enabled: checked,
                                },
                            }))
                        }
                    />
                    <div className="grid gap-4 md:grid-cols-3">
                        <ToggleRow
                            label={`${chatRoleLabelPlural('student')} can post`}
                            checked={chat.community.students_can_post}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        students_can_post: checked,
                                    },
                                }))
                            }
                        />
                        <ToggleRow
                            label={`${chatRoleLabelPlural('teacher')} can post`}
                            checked={chat.community.teachers_can_post}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        teachers_can_post: checked,
                                    },
                                }))
                            }
                        />
                        <ToggleRow
                            label={`${chatRoleLabelPlural('admin')} can post`}
                            checked={chat.community.admins_can_post}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        admins_can_post: checked,
                                    },
                                }))
                            }
                        />
                    </div>
                </div>

                {/* Community Rules */}
                <div className="space-y-4 rounded-md border p-4">
                    <div className="text-sm font-medium">Community rules</div>

                    <div className="space-y-2">
                        <Label>Guidelines title</Label>
                        <Input
                            value={rules.guidelines.title}
                            onChange={(e) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            guidelines: {
                                                ...c.community.rules.guidelines,
                                                title: e.target.value,
                                            },
                                        },
                                    },
                                }))
                            }
                            placeholder="e.g., Community Guidelines"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Guideline items</Label>
                        <StringListEditor
                            value={rules.guidelines.items}
                            placeholder="Add a guideline and press Enter"
                            onChange={(items) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            guidelines: {
                                                ...c.community.rules.guidelines,
                                                items,
                                            },
                                        },
                                    },
                                }))
                            }
                        />
                    </div>

                    <ToggleRow
                        label="Acknowledgement required"
                        checked={rules.acknowledgement_required}
                        onChange={(checked) =>
                            onChange((c) => ({
                                ...c,
                                community: {
                                    ...c.community,
                                    rules: {
                                        ...c.community.rules,
                                        acknowledgement_required: checked,
                                    },
                                },
                            }))
                        }
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                        <NumberRow
                            label="Slow mode (seconds)"
                            hint="Delay between posts"
                            value={rules.posting.slow_mode_seconds}
                            onChange={(value) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            posting: {
                                                ...c.community.rules.posting,
                                                slow_mode_seconds: value,
                                            },
                                        },
                                    },
                                }))
                            }
                        />
                        <NumberRow
                            label="New member read-only (minutes)"
                            hint="Mute new members initially"
                            value={rules.posting.new_member_readonly_minutes}
                            onChange={(value) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            posting: {
                                                ...c.community.rules.posting,
                                                new_member_readonly_minutes: value,
                                            },
                                        },
                                    },
                                }))
                            }
                        />
                        <ToggleRow
                            label="Allow links"
                            checked={rules.posting.allow_links}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            posting: {
                                                ...c.community.rules.posting,
                                                allow_links: checked,
                                            },
                                        },
                                    },
                                }))
                            }
                        />
                        <ToggleRow
                            label="Allow attachments"
                            checked={rules.posting.allow_attachments}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            posting: {
                                                ...c.community.rules.posting,
                                                allow_attachments: checked,
                                            },
                                        },
                                    },
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Banned keywords</Label>
                        <StringListEditor
                            value={rules.auto_moderation.banned_keywords}
                            placeholder="Add a keyword and press Enter"
                            onChange={(keywords) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            auto_moderation: {
                                                ...c.community.rules.auto_moderation,
                                                banned_keywords: keywords,
                                            },
                                        },
                                    },
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Auto-moderation action</Label>
                        <Select
                            value={rules.auto_moderation.action}
                            onValueChange={(value) =>
                                onChange((c) => ({
                                    ...c,
                                    community: {
                                        ...c.community,
                                        rules: {
                                            ...c.community.rules,
                                            auto_moderation: {
                                                ...c.community.rules.auto_moderation,
                                                action: value as ChatModerationAction,
                                            },
                                        },
                                    },
                                }))
                            }
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Select action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BLOCK">Block</SelectItem>
                                <SelectItem value="FLAG">Flag</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Direct messages */}
                <div className="space-y-3">
                    <div className="text-sm font-medium">Direct messages</div>
                    <ToggleRow
                        label="Direct messages enabled"
                        checked={chat.direct.enabled}
                        onChange={(checked) =>
                            onChange((c) => ({
                                ...c,
                                direct: { ...c.direct, enabled: checked },
                            }))
                        }
                    />
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="p-3 text-left font-medium text-muted-foreground">
                                        Sender \ Can message
                                    </th>
                                    {CHAT_DIRECT_ROLES.map((target) => (
                                        <th
                                            key={target}
                                            className="p-3 text-center font-medium text-muted-foreground"
                                        >
                                            {chatRoleLabel(target)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {CHAT_DIRECT_ROLES.map((sender) => (
                                    <tr key={sender} className="border-t">
                                        <td className="p-3 font-medium">
                                            {chatRoleLabel(sender)}
                                        </td>
                                        {CHAT_DIRECT_ROLES.map((target) => (
                                            <td key={target} className="p-3 text-center">
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={chat.direct.matrix[sender][target]}
                                                        onCheckedChange={(checked) =>
                                                            onChange((c) => ({
                                                                ...c,
                                                                direct: {
                                                                    ...c.direct,
                                                                    matrix: {
                                                                        ...c.direct.matrix,
                                                                        [sender]: {
                                                                            ...c.direct.matrix[
                                                                                sender
                                                                            ],
                                                                            [target]: checked,
                                                                        },
                                                                    },
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                    <div className="text-sm font-medium">Attachments</div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <ToggleRow
                            label="Images enabled"
                            checked={chat.attachments.images_enabled}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    attachments: {
                                        ...c.attachments,
                                        images_enabled: checked,
                                    },
                                }))
                            }
                        />
                        <ToggleRow
                            label="Files enabled"
                            checked={chat.attachments.files_enabled}
                            onChange={(checked) =>
                                onChange((c) => ({
                                    ...c,
                                    attachments: {
                                        ...c.attachments,
                                        files_enabled: checked,
                                    },
                                }))
                            }
                        />
                        <NumberRow
                            label="Max file size (MB)"
                            hint="Upload limit"
                            value={chat.attachments.max_file_size_mb}
                            onChange={(value) =>
                                onChange((c) => ({
                                    ...c,
                                    attachments: {
                                        ...c.attachments,
                                        max_file_size_mb: value,
                                    },
                                }))
                            }
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StringListEditor({
    value,
    onChange,
    placeholder,
}: {
    value: string[];
    onChange: (items: string[]) => void;
    placeholder?: string;
}) {
    const [input, setInput] = useState('');
    const addItem = () => {
        const v = input.trim();
        if (!v) return;
        if (value.includes(v)) return;
        onChange([...value, v]);
        setInput('');
    };
    const removeItem = (item: string) => {
        onChange(value.filter((t) => t !== item));
    };
    return (
        <div className="flex flex-wrap items-center gap-2">
            {value.map((item) => (
                <Badge key={item} variant="secondary" className="flex items-center gap-2">
                    {item}
                    <button type="button" className="text-xs" onClick={() => removeItem(item)}>
                        ×
                    </button>
                </Badge>
            ))}
            <Input
                className="w-64"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem();
                    }
                }}
                placeholder={placeholder ?? 'Add and press Enter'}
            />
        </div>
    );
}

function TagEditor({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
    const [input, setInput] = useState('');
    const addTag = () => {
        const v = input.trim();
        if (!v) return;
        if (value.includes(v)) return;
        onChange([...value, v]);
        setInput('');
    };
    const removeTag = (tag: string) => {
        onChange(value.filter((t) => t !== tag));
    };
    return (
        <div className="flex flex-wrap items-center gap-2">
            {value.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-2">
                    {tag}
                    <button className="text-xs" onClick={() => removeTag(tag)}>
                        ×
                    </button>
                </Badge>
            ))}
            <Input
                className="w-56"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                    }
                }}
                placeholder="Add tag and press Enter"
            />
        </div>
    );
}

function EmailListEditor({
    emailConfigurations,
    loading,
    error,
    onAdd,
    onUpdate,
    onDelete,
}: {
    emailConfigurations: EmailConfiguration[];
    loading: boolean;
    error: string | null;
    onAdd: (config: CreateEmailConfigurationRequest) => Promise<void>;
    onUpdate: (id: string, config: Partial<CreateEmailConfigurationRequest>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newPurposeCode, setNewPurposeCode] = useState<string>(EMAIL_PURPOSES[0].code);
    const [newCustomPurpose, setNewCustomPurpose] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const resolvedNewPurposeCode =
        newPurposeCode === CUSTOM_PURPOSE_OPTION
            ? newCustomPurpose.trim().toUpperCase().replace(/\s+/g, '_')
            : newPurposeCode;

    const canSubmit =
        newEmail.trim().length > 0 &&
        newName.trim().length > 0 &&
        resolvedNewPurposeCode.length > 0;

    const addEmail = async () => {
        if (!canSubmit) return;

        const emailExists = emailConfigurations.some(
            (e) => e.email.toLowerCase() === newEmail.trim().toLowerCase()
        );
        if (emailExists) {
            toast.error('This email address is already added.');
            return;
        }
        const typeExists = emailConfigurations.some((e) => e.type === resolvedNewPurposeCode);
        if (typeExists) {
            toast.error('You already have an address for this purpose. Edit the existing one or pick a different purpose.');
            return;
        }

        try {
            await onAdd({
                email: newEmail.trim(),
                name: newName.trim(),
                type: resolvedNewPurposeCode,
                description: newDescription.trim() || undefined,
            });

            toast.success('Email address added.', {
                description:
                    "Before this address can send emails, our team needs to verify it. Please contact support to get it verified — emails sent before verification won't reach recipients.",
                duration: 10000,
            });

            setNewEmail('');
            setNewName('');
            setNewPurposeCode(EMAIL_PURPOSES[0].code);
            setNewCustomPurpose('');
            setNewDescription('');
        } catch (error) {
            // Error toast is raised by the parent
        }
    };

    const verificationNotice = (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <Info className="size-4 text-amber-700" />
            <AlertDescription className="text-xs leading-relaxed">
                Before any address here can send emails, <strong>our team needs to verify
                it with the email service</strong>. Until that's done, messages from a new
                address won't reach recipients. If you've just added or changed an address,
                please <strong>contact support</strong> so we can verify it for you.
            </AlertDescription>
        </Alert>
    );

    if (loading) {
        return (
            <div className="space-y-4">
                {verificationNotice}
                <div className="text-sm text-muted-foreground text-center py-4">
                    Loading your email addresses…
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                {verificationNotice}
                <div className="text-sm text-red-600 text-center py-4">
                    {error}
                </div>
            </div>
        );
    }

    const selectedPurposeHint =
        newPurposeCode !== CUSTOM_PURPOSE_OPTION
            ? EMAIL_PURPOSES.find((p) => p.code === newPurposeCode)?.hint
            : 'A custom purpose for emails that don\'t fit the categories above.';

    return (
        <div className="space-y-4">
            {verificationNotice}

            {/* Add new email form */}
            <div className="rounded-md border border-dashed border-gray-300 p-4 space-y-3">
                <div className="text-sm font-medium">Add a new email address</div>
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <Label htmlFor="new-email">Email address</Label>
                        <Input
                            id="new-email"
                            type="email"
                            placeholder="e.g., support@yourschool.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="new-name">Display name</Label>
                        <Input
                            id="new-name"
                            placeholder='e.g., "Acme Academy Support"'
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <div className="text-xs text-muted-foreground mt-1">
                            Shown to recipients next to the email address.
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="new-purpose">What is this email for?</Label>
                        <Select value={newPurposeCode} onValueChange={setNewPurposeCode}>
                            <SelectTrigger id="new-purpose">
                                <SelectValue placeholder="Choose a purpose" />
                            </SelectTrigger>
                            <SelectContent>
                                {EMAIL_PURPOSES.map((p) => (
                                    <SelectItem key={p.code} value={p.code}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                                <SelectItem value={CUSTOM_PURPOSE_OPTION}>
                                    Other (custom purpose)…
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {newPurposeCode === CUSTOM_PURPOSE_OPTION ? (
                            <div className="mt-2 space-y-1">
                                <Input
                                    placeholder='e.g., "Newsletter" or "Alumni"'
                                    value={newCustomPurpose}
                                    onChange={(e) => setNewCustomPurpose(e.target.value)}
                                />
                                <div className="text-xs text-muted-foreground">
                                    Use a short name. We'll save it as{' '}
                                    <span className="font-mono">
                                        {resolvedNewPurposeCode || 'YOUR_PURPOSE'}
                                    </span>{' '}
                                    internally.
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground mt-1">
                                {selectedPurposeHint}
                            </div>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="new-description">Notes (optional)</Label>
                        <Input
                            id="new-description"
                            placeholder="For your team's reference"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button
                        type="button"
                        onClick={addEmail}
                        disabled={!canSubmit}
                    >
                        Add email address
                    </Button>
                </div>
            </div>

            {/* Email list */}
            <div className="space-y-2">
                <div className="text-sm font-medium">
                    Your email addresses ({emailConfigurations.length})
                </div>
                {emailConfigurations.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                        You haven't added any email addresses yet. Use the form above to add one.
                    </div>
                ) : (
                    emailConfigurations.map((config) => (
                        <EmailConfigurationRow
                            key={config.type}
                            config={config}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function EmailConfigurationRow({
    config,
    onUpdate,
    onDelete,
}: {
    config: EmailConfiguration;
    onUpdate: (emailType: string, config: Partial<CreateEmailConfigurationRequest>) => Promise<void>;
    onDelete: (emailType: string) => Promise<void>;
}) {
    const [email, setEmail] = useState(config.email);
    const [name, setName] = useState(config.name);
    const [description, setDescription] = useState(config.description || '');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setEmail(config.email);
        setName(config.name);
        setDescription(config.description || '');
    }, [config.email, config.name, config.type, config.description]);

    const isDirty =
        email !== config.email ||
        name !== config.name ||
        description !== (config.description || '');

    const canSave =
        isDirty &&
        email.trim().length > 0 &&
        name.trim().length > 0 &&
        !saving;

    const handleUpdate = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await onUpdate(config.type, {
                email: email.trim(),
                name: name.trim(),
                description: description.trim() || undefined,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setEmail(config.email);
        setName(config.name);
        setDescription(config.description || '');
    };

    const handleDelete = async () => {
        const ok = confirm(
            `Remove "${config.email}"?\n\n` +
                `It will no longer be used for ${purposeLabelFor(config.type).toLowerCase()}.\n` +
                `You can add it back later if needed.`
        );
        if (!ok) return;
        setDeleting(true);
        try {
            await onDelete(config.type);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-3 p-3 border rounded-md">
            <div className="flex items-start justify-between gap-3">
                <Badge variant="secondary" className="font-normal">
                    {purposeLabelFor(config.type)}
                </Badge>
                <span
                    className="text-xs text-muted-foreground"
                    title="The purpose can't be changed after the address is added. To use a different purpose, remove this address and add a new one."
                >
                    Purpose can't be changed
                </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                    <Label className="text-xs">Email address</Label>
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="font-mono text-sm"
                    />
                </div>
                <div>
                    <Label className="text-xs">Display name</Label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='e.g., "Acme Academy Support"'
                    />
                </div>
                <div>
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="For your team's reference"
                    />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2">
                {isDirty && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="button"
                    size="sm"
                    onClick={handleUpdate}
                    disabled={!canSave}
                >
                    {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                    <Trash className="size-4 mr-1" />
                    {deleting ? 'Removing…' : 'Remove'}
                </Button>
            </div>
        </div>
    );
}
