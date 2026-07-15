import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    VideoCamera,
    ChatTeardrop,
    ArrowsClockwise,
    CursorClick,
    Globe,
    ClipboardText,
    Article,
    FileText,
    Door,
    Broadcast,
    BellRinging,
    MonitorPlay,
    PlugsConnected,
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
    type LiveSessionGuestPolicy,
    type ZoomApprovalType,
    type ZoomAudioOption,
    type ZoomAutoRecordingOption,
    PLATFORM_KEYS,
    type PlatformKey,
    getLiveSessionSettings,
    saveLiveSessionSettings,
} from '@/services/live-session-settings';
import { LIVE_SESSION_SETTINGS_QUERY_KEY } from '@/hooks/useLiveSessionSettings';
import {
    TIMEZONE_OPTIONS,
    WAITING_ROOM_OPTIONS,
    WAITING_ROOM_TYPE_OPTIONS,
} from '@/routes/study-library/live-session/schedule/-constants/options';
import { WaitingRoomType } from '@/routes/study-library/live-session/-constants/enums';
import { ZoomIntegrationCard } from './zoom/ZoomIntegrationCard';
import { GoogleMeetIntegrationCard } from './google/GoogleMeetIntegrationCard';

const PLATFORM_LABELS: Record<PlatformKey, string> = {
    youtube: 'YouTube',
    'google meet': 'Google Meet',
    zoom: 'Zoom',
    zoho: 'Zoho',
    bbb: 'Vacademy Meet',
    other: 'Other (custom link)',
};

// Sentinel used for the "no reminder" option, because Radix Select can't hold
// an empty-string value. Mapped back to '' when read/written.
const NO_REMINDER = '__none__';
// Reminder offsets mirror the scheduling forms' TimeOptions so the default
// picked here is one the per-class UI can render.
const REMINDER_OPTIONS = [
    { label: '5 minutes before', value: '5m' },
    { label: '10 minutes before', value: '10m' },
    { label: '30 minutes before', value: '30m' },
    { label: '1 hour before', value: '1h' },
];

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
                <div className="mt-1 text-xs text-amber-600">{disabledReason}</div>
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
        setSettings((prev) => {
            const allowedPlatforms = { ...prev.allowedPlatforms, [key]: allowed };
            let defaultPlatform = prev.defaultPlatform;
            // The default platform must always be an allowed one. If the admin
            // just hid the current default, fall back to the first platform
            // that's still allowed so the default never points at a hidden one.
            if (!allowed && key === defaultPlatform) {
                const nextAllowed = PLATFORM_KEYS.find((k) => allowedPlatforms[k] !== false);
                if (nextAllowed) defaultPlatform = nextAllowed;
            }
            return { ...prev, allowedPlatforms, defaultPlatform };
        });
    };

    const togglePrimitive = (key: keyof LiveSessionSettingsType, value: boolean) => {
        setSettings((prev) => ({ ...prev, [key]: value }) as LiveSessionSettingsType);
    };

    const toggleLmsConnection = (
        key: keyof LiveSessionSettingsType['lmsConnection'],
        value: boolean
    ) => {
        setSettings((prev) => ({
            ...prev,
            lmsConnection: { ...prev.lmsConnection, [key]: value },
        }));
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
        // Defensive: never persist a default platform that isn't allowed.
        let toSave = settings;
        if (settings.allowedPlatforms[settings.defaultPlatform] === false) {
            const fallback = PLATFORM_KEYS.find((k) => settings.allowedPlatforms[k] !== false);
            if (fallback) toSave = { ...settings, defaultPlatform: fallback };
        }
        try {
            setSaving(true);
            await saveLiveSessionSettings(toSave);
            // Reflect the (possibly corrected) saved document in local state so
            // the form and the dirty check stay in sync with what's persisted.
            setSettings(toSave);
            setInitial(toSave);
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

                    {/* Default platform — pre-selected on new live classes. Only
                        allowed platforms are offered so the default can never
                        point at a hidden one. */}
                    <div className="mt-4 flex flex-col gap-1.5 border-t border-neutral-100 pt-4">
                        <span className="text-sm font-medium text-neutral-800">
                            Default platform
                        </span>
                        <span className="text-xs text-neutral-500">
                            Pre-selected in the &quot;Live Stream Platform&quot; dropdown when
                            admins schedule a class (single and bulk). Admins can still change
                            it per class.
                        </span>
                        <Select
                            value={settings.defaultPlatform}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultPlatform: v as PlatformKey,
                                }))
                            }
                        >
                            <SelectTrigger className="mt-1 h-9 w-full sm:w-80">
                                <SelectValue placeholder="Select default platform" />
                            </SelectTrigger>
                            <SelectContent>
                                {PLATFORM_KEYS.filter(
                                    (k) => settings.allowedPlatforms[k] !== false
                                ).map((k) => (
                                    <SelectItem key={k} value={k}>
                                        {PLATFORM_LABELS[k]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Zoom integration — multi-account credential management.
                Placed under the platform allow-list so the Zoom config sits right next
                to the toggle that allows the Zoom platform itself. */}
            <ZoomIntegrationCard />

            {/* Google Meet integration — per-tenant OAuth ("Connect Google Workspace"). */}
            <GoogleMeetIntegrationCard />

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

            {/* Daily attendance default */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <ClipboardText size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Recurring Attendance Default</CardTitle>
                        <CardDescription>
                            Pre-fills the per-session "Daily attendance" toggle on every newly
                            added session in a recurring schedule. Admins can still flip it per
                            session.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Count daily attendance by default"
                        description="When on, new sessions inside a recurring class start with daily attendance counting enabled."
                        checked={settings.defaultDailyAttendanceCounting}
                        onChange={(v) => togglePrimitive('defaultDailyAttendanceCounting', v)}
                        disabled={!settings.recurringEnabled}
                        disabledReason={
                            !settings.recurringEnabled
                                ? 'Disabled because Recurring weekly schedule is off.'
                                : undefined
                        }
                    />
                </CardContent>
            </Card>

            {/* Description visibility */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <Article size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Class Description</CardTitle>
                        <CardDescription>
                            Whether admins can attach a rich-text description to a live class.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Show description field"
                        description="Hides the Description editor in single-class scheduling, the bulk default-description card, and the per-row description column. Existing descriptions on saved classes aren't deleted."
                        checked={settings.descriptionEnabled}
                        onChange={(v) => togglePrimitive('descriptionEnabled', v)}
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
                    {settings.feedbackEnabled && (
                        <div className="mt-4 border-t border-neutral-100 pt-4">
                            <SettingRow
                                title="Enable feedback by default"
                                description="Pre-fills the per-session 'Learner Feedback' toggle to ON, so new live classes collect post-session feedback unless the admin turns it off. Applies to single and bulk scheduling."
                                checked={settings.defaultFeedbackEnabled}
                                onChange={(v) => togglePrimitive('defaultFeedbackEnabled', v)}
                            />
                            <Separator />
                            <SettingRow
                                title="Make feedback compulsory by default"
                                description="Pre-fills the per-session 'Make feedback compulsory' toggle to ON. When enabled, learners cannot skip the feedback form."
                                checked={settings.defaultFeedbackCompulsory}
                                onChange={(v) => togglePrimitive('defaultFeedbackCompulsory', v)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Waiting room defaults */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <Door size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Waiting Room</CardTitle>
                        <CardDescription>
                            Pre-fills the waiting-room behaviour and timing on new live classes
                            (single and bulk scheduling). Admins can still change these per class.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Enable waiting room by default"
                        description="New live classes start with 'Enable Waiting Room or Pre-Joining' turned on."
                        checked={settings.defaultWaitingRoomEnabled}
                        onChange={(v) => togglePrimitive('defaultWaitingRoomEnabled', v)}
                    />
                    <Separator />
                    <div className="grid gap-4 pt-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-neutral-800">
                                Waiting room type
                            </span>
                            <Select
                                value={settings.defaultWaitingRoomType}
                                onValueChange={(v) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        defaultWaitingRoomType: v as WaitingRoomType,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Select waiting room type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WAITING_ROOM_TYPE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt._id} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-neutral-800">
                                Open waiting room before
                            </span>
                            <Select
                                value={settings.defaultWaitingRoomTime}
                                onValueChange={(v) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        defaultWaitingRoomTime: v,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WAITING_ROOM_OPTIONS.map((opt) => (
                                        <SelectItem key={opt._id} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-neutral-500">
                        The type and timing apply whenever the waiting room is enabled on a class —
                        even if it isn&apos;t enabled by default above.
                    </p>
                </CardContent>
            </Card>

            {/* Vacademy Meet (BBB) recording & controls defaults */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <Broadcast size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">
                            Vacademy Meet Recording &amp; Controls
                        </CardTitle>
                        <CardDescription>
                            Defaults applied when a live class is hosted on Vacademy Meet. Other
                            platforms ignore these. Admins can still change them per class (single
                            and bulk scheduling).
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Record the session by default"
                        description="New Vacademy Meet classes start with recording turned on."
                        checked={settings.defaultBbbRecordEnabled}
                        onChange={(v) => togglePrimitive('defaultBbbRecordEnabled', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Auto-start recording"
                        description="Begin recording automatically when the meeting starts."
                        checked={settings.defaultBbbAutoStartRecording}
                        onChange={(v) => togglePrimitive('defaultBbbAutoStartRecording', v)}
                        disabled={!settings.defaultBbbRecordEnabled}
                        disabledReason={
                            !settings.defaultBbbRecordEnabled
                                ? 'Disabled because recording is off by default.'
                                : undefined
                        }
                    />
                    <Separator />
                    <SettingRow
                        title="Mute participants on join"
                        description="Learners join muted by default."
                        checked={settings.defaultBbbMuteOnStart}
                        onChange={(v) => togglePrimitive('defaultBbbMuteOnStart', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Only host can share webcam"
                        description="Restrict webcam sharing to the moderator/host."
                        checked={settings.defaultBbbWebcamsOnlyForModerator}
                        onChange={(v) => togglePrimitive('defaultBbbWebcamsOnlyForModerator', v)}
                    />
                    <Separator />
                    <div className="flex items-start justify-between gap-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-neutral-800">
                                Guest admission policy
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                How guests are admitted when they try to join the class.
                            </div>
                        </div>
                        <Select
                            value={settings.defaultBbbGuestPolicy}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultBbbGuestPolicy: v as LiveSessionGuestPolicy,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALWAYS_ACCEPT">Always accept</SelectItem>
                                <SelectItem value="ASK_MODERATOR">
                                    Ask moderator to approve
                                </SelectItem>
                                <SelectItem value="ALWAYS_DENY">Always deny guests</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Zoom meeting control defaults (single-class Zoom sessions only) */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <MonitorPlay size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Zoom Meeting Controls</CardTitle>
                        <CardDescription>
                            Defaults pre-filled in the Zoom settings panel when a single class is
                            hosted on Zoom with a connected account. Admins can still change them
                            per class. (Bulk scheduling doesn&apos;t provision Zoom meetings.)
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Entry &amp; security
                    </div>
                    <SettingRow
                        title="Enable waiting room"
                        description="Participants wait until the host admits them."
                        checked={settings.defaultZoomWaitingRoom}
                        onChange={(v) => togglePrimitive('defaultZoomWaitingRoom', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Allow join before host"
                        description="Participants can enter before the host starts the meeting."
                        checked={settings.defaultZoomJoinBeforeHost}
                        onChange={(v) => togglePrimitive('defaultZoomJoinBeforeHost', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Require Zoom login to join"
                        description="Only authenticated Zoom users can join."
                        checked={settings.defaultZoomMeetingAuthentication}
                        onChange={(v) => togglePrimitive('defaultZoomMeetingAuthentication', v)}
                    />
                    <Separator />
                    <div className="flex items-start justify-between gap-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-neutral-800">
                                Registration approval
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                How registrations are approved for the meeting.
                            </div>
                        </div>
                        <Select
                            value={settings.defaultZoomApprovalType}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultZoomApprovalType: v as ZoomApprovalType,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2">No registration required</SelectItem>
                                <SelectItem value="0">Automatically approve</SelectItem>
                                <SelectItem value="1">Manually approve</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mt-4 border-t border-neutral-100 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Audio / Video
                    </div>
                    <SettingRow
                        title="Mute participants on entry"
                        description="Participants join muted."
                        checked={settings.defaultZoomMuteUponEntry}
                        onChange={(v) => togglePrimitive('defaultZoomMuteUponEntry', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Start host video on"
                        description="The host's camera turns on automatically."
                        checked={settings.defaultZoomHostVideo}
                        onChange={(v) => togglePrimitive('defaultZoomHostVideo', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Start participant video on"
                        description="Participants' cameras turn on automatically."
                        checked={settings.defaultZoomParticipantVideo}
                        onChange={(v) => togglePrimitive('defaultZoomParticipantVideo', v)}
                    />
                    <Separator />
                    <div className="flex items-start justify-between gap-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-neutral-800">Audio</div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                Which audio methods participants can use.
                            </div>
                        </div>
                        <Select
                            value={settings.defaultZoomAudio}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultZoomAudio: v as ZoomAudioOption,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="both">Computer + Telephony</SelectItem>
                                <SelectItem value="voip">Computer audio only</SelectItem>
                                <SelectItem value="telephony">Telephony only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mt-4 border-t border-neutral-100 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        In-meeting
                    </div>
                    <SettingRow
                        title="Enable breakout rooms"
                        description="Allow splitting participants into breakout rooms."
                        checked={settings.defaultZoomBreakoutRoom}
                        onChange={(v) => togglePrimitive('defaultZoomBreakoutRoom', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Start in focus mode"
                        description="Participants only see the host and shared content."
                        checked={settings.defaultZoomFocusMode}
                        onChange={(v) => togglePrimitive('defaultZoomFocusMode', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Allow join from multiple devices"
                        description="A participant can be signed in from more than one device."
                        checked={settings.defaultZoomAllowMultipleDevices}
                        onChange={(v) => togglePrimitive('defaultZoomAllowMultipleDevices', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Add identity watermark"
                        description="Overlay each participant's identity on shared content."
                        checked={settings.defaultZoomWatermark}
                        onChange={(v) => togglePrimitive('defaultZoomWatermark', v)}
                    />
                    <Separator />
                    <div className="flex items-start justify-between gap-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-neutral-800">
                                Automatic recording
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                Whether and where the meeting is recorded automatically.
                            </div>
                        </div>
                        <Select
                            value={settings.defaultZoomAutoRecording}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultZoomAutoRecording: v as ZoomAutoRecordingOption,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cloud">Record to Zoom cloud</SelectItem>
                                <SelectItem value="local">Local recording (host machine)</SelectItem>
                                <SelectItem value="none">Don&apos;t record</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Notification defaults (channels + triggers) */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <BellRinging size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Notifications</CardTitle>
                        <CardDescription>
                            Default channels and triggers pre-selected when admins schedule a live
                            class (single and bulk). Admins can still change them per class.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Channels
                    </div>
                    <SettingRow
                        title="Notify via Email"
                        description="Send live-class notifications over email by default."
                        checked={settings.defaultNotifyByEmail}
                        onChange={(v) => togglePrimitive('defaultNotifyByEmail', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Notify via WhatsApp"
                        description="Send live-class notifications over WhatsApp by default."
                        checked={settings.defaultNotifyByWhatsapp}
                        onChange={(v) => togglePrimitive('defaultNotifyByWhatsapp', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Notify via Push Notification"
                        description="Send live-class push notifications by default."
                        checked={settings.defaultNotifyByPush}
                        onChange={(v) => togglePrimitive('defaultNotifyByPush', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Notify via System Notification"
                        description="Send in-app system notifications by default."
                        checked={settings.defaultNotifyBySystem}
                        onChange={(v) => togglePrimitive('defaultNotifyBySystem', v)}
                    />

                    <div className="mt-4 border-t border-neutral-100 pt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Triggers
                    </div>
                    <SettingRow
                        title="When the live class is created"
                        description="Fire a notification as soon as the class is scheduled."
                        checked={settings.defaultNotifyOnCreate}
                        onChange={(v) => togglePrimitive('defaultNotifyOnCreate', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="When the class goes live"
                        description="Fire a notification the moment the class starts."
                        checked={settings.defaultNotifyOnLive}
                        onChange={(v) => togglePrimitive('defaultNotifyOnLive', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="When attendance is marked"
                        description="Notify learners when they're marked present/absent."
                        checked={settings.defaultNotifyOnAttendance}
                        onChange={(v) => togglePrimitive('defaultNotifyOnAttendance', v)}
                    />
                    <Separator />
                    <div className="flex items-start justify-between gap-4 py-3">
                        <div className="flex-1">
                            <div className="text-sm font-medium text-neutral-800">
                                Reminder before class
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                                Pre-seed one &quot;notify before&quot; reminder on new classes.
                                Admins can add more or remove it per class.
                            </div>
                        </div>
                        <Select
                            value={settings.defaultNotifyBeforeReminder || NO_REMINDER}
                            onValueChange={(v) =>
                                setSettings((prev) => ({
                                    ...prev,
                                    defaultNotifyBeforeReminder: v === NO_REMINDER ? '' : v,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_REMINDER}>No reminder</SelectItem>
                                {REMINDER_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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

            {/* Recording transcription */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <FileText size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">Recording Transcription</CardTitle>
                        <CardDescription>
                            Generates a searchable transcript and English translation from each
                            Vacademy Meet recording using Whisper. Costs compute per minute of
                            audio, so this is off by default — turn on when you&apos;re ready to
                            use transcripts for assessment generation or study notes.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Show the 'Process Recording' button"
                        description="Adds a Process Recording action next to each recording in the live-session view so admins/teachers can kick off transcription. Existing transcripts remain viewable regardless of this setting — only the entry point to start new ones is hidden when off."
                        checked={settings.recordingTranscriptionEnabled}
                        onChange={(v) => togglePrimitive('recordingTranscriptionEnabled', v)}
                    />
                </CardContent>
            </Card>

            {/* LMS Connection — live class content → course chapters */}
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                        <PlugsConnected size={18} />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">LMS Connection</CardTitle>
                        <CardDescription>
                            Lets teachers push live-class content into course chapters right from
                            the session page. Off by default — turn on the features you want.
                            Turning one off hides its entry point only; recordings and materials
                            already added to chapters stay there.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="border-t border-neutral-100 p-5">
                    <SettingRow
                        title="Add recordings to course"
                        description="Shows an 'Add to course' action next to each recording on the live-session view, so teachers can link the recording into chapters of the session's batches."
                        checked={settings.lmsConnection.recordingAddToCourseEnabled}
                        onChange={(v) => toggleLmsConnection('recordingAddToCourseEnabled', v)}
                    />
                    <Separator />
                    <SettingRow
                        title="Class materials"
                        description="Shows the Class Materials card on the live-session view, where teachers upload a PDF or video (or paste a YouTube link) and add it to chapters."
                        checked={settings.lmsConnection.classMaterialsEnabled}
                        onChange={(v) => toggleLmsConnection('classMaterialsEnabled', v)}
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
