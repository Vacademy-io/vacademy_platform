import { useRef, useCallback, useMemo } from 'react';
import { useVideoEditorStore } from './stores/video-editor-store';
import { assignTracks, getEntryColor, computeTotalDuration } from './utils/track-layout';
import { clamp } from './utils/coord-convert';

const TRACK_H = 22; // px per track row
const HEADER_H = 20; // time ruler height
const PADDING_X = 8; // horizontal padding (px)

function formatSec(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Horizontal multi-track timeline scrubber.
 *
 * time_driven  – shows entries as time-proportional blocks, scrubs in seconds.
 * user_driven  – shows entries as equal-width sequential blocks, scrubs by index.
 */
export function TimelineScrubber() {
    const { entries, meta, currentTime, selectedEntryId, seek, selectEntry } =
        useVideoEditorStore();

    const barRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const navigationMode = meta.navigation;
    const totalDuration = useMemo(
        () => computeTotalDuration(entries, meta.total_duration),
        [entries, meta.total_duration]
    );
    const trackEntries = useMemo(() => assignTracks(entries), [entries]);
    const trackCount = useMemo(
        () => Math.max(1, ...trackEntries.map((te) => te.track + 1)),
        [trackEntries]
    );

    // Convert a mouse X position (relative to the bar) to a time / index
    const xToTime = useCallback(
        (clientX: number): number => {
            const bar = barRef.current;
            if (!bar) return 0;
            const { left, width } = bar.getBoundingClientRect();
            const ratio = clamp((clientX - left - PADDING_X) / (width - PADDING_X * 2), 0, 1);
            return ratio * totalDuration;
        },
        [totalDuration]
    );

    const startDrag = useCallback(
        (e: React.MouseEvent | React.TouchEvent) => {
            e.stopPropagation();
            isDragging.current = true;

            const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX;
            seek(xToTime(clientX));

            const onMove = (ev: MouseEvent | TouchEvent) => {
                if (!isDragging.current) return;
                const cx =
                    'touches' in ev
                        ? (ev as TouchEvent).touches[0]!.clientX
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

    const timeToPercent = (t: number) => `${((t / totalDuration) * 100).toFixed(4)}%`;

    const scrubPercent = timeToPercent(
        navigationMode === 'time_driven' ? currentTime : Math.min(currentTime, totalDuration - 1)
    );

    // Tick mark interval based on total duration
    const tickInterval =
        totalDuration < 30 ? 5 : totalDuration < 120 ? 15 : totalDuration < 300 ? 30 : 60;
    const ticks = useMemo(() => {
        if (navigationMode !== 'time_driven') return [];
        const arr: number[] = [];
        for (let t = 0; t <= totalDuration; t += tickInterval) arr.push(t);
        return arr;
    }, [totalDuration, tickInterval, navigationMode]);

    const totalH = HEADER_H + trackCount * TRACK_H + 4;

    return (
        <div
            className="shrink-0 select-none border-t border-gray-200 bg-white"
            style={{ height: totalH + 28, minHeight: 70 }}
        >
            {/* Current time label + duration */}
            <div className="flex items-center justify-between px-3 py-1">
                <span className="font-mono text-xs text-indigo-600">
                    {navigationMode === 'time_driven'
                        ? formatSec(currentTime)
                        : `${Math.floor(currentTime) + 1} / ${entries.length}`}
                </span>
                <span className="font-mono text-xs text-gray-400">
                    {navigationMode === 'time_driven'
                        ? formatSec(totalDuration)
                        : `${entries.length} entries`}
                </span>
            </div>

            {/* Timeline bar */}
            <div
                ref={barRef}
                className="relative mx-2 cursor-pointer overflow-hidden rounded"
                style={{ height: totalH }}
                onMouseDown={startDrag}
                onTouchStart={startDrag}
            >
                {/* Light background */}
                <div className="absolute inset-0 rounded bg-gray-100" />

                {/* Time ruler */}
                <div
                    className="absolute inset-x-0 top-0 border-b border-gray-200"
                    style={{ height: HEADER_H }}
                >
                    {ticks.map((t) => (
                        <div
                            key={t}
                            className="absolute flex flex-col items-center"
                            style={{
                                left: `calc(${PADDING_X}px + ${(t / totalDuration) * 100}% * (1 - ${(PADDING_X * 2) / 100}))`,
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

                {/* Entry blocks per track */}
                {trackEntries.map(({ entry, track }) => {
                    const isSelected = entry.id === selectedEntryId;
                    const color = getEntryColor(entry.id, entry.z);

                    let left: string;
                    let width: string;

                    if (navigationMode === 'time_driven') {
                        const start = entry.inTime ?? entry.start ?? 0;
                        const end = entry.exitTime ?? entry.end ?? totalDuration;
                        const safeEnd = Math.min(end, totalDuration);
                        left = timeToPercent(start);
                        width = `${(((safeEnd - start) / totalDuration) * 100).toFixed(4)}%`;
                    } else {
                        // equal-width sequential
                        const idx = entries.indexOf(entry);
                        left = timeToPercent(idx);
                        width = `${(1 / totalDuration) * 100}%`;
                    }

                    const top = HEADER_H + track * TRACK_H + 2;

                    return (
                        <button
                            key={entry.id}
                            className="absolute rounded-sm transition-opacity hover:opacity-90"
                            style={{
                                left,
                                width,
                                top,
                                height: TRACK_H - 4,
                                background: color,
                                opacity: isSelected ? 1 : 0.75,
                                outline: isSelected ? '2px solid #818cf8' : 'none',
                                outlineOffset: 1,
                                overflow: 'hidden',
                                padding: '0 3px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                selectEntry(entry.id);
                                // Also seek to this entry's start
                                if (navigationMode === 'time_driven') {
                                    seek(entry.inTime ?? entry.start ?? 0);
                                } else {
                                    seek(entries.indexOf(entry));
                                }
                            }}
                        >
                            <span
                                className="truncate text-white"
                                style={{ fontSize: 9, lineHeight: 1, fontFamily: 'monospace' }}
                            >
                                {entry.id}
                            </span>
                        </button>
                    );
                })}

                {/* Scrub head */}
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
    );
}
