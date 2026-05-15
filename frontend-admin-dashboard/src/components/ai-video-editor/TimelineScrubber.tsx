import { useRef, useCallback, useMemo, useState, useEffect, Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import {
    useVideoEditorStore,
    MIN_SHOT_DURATION,
    SNAP_S,
    snapTime,
    findRollNeighbour,
    computeTimelineGaps,
    TimelineGap,
} from './stores/video-editor-store';
import {
    assignChannelGroups,
    getEntryColor,
    computeTotalDuration,
    ChannelGroup,
} from './utils/track-layout';
import { clamp } from './utils/coord-convert';
import { useAudioWaveform } from './utils/use-audio-waveform';
import { pauseIfPlaying } from './playback/playback-engine';
import { SentenceEditPopover } from './SentenceEditPopover';
import { ShotEditPopover } from './ShotEditPopover';
import { SoundCueRemovePopover } from './SoundCueRemovePopover';
import { AddShotPopover } from './AddShotPopover';
import type { Entry, SentenceClip, ShotClip, SoundCue } from '@/components/ai-video-player/types';

// ── Layout constants ────────────────────────────────────────────────────────

const RULER_H = 20; // time-ruler row
const WAVEFORM_H = 32; // audio waveform row (shown only when audioUrl present)
const CAPTION_TRACK_H = 22; // captions phrase row (shown only when captions enabled + transcript loaded)
const CHANNEL_SEP_H = 13; // coloured channel header separating each channel section
const TRACK_H = 22; // height of each track row inside a channel
const LABEL_W = 48; // fixed-width left label column (px)

// ── Move-drag hit zones ─────────────────────────────────────────────────────
// Edge handles get an 8 px click target on each side. The body grab needs at
// least 12 px of remaining width — below that we disable body drag and let
// the edges take over so a too-narrow body doesn't trap the cursor.
const EDGE_HIT_PX = 8;
const BODY_HIT_MIN_PX = 12;
const CLICK_DRAG_THRESHOLD_PX = 3; // mouseup within this displacement = click, not drag
const SNAP_PX = 6; // body-drag snap threshold in pixels (scaled to time at use)

type MoveMode = 'move' | 'ripple';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSec(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Compute the pixel y-offset of each channel group within the track area. */
function computeChannelYOffsets(
    groups: ChannelGroup[],
    hasWaveform: boolean,
    hasCaptions: boolean
): number[] {
    const offsets: number[] = [];
    let y = RULER_H + (hasWaveform ? WAVEFORM_H : 0) + (hasCaptions ? CAPTION_TRACK_H : 0);
    for (const g of groups) {
        offsets.push(y);
        y += CHANNEL_SEP_H + g.trackCount * TRACK_H;
    }
    return offsets;
}

/**
 * Imperative subscription helper: write `left:%` directly on a ref's style
 * whenever currentTime changes, without re-rendering this component (and
 * therefore without re-rendering the heavy timeline SVG above it).
 *
 * Used both for the waveform playhead and the main scrub head so the timeline
 * stays responsive at 60 Hz playback.
 */
function useImperativeLeftFromCurrentTime(
    ref: React.RefObject<HTMLDivElement>,
    totalDuration: number,
    navigationMode: string | undefined
) {
    useEffect(() => {
        const apply = (t: number) => {
            const el = ref.current;
            if (!el) return;
            if (totalDuration <= 0) {
                el.style.left = '0%';
                return;
            }
            const clamped = navigationMode === 'time_driven' ? t : Math.min(t, totalDuration - 1);
            const pct = Math.max(0, Math.min(100, (clamped / totalDuration) * 100));
            el.style.left = `${pct.toFixed(4)}%`;
        };
        apply(useVideoEditorStore.getState().currentTime);
        return useVideoEditorStore.subscribe((s, prev) => {
            if (s.currentTime !== prev.currentTime) apply(s.currentTime);
        });
    }, [ref, totalDuration, navigationMode]);
}

function PlayheadWaveformCursor({
    totalDuration,
    navigationMode,
}: {
    totalDuration: number;
    navigationMode: string | undefined;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useImperativeLeftFromCurrentTime(ref, totalDuration, navigationMode);
    return (
        <div
            ref={ref}
            className="pointer-events-none absolute inset-y-0 w-px bg-indigo-400 opacity-60"
            style={{ left: 0 }}
        />
    );
}

function PlayheadScrubCursor({
    totalDuration,
    navigationMode,
}: {
    totalDuration: number;
    navigationMode: string | undefined;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useImperativeLeftFromCurrentTime(ref, totalDuration, navigationMode);
    return (
        <div
            ref={ref}
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: 0, transform: 'translateX(-1px)' }}
        >
            {/* Triangle marker */}
            <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                    top: 0,
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #6366f1',
                }}
            />
            {/* Vertical line */}
            <div
                className="absolute left-1/2 w-px -translate-x-1/2 bg-indigo-500"
                style={{ top: 6, bottom: 0 }}
            />
        </div>
    );
}

function StatusTimeReadout({
    navigationMode,
    entriesLength,
}: {
    navigationMode: string | undefined;
    entriesLength: number;
}) {
    const currentTime = useVideoEditorStore((s) => s.currentTime);
    return (
        <span className="font-mono text-xs text-indigo-600">
            {navigationMode === 'time_driven'
                ? formatSec(currentTime)
                : `${Math.floor(currentTime) + 1} / ${entriesLength}`}
        </span>
    );
}

// ── Waveform SVG ────────────────────────────────────────────────────────────

interface WaveformProps {
    peaks: number[];
    height: number;
}

function WaveformBars({ peaks, height }: WaveformProps) {
    const mid = height / 2;
    const barW = 1; // px per bar — will be sized via viewBox scaling
    const totalW = peaks.length * barW;

    const bars = peaks.map((p, i) => {
        const h = Math.max(1, p * mid);
        return (
            <rect
                key={i}
                x={i * barW}
                y={mid - h}
                width={barW}
                height={h * 2}
                fill="currentColor"
            />
        );
    });

    return (
        <svg
            viewBox={`0 0 ${totalW} ${height}`}
            preserveAspectRatio="none"
            className="size-full text-indigo-400 opacity-50"
        >
            {bars}
        </svg>
    );
}

// ── Mode toolbar ────────────────────────────────────────────────────────────

/**
 * Segmented pill row for picking the timeline's body-drag verb. Trim
 * (edge-resize) stays available in every mode via the existing edge handles.
 * Slide and Swap are rendered disabled until Phase 2.
 */
function ModeToolbar({ mode, onChange }: { mode: MoveMode; onChange: (m: MoveMode) => void }) {
    const items: {
        id: MoveMode | 'slide' | 'swap';
        label: string;
        hotkey: string;
        disabled?: boolean;
        tooltip?: string;
    }[] = [
        { id: 'move', label: 'Move', hotkey: 'M' },
        { id: 'ripple', label: 'Ripple', hotkey: 'R' },
        { id: 'slide', label: 'Slide', hotkey: 'L', disabled: true, tooltip: 'Coming soon' },
        { id: 'swap', label: 'Swap', hotkey: 'W', disabled: true, tooltip: 'Coming soon' },
    ];
    return (
        <div
            className="flex items-center overflow-hidden rounded border border-gray-200 bg-gray-50 text-[11px]"
            role="radiogroup"
            aria-label="Timeline drag mode"
        >
            {items.map((it) => {
                const active = !it.disabled && it.id === mode;
                return (
                    <button
                        key={it.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={it.disabled}
                        onClick={() => !it.disabled && onChange(it.id as MoveMode)}
                        title={
                            it.disabled
                                ? `${it.label} — ${it.tooltip ?? 'disabled'}`
                                : `${it.label} mode (${it.hotkey})`
                        }
                        className={[
                            'flex h-6 items-center gap-1 px-2 transition-colors',
                            it.disabled
                                ? 'cursor-not-allowed text-gray-300'
                                : active
                                  ? it.id === 'ripple'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-indigo-100 text-indigo-700'
                                  : 'text-gray-500 hover:text-gray-800',
                        ].join(' ')}
                    >
                        {it.label}
                        <kbd className="ml-0.5 rounded bg-white/70 px-1 font-mono text-[9px] text-gray-400">
                            {it.hotkey}
                        </kbd>
                    </button>
                );
            })}
        </div>
    );
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * Horizontal multi-track timeline scrubber with:
 *   - Channel grouping (Base / Overlay / UI) based on entry z-index
 *   - Audio waveform visualization (Web Audio API, frontend-only)
 *   - Left label column showing channel names
 *
 * time_driven  – entries are time-proportional blocks, scrubs in seconds.
 * user_driven  – entries are equal-width sequential blocks, scrubs by index.
 */
export function TimelineScrubber() {
    const {
        entries,
        meta,
        selectedEntryId,
        seek,
        selectEntry,
        audioUrl,
        resizeEntryEdge,
        moveEntries,
        captionPhrases,
        captionEnabled,
    } = useVideoEditorStore(
        useShallow((s) => ({
            entries: s.entries,
            meta: s.meta,
            selectedEntryId: s.selectedEntryId,
            seek: s.seek,
            selectEntry: s.selectEntry,
            audioUrl: s.audioUrl,
            resizeEntryEdge: s.resizeEntryEdge,
            moveEntries: s.moveEntries,
            captionPhrases: s.captionPhrases,
            captionEnabled: s.captionSettings.enabled,
        }))
    );
    // currentTime is intentionally NOT a parent-level subscription — playhead
    // and time readout each subscribe individually so 60 Hz playback ticks
    // don't re-render the entire timeline SVG.

    const barRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    // Active edge-resize operation — drives the floating tooltip + live preview.
    const [resizeDrag, setResizeDrag] = useState<{
        entryId: string;
        edge: 'in' | 'out';
        mode: 'slip' | 'roll' | 'ripple';
        time: number;
        blocked: 'min' | null;
        /** Roll-mode: the entry whose opposing edge follows this one. */
        neighbourId: string | null;
    } | null>(null);

    // Active move-mode (body drag) operation. Drives live preview + tooltip.
    // `delta` is the snapped, clamped shift; mode is captured at drag start
    // so mid-drag mode-toolbar clicks don't change the gesture's behaviour.
    const [moveDrag, setMoveDrag] = useState<{
        entryId: string;
        originalInTime: number;
        originalExitTime: number;
        delta: number;
        mode: MoveMode;
    } | null>(null);
    const moveDragRef = useRef<typeof moveDrag>(null);
    useEffect(() => {
        moveDragRef.current = moveDrag;
    }, [moveDrag]);

    // Active mode for body-drag in the timeline. Local component state — the
    // mode is purely a UI affordance and never persists across reload.
    const [mode, setMode] = useState<MoveMode>('move');

    // Currently-edited sentence (popover open). Anchor coordinates are
    // captured in VIEWPORT space at click time so the portal-rendered
    // popover positions correctly regardless of any overflow:hidden in
    // ancestor layout. Captured-once: we don't track scroll/resize while
    // the popover is open — clicking outside is the expected close path.
    const [editingSentence, setEditingSentence] = useState<{
        sentence: SentenceClip;
        anchorViewportX: number;
        anchorViewportTop: number;
    } | null>(null);

    // v3 editor unit. When `meta.shots[]` is present the editor renders
    // shot regions on the waveform (instead of sentence regions) and
    // clicks open the ShotEditPopover. Sentence regions remain the
    // fallback for legacy timelines that don't have meta.shots[].
    const [editingShot, setEditingShot] = useState<{
        shot: ShotClip;
        anchorViewportX: number;
        anchorViewportTop: number;
    } | null>(null);

    // Currently-active sound-cue popover. Same anchoring story as the
    // sentence popover above.
    const [editingCue, setEditingCue] = useState<{
        cue: SoundCue;
        entryId: string;
        anchorViewportX: number;
        anchorViewportTop: number;
    } | null>(null);

    // Currently-active "add shot in gap" popover. Anchor coordinates are
    // captured in viewport space at click time (same pattern as the
    // sentence/cue popovers above).
    const [editingGap, setEditingGap] = useState<{
        gap: TimelineGap;
        anchorViewportX: number;
        anchorViewportTop: number;
    } | null>(null);

    const navigationMode = meta.navigation;

    // Entries with the current move-drag preview applied. Used both for
    // channel-track assignment (so rows re-layout live when a clip overlaps
    // a neighbour mid-drag) and for the per-clip block geometry below.
    // Identity-stable when no drag is active so existing memo chains keep
    // their previous behaviour.
    const previewedEntries = useMemo(() => {
        if (!moveDrag) return entries;
        const movingId = moveDrag.entryId;
        const boundary = moveDrag.originalExitTime;
        return entries.map((e) => {
            if (e.id === movingId) {
                return {
                    ...e,
                    inTime: moveDrag.originalInTime + moveDrag.delta,
                    exitTime: moveDrag.originalExitTime + moveDrag.delta,
                };
            }
            if (
                moveDrag.mode === 'ripple' &&
                !e.id.startsWith('branding-') &&
                (e.inTime ?? Infinity) >= boundary
            ) {
                return {
                    ...e,
                    inTime: (e.inTime ?? 0) + moveDrag.delta,
                    exitTime: (e.exitTime ?? 0) + moveDrag.delta,
                };
            }
            return e;
        });
    }, [entries, moveDrag]);

    // Total duration is computed from the previewed entries so the bar
    // visibly grows during a ripple drag instead of snapping at commit.
    const totalDuration = useMemo(
        () => computeTotalDuration(previewedEntries, meta.total_duration),
        [previewedEntries, meta.total_duration]
    );

    // Mirror totalDuration into a ref so the in-flight body-drag closure
    // (built once at mousedown, lifetime ~1 gesture) reads the current value
    // every frame instead of the value captured when the drag started. Keeps
    // the cursor→time mapping consistent with the rendered bar even while
    // ripple grows total_duration mid-drag.
    const totalDurationRef = useRef(totalDuration);
    useEffect(() => {
        totalDurationRef.current = totalDuration;
    }, [totalDuration]);

    // Channel-aware track assignment — driven by the previewed entries so
    // overlapping a neighbour during a drag visibly pushes track rows.
    const channelGroups = useMemo(() => assignChannelGroups(previewedEntries), [previewedEntries]);

    // M / R toggle the active mode. Ignored while focus is in an input,
    // textarea, select, or contenteditable so the user can type those
    // letters into fields. Mirrors EditorCanvas's keyboard guard pattern.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.tagName === 'SELECT' ||
                    t.isContentEditable)
            ) {
                return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                setMode('move');
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                setMode('ripple');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Audio waveform peaks (computed once per audioUrl)
    const { peaks: waveformPeaks, loading: waveformLoading } = useAudioWaveform(
        navigationMode === 'time_driven' ? audioUrl : undefined
    );

    // Per-sentence audio clips. Only renderable in time-driven mode (the
    // waveform itself is too — sentences are an audio concept and we
    // anchor them to absolute time). Empty for older videos that haven't
    // been backfilled via /sentences/build.
    const sentences: SentenceClip[] = useMemo(
        () => (navigationMode === 'time_driven' ? meta.sentences ?? [] : []),
        [navigationMode, meta.sentences]
    );

    // Per-shot audio clips (v3). When present, the editor PREFERS these
    // over sentence regions — they're the canonical editing unit on v3
    // timelines. Sentence regions fall through as the fallback path when
    // shots is empty (legacy v2 timelines or pre-meta.shots videos).
    const shots: ShotClip[] = useMemo(
        () => (navigationMode === 'time_driven' ? meta.shots ?? [] : []),
        [navigationMode, meta.shots]
    );
    const useShots = shots.length > 0;

    // Base-channel gaps: ranges where audio plays but no shot exists.
    // Surfaced as dashed pills under the entries so the user can spot
    // and fill them. Skipped in user_driven mode (no time axis).
    const gaps = useMemo<TimelineGap[]>(
        () => (navigationMode === 'time_driven' ? computeTimelineGaps(entries, totalDuration) : []),
        [entries, totalDuration, navigationMode]
    );

    // Flatten every shot's sound_cues into a single absolute-time list so
    // the waveform row can render them as markers. Each cue carries its
    // owning entryId so the popover knows where to dispatch the removal.
    // Sorted by absolute_time so visually adjacent markers don't overlap
    // unpredictably; offsets fall back to entry inTime + cue.t for older
    // payloads that pre-date `absolute_time`.
    const soundCues = useMemo(() => {
        if (navigationMode !== 'time_driven') return [];
        const out: Array<{ cue: SoundCue; entryId: string; absoluteTime: number }> = [];
        for (const e of entries) {
            for (const cue of e.sound_cues ?? []) {
                const abs = cue.absolute_time ?? (e.inTime ?? 0) + (cue.t ?? 0);
                if (abs == null || Number.isNaN(abs)) continue;
                out.push({ cue, entryId: e.id, absoluteTime: abs });
            }
        }
        out.sort((a, b) => a.absoluteTime - b.absoluteTime);
        return out;
    }, [entries, navigationMode]);
    const hasWaveform =
        navigationMode === 'time_driven' && (waveformPeaks.length > 0 || waveformLoading);
    const hasCaptions = captionEnabled && captionPhrases.length > 0;

    // Y-offsets for each channel section
    const channelYOffsets = useMemo(
        () => computeChannelYOffsets(channelGroups, hasWaveform, hasCaptions),
        [channelGroups, hasWaveform, hasCaptions]
    );

    // Total height of the track area
    const totalH = useMemo(() => {
        const channelsH = channelGroups.reduce(
            (acc, g) => acc + CHANNEL_SEP_H + g.trackCount * TRACK_H,
            0
        );
        return (
            RULER_H +
            (hasWaveform ? WAVEFORM_H : 0) +
            (hasCaptions ? CAPTION_TRACK_H : 0) +
            Math.max(channelsH, TRACK_H + CHANNEL_SEP_H)
        );
    }, [channelGroups, hasWaveform, hasCaptions]);

    // ── Mouse / touch scrub ────────────────────────────────────────────────

    const xToTime = useCallback(
        (clientX: number): number => {
            const bar = barRef.current;
            if (!bar) return 0;
            const { left, width } = bar.getBoundingClientRect();
            const ratio = clamp((clientX - left) / width, 0, 1);
            return ratio * totalDuration;
        },
        [totalDuration]
    );

    const startDrag = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            e.stopPropagation();
            // User scrubbing takes precedence over playback — stop the rAF
            // loop so it doesn't race the seek values the user is dragging.
            pauseIfPlaying();
            isDragging.current = true;
            const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
            seek(xToTime(clientX));

            const onMove = (ev: MouseEvent | TouchEvent) => {
                if (!isDragging.current) return;
                const cx =
                    'touches' in ev
                        ? (ev as TouchEvent).touches[0]?.clientX ?? 0
                        : (ev as MouseEvent).clientX;
                seek(xToTime(cx));
            };
            const onUp = () => {
                isDragging.current = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('touchend', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('touchmove', onMove, { passive: true });
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchend', onUp);
        },
        [seek, xToTime]
    );

    // ── Edge drag (resize shots) ───────────────────────────────────────────

    const startEdgeResize = useCallback(
        (entry: Entry, edge: 'in' | 'out', e: React.MouseEvent) => {
            if (navigationMode !== 'time_driven') return;
            e.stopPropagation();
            e.preventDefault();
            const bar = barRef.current;
            if (!bar) return;

            const inT = entry.inTime ?? entry.start ?? 0;
            const outT = entry.exitTime ?? entry.end ?? inT + 1;
            const neighbour = findRollNeighbour(entries, entry, edge);
            const baseMode: 'slip' | 'roll' = neighbour ? 'roll' : 'slip';
            selectEntry(entry.id);

            const clientToTime = (cx: number): number => {
                const { left, width } = bar.getBoundingClientRect();
                const ratio = clamp((cx - left) / width, 0, 1);
                return ratio * totalDuration;
            };

            const apply = (cx: number, shiftHeld: boolean) => {
                const raw = clientToTime(cx);
                const snapped = Math.round(raw / SNAP_S) * SNAP_S;
                const mode: 'slip' | 'roll' | 'ripple' = shiftHeld ? 'ripple' : baseMode;
                // Clamp for preview so the tooltip reflects what will actually commit.
                let preview = snapped;
                let blocked: 'min' | null = null;
                if (mode === 'slip' || mode === 'ripple') {
                    if (edge === 'in' && preview > outT - MIN_SHOT_DURATION) {
                        preview = outT - MIN_SHOT_DURATION;
                        blocked = 'min';
                    }
                    if (edge === 'out' && preview < inT + MIN_SHOT_DURATION) {
                        preview = inT + MIN_SHOT_DURATION;
                        blocked = 'min';
                    }
                } else if (mode === 'roll' && neighbour) {
                    const nIn = neighbour.inTime ?? 0;
                    const nOut = neighbour.exitTime ?? 0;
                    if (edge === 'out') {
                        const lo = inT + MIN_SHOT_DURATION;
                        const hi = nOut - MIN_SHOT_DURATION;
                        if (preview < lo) {
                            preview = lo;
                            blocked = 'min';
                        } else if (preview > hi) {
                            preview = hi;
                            blocked = 'min';
                        }
                    } else {
                        const lo = nIn + MIN_SHOT_DURATION;
                        const hi = outT - MIN_SHOT_DURATION;
                        if (preview < lo) {
                            preview = lo;
                            blocked = 'min';
                        } else if (preview > hi) {
                            preview = hi;
                            blocked = 'min';
                        }
                    }
                }

                // Preview only — the block's render below reads resizeDrag and
                // overrides its own geometry for the dragged entry (and its roll
                // neighbour) without touching the store. Committed once on mouseup.
                setResizeDrag({
                    entryId: entry.id,
                    edge,
                    mode,
                    time: preview,
                    blocked,
                    neighbourId: mode === 'roll' && neighbour ? neighbour.id : null,
                });
                return { time: preview, mode };
            };

            let last: { time: number; mode: 'slip' | 'roll' | 'ripple' } | null = null;
            const onMove = (ev: MouseEvent) => {
                last = apply(ev.clientX, ev.shiftKey);
            };
            const onUp = (ev: MouseEvent) => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                const committed = last ?? apply(ev.clientX, ev.shiftKey);
                resizeEntryEdge(entry.id, edge, committed.time, committed.mode);
                setResizeDrag(null);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            last = apply(e.clientX, e.shiftKey);
        },
        [navigationMode, entries, totalDuration, resizeEntryEdge, selectEntry]
    );

    // ── Body drag (move clip) ────────────────────────────────────────────────
    //
    // Click-and-drag on the body of a clip in time_driven mode. Delta is
    // computed in seconds, quantized to SNAP_S, clamped per-mode, and snapped
    // to nearby clip edges / playhead / timeline bounds unless Alt is held.
    // Mode is captured at drag start so toolbar clicks mid-drag don't change
    // the gesture's meaning.
    const startBodyDrag = useCallback(
        (entry: Entry, e: React.MouseEvent) => {
            if (e.button !== 0) return;
            if (entry.id.startsWith('branding-')) return;
            if (navigationMode !== 'time_driven') return;
            const bar = barRef.current;
            if (!bar) return;

            const originalInTime = entry.inTime ?? entry.start ?? 0;
            const originalExitTime = entry.exitTime ?? entry.end ?? originalInTime + 1;
            const dragMode: MoveMode = mode;
            const startClientX = e.clientX;

            const barRect = bar.getBoundingClientRect();
            const startTotal = totalDurationRef.current;
            const bodyPx = ((originalExitTime - originalInTime) / startTotal) * barRect.width;
            if (bodyPx < BODY_HIT_MIN_PX + 2 * EDGE_HIT_PX) return;

            e.stopPropagation();
            e.preventDefault();

            pauseIfPlaying();
            selectEntry(entry.id);

            const clientXToTime = (cx: number) => {
                const { left, width } = bar.getBoundingClientRect();
                const td = totalDurationRef.current;
                return clamp((cx - left) / width, 0, 1) * td;
            };

            // Returns { delta, snapped } — `snapped` is true when a target
            // adjusted the delta, so the caller can skip the post-snap grid
            // re-quantize that would otherwise round the snap off.
            // Alt bypasses snap entirely.
            const applySnap = (
                rawDelta: number,
                altPressed: boolean
            ): { delta: number; snapped: boolean } => {
                if (altPressed) return { delta: rawDelta, snapped: false };
                const { width: barWidth } = bar.getBoundingClientRect();
                const td = totalDurationRef.current;
                if (barWidth <= 0 || td <= 0) return { delta: rawDelta, snapped: false };
                const threshold = (SNAP_PX / barWidth) * td;
                const candidateIn = originalInTime + rawDelta;
                const candidateOut = originalExitTime + rawDelta;

                // In Ripple mode, clips downstream of the moving block ripple
                // with it — their edges move in lockstep, so snapping to them
                // would just preserve the existing relative gap, which is not
                // a useful snap target. Filter them out.
                const rippleBoundary = originalExitTime;
                const targets: number[] = [0, td, useVideoEditorStore.getState().currentTime];
                for (const other of entries) {
                    if (other.id === entry.id) continue;
                    if (
                        dragMode === 'ripple' &&
                        !other.id.startsWith('branding-') &&
                        (other.inTime ?? Infinity) >= rippleBoundary
                    ) {
                        continue;
                    }
                    if (other.inTime != null) targets.push(other.inTime);
                    if (other.exitTime != null) targets.push(other.exitTime);
                }
                let best: number | null = null;
                let bestDist = threshold;
                for (const t of targets) {
                    const dIn = Math.abs(candidateIn - t);
                    if (dIn < bestDist) {
                        bestDist = dIn;
                        best = t - originalInTime;
                    }
                    const dOut = Math.abs(candidateOut - t);
                    if (dOut < bestDist) {
                        bestDist = dOut;
                        best = t - originalExitTime;
                    }
                }
                return best == null
                    ? { delta: rawDelta, snapped: false }
                    : { delta: best, snapped: true };
            };

            const apply = (cx: number, altPressed: boolean) => {
                const cursorTime = clientXToTime(cx);
                const anchorTime = clientXToTime(startClientX);
                let delta = snapTime(cursorTime - anchorTime);

                if (originalInTime + delta < 0) delta = -originalInTime;
                if (dragMode === 'move' && originalExitTime + delta > totalDurationRef.current) {
                    delta = totalDurationRef.current - originalExitTime;
                }
                const snap = applySnap(delta, altPressed);
                delta = snap.delta;
                if (!snap.snapped) delta = snapTime(delta);

                setMoveDrag({
                    entryId: entry.id,
                    originalInTime,
                    originalExitTime,
                    delta,
                    mode: dragMode,
                });
                return delta;
            };

            let lastDelta = 0;
            const onMove = (ev: MouseEvent) => {
                lastDelta = apply(ev.clientX, ev.altKey);
            };
            const onUp = (ev: MouseEvent) => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);

                const displacementPx = Math.abs(ev.clientX - startClientX);
                const finalDelta = moveDragRef.current?.delta ?? lastDelta;

                if (displacementPx < CLICK_DRAG_THRESHOLD_PX && finalDelta === 0) {
                    seek(originalInTime);
                } else if (finalDelta !== 0) {
                    moveEntries([entry.id], finalDelta, dragMode);
                }
                setMoveDrag(null);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        },
        // `totalDuration` intentionally omitted — accessed via
        // `totalDurationRef` so the closure picks up live changes during a
        // ripple drag instead of rebuilding the entire handler.
        [navigationMode, entries, mode, selectEntry, seek, moveEntries]
    );

    /**
     * Count of entries that will be re-timed when a given sentence is
     * re-narrated. The splice ripples every entry whose time range starts
     * AT or after the sentence's start_time — those are the shots the
     * user is implicitly affecting by editing this sentence's audio.
     */
    const countAffectedEntries = useCallback(
        (sentence: SentenceClip): number => {
            const epsilon = 1e-3;
            const boundary = sentence.start_time;
            return entries.reduce((n, e) => {
                const t = e.inTime ?? e.start ?? 0;
                return t >= boundary - epsilon ? n + 1 : n;
            }, 0);
        },
        [entries]
    );

    const handleCueClick = useCallback(
        (e: React.MouseEvent, cue: SoundCue, entryId: string, absoluteTime: number) => {
            // Cue markers sit ON TOP of sentence regions. Stop propagation so
            // the underlying sentence-region click + the bar's scrub handler
            // don't both fire alongside the cue popover.
            e.stopPropagation();
            const bar = barRef.current;
            if (!bar) return;
            const barRect = bar.getBoundingClientRect();
            if (totalDuration <= 0 || barRect.width <= 0) return;
            const offsetX = clamp((absoluteTime / totalDuration) * barRect.width, 0, barRect.width);
            setEditingCue({
                cue,
                entryId,
                anchorViewportX: barRect.left + offsetX,
                anchorViewportTop: barRect.top + RULER_H,
            });
        },
        [totalDuration]
    );

    const handleGapClick = useCallback(
        (e: React.MouseEvent, gap: TimelineGap) => {
            // Stop the click from also being interpreted as a scrub.
            e.stopPropagation();
            const bar = barRef.current;
            if (!bar) return;
            const barRect = bar.getBoundingClientRect();
            if (totalDuration <= 0 || barRect.width <= 0) return;
            // Anchor on the gap's centre — same convention as sentence
            // and cue popovers so the floating UI feels consistent.
            const centerTime = (gap.start + gap.end) / 2;
            const offsetX = clamp((centerTime / totalDuration) * barRect.width, 0, barRect.width);
            setEditingGap({
                gap,
                anchorViewportX: barRect.left + offsetX,
                anchorViewportTop: barRect.top + RULER_H,
            });
        },
        [totalDuration]
    );

    const handleSentenceClick = useCallback(
        (e: React.MouseEvent, sentence: SentenceClip) => {
            // Stop the click from also being interpreted as a scrub on the bar.
            e.stopPropagation();
            const bar = barRef.current;
            if (!bar) return;
            const barRect = bar.getBoundingClientRect();
            if (totalDuration <= 0 || barRect.width <= 0) return;
            // Anchor on the sentence region's centre so the popover always
            // points at the same spot regardless of where the user clicked
            // within the region.
            const centerTime = sentence.start_time + sentence.duration / 2;
            const offsetX = clamp((centerTime / totalDuration) * barRect.width, 0, barRect.width);
            // Waveform row top in bar coords = RULER_H. Convert to viewport.
            setEditingSentence({
                sentence,
                anchorViewportX: barRect.left + offsetX,
                anchorViewportTop: barRect.top + RULER_H,
            });
        },
        [totalDuration]
    );

    // Count entries that will be re-timed when a given shot is re-narrated.
    // Mirrors `countAffectedEntries` for sentences but keyed off the shot's
    // start_time. Surfaced to the ShotEditPopover so the user sees the
    // ripple cost before submitting.
    const countAffectedShotEntries = useCallback(
        (shot: ShotClip): number => {
            const epsilon = 1e-3;
            const boundary = shot.start_time;
            return entries.reduce((n, e) => {
                const t = e.inTime ?? e.start ?? 0;
                return t >= boundary - epsilon ? n + 1 : n;
            }, 0);
        },
        [entries]
    );

    const handleShotClick = useCallback(
        (e: React.MouseEvent, shot: ShotClip) => {
            e.stopPropagation();
            const bar = barRef.current;
            if (!bar) return;
            const barRect = bar.getBoundingClientRect();
            if (totalDuration <= 0 || barRect.width <= 0) return;
            const centerTime = shot.start_time + shot.duration / 2;
            const offsetX = clamp((centerTime / totalDuration) * barRect.width, 0, barRect.width);
            setEditingShot({
                shot,
                anchorViewportX: barRect.left + offsetX,
                anchorViewportTop: barRect.top + RULER_H,
            });
        },
        [totalDuration]
    );

    // ── Position helpers ───────────────────────────────────────────────────

    const timeToPercent = (t: number) => {
        if (totalDuration <= 0) return '0%';
        const pct = clamp((t / totalDuration) * 100, 0, 100);
        return `${pct.toFixed(4)}%`;
    };

    // Playhead position is applied imperatively inside <PlayheadScrubCursor>
    // / <PlayheadWaveformCursor> — no scrubPercent needed at this scope.

    // Tick marks for the time ruler
    const tickInterval =
        totalDuration < 30 ? 5 : totalDuration < 120 ? 15 : totalDuration < 300 ? 30 : 60;

    const ticks = useMemo(() => {
        if (navigationMode !== 'time_driven') return [];
        const arr: number[] = [];
        for (let t = 0; t <= totalDuration; t += tickInterval) arr.push(t);
        return arr;
    }, [totalDuration, tickInterval, navigationMode]);

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div
            className="shrink-0 select-none border-t border-gray-200 bg-white"
            style={{ height: totalH + 28, minHeight: 72 }}
        >
            {/* Status bar: current time / mode toolbar / duration */}
            <div className="flex items-center justify-between gap-3 px-3 py-1">
                <StatusTimeReadout navigationMode={navigationMode} entriesLength={entries.length} />

                {/* Mode toolbar — picks the verb for body-drag in the timeline.
                    Trim stays available everywhere via edge-resize handles. */}
                {navigationMode === 'time_driven' && <ModeToolbar mode={mode} onChange={setMode} />}

                <div className="flex items-center gap-2">
                    {waveformLoading && (
                        <span className="text-[10px] text-gray-400">Loading waveform…</span>
                    )}
                    <span className="font-mono text-xs text-gray-400">
                        {navigationMode === 'time_driven'
                            ? formatSec(totalDuration)
                            : `${entries.length} entries`}
                    </span>
                </div>
            </div>

            {/* Ripple-mode banner — sticky while a ripple drag is in flight so
                users know the visual ripple does NOT carry the narration audio. */}
            {moveDrag?.mode === 'ripple' && (
                <div
                    className="border-y border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-800"
                    role="status"
                >
                    Ripple mode — narration audio not shifted. Playback alignment may drift.
                </div>
            )}

            {/* Two-column layout: [labels] [timeline] */}
            <div className="flex" style={{ height: totalH, paddingLeft: 8, paddingRight: 8 }}>
                {/* ── Left label column ───────────────────────────────── */}
                <div
                    className="flex shrink-0 flex-col"
                    style={{
                        width: LABEL_W,
                        paddingTop: RULER_H + (hasWaveform ? WAVEFORM_H : 0),
                    }}
                >
                    {hasCaptions && (
                        <div
                            className="flex items-center justify-center rounded-l border-r-2 border-emerald-300/50 bg-emerald-50"
                            style={{ height: CAPTION_TRACK_H }}
                        >
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600">
                                CC
                            </span>
                        </div>
                    )}
                    {channelGroups.map((g) => (
                        <div
                            key={g.channel.id}
                            className="flex items-center justify-center rounded-l"
                            style={{
                                height: CHANNEL_SEP_H + g.trackCount * TRACK_H,
                                background: g.channel.bgColor,
                                borderRight: `2px solid ${g.channel.color}40`,
                            }}
                        >
                            <span
                                className="text-[9px] font-semibold uppercase tracking-wide"
                                style={{ color: g.channel.color }}
                            >
                                {g.channel.label}
                            </span>
                        </div>
                    ))}
                    {channelGroups.length === 0 && (
                        <div
                            className="flex-1"
                            style={{ background: '#eff6ff', borderRight: '2px solid #1d4ed820' }}
                        />
                    )}
                </div>

                {/* ── Timeline track area ─────────────────────────────── */}
                <div
                    ref={barRef}
                    className="relative flex-1 cursor-pointer overflow-hidden rounded-r"
                    style={{ height: totalH }}
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                >
                    {/* Light background */}
                    <div className="absolute inset-0 bg-gray-100" />

                    {/* Time ruler */}
                    <div
                        className="absolute inset-x-0 top-0 border-b border-gray-200 bg-white"
                        style={{ height: RULER_H }}
                    >
                        {ticks.map((t) => (
                            <div
                                key={t}
                                className="absolute flex flex-col items-center"
                                style={{
                                    left: timeToPercent(t),
                                    top: 0,
                                    transform: 'translateX(-50%)',
                                }}
                            >
                                <div className="w-px bg-gray-300" style={{ height: 6 }} />
                                <span className="text-[9px] tabular-nums text-gray-400">
                                    {formatSec(t)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Audio waveform row */}
                    {hasWaveform && (
                        <div
                            className="absolute inset-x-0 border-b border-indigo-100 bg-indigo-50"
                            style={{ top: RULER_H, height: WAVEFORM_H }}
                        >
                            {waveformPeaks.length > 0 ? (
                                <WaveformBars peaks={waveformPeaks} height={WAVEFORM_H} />
                            ) : (
                                /* Loading shimmer */
                                <div className="flex h-full items-center px-2">
                                    <div className="h-2 w-full animate-pulse rounded bg-indigo-200" />
                                </div>
                            )}
                            {/* Current-time cursor line on waveform */}
                            <PlayheadWaveformCursor
                                totalDuration={totalDuration}
                                navigationMode={navigationMode}
                            />

                            {/* Sound-effect markers: small clickable dots positioned at each
                                cue's absolute_time. Rendered ABOVE sentence regions so they
                                steal clicks first (handler stops propagation). Visual: a small
                                amber pill sits above the waveform line so it's distinguishable
                                from sentence-region borders without obscuring the waveform. */}
                            {soundCues.map(({ cue, entryId, absoluteTime }, i) => {
                                const left = `${(absoluteTime / totalDuration) * 100}%`;
                                const isActive = editingCue?.cue.id === cue.id;
                                // Index suffix because the planner can emit
                                // duplicate cue.id within one entry; the
                                // entryId+cueId pair alone isn't guaranteed
                                // unique.
                                return (
                                    <button
                                        key={`${entryId}:${cue.id}:${i}`}
                                        type="button"
                                        title={`${cue.role || 'SFX'} · ${absoluteTime.toFixed(2)}s`}
                                        onClick={(e) =>
                                            handleCueClick(e, cue, entryId, absoluteTime)
                                        }
                                        // 8px square pill with a small downward "tail" via border
                                        // tricks would be nice but keep the markup minimal: a
                                        // simple rounded square is unambiguous enough at this size.
                                        className={[
                                            'absolute z-10 -translate-x-1/2 cursor-pointer rounded-sm border transition-all',
                                            isActive
                                                ? 'border-amber-700 bg-amber-500 shadow-md'
                                                : 'border-amber-600 bg-amber-400 hover:scale-110 hover:bg-amber-500',
                                        ].join(' ')}
                                        style={{
                                            left,
                                            top: 2,
                                            width: 6,
                                            height: 6,
                                        }}
                                    />
                                );
                            })}

                            {/* Per-{shot|sentence} regions: subtle hoverable bands so the
                                user can click an editing unit to re-narrate its audio. v3
                                timelines populate `meta.shots[]` which is the preferred unit
                                (see `useShots`); pre-v3 timelines fall back to sentences. */}
                            {useShots
                                ? shots.map((sh, i) => {
                                      const left = `${(sh.start_time / totalDuration) * 100}%`;
                                      const width = `${(sh.duration / totalDuration) * 100}%`;
                                      const isEditing = editingShot?.shot.shot_idx === sh.shot_idx;
                                      // Intrinsic-only shots (source-clip / Veo audio) carry
                                      // their own audio — render with an amber treatment so
                                      // the user spots them as a different unit. They're
                                      // clickable but the popover renders as read-only.
                                      const isIntrinsic = sh.audio_policy === 'intrinsic_only';
                                      return (
                                          <button
                                              key={sh.id}
                                              type="button"
                                              title={
                                                  isIntrinsic
                                                      ? `(intrinsic audio · ${sh.shot_type})`
                                                      : sh.text || sh.narration_brief
                                              }
                                              onClick={(e) => handleShotClick(e, sh)}
                                              className={[
                                                  'absolute bottom-0 top-0 cursor-pointer border-l transition-colors',
                                                  isEditing
                                                      ? isIntrinsic
                                                          ? 'border-amber-500 bg-amber-300/40'
                                                          : 'border-indigo-500 bg-indigo-300/40'
                                                      : isIntrinsic
                                                        ? 'border-amber-400 bg-amber-100/40 hover:bg-amber-200/40'
                                                        : 'border-transparent hover:border-indigo-400 hover:bg-indigo-200/30',
                                                  i === shots.length - 1
                                                      ? 'border-r border-r-transparent'
                                                      : '',
                                              ].join(' ')}
                                              style={{ left, width }}
                                          />
                                      );
                                  })
                                : sentences.map((s, i) => {
                                      const left = `${(s.start_time / totalDuration) * 100}%`;
                                      const width = `${(s.duration / totalDuration) * 100}%`;
                                      const isEditing = editingSentence?.sentence.id === s.id;
                                      // Silenced sentences (audio replaced with silence,
                                      // text cleared) get a muted gray treatment so the
                                      // user can spot empty slots at a glance.
                                      const isSilenced =
                                          s.text.trim() === '' && (s.audio_url ?? '') === '';
                                      return (
                                          <button
                                              key={s.id}
                                              type="button"
                                              title={
                                                  isSilenced
                                                      ? '(silenced — click to add narration)'
                                                      : s.text
                                              }
                                              onClick={(e) => handleSentenceClick(e, s)}
                                              className={[
                                                  'absolute bottom-0 top-0 cursor-pointer border-l transition-colors',
                                                  isEditing
                                                      ? isSilenced
                                                          ? 'border-gray-500 bg-gray-300/40'
                                                          : 'border-indigo-500 bg-indigo-300/40'
                                                      : isSilenced
                                                        ? 'border-gray-400 bg-gray-200/40 hover:bg-gray-300/40'
                                                        : 'border-transparent hover:border-indigo-400 hover:bg-indigo-200/30',
                                                  // Right-most border on the last sentence so the
                                                  // grid feels closed; intermediate sentences only
                                                  // need the left border to mark their start.
                                                  i === sentences.length - 1
                                                      ? 'border-r border-r-transparent'
                                                      : '',
                                              ].join(' ')}
                                              style={{ left, width }}
                                          />
                                      );
                                  })}
                        </div>
                    )}

                    {/* Captions phrase row. Sits between the waveform (or ruler) and
                        the shot channels. Each pill spans one caption phrase from the
                        narration words.json; click a pill to seek to its start.
                        Hidden when captions are off or no transcript is loaded so it
                        doesn't add empty height to the timeline. */}
                    {hasCaptions && (
                        <div
                            className="absolute inset-x-0 border-b border-emerald-100 bg-emerald-50"
                            style={{
                                top: RULER_H + (hasWaveform ? WAVEFORM_H : 0),
                                height: CAPTION_TRACK_H,
                            }}
                        >
                            {captionPhrases.map((p, i) => {
                                const left = `${(p.startTime / totalDuration) * 100}%`;
                                const width = `${
                                    ((p.endTime - p.startTime) / totalDuration) * 100
                                }%`;
                                return (
                                    <button
                                        key={`cap-${i}`}
                                        type="button"
                                        title={`${p.startTime.toFixed(1)}s · ${p.text}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            pauseIfPlaying();
                                            seek(p.startTime);
                                        }}
                                        className="absolute top-0.5 cursor-pointer overflow-hidden truncate rounded border border-emerald-300 bg-white px-1 text-left text-[10px] text-emerald-800 hover:border-emerald-500 hover:bg-emerald-100"
                                        style={{
                                            left,
                                            width,
                                            height: CAPTION_TRACK_H - 4,
                                            lineHeight: `${CAPTION_TRACK_H - 6}px`,
                                        }}
                                    >
                                        {p.text}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Sentence-edit popover. Rendered via portal at the document body
                        so it floats above any overflow:hidden ancestors in the editor
                        layout. Anchor coordinates are in viewport space. */}
                    {editingSentence && (
                        <SentenceEditPopover
                            sentence={editingSentence.sentence}
                            anchorViewportX={editingSentence.anchorViewportX}
                            anchorViewportTop={editingSentence.anchorViewportTop}
                            affectedEntryCount={countAffectedEntries(editingSentence.sentence)}
                            onClose={() => setEditingSentence(null)}
                        />
                    )}

                    {/* Shot-edit popover (v3). Only opens when the timeline has
                        meta.shots[] populated and the user clicked a shot region above. */}
                    {editingShot && (
                        <ShotEditPopover
                            shot={editingShot.shot}
                            anchorViewportX={editingShot.anchorViewportX}
                            anchorViewportTop={editingShot.anchorViewportTop}
                            affectedEntryCount={countAffectedShotEntries(editingShot.shot)}
                            onClose={() => setEditingShot(null)}
                        />
                    )}

                    {/* Sound-effect remove popover. Same portal pattern. */}
                    {editingCue && (
                        <SoundCueRemovePopover
                            cue={editingCue.cue}
                            entryId={editingCue.entryId}
                            anchorViewportX={editingCue.anchorViewportX}
                            anchorViewportTop={editingCue.anchorViewportTop}
                            onClose={() => setEditingCue(null)}
                        />
                    )}

                    {/* Add-shot-in-gap popover. Same portal pattern. */}
                    {editingGap && (
                        <AddShotPopover
                            gap={editingGap.gap}
                            anchorViewportX={editingGap.anchorViewportX}
                            anchorViewportTop={editingGap.anchorViewportTop}
                            onClose={() => setEditingGap(null)}
                        />
                    )}

                    {/* Base-channel gap pills: dashed amber regions where audio
                        plays but no shot exists. Click → AddShotPopover. Rendered
                        BEFORE channel sections so the + button sits behind any
                        base entries (entries that bleed into a gap by float-rounding
                        still steal the click); each gap is computed from the
                        canonical base-entries view, so the bookkeeping stays clean. */}
                    {gaps.map((gap) => {
                        const baseGroupIdx = channelGroups.findIndex(
                            (g) => g.channel.id === 'base'
                        );
                        if (baseGroupIdx < 0) return null;
                        const baseY = channelYOffsets[baseGroupIdx]!;
                        const top = baseY + CHANNEL_SEP_H + 2;
                        const height = TRACK_H - 4;
                        const left = timeToPercent(gap.start);
                        const width = `${(((gap.end - gap.start) / totalDuration) * 100).toFixed(4)}%`;
                        return (
                            <button
                                key={gap.key}
                                type="button"
                                title={`Empty range ${gap.start.toFixed(2)}s → ${gap.end.toFixed(2)}s · click to fill`}
                                onClick={(e) => handleGapClick(e, gap)}
                                className="absolute z-0 flex items-center justify-center rounded-sm border border-dashed border-amber-400 bg-amber-50/70 text-amber-600 transition-colors hover:bg-amber-100"
                                style={{ left, width, top, height }}
                            >
                                <Plus className="size-3" />
                            </button>
                        );
                    })}

                    {/* Channel sections */}
                    {channelGroups.map((group, gi) => {
                        const channelY = channelYOffsets[gi]!;

                        return (
                            <Fragment key={group.channel.id}>
                                {/* Channel separator / header */}
                                <div
                                    className="absolute inset-x-0 flex items-center px-2"
                                    style={{
                                        top: channelY,
                                        height: CHANNEL_SEP_H,
                                        background: group.channel.bgColor,
                                        borderBottom: `1px solid ${group.channel.color}25`,
                                    }}
                                />

                                {/* Entry blocks */}
                                {group.entries.map(({ entry, channelTrack }) => {
                                    const isSelected = entry.id === selectedEntryId;
                                    const color = getEntryColor(entry.id, entry.z);
                                    const isBranding = entry.id.startsWith('branding-');
                                    const isMoving = moveDrag?.entryId === entry.id;
                                    const isRippledByMove =
                                        moveDrag != null &&
                                        moveDrag.mode === 'ripple' &&
                                        !isBranding &&
                                        moveDrag.entryId !== entry.id &&
                                        (entry.inTime ?? Infinity) >= moveDrag.originalExitTime;

                                    let left: string;
                                    let width: string;

                                    if (navigationMode === 'time_driven') {
                                        let start = entry.inTime ?? entry.start ?? 0;
                                        let end = entry.exitTime ?? entry.end ?? totalDuration;

                                        // Live drag preview: override edges without mutating the store.
                                        if (resizeDrag) {
                                            if (resizeDrag.entryId === entry.id) {
                                                if (resizeDrag.edge === 'in')
                                                    start = resizeDrag.time;
                                                else end = resizeDrag.time;
                                            } else if (resizeDrag.neighbourId === entry.id) {
                                                // Roll neighbour: its opposite edge follows.
                                                if (resizeDrag.edge === 'in') end = resizeDrag.time;
                                                else start = resizeDrag.time;
                                            }
                                        }

                                        // Body-move preview: shift the moving clip, and in ripple
                                        // mode also shift every non-branding downstream entry.
                                        if (isMoving) {
                                            start = moveDrag!.originalInTime + moveDrag!.delta;
                                            end = moveDrag!.originalExitTime + moveDrag!.delta;
                                        } else if (isRippledByMove) {
                                            start += moveDrag!.delta;
                                            end += moveDrag!.delta;
                                        }

                                        const safeEnd = Math.min(end, totalDuration);
                                        left = timeToPercent(start);
                                        width = `${(((safeEnd - start) / totalDuration) * 100).toFixed(4)}%`;
                                    } else {
                                        const idx = entries.indexOf(entry);
                                        left = timeToPercent(idx);
                                        width = `${((1 / totalDuration) * 100).toFixed(4)}%`;
                                    }

                                    const top =
                                        channelY + CHANNEL_SEP_H + channelTrack * TRACK_H + 2;

                                    const canResize = navigationMode === 'time_driven';
                                    const canMove = canResize && !isBranding;
                                    const isBeingDragged =
                                        resizeDrag?.entryId === entry.id ||
                                        resizeDrag?.neighbourId === entry.id ||
                                        isMoving;
                                    const outlineColor =
                                        isMoving && moveDrag?.mode === 'ripple'
                                            ? '#f59e0b'
                                            : '#818cf8';

                                    return (
                                        <div
                                            key={entry.id}
                                            className="absolute rounded-sm transition-opacity hover:opacity-90"
                                            style={{
                                                left,
                                                width,
                                                top,
                                                height: TRACK_H - 4,
                                                background: color,
                                                opacity: isSelected || isBeingDragged ? 1 : 0.75,
                                                outline:
                                                    isSelected || isBeingDragged
                                                        ? `2px solid ${outlineColor}`
                                                        : 'none',
                                                outlineOffset: 1,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                            }}
                                        >
                                            {/* Left edge resize handle */}
                                            {canResize && (
                                                <div
                                                    onMouseDown={(e) =>
                                                        startEdgeResize(entry, 'in', e)
                                                    }
                                                    className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-white/50"
                                                    title="Drag to resize start (Shift = ripple)"
                                                    style={{ zIndex: 2 }}
                                                />
                                            )}
                                            {/* Body — drag-to-move (Move/Ripple); falls through to
                                                a plain click when displacement < 3 px, which keeps
                                                the existing select+seek behaviour intact. */}
                                            <button
                                                className="absolute inset-0 flex items-center px-2"
                                                style={{
                                                    cursor: canMove
                                                        ? isMoving
                                                            ? 'grabbing'
                                                            : 'grab'
                                                        : 'pointer',
                                                }}
                                                title={
                                                    isBranding
                                                        ? `${entry.id} (locked)`
                                                        : canMove
                                                          ? `Drag to ${mode} (${mode === 'move' ? 'M' : 'R'}). Alt = ignore snap.`
                                                          : entry.id
                                                }
                                                onMouseDown={(e) => {
                                                    if (canMove) startBodyDrag(entry, e);
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (resizeDrag) return;
                                                    if (canMove) return;
                                                    selectEntry(entry.id);
                                                    if (navigationMode === 'time_driven') {
                                                        seek(entry.inTime ?? entry.start ?? 0);
                                                    } else {
                                                        seek(entries.indexOf(entry));
                                                    }
                                                }}
                                            >
                                                <span
                                                    className="truncate text-white"
                                                    style={{
                                                        fontSize: 9,
                                                        lineHeight: 1,
                                                        fontFamily: 'monospace',
                                                    }}
                                                >
                                                    {entry.id}
                                                </span>
                                            </button>
                                            {/* Right edge resize handle */}
                                            {canResize && (
                                                <div
                                                    onMouseDown={(e) =>
                                                        startEdgeResize(entry, 'out', e)
                                                    }
                                                    className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-white/50"
                                                    title="Drag to resize end (Shift = ripple)"
                                                    style={{ zIndex: 2 }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </Fragment>
                        );
                    })}

                    {/* Floating resize tooltip */}
                    {resizeDrag && (
                        <div
                            className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 font-mono text-[10px] shadow-md"
                            style={{
                                left: timeToPercent(resizeDrag.time),
                                top: 2,
                                background:
                                    resizeDrag.mode === 'ripple'
                                        ? '#b45309'
                                        : resizeDrag.blocked
                                          ? '#6b7280'
                                          : '#4338ca',
                                color: 'white',
                            }}
                        >
                            {resizeDrag.time.toFixed(1)}s
                            <span className="ml-1 opacity-80">
                                {resizeDrag.mode === 'ripple'
                                    ? '⚠ ripple (downstream shifts)'
                                    : resizeDrag.mode === 'roll'
                                      ? 'roll'
                                      : 'slip'}
                            </span>
                            {resizeDrag.blocked === 'min' && (
                                <span className="ml-1 opacity-80">· min {MIN_SHOT_DURATION}s</span>
                            )}
                        </div>
                    )}

                    {/* Floating body-move tooltip — anchored to the previewed
                        midpoint of the dragged clip, showing the new in→out range
                        and the active mode. */}
                    {moveDrag && (
                        <div
                            className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded px-2 py-0.5 font-mono text-[10px] shadow-md"
                            style={{
                                left: timeToPercent(
                                    moveDrag.originalInTime +
                                        moveDrag.delta +
                                        (moveDrag.originalExitTime - moveDrag.originalInTime) / 2
                                ),
                                top: 2,
                                background: moveDrag.mode === 'ripple' ? '#b45309' : '#4338ca',
                                color: 'white',
                            }}
                        >
                            {formatSec(moveDrag.originalInTime + moveDrag.delta)} →{' '}
                            {formatSec(moveDrag.originalExitTime + moveDrag.delta)}
                            <span className="ml-1 opacity-80">
                                {moveDrag.mode === 'ripple' ? '⚠ ripple' : 'move'}
                                {moveDrag.delta !== 0 && (
                                    <>
                                        {' '}
                                        ({moveDrag.delta > 0 ? '+' : ''}
                                        {moveDrag.delta.toFixed(1)}s)
                                    </>
                                )}
                            </span>
                        </div>
                    )}

                    {/* Scrub head (on top of everything) */}
                    <PlayheadScrubCursor
                        totalDuration={totalDuration}
                        navigationMode={navigationMode}
                    />
                </div>
            </div>
        </div>
    );
}
