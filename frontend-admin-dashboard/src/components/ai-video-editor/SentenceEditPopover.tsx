import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, X } from 'lucide-react';
import { toast } from 'sonner';

import { SentenceClip } from '@/components/ai-video-player/types';
import { useVideoEditorStore } from './stores/video-editor-store';
import { FriendlyError, humanizeNarrationError } from './utils/sentence-api';

interface Props {
    /** The sentence the user clicked on. The popover edits its `text`. */
    sentence: SentenceClip;
    /** Anchor in viewport coordinates — the popover renders via a portal
     *  with `position: fixed`, so we sidestep any overflow-hidden ancestor
     *  in the editor layout. The caller passes the centre X of the
     *  sentence region (in viewport space) and the Y of the region's TOP
     *  (popover bottom is placed just above that). */
    anchorViewportX: number;
    anchorViewportTop: number;
    /** How many other entries will be re-timed when this sentence is
     *  re-narrated. Caller computes this so the popover stays free of
     *  entry/overlap logic. */
    affectedEntryCount: number;
    onClose: () => void;
}

const POPOVER_WIDTH = 360;
const POPOVER_MARGIN = 8;
const POPOVER_GAP_ABOVE_ANCHOR = 6;

/**
 * Floating editor anchored above a sentence region on the audio waveform.
 *
 * UX:
 *   - Clicking outside / pressing Escape closes without saving.
 *   - "Re-narrate" calls the store action which TTSes the new text on the
 *     server, splices it into the global MP3, and ripples downstream
 *     timestamps. The popover stays open in a loading state until the
 *     server returns; on success it closes itself, on failure it shows
 *     an inline error and the user can retry.
 *   - The disable-when-unchanged guard mirrors the store's check so the
 *     button only lights up when there's something worth doing.
 */
export function SentenceEditPopover({
    sentence,
    anchorViewportX,
    anchorViewportTop,
    affectedEntryCount,
    onClose,
}: Props) {
    const { regenerateSentence, silenceSentence, regeneratingSentenceId } = useVideoEditorStore();
    const [draft, setDraft] = useState(sentence.text);
    const [error, setError] = useState<FriendlyError | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // A silenced sentence is one whose audio was muted via /sentence/silence;
    // we detect it by an empty text + audio_url pair. The popover's UX
    // pivots from "Re-narrate" to "Add narration" in that case so the user
    // understands they're filling an empty slot rather than overwriting
    // existing words.
    const isSilenced = sentence.text.trim() === '' && (sentence.audio_url ?? '') === '';

    const isRegenerating = regeneratingSentenceId === sentence.id;
    const isAnotherRegenerating =
        regeneratingSentenceId != null && regeneratingSentenceId !== sentence.id;
    const trimmed = draft.trim();
    // For silenced sentences any non-empty text is a valid submission;
    // for regular sentences we require a real change vs the saved text.
    const dirty = isSilenced
        ? trimmed.length > 0
        : trimmed.length > 0 && trimmed !== sentence.text.trim();
    const canSubmit = dirty && !isRegenerating && !isAnotherRegenerating;
    const canSilence = !isSilenced && !isRegenerating && !isAnotherRegenerating;

    // Reset the draft when a different sentence is selected (parent
    // re-renders with the same component instance).
    useEffect(() => {
        setDraft(sentence.text);
        setError(null);
        // Focus the textarea on open so the user can start typing
        // immediately without needing a click.
        textareaRef.current?.focus();
        textareaRef.current?.select();
    }, [sentence.id, sentence.text]);

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
        // `click` instead of `mousedown` so the click that opened us
        // doesn't also close us on the same event tick.
        window.addEventListener('click', handleClick);
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('click', handleClick);
        };
    }, [onClose, isRegenerating]);

    const left = useMemo(() => {
        // Centre on the anchor, then clamp to the viewport so the popover
        // is always fully visible regardless of where the user clicked.
        const half = POPOVER_WIDTH / 2;
        const min = POPOVER_MARGIN;
        const max = Math.max(min, window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN);
        return Math.min(max, Math.max(min, anchorViewportX - half));
    }, [anchorViewportX]);

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setError(null);
        const result = await regenerateSentence(sentence.id, trimmed);
        if (result.ok) {
            toast.success(
                isSilenced ? 'Narration added' : 'Sentence re-narrated and audio updated'
            );
            onClose();
        } else {
            const friendly = humanizeNarrationError(result.error || '', 'Re-narration failed');
            setError(friendly);
            toast.error(friendly.message);
        }
    };

    const handleSilence = async () => {
        if (!canSilence) return;
        setError(null);
        const result = await silenceSentence(sentence.id);
        if (result.ok) {
            toast.success('Sentence muted — audio replaced with silence');
            onClose();
        } else {
            const friendly = humanizeNarrationError(result.error || '', 'Failed to mute sentence');
            setError(friendly);
            toast.error(friendly.message);
        }
    };

    return createPortal(
        <div
            ref={containerRef}
            role="dialog"
            aria-label="Edit sentence script"
            className="fixed z-[1000] flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
            style={{
                left,
                // `bottom` from the viewport's bottom edge; the popover grows
                // upward from the anchor's top so it sits above the sentence
                // region with a small visual gap.
                bottom: window.innerHeight - anchorViewportTop + POPOVER_GAP_ABOVE_ANCHOR,
                width: POPOVER_WIDTH,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                    {isSilenced ? (
                        <MicOff className="size-3.5 text-gray-400" />
                    ) : (
                        <Mic className="size-3.5 text-indigo-500" />
                    )}
                    <span>{isSilenced ? 'Silenced sentence' : 'Edit sentence'}</span>
                    <span className="text-[10px] font-normal text-gray-400">
                        {sentence.id} · {sentence.duration.toFixed(2)}s
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

            <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                    setDraft(e.target.value);
                    if (error) setError(null);
                }}
                disabled={isRegenerating}
                rows={3}
                placeholder={
                    isSilenced ? 'Type the new narration for this slot…' : 'Sentence text…'
                }
                className="resize-y rounded border border-gray-200 px-2 py-1.5 text-sm leading-snug text-gray-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:bg-gray-50 disabled:text-gray-500"
            />

            {!isSilenced && affectedEntryCount > 0 && (
                <p className="text-[11px] text-amber-600">
                    Re-narrating this sentence will also shift {affectedEntryCount}{' '}
                    {affectedEntryCount === 1 ? 'shot' : 'shots'} on the timeline.
                </p>
            )}

            {isSilenced && (
                <p className="text-[11px] text-gray-500">
                    This slot is currently silent ({sentence.duration.toFixed(2)}s). Type new
                    narration above and press “Add narration” to fill it.
                </p>
            )}

            {error && (
                <div className="flex flex-col gap-1">
                    <p className="text-[11px] text-red-500">{error.message}</p>
                    {error.detail && (
                        <details className="text-[10px] text-gray-400">
                            <summary className="cursor-pointer select-none hover:text-gray-600">
                                Technical details
                            </summary>
                            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-1.5 leading-snug text-gray-500">
                                {error.detail}
                            </pre>
                        </details>
                    )}
                </div>
            )}

            <div className="mt-1 flex items-center justify-end gap-2">
                {/* Silence sits to the LEFT of the primary action so a quick
                    misclick on the right side doesn't mute by accident.
                    Hidden once the sentence is already silenced. */}
                {!isSilenced && (
                    <button
                        type="button"
                        onClick={handleSilence}
                        disabled={!canSilence}
                        title="Replace this sentence's audio with silence (preserves timing)"
                        className="mr-auto flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <MicOff className="size-3" />
                        Silence
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isRegenerating}
                    className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded bg-indigo-500 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isRegenerating
                        ? isSilenced
                            ? 'Adding…'
                            : 'Re-narrating…'
                        : isSilenced
                          ? 'Add narration'
                          : 'Re-narrate'}
                </button>
            </div>
        </div>,
        document.body
    );
}
