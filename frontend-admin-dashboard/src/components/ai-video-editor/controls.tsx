/**
 * Friendly controls for the AI video editor.
 *
 * Replaces raw-CSS text inputs (`40%`, `auto`, `rotate(45deg)`, etc.) with
 * sliders, dials, and segmented pickers a non-coder can use. Each control
 * accepts the raw CSS string and emits raw CSS so it's a drop-in for the
 * existing `setStyle` / `setAttr` patches in LayersTab and elsewhere.
 *
 * Design rule (from `friendly-labels.ts`): the underlying property is
 * always reachable. If the current value can't be represented by the
 * friendly control (e.g. `calc(...)` for length, a custom matrix for
 * rotation), the control falls back to a plain text input so the user
 * can still edit the value. Switching to the friendly mode at any time
 * is a single click.
 */

import { useCallback, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Layers, Wrench } from 'lucide-react';

// ── LengthControl ──────────────────────────────────────────────────────────
//
// CSS length picker. Native operating mode: percentage slider 0-100. If the
// current value can't be parsed as a percentage (e.g. `auto`, `200px`,
// `calc(50% - 10px)`), we collapse into a text input with a button to
// switch back to the slider.

interface LengthControlProps {
    value: string;
    onCommit: (v: string) => void;
    /** Show an "Auto" toggle button that clears the value back to `auto`. */
    allowAuto?: boolean;
    placeholder?: string;
    /** Slider range — defaults to 0-100. Override for cases where negative
     *  values make sense (e.g. an `X position` that can be `-10%`). */
    min?: number;
    max?: number;
}

const PCT_RE = /^(-?\d+(?:\.\d+)?)%$/;

export function LengthControl({
    value,
    onCommit,
    allowAuto = true,
    placeholder = '40%',
    min = 0,
    max = 100,
}: LengthControlProps) {
    const trimmed = (value ?? '').trim();
    const pctMatch = trimmed.match(PCT_RE);
    const isAuto = trimmed === '' || trimmed === 'auto';
    const isPct = !!pctMatch;
    const canSlide = isPct || isAuto;

    // Force-custom mode: user clicked "Edit" to type a raw value, even if the
    // current value happens to parse as a percentage. Stays true until they
    // click "Slider" again.
    const [forceCustom, setForceCustom] = useState(false);

    if (forceCustom || !canSlide) {
        return (
            <div className="space-y-1">
                <input
                    type="text"
                    value={trimmed}
                    placeholder={placeholder}
                    onChange={(e) => onCommit(e.currentTarget.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-[11px] focus:border-indigo-400 focus:outline-none"
                />
                <div className="flex items-center gap-1 text-[10px]">
                    <button
                        type="button"
                        onClick={() => {
                            setForceCustom(false);
                            onCommit('50%');
                        }}
                        className="text-indigo-600 hover:underline"
                    >
                        Use slider
                    </button>
                    {allowAuto && (
                        <>
                            <span className="text-gray-300">·</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setForceCustom(false);
                                    onCommit('auto');
                                }}
                                className="text-gray-500 hover:underline"
                            >
                                Auto
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const num = pctMatch ? parseFloat(pctMatch[1]!) : 50;

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={num}
                    onChange={(e) => onCommit(`${e.currentTarget.value}%`)}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
                />
                <span className="w-10 shrink-0 text-right font-mono text-[10px] text-gray-700">
                    {isAuto ? 'auto' : `${num.toFixed(0)}%`}
                </span>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
                {allowAuto && (
                    <button
                        type="button"
                        onClick={() => onCommit('auto')}
                        className="text-gray-500 hover:underline"
                    >
                        Auto
                    </button>
                )}
                {allowAuto && <span className="text-gray-300">·</span>}
                <button
                    type="button"
                    onClick={() => setForceCustom(true)}
                    className="flex items-center gap-0.5 text-gray-500 hover:underline"
                >
                    <Wrench className="size-2.5" />
                    Custom
                </button>
            </div>
        </div>
    );
}

// ── RotationControl ────────────────────────────────────────────────────────
//
// Parses and writes the `rotate(Ndeg)` portion of a CSS `transform` value
// while leaving any other functions (`translate`, `scale`, `skew`, …)
// untouched. Slider runs from -180 to 180 degrees.

interface RotationControlProps {
    /** Full CSS transform value (may contain multiple functions). */
    value: string;
    onCommit: (v: string) => void;
}

const ROTATE_RE = /rotate\((-?\d+(?:\.\d+)?)deg\)/;

export function RotationControl({ value, onCommit }: RotationControlProps) {
    const trimmed = (value ?? '').trim();
    const match = trimmed.match(ROTATE_RE);
    const deg = match ? parseFloat(match[1]!) : 0;

    const set = useCallback(
        (newDeg: number) => {
            const rounded = Math.round(newDeg);
            if (rounded === 0 && !match) {
                // Zero rotation on a transform that had no rotate — no-op,
                // don't pollute the value.
                return;
            }
            const newRotatePart = `rotate(${rounded}deg)`;
            if (match) {
                onCommit(trimmed.replace(ROTATE_RE, newRotatePart));
            } else if (trimmed) {
                onCommit(`${trimmed} ${newRotatePart}`);
            } else {
                onCommit(newRotatePart);
            }
        },
        [match, trimmed, onCommit]
    );

    return (
        <div className="flex items-center gap-2">
            <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={deg}
                onChange={(e) => set(parseFloat(e.currentTarget.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-600"
            />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] text-gray-700">
                {deg}°
            </span>
            {deg !== 0 && (
                <button
                    type="button"
                    onClick={() => {
                        if (match)
                            onCommit(trimmed.replace(ROTATE_RE, '').replace(/\s+/g, ' ').trim());
                    }}
                    title="Reset rotation"
                    className="text-[10px] text-gray-400 hover:text-gray-700"
                >
                    Reset
                </button>
            )}
        </div>
    );
}

// ── LayerOrderControl ──────────────────────────────────────────────────────
//
// Friendly replacement for the numeric z-index input on overlay entries.
// Three buckets covering 95% of real cases:
//   - "Behind content" (z = 0)  → between the base shot and other overlays
//   - "On top"        (z = 500) → default for overlays; renders above content
//   - "Watermark"     (z = 9000) → corner watermarks / always-on-top branding
// The numeric input stays available under `Advanced ▾` for finer control.

type LayerBucket = 'behind' | 'on-top' | 'watermark';

interface LayerOrderControlProps {
    value: number;
    onCommit: (z: number) => void;
}

const BUCKETS: { id: LayerBucket; label: string; z: number; icon: React.ReactElement }[] = [
    {
        id: 'behind',
        label: 'Behind',
        z: 0,
        icon: <ArrowDownToLine className="size-3" />,
    },
    {
        id: 'on-top',
        label: 'On top',
        z: 500,
        icon: <Layers className="size-3" />,
    },
    {
        id: 'watermark',
        label: 'Watermark',
        z: 9000,
        icon: <ArrowUpToLine className="size-3" />,
    },
];

function bucketFor(z: number): LayerBucket {
    if (z >= 9000) return 'watermark';
    if (z >= 500) return 'on-top';
    return 'behind';
}

export function LayerOrderControl({ value, onCommit }: LayerOrderControlProps) {
    const active = bucketFor(value);
    return (
        <div
            className="flex items-center overflow-hidden rounded border border-gray-200 bg-gray-50 text-[10px]"
            role="radiogroup"
            aria-label="Layer order"
        >
            {BUCKETS.map((b) => {
                const isActive = b.id === active;
                return (
                    <button
                        key={b.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onCommit(b.z)}
                        title={`${b.label} (z=${b.z})`}
                        className={[
                            'flex h-6 flex-1 items-center justify-center gap-1 px-1 transition-colors',
                            isActive
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'text-gray-500 hover:text-gray-800',
                        ].join(' ')}
                    >
                        {b.icon}
                        {b.label}
                    </button>
                );
            })}
        </div>
    );
}

// ── Fit labels ─────────────────────────────────────────────────────────────
//
// Friendly labels for CSS `object-fit`. "Contain / Cover / Fill" are precise
// CSS terms but layman users have no idea what they mean. Mapping below maps
// them to plain English with short tooltips explaining the visual effect.

export type FitValue = 'contain' | 'cover' | 'fill';

export const FIT_LABELS: Record<FitValue, { label: string; description: string }> = {
    contain: {
        label: 'Fit inside',
        description: 'Show the whole image, may leave empty edges.',
    },
    cover: {
        label: 'Fill',
        description: 'Cover the whole area, may crop the edges.',
    },
    fill: {
        label: 'Stretch',
        description: 'Stretch to fill exactly. May look distorted.',
    },
};
