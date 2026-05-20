import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    YoutubeLogo,
    ArrowSquareOut,
    Check,
    Warning,
    ArrowsClockwise,
    Plug,
    PlugsConnected,
    CloudArrowUp,
    type Icon,
} from '@phosphor-icons/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    YoutubeConnectionStatus,
    YoutubeUploadDefaults,
    YoutubeUploadJob,
    disconnectYoutube,
    getYoutubeDefaults,
    getYoutubeStatus,
    initiateYoutubeOAuth,
    listYoutubeJobs,
    retryYoutubeUpload,
    updateYoutubeDefaults,
} from '../-services/youtube-integration-service';

// YouTube content categories most relevant for an EdTech platform. Full list
// at https://developers.google.com/youtube/v3/docs/videoCategories/list — we
// only surface the ones an admin will ever realistically pick.
const CATEGORY_OPTIONS: { id: string; label: string }[] = [
    { id: '27', label: 'Education' },
    { id: '28', label: 'Science & Technology' },
    { id: '22', label: 'People & Blogs' },
    { id: '25', label: 'News & Politics' },
    { id: '24', label: 'Entertainment' },
    { id: '20', label: 'Gaming' },
    { id: '26', label: 'How-to & Style' },
];

const PRIVACY_OPTIONS: { value: 'public' | 'unlisted' | 'private'; label: string; help: string }[] = [
    { value: 'unlisted', label: 'Unlisted', help: 'Anyone with the link can watch. Recommended for embed-only.' },
    { value: 'private', label: 'Private', help: 'Only you can watch. Use for review before publishing.' },
    { value: 'public', label: 'Public', help: 'Searchable on YouTube and your channel.' },
];

export default function YoutubeIntegrationSettings() {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    // Surface the post-OAuth ?yt=connected / ?yt=error flag that the backend
    // redirect target sets, then clean it out of the URL.
    const [oauthFlag, setOauthFlag] = useState<string | null>(null);
    useEffect(() => {
        const url = new URL(window.location.href);
        const yt = url.searchParams.get('yt');
        const reason = url.searchParams.get('reason');
        if (yt) {
            setOauthFlag(yt);
            if (yt === 'connected') toast.success('YouTube channel connected');
            if (yt === 'error') toast.error(`Connect failed: ${reason ?? 'unknown'}`);
            url.searchParams.delete('yt');
            url.searchParams.delete('reason');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Connection status
    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ['youtube-status', instituteId, oauthFlag],
        queryFn: () => getYoutubeStatus(instituteId),
        enabled: !!instituteId,
    });

    // Defaults
    const { data: defaults, isLoading: defaultsLoading } = useQuery({
        queryKey: ['youtube-defaults', instituteId],
        queryFn: () => getYoutubeDefaults(instituteId),
        enabled: !!instituteId,
    });

    // Upload history
    const { data: jobs = [], isLoading: jobsLoading } = useQuery({
        queryKey: ['youtube-jobs', instituteId],
        queryFn: () => listYoutubeJobs(instituteId),
        enabled: !!instituteId,
        // Polling while uploads are in flight keeps the table fresh without
        // adding websockets. Cheap because the endpoint is paged.
        refetchInterval: (q) => {
            const data = q.state.data as YoutubeUploadJob[] | undefined;
            return data?.some((j) => j.status === 'QUEUED' || j.status === 'UPLOADING')
                ? 5_000
                : false;
        },
    });

    const featureEnabled = defaults?.featureEnabled ?? false;

    return (
        <div className="flex flex-col gap-5 p-1">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-neutral-800">YouTube Integration</h2>
                    <p className="text-sm text-neutral-500">
                        Auto-upload recorded live sessions to your YouTube channel. Connect once;
                        every recording from this institute lands on your channel.
                    </p>
                </div>
            </header>

            <FeatureGateCard
                instituteId={instituteId}
                defaults={defaults}
                loading={defaultsLoading}
            />

            {featureEnabled && (
                <>
                    <ConnectionCard
                        status={status}
                        loading={statusLoading}
                        instituteId={instituteId}
                        onReload={() => {
                            queryClient.invalidateQueries({ queryKey: ['youtube-status'] });
                            queryClient.invalidateQueries({ queryKey: ['youtube-jobs'] });
                        }}
                    />

                    {status?.status === 'ACTIVE' && (
                        <DefaultsCard
                            instituteId={instituteId}
                            defaults={defaults}
                            loading={defaultsLoading}
                        />
                    )}

                    <UploadHistoryCard
                        jobs={jobs}
                        loading={jobsLoading}
                        connected={status?.status === 'ACTIVE'}
                    />
                </>
            )}
        </div>
    );
}

// ─── Feature-gate card (master toggle) ───────────────────────────────────────

function FeatureGateCard({
    instituteId,
    defaults,
    loading,
}: {
    instituteId: string;
    defaults?: YoutubeUploadDefaults;
    loading: boolean;
}) {
    const queryClient = useQueryClient();

    // Mutation flips the master switch. We send the full defaults payload so
    // the row gets created on first opt-in (the PUT endpoint upserts).
    const { mutate: toggleFeature, isPending } = useMutation({
        mutationFn: (next: boolean) =>
            updateYoutubeDefaults(instituteId, {
                ...(defaults ?? platformFallback()),
                featureEnabled: next,
            }),
        onSuccess: (_data, next) => {
            toast.success(next ? 'YouTube Integration enabled' : 'YouTube Integration turned off');
            queryClient.invalidateQueries({ queryKey: ['youtube-defaults', instituteId] });
            queryClient.invalidateQueries({ queryKey: ['youtube-status', instituteId] });
            queryClient.invalidateQueries({ queryKey: ['youtube-jobs', instituteId] });
        },
        onError: () => toast.error('Failed to update toggle'),
    });

    const featureEnabled = defaults?.featureEnabled ?? false;

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                <div className="flex size-9 items-center justify-center rounded-md bg-red-50 text-red-600">
                    <YoutubeLogo size={20} weight="fill" />
                </div>
                <div className="flex-1">
                    <CardTitle className="text-base">Enable YouTube Integration</CardTitle>
                    <CardDescription>
                        Turn this on if this institute wants to publish recorded live sessions to
                        YouTube. When off, no recording is uploaded and no "Upload to YouTube"
                        button appears on any session.
                    </CardDescription>
                </div>
                <Switch
                    checked={featureEnabled}
                    disabled={loading || isPending}
                    onCheckedChange={(v) => toggleFeature(v)}
                />
            </CardHeader>
            {!featureEnabled && (
                <CardContent className="border-t border-neutral-100 p-5 text-sm text-neutral-500">
                    Once enabled, you'll be able to connect a YouTube channel, configure upload
                    defaults (privacy, title template, category), and see the upload history of
                    every recording.
                </CardContent>
            )}
        </Card>
    );
}

/** Fallback used when the institute has never opened this page before — keeps
 *  the toggle-on PUT well-formed so the server can upsert a clean row. */
function platformFallback(): YoutubeUploadDefaults {
    return {
        featureEnabled: false,
        autoUploadEnabled: true,
        privacyStatus: 'unlisted',
        embeddable: true,
        publicStatsViewable: false,
        madeForKids: false,
        categoryId: '27',
        license: 'youtube',
        titleTemplate: '{session_title} | {date}',
        notifySubscribers: false,
    };
}

// ─── Connection card ─────────────────────────────────────────────────────────

function ConnectionCard({
    status,
    loading,
    instituteId,
    onReload,
}: {
    status?: YoutubeConnectionStatus;
    loading: boolean;
    instituteId: string;
    onReload: () => void;
}) {
    const { mutate: connect, isPending: connecting } = useMutation({
        mutationFn: () => initiateYoutubeOAuth(instituteId),
        onSuccess: (data) => {
            window.location.href = data.authorization_url;
        },
        onError: () => toast.error('Failed to start YouTube OAuth — check console.'),
    });

    const { mutate: disconnect, isPending: disconnecting } = useMutation({
        mutationFn: () => disconnectYoutube(instituteId),
        onSuccess: () => {
            toast.success('YouTube disconnected');
            onReload();
        },
        onError: () => toast.error('Failed to disconnect'),
    });

    const s = status?.status ?? 'NOT_CONNECTED';

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                <div className="flex size-9 items-center justify-center rounded-md bg-red-50 text-red-600">
                    <YoutubeLogo size={20} weight="fill" />
                </div>
                <div className="flex-1">
                    <CardTitle className="text-base">YouTube Channel</CardTitle>
                    <CardDescription>
                        Sign in with the Google account that owns the channel you want to publish
                        to. Required: edit access to that channel.
                    </CardDescription>
                </div>
                <StatusBadge status={s} />
            </CardHeader>
            <CardContent className="border-t border-neutral-100 p-5">
                {loading ? (
                    <div className="text-sm text-neutral-500">Loading…</div>
                ) : s === 'ACTIVE' ? (
                    <div className="flex flex-wrap items-center gap-4">
                        {status?.channelThumbnailUrl && (
                            <img
                                src={status.channelThumbnailUrl}
                                alt={status.channelTitle ?? 'channel'}
                                className="size-12 rounded-full"
                            />
                        )}
                        <div className="flex-1 min-w-[200px]">
                            <div className="text-sm font-medium text-neutral-800">
                                {status?.channelTitle ?? '(unnamed channel)'}
                            </div>
                            {status?.channelId && (
                                <a
                                    href={`https://www.youtube.com/channel/${status.channelId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-600"
                                >
                                    {status.channelId}
                                    <ArrowSquareOut size={12} />
                                </a>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => connect()}
                                disabled={connecting}
                            >
                                <ArrowsClockwise className="mr-1 size-3.5" />
                                Reconnect
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => disconnect()}
                                disabled={disconnecting}
                                className="text-red-600 hover:text-red-700"
                            >
                                Disconnect
                            </Button>
                        </div>
                    </div>
                ) : s === 'INVALID' ? (
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[240px]">
                            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                                <Warning size={16} />
                                Connection invalid
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">
                                {status?.lastError ??
                                    'Google rejected the refresh token. This usually means access was revoked in Google Account settings.'}
                            </p>
                        </div>
                        <Button onClick={() => connect()} disabled={connecting}>
                            <PlugsConnected className="mr-1 size-4" />
                            {connecting ? 'Redirecting…' : 'Reconnect YouTube'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[240px] text-sm text-neutral-500">
                            No channel connected yet. Once connected, every BBB recording will
                            auto-upload to that channel.
                        </div>
                        <Button onClick={() => connect()} disabled={connecting}>
                            <Plug className="mr-1 size-4" />
                            {connecting ? 'Redirecting…' : 'Connect YouTube'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status }: { status: 'ACTIVE' | 'INVALID' | 'NOT_CONNECTED' }) {
    const cfg = {
        ACTIVE: { label: 'Connected', color: 'bg-green-100 text-green-700' },
        INVALID: { label: 'Needs reconnect', color: 'bg-amber-100 text-amber-700' },
        NOT_CONNECTED: { label: 'Not connected', color: 'bg-neutral-100 text-neutral-600' },
    }[status];
    return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}

// ─── Defaults card ───────────────────────────────────────────────────────────

function DefaultsCard({
    instituteId,
    defaults,
    loading,
}: {
    instituteId: string;
    defaults?: YoutubeUploadDefaults;
    loading: boolean;
}) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<YoutubeUploadDefaults | null>(null);

    useEffect(() => {
        if (defaults) setDraft(defaults);
    }, [defaults]);

    const dirty = useMemo(
        () => !!draft && !!defaults && JSON.stringify(draft) !== JSON.stringify(defaults),
        [draft, defaults]
    );

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: (next: YoutubeUploadDefaults) => updateYoutubeDefaults(instituteId, next),
        onSuccess: () => {
            toast.success('Upload defaults saved');
            queryClient.invalidateQueries({ queryKey: ['youtube-defaults', instituteId] });
        },
        onError: () => toast.error('Failed to save defaults'),
    });

    if (loading || !draft) {
        return (
            <Card className="border-neutral-200 shadow-none">
                <CardHeader className="p-5">
                    <CardTitle className="text-base">Upload Defaults</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 text-sm text-neutral-500">Loading…</CardContent>
            </Card>
        );
    }

    const set = (patch: Partial<YoutubeUploadDefaults>) =>
        setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="flex-row items-start gap-3 space-y-0 p-5 pb-4">
                <div className="flex size-9 items-center justify-center rounded-md bg-primary-50 text-primary-500">
                    <CloudArrowUp size={18} />
                </div>
                <div className="flex-1">
                    <CardTitle className="text-base">Upload Defaults</CardTitle>
                    <CardDescription>
                        Applied to every recording that auto-uploads. Manual upload can override
                        privacy per recording.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!dirty || saving}
                        onClick={() => defaults && setDraft(defaults)}
                    >
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        disabled={!dirty || saving}
                        onClick={() => draft && save(draft)}
                        className="bg-primary-500 hover:bg-primary-600"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 border-t border-neutral-100 p-5">
                <SettingRow
                    title="Auto-upload on recording ready"
                    description="When off, recordings won't upload automatically. Anyone can still trigger an upload from the live-session view."
                    checked={draft.autoUploadEnabled}
                    onChange={(v) => set({ autoUploadEnabled: v })}
                />

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Privacy</Label>
                        <Select
                            value={draft.privacyStatus}
                            onValueChange={(v) =>
                                set({ privacyStatus: v as YoutubeUploadDefaults['privacyStatus'] })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRIVACY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-neutral-500">
                            {PRIVACY_OPTIONS.find((p) => p.value === draft.privacyStatus)?.help}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        <Select
                            value={draft.categoryId}
                            onValueChange={(v) => set({ categoryId: v })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">License</Label>
                        <Select
                            value={draft.license}
                            onValueChange={(v) =>
                                set({ license: v as YoutubeUploadDefaults['license'] })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="youtube">Standard YouTube License</SelectItem>
                                <SelectItem value="creativeCommon">Creative Commons</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Default language</Label>
                        <Input
                            placeholder="en, hi, …"
                            value={draft.defaultLanguage ?? ''}
                            onChange={(e) => set({ defaultLanguage: e.target.value })}
                        />
                    </div>
                </div>

                <Separator />

                <SettingRow
                    title="Allow embedding"
                    description="Required if you want to play these videos inside Vacademy. Turn off only for download-restricted content."
                    checked={draft.embeddable}
                    onChange={(v) => set({ embeddable: v })}
                />
                <SettingRow
                    title="Public stats viewable"
                    description="Whether view-count / like-count are visible on the video page."
                    checked={draft.publicStatsViewable}
                    onChange={(v) => set({ publicStatsViewable: v })}
                />
                <SettingRow
                    title="Made for kids"
                    description="YouTube requires this declaration. Most adult-learner lectures should be off."
                    checked={draft.madeForKids}
                    onChange={(v) => set({ madeForKids: v })}
                />
                <SettingRow
                    title="Notify channel subscribers"
                    description="When on, YouTube pushes a subscriber notification for every uploaded recording. Usually off for routine recordings."
                    checked={draft.notifySubscribers}
                    onChange={(v) => set({ notifySubscribers: v })}
                />

                <Separator />

                <div className="space-y-1.5">
                    <Label className="text-xs">
                        Title template
                        <span className="ml-2 font-normal text-neutral-500">
                            Tokens: {'{session_title}, {subject}, {date}'}
                        </span>
                    </Label>
                    <Input
                        value={draft.titleTemplate}
                        onChange={(e) => set({ titleTemplate: e.target.value })}
                        placeholder="{session_title} | {date}"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">
                        Description template
                        <span className="ml-2 font-normal text-neutral-500">
                            Same tokens as title
                        </span>
                    </Label>
                    <Textarea
                        rows={4}
                        value={draft.descriptionTemplate ?? ''}
                        onChange={(e) => set({ descriptionTemplate: e.target.value })}
                        placeholder="Recorded session of {session_title} on {date}. © Your Institute."
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Tags (comma-separated)</Label>
                    <Input
                        value={draft.tagsCsv ?? ''}
                        onChange={(e) => set({ tagsCsv: e.target.value })}
                        placeholder="lecture, class 12, jee"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Default playlist ID (optional)</Label>
                    <Input
                        value={draft.defaultPlaylistId ?? ''}
                        onChange={(e) => set({ defaultPlaylistId: e.target.value })}
                        placeholder="PLxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <p className="text-[11px] text-neutral-500">
                        Videos uploaded with auto-upload will be added to this playlist.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function SettingRow({
    title,
    description,
    checked,
    onChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
                <div className="text-sm font-medium text-neutral-800">{title}</div>
                <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

// ─── Upload history card ─────────────────────────────────────────────────────

function UploadHistoryCard({
    jobs,
    loading,
    connected,
}: {
    jobs: YoutubeUploadJob[];
    loading: boolean;
    connected: boolean;
}) {
    const queryClient = useQueryClient();
    const { mutate: retry, isPending: retrying } = useMutation({
        mutationFn: (jobId: string) => retryYoutubeUpload(jobId),
        onSuccess: () => {
            toast.success('Re-queued for upload');
            queryClient.invalidateQueries({ queryKey: ['youtube-jobs'] });
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to retry';
            toast.error(msg);
        },
    });

    return (
        <Card className="border-neutral-200 shadow-none">
            <CardHeader className="p-5 pb-4">
                <CardTitle className="text-base">Upload History</CardTitle>
                <CardDescription>
                    Most recent 50 uploads for this institute. Failures can be retried; quota
                    errors auto-retry after the daily window resets.
                </CardDescription>
            </CardHeader>
            <CardContent className="border-t border-neutral-100 p-0">
                {!connected ? (
                    <div className="p-8 text-center text-sm text-neutral-500">
                        Connect a YouTube channel to start uploading recordings.
                    </div>
                ) : loading ? (
                    <div className="p-6 text-sm text-neutral-500">Loading…</div>
                ) : jobs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-neutral-500">
                        No uploads yet. Recordings will appear here once they finish processing.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b bg-neutral-50 text-xs text-neutral-500">
                                <tr>
                                    <th className="px-4 py-2">When</th>
                                    <th className="px-4 py-2">Title</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">Trigger</th>
                                    <th className="px-4 py-2">Video</th>
                                    <th className="px-4 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((j) => (
                                    <tr key={j.id} className="border-b last:border-0">
                                        <td className="whitespace-nowrap px-4 py-2 text-xs text-neutral-500">
                                            {formatWhen(j.createdAt)}
                                        </td>
                                        <td className="max-w-[280px] truncate px-4 py-2">
                                            {j.title ?? (
                                                <span className="text-neutral-400">
                                                    (pending — file {short(j.recordingFileId)})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <JobStatusPill job={j} />
                                        </td>
                                        <td className="px-4 py-2 text-xs text-neutral-500">
                                            {j.triggeredVia === 'AUTO' ? 'Auto' : 'Manual'}
                                        </td>
                                        <td className="px-4 py-2">
                                            {j.youtubeVideoUrl ? (
                                                <a
                                                    href={j.youtubeVideoUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                                                >
                                                    Open
                                                    <ArrowSquareOut size={12} />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-neutral-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {j.status === 'FAILED' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={retrying}
                                                    onClick={() => retry(j.id)}
                                                >
                                                    Retry
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function JobStatusPill({ job }: { job: YoutubeUploadJob }) {
    const map: Record<YoutubeUploadJob['status'], { label: string; color: string; Icon: Icon }> = {
        QUEUED: {
            label: `Queued${job.attempts > 0 ? ` (try ${job.attempts + 1}/${job.maxAttempts})` : ''}`,
            color: 'bg-neutral-100 text-neutral-600',
            Icon: ArrowsClockwise,
        },
        UPLOADING: {
            label: 'Uploading…',
            color: 'bg-blue-100 text-blue-700',
            Icon: CloudArrowUp,
        },
        DONE: { label: 'Uploaded', color: 'bg-green-100 text-green-700', Icon: Check },
        FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', Icon: Warning },
        CANCELLED: { label: 'Cancelled', color: 'bg-neutral-100 text-neutral-500', Icon: Warning },
    };
    const cfg = map[job.status];
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}
            title={job.lastError ?? undefined}
        >
            <cfg.Icon size={11} />
            {cfg.label}
        </span>
    );
}

function formatWhen(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - d.getTime()) / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`;
    return d.toLocaleDateString();
}

function short(id?: string) {
    if (!id) return '';
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
}
