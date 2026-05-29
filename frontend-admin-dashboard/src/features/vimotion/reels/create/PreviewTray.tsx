/**
 * Slide-up drawer for Gate 2 (preview) + Gate 3 (render).
 *
 * Flow:
 *   1. Mounts open with `candidateIds` set → fires `usePreview` mutation
 *   2. Loading state until LLM enrichment lands (typically 2-5s for N
 *      candidates running in parallel server-side)
 *   3. Renders one expanded card per enriched candidate showing title,
 *      rationale, cut-plan visualization, predicted output duration
 *   4. Per-card "Render this clip" button fires `useRender` with the
 *      tray-level `renderConfig` and navigates to /vim/reels/$reelId
 *
 * Config: one shared `RenderConfigPanel` sits above the cards. The same
 * config is applied to whichever candidate the user renders — matches how
 * scan params work and how every competing product (Opus / Vizard / Klap)
 * frames it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    AlertCircle,
    CheckCircle2,
    Scissors,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type {
    CutSpan,
    EnrichedCandidate,
    ReelCandidate,
} from '../services/reels-api';
import { usePreview } from '../hooks/usePreview';
import { useRender } from '../hooks/useRender';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { WordImportanceTimeline } from './WordImportanceTimeline';
import {
    DEFAULT_RENDER_CONFIG,
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
}

export function PreviewTray({
    open,
    onClose,
    apiKey,
    inputAssetId,
    candidatesById,
    candidateIds,
}: PreviewTrayProps) {
    const navigate = useNavigate();
    const preview = usePreview({ apiKey });
    const render = useRender({ apiKey });

    // Tray-level render config — applies to whichever card the user renders.
    // Default mirrors what we used to hardcode (9:16 / silence-trim on / 1.0× /
    // hormozi captions / speaker-only). The panel sits above the cards.
    const [renderConfig, setRenderConfig] = useState<RenderConfigValue>(
        DEFAULT_RENDER_CONFIG
    );

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

    // Synchronous guard against double-click on "Render this clip".
    // `render.isPending` flips on the next React render after `mutate()`,
    // which leaves a small window where a fast second click can fire a
    // duplicate POST. The ref-based check closes it: any second invocation
    // for the same candidate within the in-flight window is a no-op. The
    // backend dedup catches anything that slips past (different tab, etc.).
    const renderingCandidateRef = useRef<string | null>(null);

    const handleRender = (
        enriched: EnrichedCandidate,
        cutPlanOverrides?: CutSpan[],
    ) => {
        if (renderingCandidateRef.current === enriched.candidate_id) return;
        // Soft validation: nudge the user to fill in URLs they asked for.
        // Backend would silently fall back to defaults if these are missing,
        // but that's a worse UX than telling them why their choice didn't
        // take effect.
        if (
            renderConfig.audio_strategy === 'keep_speaker_plus_bgm'
            && !renderConfig.background_music_url
        ) {
            toast.error(
                'Add a background music URL or switch back to "Speaker only".'
            );
            return;
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
            return;
        }
        renderingCandidateRef.current = enriched.candidate_id;
        render.mutate(
            {
                input_asset_id: inputAssetId,
                candidate_id: enriched.candidate_id,
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
            },
            {
                onSuccess: (reel) => {
                    toast.success('Render started — tracking on detail page');
                    onClose();
                    navigate({
                        to: '/vim/reels/$reelId',
                        params: { reelId: reel.reel_id },
                    });
                },
                onError: (e) => {
                    toast.error(`Couldn't start render: ${e.message}`);
                },
                onSettled: () => {
                    renderingCandidateRef.current = null;
                },
            }
        );
    };

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
                    onClose={onClose}
                />
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <PreviewTrayBody
                        preview={preview}
                        candidatesById={candidatesById}
                        onRender={handleRender}
                        speedMultiplier={renderConfig.pace?.speed_multiplier ?? 1.0}
                        renderInflight={render.isPending}
                        renderingCandidateId={
                            render.isPending ? render.variables?.candidate_id ?? null : null
                        }
                        renderConfig={renderConfig}
                        onConfigChange={setRenderConfig}
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
    onClose,
}: {
    count: number;
    enrichedCount: number;
    onClose: () => void;
}) {
    return (
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <div>
                <h2 className="text-base font-semibold text-neutral-900">
                    Preview {enrichedCount > 0 ? enrichedCount : count} clip
                    {count === 1 ? '' : 's'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                    Review the AI-generated cut plan before triggering a render.
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100"
                aria-label="Close preview"
            >
                <X className="size-5" />
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Body — switches on preview mutation state
// ---------------------------------------------------------------------------

function PreviewTrayBody({
    preview,
    candidatesById,
    onRender,
    speedMultiplier,
    renderInflight,
    renderingCandidateId,
    renderConfig,
    onConfigChange,
}: {
    preview: ReturnType<typeof usePreview>;
    candidatesById: Map<string, ReelCandidate>;
    onRender: (enriched: EnrichedCandidate, cutPlanOverrides?: CutSpan[]) => void;
    speedMultiplier: number;
    renderInflight: boolean;
    renderingCandidateId: string | null;
    renderConfig: RenderConfigValue;
    onConfigChange: (next: RenderConfigValue) => void;
}) {
    if (preview.isPending) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-neutral-500">
                <VimotionLoader size={56} className="text-neutral-900" label="Enriching with AI" />
                <p className="font-medium text-neutral-900">Enriching with AI…</p>
                <p className="max-w-md text-center text-xs">
                    Generating titles, rationales, and surgical cut plans for each clip.
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
                No candidates were enriched. Some may have been silently filtered (e.g. expired
                cache). Try a fresh scan.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <RenderConfigPanel
                value={renderConfig}
                onChange={onConfigChange}
                disabled={renderInflight}
            />
            {enriched.map((e) => (
                <EnrichedCard
                    key={e.candidate_id}
                    enriched={e}
                    source={candidatesById.get(e.candidate_id)}
                    speedMultiplier={speedMultiplier}
                    onRender={(overrides) => onRender(e, overrides)}
                    busy={renderInflight}
                    isRenderingThis={renderingCandidateId === e.candidate_id}
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
    speedMultiplier,
    onRender,
    busy,
    isRenderingThis,
}: {
    enriched: EnrichedCandidate;
    source: ReelCandidate | undefined;
    speedMultiplier: number;
    onRender: (overrides?: CutSpan[]) => void;
    busy: boolean;
    isRenderingThis: boolean;
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

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900">
                        {enriched.title}
                    </h3>
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
                            disabled={busy}
                            className={cn(
                                'inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50',
                                busy && 'cursor-not-allowed opacity-60',
                            )}
                            title="Clear all user cuts on this clip"
                        >
                            Clear cuts
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setEditMode((v) => !v)}
                        disabled={busy}
                        className={cn(
                            'inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
                            editMode
                                ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                            busy && 'cursor-not-allowed opacity-60',
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
                        disabled={busy}
                        className={cn(
                            'inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow-sm transition-colors',
                            busy ? 'cursor-not-allowed bg-neutral-400' : 'bg-neutral-900 hover:bg-neutral-800'
                        )}
                    >
                        {isRenderingThis ? (
                            <VimotionLoader size={16} className="text-white" label="Starting" />
                        ) : (
                            <CheckCircle2 className="size-4" />
                        )}
                        {isRenderingThis ? 'Starting…' : 'Render this clip'}
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
    );
}
