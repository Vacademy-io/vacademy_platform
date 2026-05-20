/**
 * Per-shot caption override control. Lives in the PropertiesPanel's Layers tab
 * when an entry is selected. Lets the user force captions to top / bottom /
 * hidden for one shot without changing the global caption settings.
 *
 * Persists via `entry.entry_meta.caption_style` (see types.ts:Entry). The
 * editor's CaptionOverlay reads this and the render server (generate_video.py)
 * applies it per-frame to the active entry.
 */
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './stores/video-editor-store';
import type { Entry } from '@/components/ai-video-player/types';

type OverrideKey = 'default' | 'top' | 'bottom' | 'hidden';

function readOverrideKey(entry: Entry | null | undefined): OverrideKey {
    const cs = entry?.entry_meta?.caption_style;
    if (!cs) return 'default';
    if (cs.hide) return 'hidden';
    if (cs.position === 'top') return 'top';
    if (cs.position === 'bottom') return 'bottom';
    return 'default';
}

const OPTIONS: { key: OverrideKey; label: string }[] = [
    { key: 'default', label: 'Default' },
    { key: 'top', label: 'Top' },
    { key: 'bottom', label: 'Bottom' },
    { key: 'hidden', label: 'Hidden' },
];

interface Props {
    entryId: string;
}

export function ShotCaptionOverride({ entryId }: Props) {
    const { entry, captionsEnabled, setEntryCaptionStyle } = useVideoEditorStore(
        useShallow((s) => ({
            entry: s.entries.find((e) => e.id === entryId) ?? null,
            captionsEnabled: s.captionSettings.enabled,
            setEntryCaptionStyle: s.setEntryCaptionStyle,
        }))
    );

    if (!entry) return null;
    const current = readOverrideKey(entry);

    const apply = (key: OverrideKey) => {
        if (key === 'default') return setEntryCaptionStyle(entryId, null);
        if (key === 'hidden') return setEntryCaptionStyle(entryId, { hide: true });
        return setEntryCaptionStyle(entryId, { position: key });
    };

    return (
        <div className="border-b border-gray-100 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-700">Captions on this shot</span>
                {!captionsEnabled && (
                    <span
                        className="text-[10px] text-amber-600"
                        title="Captions are globally off — turn them on in the Captions panel to see the effect."
                    >
                        captions off
                    </span>
                )}
            </div>
            <div className="flex gap-1">
                {OPTIONS.map((opt) => (
                    <button
                        key={opt.key}
                        type="button"
                        onClick={() => apply(opt.key)}
                        className={
                            'flex-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors ' +
                            (current === opt.key
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50')
                        }
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            {current !== 'default' && (
                <p className="mt-1 text-[10px] text-gray-400">
                    Override applies only to this shot. Other shots use the global caption settings.
                </p>
            )}
        </div>
    );
}
