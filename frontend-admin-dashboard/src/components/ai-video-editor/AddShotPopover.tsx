import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

import { SentenceClip } from '@/components/ai-video-player/types';
import { TimelineGap, useVideoEditorStore } from './stores/video-editor-store';

interface Props {
    /** The detected gap on the timeline. The popover fills exactly this range. */
    gap: TimelineGap;
    /** Anchor in viewport coordinates — same convention as SentenceEditPopover.
     *  Caller passes the gap region's centre X (viewport space) and the Y of
     *  the region's TOP, and the popover renders just above that point. */
    anchorViewportX: number;
    anchorViewportTop: number;
    onClose: () => void;
}

const POPOVER_WIDTH = 380;
const POPOVER_MARGIN = 8;
const POPOVER_GAP_ABOVE_ANCHOR = 6;

/**
 * Floating editor anchored above an empty region on the timeline.
 *
 * UX:
 *   - Shows the narration that already plays in this range (read-only)
 *     so the user can see what they're matching visuals to.
 *   - User can add an optional one-line hint to steer the visual style.
 *   - "Generate shot" calls the server which builds one HTML shot for
 *     this range and inserts it into the timeline (no audio change).
 *   - On success the popover closes itself; on failure it shows an
 *     inline error and the user can retry.
 */
export function AddShotPopover({ gap, anchorViewportX, anchorViewportTop, onClose }: Props) {
    const { insertShot, insertingGapKey, meta } = useVideoEditorStore();
    const [hint, setHint] = useState('');
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isInserting = insertingGapKey === gap.key;
    const isAnotherInserting = insertingGapKey != null && insertingGapKey !== gap.key;
    const canSubmit = !isInserting && !isAnotherInserting;
    const duration = gap.end - gap.start;

    // Speech context — same source the server reads. The user sees this
    // exact text so they understand what the LLM has to work with before
    // typing a hint (or deciding not to).
    const speechText = useMemo(
        () => sliceSpeech(meta.sentences ?? [], gap.start, gap.end),
        [meta.sentences, gap.start, gap.end]
    );

    useEffect(() => {
        setHint('');
        setError(null);
        textareaRef.current?.focus();
    }, [gap.key]);

    // Close on outside click + Escape — skipped while a request is in
    // flight so an accidental click doesn't ditch in-progress work.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isInserting) onClose();
        };
        const handleClick = (e: MouseEvent) => {
            if (isInserting) return;
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        window.addEventListener('click', handleClick);
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('click', handleClick);
        };
    }, [onClose, isInserting]);

    const left = useMemo(() => {
        const half = POPOVER_WIDTH / 2;
        const min = POPOVER_MARGIN;
        const max = Math.max(min, window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN);
        return Math.min(max, Math.max(min, anchorViewportX - half));
    }, [anchorViewportX]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setError(null);
        const result = await insertShot(gap, hint.trim() || null);
        if (result.ok) {
            toast.success('Shot generated and inserted into the timeline');
            onClose();
        } else {
            const msg = result.error || 'Failed to generate shot';
            setError(msg);
            toast.error(msg);
        }
    };

    return createPortal(
        <div
            ref={containerRef}
            role="dialog"
            aria-label="Insert new shot in gap"
            className="fixed z-[1000] flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 shadow-xl"
            style={{
                left,
                bottom: window.innerHeight - anchorViewportTop + POPOVER_GAP_ABOVE_ANCHOR,
                width: POPOVER_WIDTH,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span>Add shot in gap</span>
                    <span className="text-[10px] font-normal text-gray-400">
                        {gap.start.toFixed(2)}s → {gap.end.toFixed(2)}s · {duration.toFixed(2)}s
                    </span>
                </div>
                <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    disabled={isInserting}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <X className="size-3.5" />
                </button>
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Narration in this range
                </div>
                <div className="max-h-20 overflow-y-auto text-[12px] leading-snug text-gray-700">
                    {speechText || (
                        <span className="italic text-gray-400">
                            (No narration plays here — visuals will be generated from your hint
                            alone.)
                        </span>
                    )}
                </div>
            </div>

            <textarea
                ref={textareaRef}
                value={hint}
                onChange={(e) => {
                    setHint(e.target.value);
                    if (error) setError(null);
                }}
                disabled={isInserting}
                rows={2}
                maxLength={500}
                placeholder="Optional visual hint — e.g. show three labeled boxes connecting with arrows…"
                className="resize-y rounded border border-gray-200 px-2 py-1.5 text-sm leading-snug text-gray-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 disabled:bg-gray-50 disabled:text-gray-500"
            />

            <p className="text-[11px] text-gray-500">
                We&apos;ll generate one HTML shot covering this range. Audio is unchanged — gaps are
                duration-neutral.
            </p>

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <div className="mt-1 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isInserting}
                    className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isInserting ? 'Generating…' : 'Generate shot'}
                </button>
            </div>
        </div>,
        document.body
    );
}

/** Concatenate every sentence whose audio overlaps `[start, end]`. Mirrors
 *  the server-side `_slice_speech_text` so the popover's preview matches
 *  exactly what the LLM will see. */
function sliceSpeech(sentences: SentenceClip[], start: number, end: number): string {
    const parts: string[] = [];
    for (const s of sentences) {
        const sStart = s.start_time;
        const sEnd = sStart + s.duration;
        if (sEnd <= start || sStart >= end) continue;
        const text = (s.text ?? '').trim();
        if (text) parts.push(text);
    }
    return parts.join(' ');
}
