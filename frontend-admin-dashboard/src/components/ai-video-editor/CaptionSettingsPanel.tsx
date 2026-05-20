/**
 * Caption settings panel — sibling of AudioTracksPanel at the bottom of the
 * editor. Controls the canvas-overlay caption preview and seeds the render
 * dialog so the MP4 matches what was previewed.
 *
 * Layout/rhythm mirrors `AudioTracksPanel.tsx` (collapsible header row +
 * `text-[11px]` controls + tinted-bordered rows).
 */
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronUp, ChevronDown, Captions } from 'lucide-react';
import { useVideoEditorStore } from './stores/video-editor-store';
import {
    CAPTION_SIZE_S,
    CAPTION_SIZE_M,
    CAPTION_SIZE_L,
    type CaptionPosition,
} from './utils/caption-rendering';

type SizeKey = 'S' | 'M' | 'L';
const SIZE_PX: Record<SizeKey, number> = {
    S: CAPTION_SIZE_S,
    M: CAPTION_SIZE_M,
    L: CAPTION_SIZE_L,
};

function pxToSizeKey(px: number): SizeKey {
    if (px <= CAPTION_SIZE_S + 6) return 'S';
    if (px >= CAPTION_SIZE_L - 6) return 'L';
    return 'M';
}

// Small inline toggle group (mirrors RenderSettingsDialog's pattern, kept
// local so this panel has no cross-route dependency).
function ToggleRow<T extends string>({
    options,
    labels,
    value,
    onChange,
}: {
    options: T[];
    labels: Record<T, string>;
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div className="flex gap-1">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={
                        'rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ' +
                        (value === opt
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50')
                    }
                >
                    {labels[opt]}
                </button>
            ))}
        </div>
    );
}

export function CaptionSettingsPanel() {
    const { settings, phrases, wordsUrl, setCaptionSettings, setCaptionEnabled } =
        useVideoEditorStore(
            useShallow((s) => ({
                settings: s.captionSettings,
                phrases: s.captionPhrases,
                wordsUrl: s.wordsUrl,
                setCaptionSettings: s.setCaptionSettings,
                setCaptionEnabled: s.setCaptionEnabled,
            }))
        );

    const [expanded, setExpanded] = useState(false);

    const noTranscript = !wordsUrl;
    const sizeKey = pxToSizeKey(settings.sizePx);

    return (
        <div className="border-t border-gray-200 bg-white">
            {/* Header row */}
            <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50"
                onClick={() => setExpanded((v) => !v)}
            >
                <Captions className="size-3.5 text-indigo-500" />
                <span className="flex-1 text-[11px] font-medium text-gray-700">
                    Captions
                    {phrases.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-600">
                            {phrases.length}
                        </span>
                    )}
                    {settings.enabled && phrases.length > 0 && (
                        <span className="ml-1.5 text-[10px] text-emerald-600">on</span>
                    )}
                </span>
                {expanded ? (
                    <ChevronUp className="size-3.5 text-gray-400" />
                ) : (
                    <ChevronDown className="size-3.5 text-gray-400" />
                )}
            </button>

            {expanded && (
                <div className="space-y-2 px-3 pb-3">
                    {noTranscript && (
                        <p className="text-[11px] text-gray-400">
                            This video has no narration transcript — captions can&apos;t be
                            previewed.
                        </p>
                    )}

                    {!noTranscript && (
                        <>
                            {/* Enable + position on one row */}
                            <div className="flex items-center gap-3 rounded border border-gray-200 px-2.5 py-1.5">
                                <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={settings.enabled}
                                        onChange={(e) => setCaptionEnabled(e.target.checked)}
                                        className="size-3.5 accent-indigo-500"
                                    />
                                    Show on canvas
                                </label>
                                <div className="flex-1" />
                                <span className="text-[10px] text-gray-400">Position</span>
                                <ToggleRow<CaptionPosition>
                                    options={['top', 'bottom']}
                                    labels={{ top: 'Top', bottom: 'Bottom' }}
                                    value={settings.position}
                                    onChange={(v) => setCaptionSettings({ position: v })}
                                />
                            </div>

                            {/* Size + colors */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5">
                                    <span className="shrink-0 text-[10px] text-gray-400">Size</span>
                                    <ToggleRow<SizeKey>
                                        options={['S', 'M', 'L']}
                                        labels={{ S: 'S', M: 'M', L: 'L' }}
                                        value={sizeKey}
                                        onChange={(k) => setCaptionSettings({ sizePx: SIZE_PX[k] })}
                                    />
                                </div>
                                <div className="flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5">
                                    <span className="shrink-0 text-[10px] text-gray-400">Text</span>
                                    <input
                                        type="color"
                                        value={settings.textColor}
                                        onChange={(e) =>
                                            setCaptionSettings({ textColor: e.target.value })
                                        }
                                        className="size-5 cursor-pointer rounded border border-gray-200 p-0"
                                    />
                                    <span className="font-mono text-[10px] text-gray-400">
                                        {settings.textColor.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* Background color + opacity */}
                            <div className="flex items-center gap-2 rounded border border-gray-200 px-2.5 py-1.5">
                                <span className="shrink-0 text-[10px] text-gray-400">
                                    Background
                                </span>
                                <input
                                    type="color"
                                    value={settings.bgColor}
                                    onChange={(e) =>
                                        setCaptionSettings({ bgColor: e.target.value })
                                    }
                                    className="size-5 shrink-0 cursor-pointer rounded border border-gray-200 p-0"
                                />
                                <span className="shrink-0 font-mono text-[10px] text-gray-400">
                                    {settings.bgColor.toUpperCase()}
                                </span>
                                <div className="flex-1" />
                                <span className="shrink-0 text-[10px] text-gray-400">Opacity</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={Math.round(settings.bgOpacity * 100)}
                                    onChange={(e) =>
                                        setCaptionSettings({
                                            bgOpacity: Number(e.target.value) / 100,
                                        })
                                    }
                                    className="w-24 accent-indigo-500"
                                />
                                <span className="w-8 shrink-0 text-right font-mono text-[10px] text-gray-500">
                                    {Math.round(settings.bgOpacity * 100)}%
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
