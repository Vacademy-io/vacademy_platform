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
import type {
    NotificationSettings,
    NotificationSettingsResponse,
} from '@/services/notification-settings';
import {
    createUpsertRequest,
    getNotificationDefaultTemplate,
    getNotificationSettings,
    upsertNotificationSettings,
} from '@/services/notification-settings';
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
                    <CardTitle className="text-base">Email Settings</CardTitle>
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
                                toast.success('Email configuration added successfully');
                            } catch (error) {
                                toast.error('Failed to add email configuration');
                            }
                        }}
                        onUpdate={async (id, config) => {
                            try {
                                const updatedConfig = await updateEmailConfiguration(id, config);
                                setEmailConfigurations(prev => 
                                    prev.map(c => c.id === id ? updatedConfig : c)
                                );
                                toast.success('Email configuration updated successfully');
                            } catch (error) {
                                toast.error('Failed to update email configuration');
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
    onUpdate
}: { 
    emailConfigurations: EmailConfiguration[];
    loading: boolean;
    error: string | null;
    onAdd: (config: CreateEmailConfigurationRequest) => Promise<void>;
    onUpdate: (id: string, config: Partial<CreateEmailConfigurationRequest>) => Promise<void>;
}) {
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const addEmail = async () => {
        if (!newEmail.trim() || !newName.trim() || !newType.trim()) return;
        
        const emailExists = emailConfigurations.some(e => e.email === newEmail.trim());
        if (emailExists) {
            toast.error('Email already exists');
            return;
        }

        try {
            await onAdd({
                email: newEmail.trim(),
                name: newName.trim(),
                type: newType.trim(),
                description: newDescription.trim() || undefined
            });
            
            // Show verification popup after successful addition
            toast.success('Email configuration added successfully', {
                description: 'If the domain or email is not verified with our system, kindly contact admin for verification.',
                duration: 8000, // Show for 8 seconds to give time to read
            });
            
            setNewEmail('');
            setNewName('');
            setNewType('');
            setNewDescription('');
        } catch (error) {
            // Error handling is done in the parent component
        }
    };

    const updateEmail = async (id: string, field: 'email' | 'name' | 'type' | 'description', value: string) => {
        try {
            await onUpdate(id, { [field]: value });
        } catch (error) {
            // Error handling is done in the parent component
        }
    };


    if (loading) {
        return (
            <div className="text-sm text-muted-foreground text-center py-4">
                Loading email configurations...
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-sm text-red-600 text-center py-4">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
                Manage email addresses with their types for notifications
            </div>
            
            {/* Add new email form */}
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                <div>
                    <Label htmlFor="new-email">Email Address</Label>
                    <Input
                        id="new-email"
                        type="email"
                        placeholder="Enter email address"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="new-name">Name</Label>
                    <Input
                        id="new-name"
                        placeholder="Enter name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="new-type">Type</Label>
                    <Input
                        id="new-type"
                        placeholder="Enter email type (e.g., admin, support, info)"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                    />
                </div>
                <div>
                    <Label htmlFor="new-description">Description</Label>
                    <Input
                        id="new-description"
                        placeholder="Enter description (optional)"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex justify-end">
                <Button 
                    type="button" 
                    onClick={addEmail}
                    disabled={!newEmail.trim() || !newName.trim() || !newType.trim()}
                >
                    Add Email Configuration
                </Button>
            </div>

            {/* Email list */}
            <div className="space-y-2">
                {emailConfigurations.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No email configurations added yet
                    </div>
                ) : (
                    emailConfigurations.map((config) => (
                        <div key={config.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-md">
                            <div>
                                <Label className="text-xs">Email</Label>
                                <Input
                                    value={config.email}
                                    onChange={(e) => updateEmail(config.id, 'email', e.target.value)}
                                    className="font-mono text-sm"
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Name</Label>
                                <Input
                                    value={config.name}
                                    onChange={(e) => updateEmail(config.id, 'name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Type</Label>
                                <Input
                                    value={config.type}
                                    onChange={(e) => updateEmail(config.id, 'type', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Description</Label>
                                <Input
                                    value={config.description || ''}
                                    onChange={(e) => updateEmail(config.id, 'description', e.target.value)}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
