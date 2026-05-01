import { useEffect } from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';
import { useVideoEditorStore } from '../stores/video-editor-store';
import { play, pause, stop, useIsPlaying } from './playback-engine';

function formatTime(s: number): string {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s - Math.floor(s)) * 10);
    return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
}

/**
 * Tiny subscriber so the time readout updates from currentTime ticks without
 * re-rendering the parent bar (which would flash the play/pause button).
 */
function CurrentTimeReadout() {
    const currentTime = useVideoEditorStore((s) => s.currentTime);
    return <span className="font-mono tabular-nums">{formatTime(currentTime)}</span>;
}

function TotalDurationReadout() {
    const total = useVideoEditorStore((s) => s.meta.total_duration ?? 0);
    return <span className="font-mono tabular-nums text-gray-400">{formatTime(total)}</span>;
}

export function PlaybackBar() {
    const isPlaying = useIsPlaying();

    // Space toggles play/pause when not focused inside an input.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
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
            e.preventDefault();
            if (isPlaying) pause();
            else void play();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isPlaying]);

    return (
        <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 py-1.5">
            <button
                type="button"
                onClick={() => stop()}
                title="Stop and rewind to 0"
                className="flex size-7 items-center justify-center rounded text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
                <SkipBack className="size-4" />
            </button>

            <button
                type="button"
                onClick={() => (isPlaying ? pause() : void play())}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                className="flex size-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700"
            >
                {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
            </button>

            <div className="flex items-center gap-1 text-xs text-gray-700">
                <CurrentTimeReadout />
                <span className="text-gray-400">/</span>
                <TotalDurationReadout />
            </div>

            {isPlaying && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-indigo-600">
                    playing
                </span>
            )}
        </div>
    );
}
