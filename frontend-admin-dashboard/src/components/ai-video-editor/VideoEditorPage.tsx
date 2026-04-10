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
    Film,
    Download,
    RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIContentPlayer } from '@/components/ai-video-player/AIContentPlayer';
import { useVideoEditorStore, InitParams } from './stores/video-editor-store';
import { EditorCanvas } from './EditorCanvas';
import { EntryListPanel } from './EntryListPanel';
import { TimelineScrubber } from './TimelineScrubber';
import { PropertiesPanel } from './PropertiesPanel';
import { AddMediaOverlayDialog } from './AddMediaOverlayDialog';
import { RenderSettingsDialog } from '@/routes/video-api-studio/-components/RenderSettingsDialog';
import {
    requestVideoRender,
    getRenderStatus,
    getVideoUrls,
    type RenderSettings,
} from '@/routes/video-api-studio/-services/video-generation';
import { toast } from 'sonner';

interface VideoEditorPageProps extends InitParams {}

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
        isLoading,
        error,
        meta,
        dirtyEntryIds,
        entryTransforms,
        past,
        future,
        isPreviewMode,
        togglePreviewMode,
        isSaving,
        saveChanges,
        undo,
        redo,
    } = useVideoEditorStore();

    const [entriesPanelOpen, setEntriesPanelOpen] = useState(true);
    const [addMediaOpen, setAddMediaOpen] = useState(false);
    const [renderSettingsOpen, setRenderSettingsOpen] = useState(false);

    // Render state
    const [renderState, setRenderState] = useState<RenderState>('idle');
    const [renderProgress, setRenderProgress] = useState(0);
    const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null);
    const [, setRenderJobId] = useState<string | null>(null);

    const pollCountRef = useRef(0);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const canvasW = meta.dimensions?.width ?? 1920;
    const canvasH = meta.dimensions?.height ?? 1080;
    const isPortrait = canvasH > canvasW;

    // ── Bootstrap ──────────────────────────────────────────────────────────
    useEffect(() => {
        init(props);
    }, [props.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadTimeline();
    }, [props.htmlUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Resume render job on mount ─────────────────────────────────────────
    useEffect(() => {
        if (!props.apiKey || !props.videoId) return;

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

            const poll = async () => {
                if (pollCountRef.current >= RENDER_MAX_POLLS) {
                    setRenderState('error');
                    if (props.videoId) clearRenderJob(props.videoId);
                    return;
                }
                pollCountRef.current++;

                try {
                    const status = await getRenderStatus(jobId, props.apiKey!);

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
                    // Network hiccup — keep polling
                    pollTimerRef.current = setTimeout(poll, RENDER_POLL_INTERVAL);
                }
            };

            pollTimerRef.current = setTimeout(poll, RENDER_POLL_INTERVAL);
        },
        [props.apiKey, props.videoId]
    );

    // Clear polling timer on unmount
    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    // ── Render trigger ─────────────────────────────────────────────────────
    const handleRenderConfirm = useCallback(
        async (settings: RenderSettings) => {
            if (!props.apiKey || !props.videoId) return;
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
        [props.apiKey, props.videoId, startRenderPolling]
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
        Object.values(entryTransforms).some(
            (t) => t.x !== 0 || t.y !== 0 || t.scale !== 1 || t.rotation !== 0
        );

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    const handleBack = useCallback(() => {
        navigate({ to: '/video-api-studio' });
    }, [navigate]);

    const handleSave = useCallback(async () => {
        try {
            await saveChanges();
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
            return (
                <div
                    className="flex h-7 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3"
                    title={`Rendering: ${renderProgress}%`}
                >
                    <Loader2 className="size-3 animate-spin text-blue-500" />
                    <span className="text-xs text-blue-700">
                        {renderProgress > 0 ? `${renderProgress}%` : 'Queued…'}
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
        <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-gray-200 bg-white px-3">
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

            {/* Add media overlay */}
            <Button
                variant="ghost"
                size="icon"
                className="size-8 text-gray-500 hover:text-gray-900"
                title="Add media overlay"
                onClick={() => setAddMediaOpen(true)}
            >
                <ImagePlus className="size-4" />
            </Button>

            {/* Save */}
            <Button
                size="sm"
                variant="outline"
                className="h-7 border-gray-300 px-3 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30"
                disabled={!isDirty || isSaving}
                title={
                    !props.apiKey
                        ? 'API key required to save to backend; changes saved locally'
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
                    </>
                )}
            </Button>

            {/* Render MP4 */}
            {renderButton}

            {/* Preview toggle */}
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
    );

    // ── Preview mode: full AIContentPlayer ────────────────────────────────
    if (isPreviewMode) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
                {toolbar}
                <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
                    <div
                        className="size-full overflow-hidden rounded-xl"
                        style={{ aspectRatio: `${canvasW}/${canvasH}`, maxHeight: '100%' }}
                    >
                        <AIContentPlayer
                            timelineUrl={props.htmlUrl}
                            audioUrl={props.audioUrl}
                            wordsUrl={props.wordsUrl}
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
            <AddMediaOverlayDialog open={addMediaOpen} onClose={() => setAddMediaOpen(false)} />
            <RenderSettingsDialog
                open={renderSettingsOpen}
                onOpenChange={setRenderSettingsOpen}
                onConfirm={handleRenderConfirm}
                isPortrait={isPortrait}
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

            <div className="flex flex-1 overflow-hidden">
                {/* Entry list — collapsible left panel */}
                {entriesPanelOpen && (
                    <div className="w-52 shrink-0 overflow-hidden">
                        <EntryListPanel />
                    </div>
                )}

                {/* Canvas — fills remaining space, maintains aspect ratio internally */}
                <div className="min-w-0 flex-1 overflow-hidden">
                    <EditorCanvas />
                </div>

                {/* Properties panel — right column */}
                <PropertiesPanel />
            </div>

            <TimelineScrubber />
        </div>
    );
}
