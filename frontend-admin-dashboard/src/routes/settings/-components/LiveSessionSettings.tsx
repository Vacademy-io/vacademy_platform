import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    VideoCamera,
    ChatTeardrop,
    ArrowsClockwise,
    CursorClick,
    Globe,
} from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
    DEFAULT_LIVE_SESSION_SETTINGS,
    type LiveSessionSettings as LiveSessionSettingsType,
    PLATFORM_KEYS,
    type PlatformKey,
    getLiveSessionSettings,
    saveLiveSessionSettings,
} from '@/services/live-session-settings';
import { LIVE_SESSION_SETTINGS_QUERY_KEY } from '@/hooks/useLiveSessionSettings';
import { TIMEZONE_OPTIONS } from '@/routes/study-library/live-session/schedule/-constants/options';

const PLATFORM_LABELS: Record<PlatformKey, string> = {
    youtube: 'YouTube',
    'google meet': 'Google Meet',
    zoom: 'Zoom',
    zoho: 'Zoho',
    bbb: 'Vacademy Meet',
    other: 'Other (custom link)',
};

const SettingRow = ({
    title,
    description,
    checked,
    onChange,
    disabled,
    disabledReason,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    disabledReason?: string;
}) => (
    <div className="flex items-start justify-between gap-4 py-3">
        <div className="flex-1">
            <div className="text-sm font-medium text-neutral-800">{title}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
            {disabled && disabledReason && (
                <div className="mt-1 text-[11px] text-amber-600">{disabledReason}</div>
            )}
        </div>
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
);

export default function LiveSessionSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<LiveSessionSettingsType>(
        DEFAULT_LIVE_SESSION_SETTINGS
    );
    const [initial, setInitial] = useState<LiveSessionSettingsType>(DEFAULT_LIVE_SESSION_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const fresh = await getLiveSessionSettings();
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

    const togglePlatform = (key: PlatformKey, allowed: boolean) => {
        setSettings((prev) => ({
            ...prev,
            allowedPlatforms: { ...prev.allowedPlatforms, [key]: allowed },
        }));
    };

    const togglePrimitive = (key: keyof LiveSessionSettingsType, value: boolean) => {
        setSettings((prev) => ({ ...prev, [key]: value }) as LiveSessionSettingsType);
    };

    const reset = () => setSettings(initial);

    const save = async () => {
        // Single/Bulk schedule entry-point visibility is now configured
        // per-role under Display Settings, so the institute-wide guard is
        // no longer needed here.
        // Guard: at least one platform must remain allowed.
        const anyPlatform = Object.values(settings.allowedPlatforms).some(Boolean);
        if (!anyPlatform) {
            toast.error('At least one streaming platform must be allowed.');
            return;
        }
        try {
            setSaving(true);
            await saveLiveSessionSettings(settings);
            setInitial(settings);
            await queryClient.invalidateQueries({ queryKey: LIVE_SESSION_SETTINGS_QUERY_KEY });
            toast.success('Live session settings saved');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save live session settings.');
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

    const platformAllowedCount = PLATFORM_KEYS.filter(
        (k) => settings.allowedPlatforms[k] !== false
    ).length;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-neutral-800">Live Session Settings</h2>
                    <p className="text-sm text-neutral-500">
                        Control which scheduling modes, platforms and features are available to
                        admins when creating live classes.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={reset}
                        disabled={!dirty || saving}
                    >
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

            {/* Default timezone */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <Globe size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Default Timezone</CardTitle>
                        <CardDescription>
                            Pre-fills the timezone field on every new live-class form. Admins
                            can still change it per class while scheduling.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <Select
                            value={settings.defaultTimeZone || '__browser__'}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultTimeZone: v === '__browser__' ? '' : v,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-full sm:w-80">
                                <SelectValue placeholder="Select default timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__browser__">
                                    Use admin's browser timezone
                                </SelectItem>
                                {TIMEZONE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt._id} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-neutral-500">
                            Currently:{' '}
                            <strong>
                                {settings.defaultTimeZone
                                    ? settings.defaultTimeZone
                                    : "admin's browser timezone"}
                            </strong>
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Streaming platforms */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <VideoCamera size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Allowed Streaming Platforms</CardTitle>
                        <CardDescription>
                            Hidden platforms won&apos;t appear in the Live Stream Platform
                            dropdown when admins schedule a class.
                        </CardDescription>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        {platformAllowedCount}/{PLATFORM_KEYS.length} allowed
                    </span>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <div className="grid gap-1 sm:grid-cols-2">
                        {PLATFORM_KEYS.map((key) => {
                            const checked = settings.allowedPlatforms[key] !== false;
                            const isLastAllowed = checked && platformAllowedCount === 1;
                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        'flex items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 transition-colors',
                                        checked
                                            ? 'bg-primary-50/40 hover:bg-primary-50/70'
                                            : 'hover:bg-neutral-50'
                                    )}
                                >
                                    <div>
                                        <div className="text-sm font-medium text-neutral-800">
                                            {PLATFORM_LABELS[key]}
                                        </div>
                                        <div className="text-xs text-neutral-500">{key}</div>
                                    </div>
                                    <Switch
                                        checked={checked}
                                        disabled={isLastAllowed}
                                        onCheckedChange={(v) => togglePlatform(key, v)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Recurring */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <ArrowsClockwise size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Recurring Classes</CardTitle>
                        <CardDescription>
                            Weekly recurring schedule and the per-day default class link.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Recurring weekly schedule"
                        description="Show the 'Recurring Class' radio under Single Class mode."
                        checked={settings.recurringEnabled}
                        onChange={(v) => togglePrimitive('recurringEnabled', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Default class link for the day"
                        description="Show the 'Default Class Link' card inside each selected day in the recurring schedule, where admins can set a fallback link and class name shared across all sessions on that day."
                        checked={settings.defaultDayButtonEnabled}
                        onChange={(v) => togglePrimitive('defaultDayButtonEnabled', v)}
                        disabled={!settings.recurringEnabled}
                        disabledReason={
                            !settings.recurringEnabled
                                ? 'Disabled because Recurring weekly schedule is off.'
                                : undefined
                        }
                    />
                </CardContent>
            </Card>

            {/* Feedback */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <ChatTeardrop size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Feedback &amp; Engagement</CardTitle>
                        <CardDescription>
                            Post-session feedback collection from learners.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Learner feedback after class"
                        description="Shows the 'Learner Feedback Settings' card while scheduling, and presents the feedback form to learners after the session ends."
                        checked={settings.feedbackEnabled}
                        onChange={(v) => togglePrimitive('feedbackEnabled', v)}
                    />
                </CardContent>
            </Card>

            {/* Custom action button */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <CursorClick size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Custom Action Button</CardTitle>
                        <CardDescription>
                            An optional configurable button shown to learners on the Live Session
                            screen.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Custom action button card"
                        description="Show the 'Custom Action Button' card while scheduling so admins can configure the button's text, URL and colors."
                        checked={settings.customActionButtonEnabled}
                        onChange={(v) => togglePrimitive('customActionButtonEnabled', v)}
                    />
                </CardContent>
            </Card>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">
                <CursorClick size={14} className="-mt-0.5 mr-1 inline" />
                Changes apply only to <strong>new</strong> live classes scheduled after saving. Existing classes are unaffected.
            </div>
        </div>
    );
}
