/**
 * SilentTailNotice — amber strip shown when the timeline's content extends
 * past the end of the narration (B19): a shot was added at the end, ripple-
 * dragged outward, or stretched, so the tail of the video plays with no
 * narration audio and nothing tells the user.
 *
 * Coverage math (master-timeline coordinates):
 *  - narration end = max(shot.start_time + shot.duration) over meta.shots[].
 *    Muted shots keep their duration slot, so muting a shot does NOT trigger
 *    this notice — only genuinely uncovered tail does.
 *  - content end   = max(entry.exitTime) over NON-branding entries. The
 *    branding outro is intentionally narration-free and excluded.
 * Legacy timelines without meta.shots[] are skipped — there is no reliable
 * narration-coverage signal to compare against.
 */
import { useMemo, useState } from 'react';
import { VolumeX, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { useVideoEditorStore } from './stores/video-editor-store';

/** Tails shorter than this are inaudible-in-practice (outro fades, rounding). */
const MIN_GAP_S = 1.5;
/** After a dismissal, only reappear when the gap has grown by this much. */
const REAPPEAR_GROWTH_S = 2;

export function SilentTailNotice() {
    const { entries, shots } = useVideoEditorStore(
        useShallow((s) => ({ entries: s.entries, shots: s.meta.shots }))
    );
    const [dismissedAtGap, setDismissedAtGap] = useState<number | null>(null);

    const gap = useMemo(() => {
        if (!shots || shots.length === 0) return 0;
        let narrationEnd = 0;
        for (const sh of shots) {
            const end = (sh.start_time ?? 0) + (sh.duration ?? 0);
            if (end > narrationEnd) narrationEnd = end;
        }
        if (narrationEnd <= 0) return 0;
        let contentEnd = 0;
        for (const e of entries) {
            if (e.id?.startsWith('branding-')) continue;
            const end = e.exitTime ?? e.end;
            if (typeof end === 'number' && end > contentEnd) contentEnd = end;
        }
        return contentEnd - narrationEnd;
    }, [entries, shots]);

    if (gap < MIN_GAP_S) return null;
    if (dismissedAtGap != null && gap < dismissedAtGap + REAPPEAR_GROWTH_S) return null;

    return (
        <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1.5">
            <VolumeX className="size-3.5 shrink-0 text-amber-500" />
            <p className="flex-1 text-[11px] leading-snug text-amber-800">
                The last ~{Math.round(gap)}s of the video have no narration and will play silent.
                Loop a background track (Audio Tracks → &ldquo;Loop until video end&rdquo;) or
                re-narrate the last shot with longer text to cover it.
            </p>
            <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissedAtGap(gap)}
                className="shrink-0 rounded p-0.5 text-amber-400 hover:bg-amber-100 hover:text-amber-600"
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
