import { useState, useCallback, useMemo } from 'react';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useVideoEditorStore } from './stores/video-editor-store';
import { Entry } from '@/components/ai-video-player/types';

// ── Blank HTML template for new shots ──────────────────────────────────────

const BLANK_SHOT_HTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);font-family:system-ui,sans-serif;color:#ffffff;">
  <div style="text-align:center;max-width:80%;padding:40px;">
    <p style="font-size:clamp(32px,5vw,72px);font-weight:700;margin:0;line-height:1.1;">New Shot</p>
    <p style="font-size:clamp(14px,2vw,32px);margin-top:16px;opacity:0.6;">Select this entry and use the HTML tab to edit its content</p>
  </div>
</div>`;

type Position = 'start' | 'current' | 'end' | 'custom';

interface AddShotDialogProps {
    open: boolean;
    onClose: () => void;
}

/**
 * Dialog that inserts a new blank HTML shot into the timeline.
 *
 * Supports:
 *  - At start (before first entry)
 *  - At current scrub time
 *  - At end (after last entry)
 *  - Custom inTime / exitTime
 *
 * For user_driven videos, the shot is simply appended at the end.
 */
export function AddShotDialog({ open, onClose }: AddShotDialogProps) {
    const { entries, meta, currentTime, addEntry, newEntryIds, selectEntry, seek } =
        useVideoEditorStore();

    const isTimeDriven = meta.navigation === 'time_driven';

    // B18: when the user has already added (but not saved) a blank shot at
    // the end, repeated "Add at end" clicks shouldn't stack more blanks —
    // they almost always meant "go to the one I just added". The last entry
    // qualifies as a stackable blank when:
    //   - it's in `newEntryIds` (added since last save), AND
    //   - its HTML still matches `BLANK_SHOT_HTML` exactly (i.e. the user
    //     hasn't edited it yet — if they have, they explicitly want another
    //     fresh blank).
    const lastEntry = entries[entries.length - 1];
    const existingUnsavedBlankAtEnd =
        lastEntry && newEntryIds.includes(lastEntry.id) && lastEntry.html === BLANK_SHOT_HTML
            ? lastEntry
            : null;

    // Derive sensible boundary values from the existing timeline
    const firstStart = useMemo(() => {
        if (!isTimeDriven || entries.length === 0) return 0;
        return Math.min(...entries.map((e) => e.inTime ?? e.start ?? 0));
    }, [entries, isTimeDriven]);

    const lastEnd = useMemo(() => {
        if (!isTimeDriven || entries.length === 0) return 5;
        return Math.max(...entries.map((e) => e.exitTime ?? e.end ?? 0));
    }, [entries, isTimeDriven]);

    const [position, setPosition] = useState<Position>('end');
    const [duration, setDuration] = useState(5);
    const [customIn, setCustomIn] = useState(0);
    const [customOut, setCustomOut] = useState(5);

    // Compute inTime / exitTime based on selected position
    const { inTime, exitTime } = useMemo((): { inTime: number; exitTime: number } => {
        if (!isTimeDriven) return { inTime: 0, exitTime: 0 }; // unused for user_driven

        switch (position) {
            case 'start': {
                const out = Math.max(0, firstStart);
                const inT = Math.max(0, out - duration);
                return { inTime: inT, exitTime: out };
            }
            case 'current':
                return { inTime: currentTime, exitTime: currentTime + duration };
            case 'end':
                return { inTime: lastEnd, exitTime: lastEnd + duration };
            case 'custom':
                return { inTime: customIn, exitTime: customOut };
        }
    }, [position, duration, firstStart, lastEnd, currentTime, customIn, customOut, isTimeDriven]);

    const isValid = !isTimeDriven || inTime < exitTime;

    const handleAdd = useCallback(() => {
        if (!isValid) return;

        // B18: don't stack blanks. If the user is adding "at end" and there's
        // already an unedited blank from this session sitting there, jump
        // to it instead.
        if (position === 'end' && existingUnsavedBlankAtEnd) {
            selectEntry(existingUnsavedBlankAtEnd.id);
            if (isTimeDriven) {
                const t = existingUnsavedBlankAtEnd.inTime ?? existingUnsavedBlankAtEnd.start ?? 0;
                seek(t);
            }
            onClose();
            return;
        }

        const id = `shot-${crypto.randomUUID()}`;
        const newEntry: Entry = isTimeDriven
            ? { id, html: BLANK_SHOT_HTML, z: 0, inTime, exitTime }
            : { id, html: BLANK_SHOT_HTML, z: 0 };

        addEntry(newEntry);
        onClose();
    }, [
        isValid,
        isTimeDriven,
        inTime,
        exitTime,
        addEntry,
        onClose,
        position,
        existingUnsavedBlankAtEnd,
        selectEntry,
        seek,
    ]);

    const fmt = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <FilePlus2 className="size-4 text-indigo-500" />
                        Add New Shot
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-1">
                    {isTimeDriven ? (
                        <>
                            {/* Position selector */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-gray-500">
                                    Insert position
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(
                                        [
                                            {
                                                id: 'start',
                                                label:
                                                    firstStart > 0
                                                        ? 'Before first shot'
                                                        : 'Before first shot',
                                                disabled: firstStart === 0,
                                            },
                                            {
                                                id: 'current',
                                                label: 'At current time',
                                                disabled: false,
                                            },
                                            { id: 'end', label: 'At end', disabled: false },
                                            {
                                                id: 'custom',
                                                label: 'Custom times',
                                                disabled: false,
                                            },
                                        ] as const
                                    ).map(({ id, label, disabled }) => (
                                        <button
                                            key={id}
                                            disabled={disabled}
                                            onClick={() => !disabled && setPosition(id)}
                                            className={[
                                                'rounded border px-3 py-1.5 text-left text-[11px] transition-colors',
                                                disabled
                                                    ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                                                    : position === id
                                                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                                            ].join(' ')}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Duration (for non-custom positions) */}
                            {position !== 'custom' && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-medium text-gray-500">
                                            Duration
                                        </label>
                                        <span className="font-mono text-[11px] text-gray-700">
                                            {duration}s
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={30}
                                        step={0.5}
                                        value={duration}
                                        onChange={(e) => setDuration(parseFloat(e.target.value))}
                                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
                                    />
                                </div>
                            )}

                            {/* Custom in/out */}
                            {position === 'custom' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-500">
                                            Start (s)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.5}
                                            value={customIn}
                                            onChange={(e) =>
                                                setCustomIn(parseFloat(e.target.value) || 0)
                                            }
                                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-medium text-gray-500">
                                            End (s)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.5}
                                            value={customOut}
                                            onChange={(e) =>
                                                setCustomOut(parseFloat(e.target.value) || 0)
                                            }
                                            className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* "Already unsaved" hint — replaces the preview
                                banner when the Add-Shot will just open the
                                existing blank (B18). */}
                            {position === 'end' && existingUnsavedBlankAtEnd ? (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                                    You already added an empty shot at the end.
                                    <span className="ml-1">
                                        Clicking <b>Open existing</b> will jump to it instead of
                                        creating another. Edit that one first, then come back to add
                                        more.
                                    </span>
                                </div>
                            ) : (
                                <div
                                    className={[
                                        'rounded-md border px-3 py-2 text-[11px]',
                                        isValid
                                            ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
                                            : 'border-red-200 bg-red-50 text-red-700',
                                    ].join(' ')}
                                >
                                    {isValid ? (
                                        <>
                                            <span className="font-mono">
                                                {fmt(inTime)} → {fmt(exitTime)}
                                            </span>
                                            <span className="ml-2 opacity-70">
                                                ({(exitTime - inTime).toFixed(1)}s)
                                            </span>
                                            {exitTime > (meta.total_duration ?? 0) && (
                                                <span className="ml-2 font-medium text-amber-600">
                                                    · extends timeline to {fmt(exitTime)}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        'Start must be before end'
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-gray-500">
                            A blank shot will be appended at the end of the entry sequence. You can
                            reorder entries in the list panel after adding.
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs">
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        disabled={!isValid}
                        onClick={handleAdd}
                        className="h-8 bg-indigo-600 text-xs text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                        {position === 'end' && existingUnsavedBlankAtEnd
                            ? 'Open existing'
                            : 'Add Shot'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
