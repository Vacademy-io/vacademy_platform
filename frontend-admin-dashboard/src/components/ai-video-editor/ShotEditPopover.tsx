import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Film, Lock, Mic, X } from 'lucide-react';
import { toast } from 'sonner';

import { ShotClip } from '@/components/ai-video-player/types';
import { useVideoEditorStore } from './stores/video-editor-store';

interface Props {
    /** The shot the user clicked on. The popover edits its `text`. */
    shot: ShotClip;
    /** Anchor in viewport coordinates — mirrors `SentenceEditPopover`. */
    anchorViewportX: number;
    anchorViewportTop: number;
    /** Number of other entries that will be re-timed when this shot is
     *  re-narrated (caller computes from the timeline). */
    affectedEntryCount: number;
    onClose: () => void;
}

const POPOVER_WIDTH = 360;
const POPOVER_MARGIN = 8;
const POPOVER_GAP_ABOVE_ANCHOR = 6;

/**
 * Floating editor anchored above a shot region on the audio waveform.
 *
 * This is the v3 counterpart to `SentenceEditPopover` — same UX shape,
 * different editing unit. Use this whenever `timeline.meta.shots[]` is
 * populated (preferred). Falls back to `SentenceEditPopover` for legacy
 * timelines that only have `meta.sentences[]`.
 *
 * Intrinsic-only shots (source-clip speaker, AI_VIDEO_HERO + Veo audio)
 * are rendered as a READ-ONLY view: there is no narration to re-narrate,
 * the audio comes from the shot's own video track. The popover surfaces
 * this with a Lock icon + helper text rather than the textarea.
 */
export function ShotEditPopover({
    shot,
    anchorViewportX,
    anchorViewportTop,
    affectedEntryCount,
    onClose,
}: Props) {
    const { regenerateShot, regeneratingShotIdx, regeneratingSentenceId } =
        useVideoEditorStore();
    const [draft, setDraft] = useState(shot.text);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isIntrinsic = shot.audio_policy === 'intrinsic_only';
    const isRegenerating = regeneratingShotIdx === shot.shot_idx;
    // Mirror the store's exclusivity rule: only one master-audio mutation
    // in flight at a time across sentence + shot units.
    const isAnotherRegenerating =
        (regeneratingShotIdx != null && regeneratingShotIdx !== shot.shot_idx) ||
        regeneratingSentenceId != null;

    const trimmed = draft.trim();
    const dirty = !isIntrinsic && trimmed.length > 0 && trimmed !== shot.text.trim();
    const canSubmit = dirty && !isRegenerating && !isAnotherRegenerating;

    // Reset the draft when a different shot is selected (parent re-renders
    // with the same component instance).
    useEffect(() => {
        setDraft(shot.text);
        setError(null);
        textareaRef.current?.focus();
        textareaRef.current?.select();
    }, [shot.shot_idx, shot.text]);

    // Close on outside click + Escape. Skipped while regenerating so an
    // accidental click doesn't ditch in-flight work.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isRegenerating) onClose();
        };
        const handleClick = (e: MouseEvent) => {
            if (isRegenerating) return;
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
    }, [onClose, isRegenerating]);

    const left = useMemo(() => {
        const half = POPOVER_WIDTH / 2;
        const min = POPOVER_MARGIN;
        const max = Math.max(min, window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN);
        return Math.min(max, Math.max(min, anchorViewportX - half));
    }, [anchorViewportX]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setError(null);
        const result = await regenerateShot(shot.shot_idx, trimmed);
        if (result.ok) {
            toast.success('Shot re-narrated and audio updated');
            onClose();
        } else {
            const msg = result.error || 'Re-narration failed';
            setError(msg);
            toast.error(msg);
        }
    };

    return createPortal(
        <div
            ref={containerRef}
            role="dialog"
            aria-label={isIntrinsic ? 'Shot uses intrinsic audio' : 'Edit shot script'}
            className="fixed z-[1000] flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
            style={{
                left,
                bottom: window.innerHeight - anchorViewportTop + POPOVER_GAP_ABOVE_ANCHOR,
                width: POPOVER_WIDTH,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                    {isIntrinsic ? (
                        <Lock className="size-3.5 text-amber-500" />
                    ) : (
                        <Mic className="size-3.5 text-indigo-500" />
                    )}
                    <span>{isIntrinsic ? 'Intrinsic audio' : 'Edit shot'}</span>
                    <span className="text-[10px] font-normal text-gray-400">
                        {shot.id} · {shot.shot_type} · {shot.duration.toFixed(2)}s
                    </span>
                </div>
                <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    disabled={isRegenerating}
                    className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <X className="size-3.5" />
                </button>
            </div>

            {/* Narration brief — ShotPlanner's per-shot intent. Surfaces the
                "what this shot should say" hint so the user has design
                context while editing. Hidden for intrinsic shots. */}
            {!isIntrinsic && shot.narration_brief && (
                <div className="flex items-start gap-1.5 rounded bg-indigo-50 px-2 py-1.5 text-[11px] leading-snug text-indigo-900">
                    <Film className="mt-0.5 size-3 shrink-0 text-indigo-500" />
                    <span>{shot.narration_brief}</span>
                </div>
            )}

            {isIntrinsic ? (
                <p className="rounded bg-amber-50 px-2 py-2 text-[11px] leading-snug text-amber-900">
                    This shot uses audio from its own video track ({shot.shot_type}). Master
                    narration is silenced in this window — there is no script to re-narrate.
                    To change the audio, edit the underlying source asset.
                </p>
            ) : (
                <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        if (error) setError(null);
                    }}
                    disabled={isRegenerating || isAnotherRegenerating}
                    rows={3}
                    placeholder="Shot narration…"
                    className="resize-y rounded border border-gray-200 px-2 py-1.5 text-sm leading-snug text-gray-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
                />
            )}

            {!isIntrinsic && affectedEntryCount > 0 && (
                <p className="text-[11px] text-amber-600">
                    Re-narrating this shot will shift {affectedEntryCount}{' '}
                    {affectedEntryCount === 1 ? 'shot' : 'shots'} downstream.
                </p>
            )}

            {error && <p className="text-[11px] text-red-500">{error}</p>}

            <div className="mt-1 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isRegenerating}
                    className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isIntrinsic ? 'Close' : 'Cancel'}
                </button>
                {!isIntrinsic && (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isRegenerating ? 'Re-narrating…' : 'Re-narrate'}
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
}
