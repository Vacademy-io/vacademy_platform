/**
 * Click-to-play preview of a time segment inside a long source video.
 *
 * Uses a media-fragment URL (`#t=start,end`) so the browser only fetches
 * the bytes around the segment, with `preload="none"` so a grid of 30
 * cards issues ZERO video requests until the user actually clicks play.
 *
 * Media fragments reliably start playback at `t_start`, but browsers do
 * NOT reliably stop at `t_end` — so a `timeupdate` guard pauses (and pins
 * back to the boundary) once the segment is over. Replaying after the
 * segment ended seeks back to `t_start` first.
 *
 * Plays WITH sound: the whole point is letting the user hear the clip
 * before committing to a render, and click-to-play satisfies autoplay
 * policies for unmuted playback.
 */
import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tolerance for the end-of-segment guard. `timeupdate` fires ~4×/s, so
 *  without a small lead the clip can overshoot the boundary by ~250ms. */
const END_GUARD_S = 0.05;

interface SegmentPlayerProps {
    /** Source video URL WITHOUT a fragment — the component appends `#t=`. */
    src: string;
    tStart: number;
    tEnd: number;
    /** Poster shown before first play. When absent the wrapper background
     *  shows through (callers render their own placeholder underneath). */
    poster?: string | null;
    className?: string;
}

export function SegmentPlayer({ src, tStart, tEnd, poster, className }: SegmentPlayerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);

    const fragmentSrc = `${src}#t=${tStart.toFixed(2)},${tEnd.toFixed(2)}`;

    const toggle = (e: React.MouseEvent) => {
        // The player often sits inside a selectable card — playback must
        // not also toggle the card's selection.
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        if (playing) {
            v.pause();
            return;
        }
        // Re-arm the segment: after the end-guard pauses us at t_end (or if
        // the fragment hasn't seeked yet), restart from the segment start.
        if (v.currentTime < tStart || v.currentTime >= tEnd - END_GUARD_S) {
            v.currentTime = tStart;
        }
        setStarted(true);
        void v.play().catch(() => {
            // Source URL unreachable / codec unsupported — leave the poster
            // up; the card's render path is unaffected.
            setPlaying(false);
        });
    };

    const onTimeUpdate = () => {
        const v = videoRef.current;
        if (!v) return;
        // Media fragments don't always stop at t_end — enforce it here.
        if (v.currentTime >= tEnd - END_GUARD_S) {
            v.pause();
            v.currentTime = tEnd;
        }
    };

    return (
        <div
            className={cn('group/player relative cursor-pointer overflow-hidden bg-neutral-900', className)}
            onClick={toggle}
            role="button"
            aria-label={playing ? 'Pause clip preview' : 'Play clip preview'}
        >
            <video
                ref={videoRef}
                src={fragmentSrc}
                poster={poster ?? undefined}
                preload="none"
                playsInline
                className="size-full object-cover"
                onTimeUpdate={onTimeUpdate}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
            />
            {/* Play / pause affordance. Always visible while paused; only on
                hover while playing so it doesn't sit over the speaker. */}
            <span
                className={cn(
                    'pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity',
                    playing ? 'opacity-0 group-hover/player:opacity-100' : 'opacity-100',
                    !started && !poster && 'bg-neutral-800/60'
                )}
            >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                    {playing ? (
                        <Pause className="size-4" fill="currentColor" />
                    ) : (
                        <Play className="size-4 translate-x-px" fill="currentColor" />
                    )}
                </span>
            </span>
        </div>
    );
}
