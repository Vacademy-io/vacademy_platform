import { useRef, useCallback, useMemo, useState, Fragment } from 'react';
import {
    useVideoEditorStore,
    MIN_SHOT_DURATION,
    findRollNeighbour,
} from './stores/video-editor-store';
import {
    assignChannelGroups,
    getEntryColor,
    computeTotalDuration,
    ChannelGroup,
} from './utils/track-layout';
import { clamp } from './utils/coord-convert';
import { useAudioWaveform } from './utils/use-audio-waveform';
import type { Entry } from '@/components/ai-video-player/types';

// ── Layout constants ────────────────────────────────────────────────────────

const RULER_H = 20;       // time-ruler row
const WAVEFORM_H = 32;    // audio waveform row (shown only when audioUrl present)
const CHANNEL_SEP_H = 13; // coloured channel header separating each channel section
const TRACK_H = 22;       // height of each track row inside a channel
const LABEL_W = 48;       // fixed-width left label column (px)

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSec(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Compute the pixel y-offset of each channel group within the track area. */
function computeChannelYOffsets(groups: ChannelGroup[], hasWaveform: boolean): number[] {
    const offsets: number[] = [];
    let y = RULER_H + (hasWaveform ? WAVEFORM_H : 0);
    for (const g of groups) {
        offsets.push(y);
        y += CHANNEL_SEP_H + g.trackCount * TRACK_H;
    }
    return offsets;
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
            className="h-full w-full text-indigo-400 opacity-50"
        >
            {bars}
        </svg>
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
        currentTime,
        selectedEntryId,
        seek,
        selectEntry,
        audioUrl,
        resizeEntryEdge,
    } = useVideoEditorStore();

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

    const navigationMode = meta.navigation;
    const totalDuration = useMemo(
        () => computeTotalDuration(entries, meta.total_duration),
        [entries, meta.total_duration]
    );

    // Channel-aware track assignment
    const channelGroups = useMemo(() => assignChannelGroups(entries), [entries]);

    // Audio waveform peaks (computed once per audioUrl)
    const { peaks: waveformPeaks, loading: waveformLoading } = useAudioWaveform(
        navigationMode === 'time_driven' ? audioUrl : undefined
    );
    const hasWaveform = navigationMode === 'time_driven' && (waveformPeaks.length > 0 || waveformLoading);

    // Y-offsets for each channel section
    const channelYOffsets = useMemo(
        () => computeChannelYOffsets(channelGroups, hasWaveform),
        [channelGroups, hasWaveform]
    );

    // Total height of the track area
    const totalH = useMemo(() => {
        const channelsH = channelGroups.reduce(
            (acc, g) => acc + CHANNEL_SEP_H + g.trackCount * TRACK_H,
            0
        );
        return RULER_H + (hasWaveform ? WAVEFORM_H : 0) + Math.max(channelsH, TRACK_H + CHANNEL_SEP_H);
    }, [channelGroups, hasWaveform]);

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
            isDragging.current = true;
            const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
            seek(xToTime(clientX));

            const onMove = (ev: MouseEvent | TouchEvent) => {
                if (!isDragging.current) return;
                const cx =
                    'touches' in ev
                        ? ((ev as TouchEvent).touches[0]?.clientX ?? 0)
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
                const snapped = Math.round(raw * 10) / 10;
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

    // ── Position helpers ───────────────────────────────────────────────────

    const timeToPercent = (t: number) => {
        if (totalDuration <= 0) return '0%';
        const pct = clamp((t / totalDuration) * 100, 0, 100);
        return `${pct.toFixed(4)}%`;
    };

    const scrubPercent = timeToPercent(
        navigationMode === 'time_driven' ? currentTime : Math.min(currentTime, totalDuration - 1)
    );

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
            {/* Status bar: current time / duration */}
            <div className="flex items-center justify-between px-3 py-1">
                <span className="font-mono text-xs text-indigo-600">
                    {navigationMode === 'time_driven'
                        ? formatSec(currentTime)
                        : `${Math.floor(currentTime) + 1} / ${entries.length}`}
                </span>
                {waveformLoading && (
                    <span className="text-[10px] text-gray-400">Loading waveform…</span>
                )}
                <span className="font-mono text-xs text-gray-400">
                    {navigationMode === 'time_driven'
                        ? formatSec(totalDuration)
                        : `${entries.length} entries`}
                </span>
            </div>

            {/* Two-column layout: [labels] [timeline] */}
            <div className="flex" style={{ height: totalH, paddingLeft: 8, paddingRight: 8 }}>
                {/* ── Left label column ───────────────────────────────── */}
                <div
                    className="shrink-0 flex flex-col"
                    style={{
                        width: LABEL_W,
                        paddingTop: RULER_H + (hasWaveform ? WAVEFORM_H : 0),
                    }}
                >
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
                            <div
                                className="pointer-events-none absolute inset-y-0 w-px bg-indigo-400 opacity-60"
                                style={{ left: scrubPercent }}
                            />
                        </div>
                    )}

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

                                    let left: string;
                                    let width: string;

                                    if (navigationMode === 'time_driven') {
                                        let start = entry.inTime ?? entry.start ?? 0;
                                        let end = entry.exitTime ?? entry.end ?? totalDuration;

                                        // Live drag preview: override edges without mutating the store.
                                        if (resizeDrag) {
                                            if (resizeDrag.entryId === entry.id) {
                                                if (resizeDrag.edge === 'in') start = resizeDrag.time;
                                                else end = resizeDrag.time;
                                            } else if (resizeDrag.neighbourId === entry.id) {
                                                // Roll neighbour: its opposite edge follows.
                                                if (resizeDrag.edge === 'in') end = resizeDrag.time;
                                                else start = resizeDrag.time;
                                            }
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
                                    const isBeingDragged =
                                        resizeDrag?.entryId === entry.id ||
                                        resizeDrag?.neighbourId === entry.id;

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
                                                opacity:
                                                    isSelected || isBeingDragged ? 1 : 0.75,
                                                outline:
                                                    isSelected || isBeingDragged
                                                        ? '2px solid #818cf8'
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
                                            {/* Body — click to select */}
                                            <button
                                                className="absolute inset-0 flex items-center px-2"
                                                style={{ cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (resizeDrag) return;
                                                    selectEntry(entry.id);
                                                    if (navigationMode === 'time_driven') {
                                                        seek(
                                                            entry.inTime ?? entry.start ?? 0
                                                        );
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

                    {/* Scrub head (on top of everything) */}
                    <div
                        className="pointer-events-none absolute inset-y-0 z-10"
                        style={{ left: scrubPercent, transform: 'translateX(-1px)' }}
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
                </div>
            </div>
        </div>
    );
}
