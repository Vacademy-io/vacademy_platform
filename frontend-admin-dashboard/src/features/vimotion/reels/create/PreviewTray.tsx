/**
 * Slide-up drawer for Gate 2 (preview) + Gate 3 (render).
 *
 * Flow:
 *   1. Mounts open with `candidateIds` set → fires `usePreview` mutation
 *   2. Loading state until LLM enrichment lands (typically 2-5s for N
 *      candidates running in parallel server-side)
 *   3. Renders one expanded card per enriched candidate showing a playable
 *      source-segment preview, title, rationale, cut-plan visualization,
 *      predicted output duration
 *   4. Renders are fire-and-forget: "Render all (N)" in the header or the
 *      per-card "Render this clip" button POSTs /render WITHOUT navigating
 *      away or closing the tray. Each card then shows a live status chip
 *      (Queued / Rendering N% / Done / Failed) fed by the reels-list
 *      poller, so the user can queue many renders in one pass and keep
 *      their selection + config the whole time.
 *
 * Config: one shared `RenderConfigPanel` sits above the cards. The same
 * config is applied to whichever candidates the user renders — matches how
 * scan params work and how every competing product (Opus / Vizard / Klap)
 * frames it. The config is persisted per institute so it survives sessions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
    AlertCircle,
    ArrowUpRight,
    CheckCircle2,
    Clapperboard,
    Clock,
    Film,
    Scissors,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import type {
    CutSpan,
    EnrichedCandidate,
    ReelCandidate,
    ReelResponse,
} from '../services/reels-api';
import { usePreview } from '../hooks/usePreview';
import { useRender } from '../hooks/useRender';
import { useReelsList } from '../hooks/useReelsList';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { SegmentPlayer } from './SegmentPlayer';
import { WordImportanceTimeline } from './WordImportanceTimeline';
import {
    loadStoredRenderConfig,
    persistRenderConfig,
    RenderConfigPanel,
    type RenderConfigValue,
} from './RenderConfigPanel';

interface PreviewTrayProps {
    open: boolean;
    onClose: () => void;
    apiKey: string | undefined;
    inputAssetId: string;
    /** Original (un-enriched) candidates for the picked ids — used to look up
     *  source window bounds when rendering the cut-plan timeline. */
    candidatesById: Map<string, ReelCandidate>;
    /** User's picked candidate_ids (from ScanResultsGrid selection). */
    candidateIds: string[];
    /** Playable URL of the source video — powers the per-card segment
     *  preview. Null while the asset record is still loading (or when the
     *  asset has no playable URL); the cards degrade to poster-only. */
    sourceVideoUrl: string | null;
}

/** Where a candidate's render currently stands, from the tray's view.
 *  `starting` = POST /render in flight; `started` = accepted, tracked by
 *  reel id via the list poller; `start_failed` = the POST itself errored. */
type RenderLaunch =
    | { phase: 'starting' }
    | { phase: 'started'; reelId: string }
    | { phase: 'start_failed'; error: string };

export function PreviewTray({
    open,
    onClose,
    apiKey,
    inputAssetId,
    candidatesById,
    candidateIds,
    sourceVideoUrl,
}: PreviewTrayProps) {
    const instituteId = getInstituteId();
    const preview = usePreview({ apiKey });
    const render = useRender({ apiKey });

    // Tray-level render config — applies to whichever cards the user renders.
    // Hydrated from localStorage (per institute) so the user's choices stick
    // across visits; every change is written back immediately.
    const [renderConfig, setRenderConfig] = useState<RenderConfigValue>(() =>
        loadStoredRenderConfig(instituteId)
    );
    const handleConfigChange = useCallback(
        (next: RenderConfigValue) => {
            setRenderConfig(next);
            persistRenderConfig(instituteId, next);
        },
        [instituteId]
    );

    // Per-candidate render launches. The tray stays mounted while the page
    // lives (it early-returns null when closed), so chips survive the user
    // closing/reopening the tray mid-batch.
    const [launches, setLaunches] = useState<Record<string, RenderLaunch>>({});
    const setLaunch = useCallback((candidateId: string, launch: RenderLaunch) => {
        setLaunches((prev) => ({ ...prev, [candidateId]: launch }));
    }, []);

    // Live reel statuses for this asset. The list poller stops by itself
    // once every reel reaches a terminal state, so keeping it always-on is
    // one cheap GET when nothing is rendering — and it lets status chips
    // reappear for renders started in an earlier session.
    const reelsList = useReelsList({
        apiKey,
        instituteId,
        inputAssetId,
    });

    // candidate_id → freshest matching reel. Launch-tracked reel ids are
    // authoritative (they came straight from the POST /render response);
    // candidate_id matching backfills reels started in an earlier session
    // so chips reappear after a page reload.
    const reelByCandidate = useMemo(() => {
        const map = new Map<string, ReelResponse>();
        const reels = reelsList.data ?? [];
        const byReelId = new Map(reels.map((r) => [r.reel_id, r]));
        for (const r of reels) {
            if (!r.candidate_id) continue;
            const existing = map.get(r.candidate_id);
            if (!existing || (r.created_at ?? '') > (existing.created_at ?? '')) {
                map.set(r.candidate_id, r);
            }
        }
        for (const [candidateId, launch] of Object.entries(launches)) {
            if (launch.phase !== 'started') continue;
            const reel = byReelId.get(launch.reelId);
            if (reel) map.set(candidateId, reel);
        }
        return map;
    }, [reelsList.data, launches]);

    // Fire the /preview mutation when the drawer opens with a non-empty
    // selection. Idempotent via the backend's `enriched` cache — re-opening
    // the same selection is essentially free.
    useEffect(() => {
        if (!open || candidateIds.length === 0 || !apiKey) return;
        preview.mutate({
            input_asset_id: inputAssetId,
            candidate_ids: candidateIds,
        });
        // mutate's identity changes per render — exclude to avoid re-fires;
        // we deliberately want this to fire once per (open, ids) pair.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, candidateIds.join('|'), inputAssetId, apiKey]);

    // Synchronous guard against double-submitting one candidate. `launches`
    // updates on the next React render after `mutate()`, which leaves a
    // small window where a fast second click can fire a duplicate POST.
    // The ref-based set closes it; the backend dedup catches anything that
    // slips past (different tab, etc.).
    const inFlightRef = useRef<Set<string>>(new Set());

    /** Soft validation shared by per-card and batch renders: nudge the user
     *  to fill in URLs they asked for. Backend would silently fall back to
     *  defaults if these are missing, but that's a worse UX than telling
     *  them why their choice didn't take effect. */
    const validateConfig = (): boolean => {
        if (
            renderConfig.audio_strategy === 'keep_speaker_plus_bgm'
            && !renderConfig.background_music_url
        ) {
            toast.error(
                'Add a background music URL or switch back to "Speaker only".'
            );
            return false;
        }
        if (
            (renderConfig.layout === 'stacked_speaker_with_broll'
                || renderConfig.layout === 'pip_corner_speaker')
            && renderConfig.bgv_source === 'url'
            && !renderConfig.background_video_url
        ) {
            // Only enforce URL when the user explicitly picked "Use URL"
            // mode. Auto mode is fine without one — backend fetches at
            // DIRECTOR time. If the backend can't find a Pexels match, it
            // silently downgrades to full_speaker_with_overlays.
            toast.error(
                'Add a b-roll video URL or switch to "Auto" source.'
            );
            return false;
        }
        return true;
    };

    /** Fire one render POST and track its lifecycle. Never navigates.
     *  Resolves to `null` on success, an error message on failure. */
    const startRender = useCallback(
        async (
            enriched: EnrichedCandidate,
            cutPlanOverrides?: CutSpan[],
        ): Promise<string | null> => {
            const candidateId = enriched.candidate_id;
            if (inFlightRef.current.has(candidateId)) return null;
            inFlightRef.current.add(candidateId);
            setLaunch(candidateId, { phase: 'starting' });
            try {
                const reel = await render.mutateAsync({
                    input_asset_id: inputAssetId,
                    candidate_id: candidateId,
                    layout: renderConfig.layout,
                    aspect: renderConfig.aspect,
                    pace: renderConfig.pace,
                    audio_strategy: renderConfig.audio_strategy,
                    background_music_url: renderConfig.background_music_url,
                    background_video_url: renderConfig.background_video_url,
                    ducking: renderConfig.ducking,
                    captions: renderConfig.captions,
                    cut_plan_overrides:
                        cutPlanOverrides && cutPlanOverrides.length > 0
                            ? cutPlanOverrides
                            : undefined,
                });
                setLaunch(candidateId, { phase: 'started', reelId: reel.reel_id });
                return null;
            } catch (e) {
                const message =
                    e instanceof Error ? e.message : 'Render failed to start';
                setLaunch(candidateId, { phase: 'start_failed', error: message });
                return message;
            } finally {
                inFlightRef.current.delete(candidateId);
            }
        },
        [inputAssetId, render, renderConfig, setLaunch]
    );

    const handleRenderOne = (
        enriched: EnrichedCandidate,
        cutPlanOverrides?: CutSpan[],
    ) => {
        if (!validateConfig()) return;
        void startRender(enriched, cutPlanOverrides).then((error) => {
            if (error === null) {
                toast.success('Render started — progress shows on the card.');
            } else {
                toast.error(`Couldn't start render: ${error}`);
            }
        });
    };

    /** Candidates "Render all" would still submit: never launched, or whose
     *  previous attempt failed (start error or FAILED reel). Queued/active/
     *  completed candidates are left alone — re-rendering them is an explicit
     *  per-card action. */
    const remainingForBatch = useMemo(() => {
        const enriched = preview.data?.enriched ?? [];
        return enriched.filter((e) => {
            const launch = launches[e.candidate_id];
            if (!launch) return true;
            if (launch.phase === 'starting') return false;
            if (launch.phase === 'start_failed') return true;
            const reel = reelByCandidate.get(e.candidate_id);
            return reel?.status === 'FAILED';
        });
    }, [preview.data, launches, reelByCandidate]);

    const [batchRunning, setBatchRunning] = useState(false);
    const handleRenderAll = async () => {
        if (batchRunning || remainingForBatch.length === 0) return;
        if (!validateConfig()) return;
        setBatchRunning(true);
        let started = 0;
        try {
            // Sequential on purpose: each POST returns in well under a second
            // and ordering keeps the toasts/chips deterministic. The backend
            // renders the queue in parallel regardless.
            for (const enriched of remainingForBatch) {
                const error = await startRender(enriched);
                if (error === null) started += 1;
            }
        } finally {
            setBatchRunning(false);
        }
        if (started > 0) {
            toast.success(
                `${started} render${started === 1 ? '' : 's'} started — track progress on the cards or in the Reels tab.`
            );
        } else {
            toast.error("Couldn't start any renders — check the card statuses.");
        }
    };

    const anyStarting =
        batchRunning
        || Object.values(launches).some((l) => l.phase === 'starting');

    if (!open) return null;

    return (
        <>
            {/* Backdrop — click to close */}
            <div
                className="fixed inset-0 z-40 bg-black/40 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Drawer */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Preview selected reel candidates"
                className={cn(
                    'fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl',
                    'flex flex-col'
                )}
            >
                <PreviewTrayHeader
                    count={candidateIds.length}
                    enrichedCount={preview.data?.enriched.length ?? 0}
                    renderAllCount={remainingForBatch.length}
                    renderAllBusy={anyStarting}
                    onRenderAll={() => void handleRenderAll()}
                    onClose={onClose}
                />
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <PreviewTrayBody
                        preview={preview}
                        candidatesById={candidatesById}
                        sourceVideoUrl={sourceVideoUrl}
                        onRender={handleRenderOne}
                        launches={launches}
                        reelByCandidate={reelByCandidate}
                        configLocked={anyStarting}
                        renderConfig={renderConfig}
                        onConfigChange={handleConfigChange}
                    />
                </div>
            </aside>
        </>
    );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function PreviewTrayHeader({
    count,
    enrichedCount,
    renderAllCount,
    renderAllBusy,
    onRenderAll,
    onClose,
}: {
    count: number;
    enrichedCount: number;
    renderAllCount: number;
    renderAllBusy: boolean;
    onRenderAll: () => void;
    onClose: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4">
            <div className="min-w-0">
                <h2 className="text-base font-semibold text-neutral-900">
                    Preview {enrichedCount > 0 ? enrichedCount : count} clip
                    {count === 1 ? '' : 's'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                    Play each clip and review its cut plan — then render the ones you like.
                    You stay right here while they render.
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {enrichedCount > 0 && (
                    <button
                        type="button"
                        onClick={onRenderAll}
                        disabled={renderAllBusy || renderAllCount === 0}
                        className={cn(
                            'inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow-sm transition-colors',
                            renderAllBusy || renderAllCount === 0
                                ? 'cursor-not-allowed bg-neutral-400'
                                : 'bg-neutral-900 hover:bg-neutral-800'
                        )}
                        title={
                            renderAllCount === 0
                                ? 'Every clip here is already rendering or done'
                                : 'Start a render for every clip below with the current settings'
                        }
                    >
                        {renderAllBusy ? (
                            <VimotionLoader size={16} className="text-white" label="Starting" />
                        ) : (
                            <Clapperboard className="size-4" />
                        )}
                        {renderAllBusy
                            ? 'Starting…'
                            : `Render all (${renderAllCount})`}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
                    aria-label="Close preview"
                >
                    <X className="size-5" />
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Body — switches on preview mutation state
// ---------------------------------------------------------------------------

function PreviewTrayBody({
    preview,
    candidatesById,
    sourceVideoUrl,
    onRender,
    launches,
    reelByCandidate,
    configLocked,
    renderConfig,
    onConfigChange,
}: {
    preview: ReturnType<typeof usePreview>;
    candidatesById: Map<string, ReelCandidate>;
    sourceVideoUrl: string | null;
    onRender: (enriched: EnrichedCandidate, cutPlanOverrides?: CutSpan[]) => void;
    launches: Record<string, RenderLaunch>;
    reelByCandidate: Map<string, ReelResponse>;
    configLocked: boolean;
    renderConfig: RenderConfigValue;
    onConfigChange: (next: RenderConfigValue) => void;
}) {
    if (preview.isPending) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-neutral-500">
                <VimotionLoader size={56} className="text-neutral-900" label="Enriching with AI" />
                <p className="font-medium text-neutral-900">Preparing your clips…</p>
                <p className="max-w-md text-center text-xs">
                    Writing titles and planning the tightest cut for each clip.
                    Usually takes a couple seconds.
                </p>
            </div>
        );
    }

    if (preview.isError) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 text-red-600" />
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-800">Preview failed</h3>
                        <p className="mt-1 text-sm text-red-700">
                            {preview.error?.message ?? 'Unknown error'}
                        </p>
                        <button
                            type="button"
                            onClick={() => preview.reset()}
                            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const enriched = preview.data?.enriched ?? [];
    if (enriched.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
                These clips are no longer available — they may have aged out since the
                scan. Run a fresh scan and pick again.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <RenderConfigPanel
                value={renderConfig}
                onChange={onConfigChange}
                disabled={configLocked}
            />
            {enriched.map((e) => (
                <EnrichedCard
                    key={e.candidate_id}
                    enriched={e}
                    source={candidatesById.get(e.candidate_id)}
                    sourceVideoUrl={sourceVideoUrl}
                    onRender={(overrides) => onRender(e, overrides)}
                    launch={launches[e.candidate_id]}
                    reel={reelByCandidate.get(e.candidate_id)}
                />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Single enriched-candidate card inside the tray
// ---------------------------------------------------------------------------

/** Group consecutive user-cut word indices into contiguous CutSpans of
 *  kind="user". Two indices are "consecutive" when the next word's t_start
 *  is within MERGE_GAP_S of the previous word's t_end (handles tiny gaps
 *  between adjacent words in the transcript without breaking the span).
 *  Returns spans sorted by t_start, matching the server-side validator's
 *  expectation. */
const MERGE_GAP_S = 0.10;
/** PB5: matches MIN_CUT_SPAN_S in reels_preview_service.py. A user-cut
 *  span shorter than this fails server-side validation, so we pre-check on
 *  the FE and surface a clear toast instead of letting the user discover
 *  it via a 400 response. */
const MIN_USER_CUT_SPAN_S = 0.08;
function buildUserCutSpans(
    words: EnrichedCandidate['word_importance'],
    userCutIndices: ReadonlySet<number>,
): CutSpan[] {
    if (userCutIndices.size === 0) return [];
    const sortedIdx = Array.from(userCutIndices)
        .filter((i) => i >= 0 && i < words.length)
        .sort((a, b) => a - b);
    if (sortedIdx.length === 0) return [];
    const spans: CutSpan[] = [];
    let curStart = words[sortedIdx[0]!]!.t_start;
    let curEnd = words[sortedIdx[0]!]!.t_end;
    for (let k = 1; k < sortedIdx.length; k++) {
        const w = words[sortedIdx[k]!]!;
        if (w.t_start - curEnd <= MERGE_GAP_S) {
            curEnd = Math.max(curEnd, w.t_end);
        } else {
            spans.push({ t_start: curStart, t_end: curEnd, kind: 'user' });
            curStart = w.t_start;
            curEnd = w.t_end;
        }
    }
    spans.push({ t_start: curStart, t_end: curEnd, kind: 'user' });
    return spans;
}

function EnrichedCard({
    enriched,
    source,
    sourceVideoUrl,
    onRender,
    launch,
    reel,
}: {
    enriched: EnrichedCandidate;
    source: ReelCandidate | undefined;
    sourceVideoUrl: string | null;
    onRender: (overrides?: CutSpan[]) => void;
    launch: RenderLaunch | undefined;
    reel: ReelResponse | undefined;
}) {
    // We need the original source window to compute the cut-plan timeline's
    // 0..100% domain. Falls back to the kept/cut spans' min-max if the
    // source card isn't in the map (defensive).
    const { sourceStartS, sourceEndS } = useMemo(() => {
        if (source) {
            return {
                sourceStartS: source.source_t_start,
                sourceEndS: source.source_t_end,
            };
        }
        // Defensive fallback: derive from word_importance bounds.
        const words = enriched.word_importance;
        const first = words[0];
        const last = words[words.length - 1];
        if (first && last) {
            return {
                sourceStartS: first!.t_start,
                sourceEndS: last!.t_end,
            };
        }
        return { sourceStartS: 0, sourceEndS: 0 };
    }, [source, enriched.word_importance]);

    // B4 — edit-cuts mode + user-toggled word indices.
    const [editMode, setEditMode] = useState(false);
    const [userCutIndices, setUserCutIndices] = useState<Set<number>>(new Set());

    const handleToggleWord = useCallback((wordIdx: number) => {
        setUserCutIndices((prev) => {
            const next = new Set(prev);
            if (next.has(wordIdx)) next.delete(wordIdx);
            else next.add(wordIdx);
            return next;
        });
    }, []);

    // Live duration recompute. The server's `predicted_output_duration_s`
    // is post-cuts but PRE-speedup (see reels_preview_service.py L505),
    // matching the existing display semantics. So we just subtract the
    // raw source-time of user cuts — same scale. Speed multiplier is
    // applied later at render and intentionally isn't reflected in either
    // baseline or live numbers (pre-existing UX).
    const overrides = useMemo(
        () => buildUserCutSpans(enriched.word_importance, userCutIndices),
        [enriched.word_importance, userCutIndices],
    );
    const overrideRawSeconds = overrides.reduce(
        (acc, s) => acc + (s.t_end - s.t_start),
        0,
    );
    const liveDuration = Math.max(
        0,
        enriched.predicted_output_duration_s - overrideRawSeconds,
    );

    // Render lifecycle for THIS card only — other cards stay interactive.
    const isStarting = launch?.phase === 'starting';
    const startError = launch?.phase === 'start_failed' ? launch.error : null;
    const isQueuedOrRendering =
        !!reel && (reel.status === 'PENDING' || reel.status === 'IN_PROGRESS');
    const isDone = reel?.status === 'COMPLETED';
    const isFailed = reel?.status === 'FAILED' || !!startError;
    const renderButtonLabel = isStarting
        ? 'Starting…'
        : isFailed
            ? 'Try again'
            : isDone
                ? 'Render again'
                : 'Render this clip';
    // Re-submitting while the backend is already rendering this candidate
    // would just hit the dedup check — disable until it lands.
    const renderDisabled = isStarting || isQueuedOrRendering;

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row">
                {/* Playable source segment in a vertical frame approximating
                    the 9:16 crop. object-cover center-crops the 16:9 source,
                    which is where the renderer's default framing lands.
                    Layout-only inline aspect-ratio — Tailwind has no built-in
                    9/16 utility and arbitrary values are off-limits. */}
                <div
                    className="w-36 shrink-0 self-start overflow-hidden rounded-lg bg-neutral-100"
                    style={{ aspectRatio: '9 / 16' }}
                >
                    {sourceVideoUrl ? (
                        <SegmentPlayer
                            src={sourceVideoUrl}
                            tStart={sourceStartS}
                            tEnd={sourceEndS}
                            poster={source?.thumbnail_strip_url}
                            className="size-full"
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center text-neutral-400">
                            <Film className="size-8" />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-neutral-900">
                                    {enriched.title}
                                </h3>
                                <RenderStatusChip
                                    isStarting={isStarting}
                                    startError={startError}
                                    reel={reel}
                                />
                            </div>
                            <p className="mt-1 text-sm text-neutral-600">{enriched.rationale}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                                <span>
                                    Predicted output:{' '}
                                    <span
                                        className={cn(
                                            'font-medium',
                                            overrides.length > 0
                                                ? 'text-orange-700'
                                                : 'text-neutral-900',
                                        )}
                                    >
                                        {liveDuration.toFixed(1)}s
                                    </span>
                                    {overrides.length > 0 && (
                                        <span className="ml-1 text-neutral-500">
                                            (was {enriched.predicted_output_duration_s.toFixed(1)}s)
                                        </span>
                                    )}
                                </span>
                                <span>·</span>
                                <span>
                                    {enriched.word_importance.length} word
                                    {enriched.word_importance.length === 1 ? '' : 's'}
                                </span>
                                <span>·</span>
                                <span>
                                    {enriched.cut_plan.length} auto cut
                                    {enriched.cut_plan.length === 1 ? '' : 's'}
                                </span>
                                {overrides.length > 0 && (
                                    <>
                                        <span>·</span>
                                        <span className="text-orange-700">
                                            {overrides.length} user cut
                                            {overrides.length === 1 ? '' : 's'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {editMode && userCutIndices.size > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setUserCutIndices(new Set())}
                                    disabled={isStarting}
                                    className={cn(
                                        'inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50',
                                        isStarting && 'cursor-not-allowed opacity-60',
                                    )}
                                    title="Clear all user cuts on this clip"
                                >
                                    Clear cuts
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setEditMode((v) => !v)}
                                disabled={isStarting}
                                className={cn(
                                    'inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
                                    editMode
                                        ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                                    isStarting && 'cursor-not-allowed opacity-60',
                                )}
                                title={
                                    editMode
                                        ? 'Exit edit-cuts mode (cuts are preserved)'
                                        : 'Click low-importance words in the transcript to add user cuts'
                                }
                            >
                                <Scissors className="size-4" />
                                {editMode ? 'Done editing' : 'Edit cuts'}
                            </button>
                            {isDone && reel && (
                                <Link
                                    to="/vim/reels/$reelId"
                                    params={{ reelId: reel.reel_id }}
                                    className="inline-flex h-10 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                                >
                                    <ArrowUpRight className="size-4" />
                                    View reel
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    // PB5: pre-check span durations match server's
                                    // MIN_CUT_SPAN_S so the user gets an actionable
                                    // toast instead of a 400 response.
                                    const shortSpan = overrides.find(
                                        (s) => s.t_end - s.t_start < MIN_USER_CUT_SPAN_S,
                                    );
                                    if (shortSpan) {
                                        const ms = Math.round(
                                            (shortSpan.t_end - shortSpan.t_start) * 1000,
                                        );
                                        toast.error(
                                            `One of your cuts is only ${ms}ms long. Include adjacent words to extend the cut to at least ${MIN_USER_CUT_SPAN_S * 1000}ms.`,
                                        );
                                        return;
                                    }
                                    onRender(overrides.length > 0 ? overrides : undefined);
                                }}
                                disabled={renderDisabled}
                                className={cn(
                                    'inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow-sm transition-colors',
                                    renderDisabled
                                        ? 'cursor-not-allowed bg-neutral-400'
                                        : 'bg-neutral-900 hover:bg-neutral-800'
                                )}
                            >
                                {isStarting ? (
                                    <VimotionLoader size={16} className="text-white" label="Starting" />
                                ) : (
                                    <CheckCircle2 className="size-4" />
                                )}
                                {renderButtonLabel}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4">
                        <WordImportanceTimeline
                            sourceStartS={sourceStartS}
                            sourceEndS={sourceEndS}
                            words={enriched.word_importance}
                            cuts={enriched.cut_plan}
                            editable={editMode}
                            userCutIndices={userCutIndices}
                            onToggleWordCut={handleToggleWord}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Live render status for one card: Queued → Rendering N% → Done / Failed.
 *  Nothing is shown before the first render attempt. */
function RenderStatusChip({
    isStarting,
    startError,
    reel,
}: {
    isStarting: boolean;
    startError: string | null;
    reel: ReelResponse | undefined;
}) {
    if (isStarting) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                <VimotionLoader size={11} className="text-neutral-700" label="Starting" />
                Starting…
            </span>
        );
    }
    if (startError) {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                title={startError}
            >
                <AlertCircle className="size-3" />
                Couldn&rsquo;t start
            </span>
        );
    }
    if (!reel) return null;
    if (reel.status === 'PENDING') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                <Clock className="size-3" />
                Queued
            </span>
        );
    }
    if (reel.status === 'IN_PROGRESS') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                <VimotionLoader size={11} className="text-blue-700" label="Rendering" />
                Rendering {reel.progress || 0}%
            </span>
        );
    }
    if (reel.status === 'COMPLETED') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3" />
                Done
            </span>
        );
    }
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
            title={reel.error_message ?? undefined}
        >
            <AlertCircle className="size-3" />
            Failed
        </span>
    );
}
