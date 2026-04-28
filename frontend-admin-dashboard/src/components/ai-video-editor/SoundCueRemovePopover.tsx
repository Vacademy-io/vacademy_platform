import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

import { SoundCue } from '@/components/ai-video-player/types';
import { useVideoEditorStore } from './stores/video-editor-store';

interface Props {
    /** The clicked cue. The popover surfaces its role/url and a Remove action. */
    cue: SoundCue;
    /** Owning entry id — needed to scope the removal so the store knows
     *  which entry to mark dirty. */
    entryId: string;
    /** Anchor in viewport coordinates (portal-rendered). */
    anchorViewportX: number;
    anchorViewportTop: number;
    onClose: () => void;
}

const POPOVER_WIDTH = 240;
const POPOVER_MARGIN = 8;
const POPOVER_GAP_ABOVE_ANCHOR = 6;

/**
 * Tiny floating menu anchored above a sound-effect marker on the audio
 * waveform. Lets the user remove the cue with one click.
 *
 * Removal is local-only: the store action mutates the entry's
 * `sound_cues` array and marks the entry dirty. The change is persisted
 * to S3 via `frame/update` on the next saveChanges, matching how every
 * other entry-scoped edit in the editor works.
 */
export function SoundCueRemovePopover({
    cue,
    entryId,
    anchorViewportX,
    anchorViewportTop,
    onClose,
}: Props) {
    const { removeSoundCue } = useVideoEditorStore();
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click + Escape — same UX as the sentence popover.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const handleClick = (e: MouseEvent) => {
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
    }, [onClose]);

    const left = useMemo(() => {
        const half = POPOVER_WIDTH / 2;
        const min = POPOVER_MARGIN;
        const max = Math.max(min, window.innerWidth - POPOVER_WIDTH - POPOVER_MARGIN);
        return Math.min(max, Math.max(min, anchorViewportX - half));
    }, [anchorViewportX]);

    const handleRemove = () => {
        removeSoundCue(entryId, cue.id);
        toast.success('Sound effect removed (save to publish)');
        onClose();
    };

    // Trim the URL to the filename for display — full S3 URLs are noisy.
    const filename = cue.url.split('/').pop() ?? cue.url;

    return createPortal(
        <div
            ref={containerRef}
            role="menu"
            aria-label="Sound effect actions"
            className="fixed z-[1000] flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl"
            style={{
                left,
                bottom: window.innerHeight - anchorViewportTop + POPOVER_GAP_ABOVE_ANCHOR,
                width: POPOVER_WIDTH,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-start gap-1.5">
                <Volume2 className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-gray-700" title={cue.role}>
                        {cue.role || 'Sound effect'}
                    </div>
                    <div className="truncate text-[10px] text-gray-400" title={cue.url}>
                        {filename}
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={handleRemove}
                className="flex items-center justify-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
            >
                <Trash2 className="size-3" />
                Remove
            </button>
        </div>,
        document.body,
    );
}
