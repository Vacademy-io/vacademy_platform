import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    ArrowLeft,
    Eye,
    Pencil,
    Undo2,
    Redo2,
    Save,
    Loader2,
    AlertCircle,
    PanelLeftOpen,
    PanelLeftClose,
    Monitor,
    ImagePlus,
    Image as ImageIcon,
    FilePlus2,
    Film,
    Download,
    RotateCcw,
    Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIContentPlayer } from '@/components/ai-video-player/AIContentPlayer';
import { useVideoEditorStore, InitParams } from './stores/video-editor-store';
import { snapSizeToBucket } from './utils/caption-rendering';
import { EditorCanvas } from './EditorCanvas';
import { EntryListPanel } from './EntryListPanel';
import { TimelineScrubber } from './TimelineScrubber';
import { PropertiesPanel } from './PropertiesPanel';
import { AddMediaOverlayDialog } from './AddMediaOverlayDialog';
import { AddShotDialog } from './AddShotDialog';
import { AudioTracksPanel } from './AudioTracksPanel';
import { SilentTailNotice } from './SilentTailNotice';
import { SaveConflictNotice } from './SaveConflictNotice';
import { CaptionSettingsPanel } from './CaptionSettingsPanel';
import { PlaybackBar } from './playback/PlaybackBar';
import { RenderSettingsDialog } from '@/routes/video-api-studio/-components/RenderSettingsDialog';
import { ThumbnailPickerPanel } from '@/routes/video-api-studio/-components/pipeline/ThumbnailPickerPanel';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    requestVideoRender,
    getRenderStatus,
    getVideoUrls,
    type RenderSettings,
} from '@/routes/video-api-studio/-services/video-generation';
import { toast } from 'sonner';

interface VideoEditorPageProps extends InitParams {
    /**
     * Deep-link target — seconds into the timeline. When set, the page seeks
     * to this time and selects the entry whose [inTime, exitTime) range
     * contains it, once the timeline finishes loading. Used by the pipeline
     * view's "Edit this scene" affordance to drop the user straight on the
     * shot they wanted to tweak. Applied exactly once per mount.
     */
    focusTime?: number;
    /**
     * Override for the toolbar's "Back" navigation. Defaults to the admin
     * studio at `/video-api-studio`; vim passes a handler that returns to
     * `/vim/dashboard?videoId=…` (the production view) so the user stays in
     * the vim shell.
     */
    onBack?: () => void;
}

// ── Render job localStorage helpers ────────────────────────────────────────

const RENDER_JOB_MAX_AGE = 90 * 60 * 1000; // 90 min
const RENDER_POLL_INTERVAL = 10_000; // 10 s
const RENDER_MAX_POLLS = 180; // 30 min

function loadRenderJob(videoId: string): { jobId: string; startedAt: number } | null {
    try {
        const raw = localStorage.getItem(`render-job-${videoId}`);
        if (!raw) return null;
        return JSON.parse(raw) as { jobId: string; startedAt: number };
    } catch {
        return null;
    }
}

function saveRenderJob(videoId: string, jobId: string) {
    localStorage.setItem(`render-job-${videoId}`, JSON.stringify({ jobId, startedAt: Date.now() }));
}

function clearRenderJob(videoId: string) {
    localStorage.removeItem(`render-job-${videoId}`);
}

// ── Render state ────────────────────────────────────────────────────────────

type RenderState = 'idle' | 'submitting' | 'rendering' | 'done' | 'error';

/**
 * Full-screen AI Video Editor.
 *
 * Layout adapts to video orientation:
 *  - Landscape (1920×1080): 3-panel — entry list | canvas | properties
 *  - Portrait  (1080×1920): canvas centred, entry list as collapsible overlay
 *
 * Phase 1: editor shell, canvas scrubbing, entry selection, preview toggle.
 * Phase 2: transform controls, properties panel, undo/redo, save to backend.
 * Phase 5: render MP4 from toolbar.
 */
export function VideoEditorPage(props: VideoEditorPageProps) {
    const navigate = useNavigate();
    const {
        init,
        loadTimeline,
        loadCaptionWords,
        isLoading,
        error,
        meta,
        entries,
        seek,
        selectEntry,
        dirtyEntryIds,
        deletedEntryIds,
        pendingReorders,
        viewMode,
        toggleViewMode,
        entryTransforms,
        past,
        future,
        isPreviewMode,
        togglePreviewMode,
        isSaving,
        saveChanges,
        undo,
        redo,
        // Track these in the store so re-narration / re-rendering can refresh
        // the preview without remounting from the original mount-time props.
        audioUrl: storeAudioUrl,
        htmlUrl: storeHtmlUrl,
        wordsUrl: storeWordsUrl,
        captionSettings,
    } = useVideoEditorStore();

    const [entriesPanelOpen, setEntriesPanelOpen] = useState(true);
    const [addMediaOpen, setAddMediaOpen] = useState(false);
    const [addShotOpen, setAddShotOpen] = useState(false);
    const [renderSettingsOpen, setRenderSettingsOpen] = useState(false);

    // Render state
    const [renderState, setRenderState] = useState<RenderState>('idle');
    const [renderProgress, setRenderProgress] = useState(0);
    const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null);
    const [, setRenderJobId] = useState<string | null>(null);
    // Consecutive failed status checks (B12): drives both the exponential
    // backoff between polls and the visible "status check failing" hint.
    const [pollFailures, setPollFailures] = useState(0);

    const pollCountRef = useRef(0);
    const pollFailuresRef = useRef(0);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true); // C5: guard setState after unmount

    const canvasW = meta.dimensions?.width ?? 1920;
    const canvasH = meta.dimensions?.height ?? 1080;
    const isPortrait = canvasH > canvasW;

    // ── Preconnect to iframe library CDNs ──────────────────────────────────
    // Each shot iframe pulls gsap / anime / katex / etc. from these hosts.
    // Adding `<link rel="preconnect">` from the parent document warms TCP/TLS
    // for those origins so the very first iframe doesn't have to pay the
    // handshake latency on top of the script download. ~150–300ms saved on
    // a cold load with high-RTT connections.
    useEffect(() => {
        const HOSTS = [
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
            'https://code.iconify.design',
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
        ];
        const links: HTMLLinkElement[] = [];
        for (const href of HOSTS) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = href;
            link.crossOrigin = '';
            document.head.appendChild(link);
            links.push(link);
        }
        return () => {
            for (const l of links) l.remove();
        };
    }, []);

    // ── Bootstrap ──────────────────────────────────────────────────────────
    useEffect(() => {
        init(props);
    }, [props.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadTimeline();
    }, [props.htmlUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch narration.words.json so CaptionOverlay can render the caption layer.
    // Soft-fails when wordsUrl is missing or unreachable — captions just don't show.
    useEffect(() => {
        loadCaptionWords();
    }, [props.wordsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cmd/Ctrl+Shift+D toggles developer mode. Guarded against input focus
    // so the shortcut doesn't fire while typing into form fields.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
            if (e.key !== 'd' && e.key !== 'D') return;
            const t = e.target as HTMLElement | null;
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.tagName === 'SELECT' ||
                    t.isContentEditable)
            )
                return;
            e.preventDefault();
            toggleViewMode();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleViewMode]);

    // ── Deep-link focus ────────────────────────────────────────────────────
    // When a `focusTime` search param is set (pipeline view's "Edit this
    // scene" deep-link), seek to that time and select the entry whose range
    // covers it. Applied once per mount after entries land — earlier and
    // there's nothing to match against; later and we'd fight a user who's
    // already clicked elsewhere.
    const focusAppliedRef = useRef(false);
    useEffect(() => {
        if (focusAppliedRef.current) return;
        if (props.focusTime == null) return;
        if (entries.length === 0) return;
        focusAppliedRef.current = true;
        const t = props.focusTime;
        seek(t);
        const target = entries.find((e) => {
            const start = e.inTime ?? e.start ?? 0;
            const end = e.exitTime ?? e.end ?? Number.POSITIVE_INFINITY;
            return start <= t && t < end;
        });
        if (target) selectEntry(target.id);
    }, [entries, props.focusTime, seek, selectEntry]);

    // ── Resume render job on mount ─────────────────────────────────────────
    useEffect(() => {
        if (!props.apiKey || !props.videoId) return;
        // Studio builds render from the project detail page via the studio
        // pipeline — the AI-video render endpoints can't resolve a build id.
        if (props.kind === 'studio') return;

        // Check API for existing render job
        getVideoUrls(props.videoId, props.apiKey)
            .then((urls) => {
                if (urls.video_url) {
                    setRenderDownloadUrl(urls.video_url);
                    setRenderState('done');
                    return;
                }
                if (urls.render_job_id) {
                    setRenderJobId(urls.render_job_id);
                    setRenderState('rendering');
                    startRenderPolling(urls.render_job_id);
                    return;
                }
                // Fall back to localStorage
                resumeFromLocalStorage();
            })
            .catch(() => {
                resumeFromLocalStorage();
            });
    }, [props.videoId, props.apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

    function resumeFromLocalStorage() {
        if (!props.videoId) return;
        const saved = loadRenderJob(props.videoId);
        if (!saved) return;
        if (Date.now() - saved.startedAt > RENDER_JOB_MAX_AGE) {
            clearRenderJob(props.videoId);
            return;
        }
        setRenderJobId(saved.jobId);
        setRenderState('rendering');
        startRenderPolling(saved.jobId);
    }

    // ── Polling ────────────────────────────────────────────────────────────
    const startRenderPolling = useCallback(
        (jobId: string) => {
            if (!props.apiKey) return;
            pollCountRef.current = 0;
            pollFailuresRef.current = 0;
            setPollFailures(0);

            const poll = async () => {
                if (!isMountedRef.current) return; // C5
                if (pollCountRef.current >= RENDER_MAX_POLLS) {
                    if (isMountedRef.current) setRenderState('error');
                    if (props.videoId) clearRenderJob(props.videoId);
                    return;
                }
                pollCountRef.current++;

                try {
                    const status = await getRenderStatus(jobId, props.apiKey!, props.videoId);
                    if (!isMountedRef.current) return; // C5: guard after await

                    if (pollFailuresRef.current > 0) {
                        pollFailuresRef.current = 0;
                        setPollFailures(0);
                    }
                    if (status.progress != null) {
                        setRenderProgress(Math.round(status.progress));
                    }

                    if (status.status === 'completed' && status.video_url) {
                        setRenderDownloadUrl(status.video_url);
                        setRenderState('done');
                        if (props.videoId) clearRenderJob(props.videoId);
                        return;
                    }

                    if (status.status === 'failed') {
                        setRenderState('error');
                        toast.error(status.error ?? 'Render failed');
                        if (props.videoId) clearRenderJob(props.videoId);
                        return;
                    }

                    // Still queued/running — schedule next poll
                    pollTimerRef.current = setTimeout(poll, RENDER_POLL_INTERVAL);
                } catch {
                    if (!isMountedRef.current) return; // C5
                    // Status check failed — keep polling, but back off
                    // exponentially (10s → 20s → 40s → 60s cap) so a down
                    // backend isn't hammered, and surface the failure in the
                    // render chip instead of pretending all is well (B12).
                    pollFailuresRef.current++;
                    setPollFailures(pollFailuresRef.current);
                    const backoff = Math.min(
                        RENDER_POLL_INTERVAL * 2 ** (pollFailuresRef.current - 1),
                        60_000
                    );
                    pollTimerRef.current = setTimeout(poll, backoff);
                }
            };

            pollTimerRef.current = setTimeout(poll, RENDER_POLL_INTERVAL);
        },
        [props.apiKey, props.videoId]
    );

    // Clear polling timer on unmount; mark component as unmounted (C5)
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    // ── Render trigger ─────────────────────────────────────────────────────
    const handleRenderConfirm = useCallback(
        async (settings: RenderSettings) => {
            if (!props.apiKey || !props.videoId) return;
            // Render reads the server-side timeline; unsaved local edits would
            // be silently missing from the MP4. Save first if needed.
            if (
                dirtyEntryIds.length > 0 ||
                deletedEntryIds.length > 0 ||
                pendingReorders.length > 0
            ) {
                try {
                    await saveChanges();
                    // A revision conflict aborts the save quietly and shows the
                    // conflict strip. Don't render with unsaved edits — let the
                    // user resolve the conflict first.
                    if (useVideoEditorStore.getState().saveConflict) {
                        toast.error('Resolve the timeline conflict above before rendering.');
                        return;
                    }
                    toast.info('Saved pending edits before rendering');
                } catch (err) {
                    toast.error(
                        err instanceof Error
                            ? `Save failed before render: ${err.message}`
                            : 'Save failed before render'
                    );
                    return;
                }
            }
            setRenderState('submitting');
            setRenderProgress(0);
            try {
                const result = await requestVideoRender(props.videoId, props.apiKey, settings);
                const jobId = result.job_id;
                setRenderJobId(jobId);
                saveRenderJob(props.videoId, jobId);
                setRenderState('rendering');
                startRenderPolling(jobId);
            } catch (err) {
                setRenderState('error');
                toast.error(err instanceof Error ? err.message : 'Failed to start render');
            }
        },
        [
            props.apiKey,
            props.videoId,
            startRenderPolling,
            dirtyEntryIds,
            deletedEntryIds,
            pendingReorders,
            saveChanges,
        ]
    );

    const handleRenderRetry = useCallback(() => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        setRenderProgress(0);
        setRenderJobId(null);
        setRenderState('idle');
        setRenderSettingsOpen(true);
    }, []);

    // ── Dirty / undo state ─────────────────────────────────────────────────
    const isDirty =
        dirtyEntryIds.length > 0 ||
        deletedEntryIds.length > 0 ||
        pendingReorders.length > 0 ||
        Object.values(entryTransforms).some(
            (t) => t.x !== 0 || t.y !== 0 || t.scale !== 1 || t.rotation !== 0
        );

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    const handleBack = useCallback(() => {
        // M6: warn about unsaved changes before navigating away
        if (isDirty) {
            const ok = window.confirm('You have unsaved changes. Leave without saving?');
            if (!ok) return;
        }
        if (props.onBack) {
            props.onBack();
            return;
        }
        navigate({ to: '/video-api-studio' });
    }, [navigate, isDirty, props]);

    const handleSave = useCallback(async () => {
        try {
            await saveChanges();
            // saveChanges aborts quietly on a revision conflict and sets
            // saveConflict — the SaveConflictNotice strip handles that case,
            // so don't claim success.
            if (useVideoEditorStore.getState().saveConflict) return;
            toast.success('Changes saved successfully');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed');
        }
    }, [saveChanges]);

    // ── Loading / error states ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 text-gray-500">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Loading timeline…
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gray-50 text-gray-500">
                <AlertCircle className="size-8 text-red-500" />
                <p className="text-sm">{error}</p>
                <Button size="sm" variant="outline" onClick={handleBack}>
                    Go back
                </Button>
            </div>
        );
    }

    // ── Render button (toolbar slot) ───────────────────────────────────────
    const renderButton = (() => {
        // Studio builds render from the project detail page (studio pipeline);
        // the /external/video/v1/render endpoints 400 on a build id.
        if (props.kind === 'studio') return null;

        if (!props.apiKey) {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="h-7 gap-1 border-gray-300 px-3 text-xs text-gray-400"
                    title="API key required to render"
                >
                    <Film className="size-3" />
                    Render
                </Button>
            );
        }

        if (renderState === 'idle') {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-gray-300 px-3 text-xs text-gray-600 hover:text-gray-900"
                    onClick={() => setRenderSettingsOpen(true)}
                    title="Render to MP4"
                >
                    <Film className="size-3" />
                    Render
                </Button>
            );
        }

        if (renderState === 'submitting') {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="h-7 gap-1 border-gray-300 px-3 text-xs text-gray-500"
                >
                    <Loader2 className="size-3 animate-spin" />
                    Submitting…
                </Button>
            );
        }

        if (renderState === 'rendering') {
            const checksFailing = pollFailures > 0;
            return (
                <div
                    className={`flex h-7 items-center gap-1.5 rounded-md border px-3 ${
                        checksFailing
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-blue-200 bg-blue-50'
                    }`}
                    title={
                        checksFailing
                            ? `Rendering — last ${pollFailures} status check${
                                  pollFailures === 1 ? '' : 's'
                              } failed; retrying with backoff`
                            : `Rendering: ${renderProgress}%`
                    }
                >
                    <Loader2
                        className={`size-3 animate-spin ${
                            checksFailing ? 'text-amber-500' : 'text-blue-500'
                        }`}
                    />
                    <span
                        className={`text-xs ${checksFailing ? 'text-amber-700' : 'text-blue-700'}`}
                    >
                        {checksFailing
                            ? 'Status check failed — retrying…'
                            : renderProgress > 0
                              ? `${renderProgress}%`
                              : 'Queued…'}
                    </span>
                    {/* Mini progress bar */}
                    <div className="h-1 w-14 overflow-hidden rounded-full bg-blue-100">
                        <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${renderProgress}%` }}
                        />
                    </div>
                </div>
            );
        }

        if (renderState === 'done' && renderDownloadUrl) {
            return (
                <a
                    href={renderDownloadUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                    title="Download rendered MP4"
                >
                    <Download className="size-3" />
                    Download MP4
                </a>
            );
        }

        if (renderState === 'error') {
            return (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-red-300 px-3 text-xs text-red-600 hover:bg-red-50"
                    onClick={handleRenderRetry}
                    title="Render failed — retry"
                >
                    <RotateCcw className="size-3" />
                    Retry
                </Button>
            );
        }

        return null;
    })();

    // ── Toolbar ────────────────────────────────────────────────────────────
    const toolbar = (
        <div
            data-tour="editor-toolbar"
            className="flex h-11 shrink-0 items-center gap-1.5 border-b border-gray-200 bg-white px-3"
        >
            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-500 hover:text-gray-900"
                onClick={handleBack}
                title="Back"
            >
                <ArrowLeft className="size-4" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-500 hover:text-gray-900"
                title={entriesPanelOpen ? 'Hide entries' : 'Show entries'}
                onClick={() => setEntriesPanelOpen((v) => !v)}
            >
                {entriesPanelOpen ? (
                    <PanelLeftClose className="size-4" />
                ) : (
                    <PanelLeftOpen className="size-4" />
                )}
            </Button>

            {/* Canvas dimensions badge */}
            <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-gray-500">
                <Monitor className="size-3" />
                <span className="font-mono text-[10px]">
                    {canvasW}×{canvasH}
                </span>
            </div>

            {isDirty && (
                <Badge
                    variant="outline"
                    className="h-5 border-amber-400 px-1.5 text-[10px] text-amber-600"
                >
                    Unsaved
                </Badge>
            )}

            <div className="flex-1" />

            {/* Undo / Redo */}
            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                disabled={!canUndo}
                title="Undo"
                onClick={undo}
            >
                <Undo2 className="size-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                disabled={!canRedo}
                title="Redo"
                onClick={redo}
            >
                <Redo2 className="size-3.5" />
            </Button>

            {/* Add new shot + Add media overlay */}
            <div data-tour="editor-add-shot" className="flex items-center gap-1.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-gray-500 hover:text-gray-900"
                    title="Add new shot"
                    onClick={() => setAddShotOpen(true)}
                >
                    <FilePlus2 className="size-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-gray-500 hover:text-gray-900"
                    title="Add media overlay"
                    onClick={() => setAddMediaOpen(true)}
                >
                    <ImagePlus className="size-4" />
                </Button>
            </div>

            {/* Thumbnail picker — opens a popover with the selected option +
                alternates + regenerate. Lives next to the export group because
                thumbnails are part of "ship this video" workflow. AI-gen
                videos only — the thumbnail endpoints can't resolve a studio
                build id. */}
            {props.videoId && props.apiKey && props.kind !== 'studio' && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-gray-500 hover:text-gray-900"
                            title="Thumbnail"
                            data-tour="editor-thumbnail"
                        >
                            <ImageIcon className="size-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-0" align="end" side="bottom">
                        <div className="p-3">
                            <ThumbnailPickerPanel
                                videoId={props.videoId}
                                apiKey={props.apiKey}
                                variant="compact"
                            />
                        </div>
                    </PopoverContent>
                </Popover>
            )}

            {/* Developer-mode toggle. Off (simple) = friendly labels + advanced
                inputs tucked under `Advanced ▾` disclosures. On (developer) =
                advanced disclosures pre-expanded + tag-name badges in the
                Layers tree. Both modes keep every underlying control reachable. */}
            <Button
                size="sm"
                variant="outline"
                className={[
                    'h-7 border-gray-300 px-2 text-xs',
                    viewMode === 'developer'
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'text-gray-500 hover:text-gray-800',
                ].join(' ')}
                onClick={toggleViewMode}
                title={
                    viewMode === 'developer'
                        ? 'Developer mode on — advanced sections expanded by default. (Cmd+Shift+D)'
                        : 'Simple mode — advanced inputs hidden in `Advanced ▾` sections. (Cmd+Shift+D to toggle)'
                }
                aria-pressed={viewMode === 'developer'}
            >
                <Wrench className="size-3" />
            </Button>

            {/* Save + Render + Preview — grouped so the tour can highlight the
                full export workflow with one anchor. */}
            <div data-tour="editor-save-render" className="flex items-center gap-1.5">
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-gray-300 px-3 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30"
                    disabled={!isDirty || isSaving}
                    title={
                        !props.apiKey
                            ? 'API key required to save to backend; changes saved locally'
                            : dirtyEntryIds.length +
                                    deletedEntryIds.length +
                                    pendingReorders.length >
                                0
                              ? [
                                    `Save ${dirtyEntryIds.length} edit${dirtyEntryIds.length === 1 ? '' : 's'}`,
                                    deletedEntryIds.length > 0
                                        ? `${deletedEntryIds.length} deletion${deletedEntryIds.length === 1 ? '' : 's'}`
                                        : '',
                                    pendingReorders.length > 0
                                        ? `${pendingReorders.length} reorder${pendingReorders.length === 1 ? '' : 's'}`
                                        : '',
                                ]
                                    .filter(Boolean)
                                    .join(', ')
                              : 'Save changes'
                    }
                    onClick={handleSave}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-1 size-3 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="mr-1 size-3" />
                            Save
                            {dirtyEntryIds.length +
                                deletedEntryIds.length +
                                pendingReorders.length >
                                0 && (
                                <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">
                                    {dirtyEntryIds.length +
                                        deletedEntryIds.length +
                                        pendingReorders.length}
                                </span>
                            )}
                        </>
                    )}
                </Button>

                {renderButton}

                <Button
                    size="sm"
                    className={[
                        'h-7 px-3 text-xs',
                        isPreviewMode
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200',
                    ].join(' ')}
                    onClick={togglePreviewMode}
                    title={isPreviewMode ? 'Back to editor' : 'Preview video'}
                >
                    {isPreviewMode ? (
                        <>
                            <Pencil className="mr-1 size-3" />
                            Edit
                        </>
                    ) : (
                        <>
                            <Eye className="mr-1 size-3" />
                            Preview
                        </>
                    )}
                </Button>
            </div>
        </div>
    );

    // ── Preview mode: full AIContentPlayer ────────────────────────────────
    if (isPreviewMode) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
                {toolbar}
                {/* M5: banner when there are unsaved edits not yet reflected in the preview */}
                {isDirty && (
                    <div className="flex items-center justify-center gap-2 bg-amber-500 py-1 text-xs font-medium text-white">
                        <AlertCircle className="size-3.5" />
                        Preview shows the last saved version — unsaved changes are not reflected.
                    </div>
                )}
                <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
                    <div
                        className="size-full overflow-hidden rounded-xl"
                        style={{ aspectRatio: `${canvasW}/${canvasH}`, maxHeight: '100%' }}
                    >
                        <AIContentPlayer
                            // Read URLs from the store so re-narrate updates flow into
                            // the preview player without remounting the editor. Falls
                            // back to mount-time props if the store hasn't initialised.
                            timelineUrl={storeHtmlUrl || props.htmlUrl}
                            audioUrl={storeAudioUrl ?? props.audioUrl}
                            wordsUrl={storeWordsUrl ?? props.wordsUrl}
                            avatarUrl={props.avatarUrl}
                            width={canvasW}
                            height={canvasH}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ── Edit mode — always 3-panel (entry list | canvas | properties) ──────
    return (
        <>
            <EditorLayout toolbar={toolbar} entriesPanelOpen={entriesPanelOpen} />
            <AddShotDialog open={addShotOpen} onClose={() => setAddShotOpen(false)} />
            <AddMediaOverlayDialog open={addMediaOpen} onClose={() => setAddMediaOpen(false)} />
            <RenderSettingsDialog
                open={renderSettingsOpen}
                onOpenChange={setRenderSettingsOpen}
                onConfirm={handleRenderConfirm}
                isPortrait={isPortrait}
                // Seed the dialog from the editor's caption preview so the MP4
                // matches what the user just saw on canvas. Resolution / fps /
                // watermark still come from the dialog's own localStorage.
                initialSettings={{
                    captions: captionSettings.enabled,
                    captionPosition: captionSettings.position,
                    captionTextColor: captionSettings.textColor,
                    captionBgColor: captionSettings.bgColor,
                    captionBgOpacity: Math.round(captionSettings.bgOpacity * 100),
                    captionSize: snapSizeToBucket(captionSettings.sizePx),
                    captionStyle: captionSettings.style,
                    captionFontFamily: captionSettings.fontFamily,
                    captionFontWeight: captionSettings.fontWeight,
                    captionTextStrokeWidth: captionSettings.textStrokeWidth,
                    captionTextStrokeColor: captionSettings.textStrokeColor,
                    captionHighlightColor: captionSettings.highlightColor,
                    captionPreset: captionSettings.preset,
                }}
            />
        </>
    );
}

// ── Editor layout — 3-panel for both portrait and landscape videos ──────────

interface LayoutProps {
    toolbar: React.ReactNode;
    entriesPanelOpen: boolean;
}

function EditorLayout({ toolbar, entriesPanelOpen }: LayoutProps) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-50 text-gray-900">
            {toolbar}
            <SaveConflictNotice />

            <div className="flex flex-1 overflow-hidden">
                {/* Entry list — collapsible left panel */}
                {entriesPanelOpen && (
                    <div data-tour="editor-entry-list" className="w-52 shrink-0 overflow-hidden">
                        <EntryListPanel />
                    </div>
                )}

                {/* Canvas — fills remaining space, maintains aspect ratio internally */}
                <div data-tour="editor-canvas" className="min-w-0 flex-1 overflow-hidden">
                    <EditorCanvas />
                </div>

                {/* Properties panel — right column */}
                <PropertiesPanel />
            </div>

            <PlaybackBar />
            <SilentTailNotice />
            <div data-tour="editor-timeline">
                <TimelineScrubber />
            </div>
            <div data-tour="editor-captions">
                <CaptionSettingsPanel />
            </div>
            <div data-tour="editor-audio-tracks">
                <AudioTracksPanel />
            </div>
        </div>
    );
}
