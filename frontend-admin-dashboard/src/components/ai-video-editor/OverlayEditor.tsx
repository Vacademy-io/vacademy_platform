import { Type, Image, Film, Trash2, Upload } from 'lucide-react';
import { Overlay } from './utils/html-overlay-editor';
import { FIT_LABELS } from './controls';

/**
 * Shared overlay-editing form. Renders the controls for one overlay row.
 *
 * Currently used in two places:
 *   - The Overlays tab (Properties panel) — until B23 collapses it.
 *   - The Elements (Layers) tab inspector — when the selected DOM node has
 *     `data-vx-overlay-id`, we route to this editor instead of NodeInspector
 *     because its slider-based geometry and objectFit controls are friendlier
 *     for overlay-style content.
 *
 * Set `hideHeader` to true when the host already shows a row label (e.g. the
 * Layers tree row above the inspector), so we don't render a duplicate
 * kind/icon/delete row inside this form.
 */
export interface OverlayEditorProps {
    overlay: Overlay;
    selected: boolean;
    onSelect: () => void;
    onPatch: (patch: Partial<Overlay>) => void;
    onDelete: () => void;
    onReplaceSrc: () => void;
    hideHeader?: boolean;
}

export function OverlayEditor({
    overlay,
    selected,
    onSelect,
    onPatch,
    onDelete,
    onReplaceSrc,
    hideHeader = false,
}: OverlayEditorProps) {
    return (
        <div
            className={[
                'space-y-2 rounded-md border p-2 transition-colors',
                selected
                    ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-gray-50',
            ].join(' ')}
        >
            {!hideHeader && (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={onSelect}
                    onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect();
                        }
                    }}
                    title="Select on canvas"
                    className="-m-1 flex cursor-pointer items-center gap-1.5 rounded p-1 hover:bg-white/60"
                >
                    {overlay.kind === 'text' && <Type className="size-3 text-indigo-500" />}
                    {overlay.kind === 'image' && <Image className="size-3 text-indigo-500" />}
                    {overlay.kind === 'video' && <Film className="size-3 text-indigo-500" />}
                    <span className="flex-1 truncate text-[10px] font-medium text-gray-600">
                        {overlay.kind}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="text-gray-300 hover:text-red-500"
                        title="Delete overlay"
                    >
                        <Trash2 className="size-3" />
                    </button>
                </div>
            )}

            {overlay.kind === 'text' && (
                <>
                    <textarea
                        value={overlay.text}
                        onChange={(e) => onPatch({ text: e.target.value } as Partial<Overlay>)}
                        rows={2}
                        className="w-full resize-none rounded border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-indigo-400 focus:outline-none"
                        placeholder="Overlay text"
                    />
                    <div className="flex items-center gap-1.5">
                        <label className="text-[10px] text-gray-500">Size</label>
                        <input
                            type="number"
                            min={8}
                            max={256}
                            value={overlay.fontPx}
                            onChange={(e) =>
                                onPatch({
                                    fontPx: parseInt(e.target.value, 10) || 32,
                                } as Partial<Overlay>)
                            }
                            className="h-6 w-14 rounded border border-gray-200 bg-white px-1 font-mono text-[11px]"
                        />
                        <input
                            type="color"
                            value={
                                /^#[0-9a-fA-F]{6}$/.test(overlay.color) ? overlay.color : '#ffffff'
                            }
                            onChange={(e) => onPatch({ color: e.target.value } as Partial<Overlay>)}
                            className="h-6 w-8 cursor-pointer rounded border border-gray-200 bg-white p-0"
                        />
                        <div className="flex gap-0.5">
                            {(['left', 'center', 'right'] as const).map((a) => (
                                <button
                                    key={a}
                                    onClick={() => onPatch({ align: a } as Partial<Overlay>)}
                                    className={[
                                        'h-6 rounded px-1.5 text-[10px]',
                                        overlay.align === a
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-white text-gray-500 hover:text-gray-800',
                                    ].join(' ')}
                                >
                                    {a[0]!.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {overlay.kind !== 'text' && (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={onReplaceSrc}
                            className="flex h-6 flex-1 items-center justify-center gap-1 rounded border border-gray-200 bg-white text-[11px] text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                        >
                            <Upload className="size-3" />
                            Replace
                        </button>
                        <div className="flex gap-0.5">
                            {(['contain', 'cover', 'fill'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => onPatch({ objectFit: f } as Partial<Overlay>)}
                                    title={FIT_LABELS[f].description}
                                    className={[
                                        'h-6 rounded px-2 text-[10px]',
                                        overlay.objectFit === f
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-white text-gray-500 hover:text-gray-800',
                                    ].join(' ')}
                                >
                                    {FIT_LABELS[f].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400">
                        {FIT_LABELS[overlay.objectFit as 'contain' | 'cover' | 'fill'].description}
                    </p>
                </div>
            )}

            <SliderField
                label="X"
                value={overlay.left}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => onPatch({ left: v } as Partial<Overlay>)}
            />
            <SliderField
                label="Y"
                value={overlay.top}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(v) => onPatch({ top: v } as Partial<Overlay>)}
            />
            {overlay.width != null && (
                <SliderField
                    label="Width"
                    value={overlay.width}
                    min={5}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={(v) => onPatch({ width: v } as Partial<Overlay>)}
                />
            )}
            {(overlay.kind === 'image' || overlay.kind === 'video') && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">Height</span>
                        <button
                            type="button"
                            onClick={() =>
                                onPatch({
                                    height:
                                        overlay.height == null ? overlay.width ?? 30 : undefined,
                                } as Partial<Overlay>)
                            }
                            className="text-[10px] text-indigo-600 hover:underline"
                        >
                            {overlay.height == null ? 'Set' : 'Auto'}
                        </button>
                    </div>
                    {overlay.height != null ? (
                        <input
                            type="range"
                            min={5}
                            max={100}
                            step={1}
                            value={overlay.height}
                            onChange={(e) =>
                                onPatch({
                                    height: parseFloat(e.target.value),
                                } as Partial<Overlay>)
                            }
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
                        />
                    ) : (
                        <p className="text-[10px] text-gray-400">
                            Auto · preserves natural aspect ratio
                        </p>
                    )}
                </div>
            )}
            <SliderField
                label="Opacity"
                value={Math.round(overlay.opacity * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => onPatch({ opacity: v / 100 } as Partial<Overlay>)}
            />
        </div>
    );
}

// ── Shared sub-control ──────────────────────────────────────────────────────

export interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
}

export function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{label}</span>
                <span className="font-mono text-[11px] text-gray-700">
                    {Number.isInteger(value) ? value : value.toFixed(2)}
                    {unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
            />
        </div>
    );
}
