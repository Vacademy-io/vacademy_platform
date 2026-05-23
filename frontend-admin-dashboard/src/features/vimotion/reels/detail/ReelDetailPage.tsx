/**
 * `/vim/reels/$reelId` — the detail / status page.
 *
 * Three render branches, all gated on `useReel`:
 *   - IN_PROGRESS / PENDING → live stage progress + adaptive polling
 *   - COMPLETED            → final MP4 + Open-in-editor + Download CTAs
 *   - FAILED               → error message + retry path back to picker
 *
 * Editor handoff search params built from the reel's persisted artifacts
 * — see VIDEO_EDITOR_REVIEW.md §1.2 for the contract. We pass `kind=reel`
 * so the editor's saveChanges routes /frame/{add,update,delete} to
 * /external/reels/v1/frame/* (which updates `ai_reels.s3_urls.time_based_frame`)
 * rather than the AI-gen-video table.
 */
import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    AlertCircle,
    ChevronLeft,
    Download,
    Edit3,
    PlayCircle,
    Scissors,
    Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from '../../dashboard/hooks/useVimotionApiKey';
import { useReel } from '../hooks/useReel';
import { deleteReel, type ReelResponse } from '../services/reels-api';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { StageProgressList } from './StageProgressList';

interface ReelDetailPageProps {
    reelId: string;
}

export function ReelDetailPage({ reelId }: ReelDetailPageProps) {
    const navigate = useNavigate();
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);
    const reelQuery = useReel({ apiKey: apiKey.data, reelId });

    const goBackToList = () =>
        navigate({ to: '/vim/dashboard', search: { tab: 'reels' } });

    return (
        <div className="min-h-screen bg-[#FAFAF7]">
            <header className="border-b border-neutral-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
                    <button
                        type="button"
                        onClick={goBackToList}
                        className="inline-flex items-center gap-1 rounded-md p-1 text-sm text-neutral-600 hover:bg-neutral-100"
                    >
                        <ChevronLeft className="size-4" />
                        Reels
                    </button>
                    <div className="h-4 w-px bg-neutral-200" />
                    <h1 className="font-mono text-sm text-neutral-700">{reelId}</h1>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-8">
                {apiKey.isLoading || reelQuery.isLoading ? (
                    <CenteredLoader message="Loading reel…" />
                ) : reelQuery.isError ? (
                    <ErrorPanel message={reelQuery.error?.message ?? 'Failed to load reel'} />
                ) : reelQuery.data ? (
                    <ReelDetailBody reel={reelQuery.data} apiKey={apiKey.data ?? ''} />
                ) : null}
            </main>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Body — switches on status
// ---------------------------------------------------------------------------

function ReelDetailBody({ reel, apiKey }: { reel: ReelResponse; apiKey: string }) {
    if (reel.status === 'COMPLETED') {
        return <CompletedBody reel={reel} apiKey={apiKey} />;
    }
    if (reel.status === 'FAILED') {
        return <FailedBody reel={reel} apiKey={apiKey} />;
    }
    // PENDING or IN_PROGRESS.
    return <RunningBody reel={reel} />;
}

// ---------------------------------------------------------------------------
// Running — stage progress + overall bar
// ---------------------------------------------------------------------------

function RunningBody({ reel }: { reel: ReelResponse }) {
    const title = getTitle(reel);
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
                <header>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                        <VimotionLoader size={12} className="text-blue-700" label="Rendering" />
                        Rendering · {reel.progress}%
                    </span>
                    <h2 className="mt-3 text-xl font-semibold text-neutral-900">{title}</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        We poll every 3 seconds — leave this page open or check back later
                        from the Reels tab.
                    </p>
                </header>

                <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                            className="h-full bg-neutral-900 transition-all"
                            style={{ width: `${reel.progress}%` }}
                        />
                    </div>
                </div>

                <section>
                    <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                        Pipeline stages
                    </h3>
                    <StageProgressList reel={reel} />
                </section>
            </div>

            <aside className="space-y-3">
                <h3 className="text-sm font-semibold text-neutral-900">Source clip</h3>
                <SourceClipFacts reel={reel} />
            </aside>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Completed — video player + CTAs
// ---------------------------------------------------------------------------

function CompletedBody({ reel, apiKey }: { reel: ReelResponse; apiKey: string }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const videoUrl = reel.s3_urls?.video;
    const title = getTitle(reel);
    const aspect = (reel.config?.aspect as string | undefined) ?? '9:16';
    const isVertical = aspect === '9:16';

    const editorSearch = useMemo(
        () => buildEditorSearch(reel, apiKey),
        [reel, apiKey]
    );

    const openInEditor = () => {
        if (!editorSearch) {
            toast.error('Missing artifacts — cannot open in editor.');
            return;
        }
        navigate({
            to: '/vim/edit/$videoId',
            params: { videoId: reel.reel_id },
            search: editorSearch,
        });
    };

    const handleDelete = async () => {
        if (!confirm('Delete this reel? The rendered MP4 stays in S3.')) return;
        try {
            await deleteReel(apiKey, reel.reel_id);
            toast.success('Reel deleted');
            queryClient.invalidateQueries({ queryKey: ['reels-list'] });
            navigate({ to: '/vim/dashboard', search: { tab: 'reels' } });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Delete failed');
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div
                className={cn(
                    'lg:col-span-2 flex flex-col items-center',
                    isVertical ? 'lg:col-span-1' : 'lg:col-span-2'
                )}
            >
                <div
                    className={cn(
                        'overflow-hidden rounded-xl bg-black shadow-lg',
                        isVertical ? 'aspect-[9/16] max-w-sm w-full' : 'aspect-video w-full'
                    )}
                >
                    {videoUrl ? (
                        <video
                            src={videoUrl}
                            controls
                            playsInline
                            className="size-full object-cover"
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center text-white">
                            <PlayCircle className="size-12" />
                        </div>
                    )}
                </div>
            </div>

            <aside
                className={cn(
                    'space-y-5',
                    isVertical ? 'lg:col-span-2' : 'lg:col-span-1'
                )}
            >
                <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                        Ready
                    </span>
                    <h2 className="mt-3 text-xl font-semibold text-neutral-900">{title}</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                        {(reel.config?.enriched_snapshot as { rationale?: string } | undefined)
                            ?.rationale ?? 'Render complete.'}
                    </p>
                </div>

                <ReelFactsList reel={reel} />

                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={openInEditor}
                        disabled={!editorSearch}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Edit3 className="size-4" />
                        Open in editor
                    </button>
                    {videoUrl && (
                        <a
                            href={videoUrl}
                            download={`${reel.reel_id}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
                        >
                            <Download className="size-4" />
                            Download MP4
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="size-4" />
                        Delete reel
                    </button>
                </div>
            </aside>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Failed — clear error + retry path
// ---------------------------------------------------------------------------

function FailedBody({ reel, apiKey }: { reel: ReelResponse; apiKey: string }) {
    void apiKey; // retry-via-/render uses input_asset + candidate, slice 5+
    const navigate = useNavigate();
    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-6 text-red-600" />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-red-800">Render failed</h2>
                        <p className="mt-1 text-sm text-red-700">
                            {reel.error_message ?? 'Unknown error.'}
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    navigate({
                                        to: '/vim/reels/new',
                                        search: {
                                            fromAssetId: reel.input_asset_id,
                                        },
                                    })
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                            >
                                Pick another candidate from this video
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    navigate({ to: '/vim/dashboard', search: { tab: 'reels' } })
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                                Back to reels
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <section>
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">
                    What had completed
                </h3>
                <StageProgressList reel={reel} />
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Shared facts panels
// ---------------------------------------------------------------------------

function ReelFactsList({ reel }: { reel: ReelResponse }) {
    const window = reel.source_window as
        | { t_start?: number; t_end?: number; original_duration_s?: number }
        | undefined;
    const trim = reel.trim_map as
        | { total_new_duration_s?: number; speed_multiplier?: number }
        | undefined;
    // B5 (2026-05-22) — render-time echo for user-cut renders. Present
    // only when /render received cut_plan_overrides; backend writes the
    // resolved override summary into ai_reels.extra_metadata.
    const meta = (reel.metadata ?? {}) as {
        output_resolution?: { width?: number; height?: number };
        render_duration_s?: number;
        cut_plan_override_count?: number;
        cut_plan_override_total_s?: number;
        final_predicted_duration_s?: number;
    };
    const sourceWindowLabel =
        window?.t_start != null && window?.t_end != null
            ? `${formatHms(window.t_start)} → ${formatHms(window.t_end)}`
            : '—';
    const dims = meta.output_resolution
        ? `${meta.output_resolution.width ?? '?'}×${meta.output_resolution.height ?? '?'}`
        : '—';
    const hasUserCuts =
        typeof meta.cut_plan_override_count === 'number'
        && meta.cut_plan_override_count > 0;
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <Fact label="Aspect" value={(reel.config?.aspect as string) ?? '9:16'} />
            <Fact label="Output" value={dims} />
            <Fact
                label="Length"
                value={
                    trim?.total_new_duration_s != null
                        ? `${trim.total_new_duration_s.toFixed(1)}s`
                        : '—'
                }
            />
            <Fact
                label="Speed"
                value={trim?.speed_multiplier ? `${trim.speed_multiplier.toFixed(2)}×` : '1.00×'}
            />
            <Fact label="Source window" value={sourceWindowLabel} />
            <Fact
                label="Render time"
                value={
                    meta.render_duration_s != null
                        ? `${meta.render_duration_s.toFixed(0)}s`
                        : '—'
                }
            />
            {hasUserCuts && (
                <div className="col-span-2 rounded-md bg-orange-50 px-3 py-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-orange-700">
                        <Scissors className="mr-1 inline size-3" />
                        Your edits
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-orange-900">
                        {meta.cut_plan_override_count} user cut
                        {meta.cut_plan_override_count === 1 ? '' : 's'}
                        {typeof meta.cut_plan_override_total_s === 'number' && (
                            <> · {meta.cut_plan_override_total_s.toFixed(1)}s removed</>
                        )}
                        {typeof meta.final_predicted_duration_s === 'number' && (
                            <span className="ml-2 text-xs text-orange-700">
                                (predicted {meta.final_predicted_duration_s.toFixed(1)}s)
                            </span>
                        )}
                    </dd>
                </div>
            )}
        </dl>
    );
}

function SourceClipFacts({ reel }: { reel: ReelResponse }) {
    const window = reel.source_window as
        | { t_start?: number; t_end?: number }
        | undefined;
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
            <dl className="space-y-2">
                <Fact label="Aspect" value={(reel.config?.aspect as string) ?? '9:16'} />
                <Fact
                    label="Source window"
                    value={
                        window?.t_start != null && window?.t_end != null
                            ? `${formatHms(window.t_start)} → ${formatHms(window.t_end)}`
                            : '—'
                    }
                />
                <Fact
                    label="Candidate"
                    value={
                        <span className="font-mono text-xs text-neutral-600">
                            <Scissors className="mr-1 inline size-3" />
                            {reel.candidate_id?.slice(0, 8) ?? '—'}
                        </span>
                    }
                />
            </dl>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-neutral-900">{value}</dd>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTitle(reel: ReelResponse): string {
    return (
        (reel.config?.enriched_snapshot as { title?: string } | undefined)?.title ??
        reel.reel_id
    );
}

function formatHms(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Build the editor search-param payload for /vim/edit/$videoId from a
 * completed reel. Returns null if any required artifact is missing.
 */
function buildEditorSearch(
    reel: ReelResponse,
    apiKey: string
): {
    htmlUrl: string;
    audioUrl: string | undefined;
    wordsUrl: string | undefined;
    avatarUrl: string | undefined;
    apiKey: string | undefined;
    orientation: string;
    kind: 'reel';
    focusTime: number | undefined;
} | null {
    const htmlUrl = reel.s3_urls?.time_based_frame;
    if (!htmlUrl) return null;
    const audioUrl = reel.s3_urls?.speaker_audio;
    const aspect = (reel.config?.aspect as string | undefined) ?? '9:16';
    const orientation = aspect === '9:16' ? 'portrait' : 'landscape';
    return {
        htmlUrl,
        audioUrl,
        wordsUrl: undefined,
        avatarUrl: undefined,
        apiKey: apiKey || undefined,
        orientation,
        kind: 'reel',
        focusTime: undefined,
    };
}

// ---------------------------------------------------------------------------
// Misc shared panels
// ---------------------------------------------------------------------------

function CenteredLoader({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-neutral-500">
            <VimotionLoader size={56} className="text-neutral-900" label={message} />
            <p>{message}</p>
        </div>
    );
}

function ErrorPanel({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4" />
                {message}
            </div>
        </div>
    );
}
