import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    Layers,
    Type,
    Sliders,
    Image,
    Loader2,
    Trash2,
    Wand2,
    Check,
    X,
    Code2,
    AlertTriangle,
    Shapes,
    Film,
    Upload,
    Download,
    Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVideoEditorStore, DEFAULT_TRANSFORM } from './stores/video-editor-store';
import { regenerateFrame } from '@/routes/video-api-studio/-services/video-generation';
import { toast } from 'sonner';
import {
    extractTextElements,
    applyTextPatch,
    deleteTextElement,
    TextElement,
} from './utils/html-text-editor';
import {
    extractMediaElements,
    replaceMediaSrc,
    deleteMediaElement,
    MediaElement,
} from './utils/html-media-editor';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import { MonacoHtmlEditor, countInlineBase64 } from './MonacoHtmlEditor';
import {
    Overlay,
    listOverlays,
    upsertOverlay,
    deleteOverlay,
    newTextOverlay,
    newImageOverlay,
    newVideoOverlay,
    findOverlayPath,
} from './utils/html-overlay-editor';
import { pathsEqual } from './utils/html-tree';
import {
    TRANSITION_OPTIONS,
    Transition,
    TransitionType,
    EASING_PRESETS,
    easingPresetFor,
} from './utils/transitions';
import { LayersTab } from './LayersTab';
import { ShotCaptionOverride } from './ShotCaptionOverride';
import { FIT_LABELS } from './controls';
import { AdvancedSection } from './AdvancedSection';
import { friendlyEntryName } from './registry/friendly-labels';
import { downloadShotHtml } from './utils/download-shot';

// ── Shared helpers ─────────────────────────────────────────────────────────

function formatTime(s?: number | null): string {
    if (s == null) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Tiny badge that subscribes to currentTime independently. Isolated so that
 * the heavy PropertiesPanel body doesn't re-render on every playhead tick —
 * only this 1-line component does.
 */
function OutsidePlayheadBadge({
    navigation,
    inTime,
    outTime,
    entryIndex,
    onJump,
}: {
    navigation?: string;
    inTime?: number | null;
    outTime?: number | null;
    entryIndex: number;
    onJump: () => void;
}) {
    const currentTime = useVideoEditorStore((s) => s.currentTime);
    const isOutside =
        navigation === 'time_driven'
            ? currentTime < (inTime ?? 0) || currentTime >= (outTime ?? Infinity)
            : Math.floor(currentTime) !== entryIndex;
    if (!isOutside) return null;
    return (
        <button
            type="button"
            onClick={onJump}
            title="The playhead is outside this entry. Click to jump to its start."
            className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 transition hover:bg-amber-200"
        >
            Outside playhead
        </button>
    );
}

// ── Slider field ───────────────────────────────────────────────────────────

interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
}

function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
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

// ── Transform tab ──────────────────────────────────────────────────────────

interface TransformTabProps {
    entryId: string;
    canvasW: number;
    canvasH: number;
}

function TransformTab({ entryId, canvasW, canvasH }: TransformTabProps) {
    const {
        entryTransforms,
        entryBackgrounds,
        updateEntryTransform,
        resetEntryTransform,
        updateEntryBackground,
    } = useVideoEditorStore(
        useShallow((s) => ({
            entryTransforms: s.entryTransforms,
            entryBackgrounds: s.entryBackgrounds,
            updateEntryTransform: s.updateEntryTransform,
            resetEntryTransform: s.resetEntryTransform,
            updateEntryBackground: s.updateEntryBackground,
        }))
    );
    const transform = entryTransforms[entryId] ?? DEFAULT_TRANSFORM;
    const background = entryBackgrounds[entryId] ?? '';
    // Only feed a valid 7-char hex into <input type="color"> (it can't render gradients/named colors).
    const pickerValue = /^#[0-9a-fA-F]{6}$/.test(background) ? background : '#ffffff';

    return (
        <div className="space-y-3 p-3">
            {/* Background — color picker is the primary control. The raw CSS
                text input (which accepts gradients / image URLs) is tucked
                into the Advanced disclosure inside this card so layman users
                aren't staring at `linear-gradient(...)` placeholders. */}
            <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-2">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-gray-600">Background</span>
                    {background && (
                        <button
                            onClick={() => updateEntryBackground(entryId, undefined)}
                            className="text-[10px] text-gray-400 hover:text-gray-700"
                        >
                            Clear
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <input
                        type="color"
                        value={pickerValue}
                        onChange={(e) => updateEntryBackground(entryId, e.target.value)}
                        className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-white p-0"
                        aria-label="Background color"
                    />
                    <span
                        className="h-7 flex-1 truncate rounded border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-600"
                        title={background || 'No background — transparent'}
                    >
                        {background || <span className="text-gray-300">No background</span>}
                    </span>
                </div>
                <AdvancedSection label="Custom background CSS">
                    <input
                        type="text"
                        value={background}
                        placeholder="#ffffff or linear-gradient(...) or url(...)"
                        onChange={(e) => updateEntryBackground(entryId, e.target.value)}
                        className="h-7 w-full rounded border border-gray-300 px-2 font-mono text-[11px] focus:border-indigo-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-400">
                        Solid color, CSS gradient, or image URL — applied behind this shot.
                    </p>
                </AdvancedSection>
            </div>
            <SliderField
                label="X Offset"
                value={transform.x}
                min={-Math.round(canvasW / 2)}
                max={Math.round(canvasW / 2)}
                step={10}
                unit="px"
                onChange={(v) => updateEntryTransform(entryId, { x: v })}
            />
            <SliderField
                label="Y Offset"
                value={transform.y}
                min={-Math.round(canvasH / 2)}
                max={Math.round(canvasH / 2)}
                step={10}
                unit="px"
                onChange={(v) => updateEntryTransform(entryId, { y: v })}
            />
            <SliderField
                label="Scale"
                value={Math.round(transform.scale * 100)}
                min={10}
                max={300}
                step={5}
                unit="%"
                onChange={(v) => updateEntryTransform(entryId, { scale: v / 100 })}
            />
            <SliderField
                label="Rotation"
                value={transform.rotation}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={(v) => updateEntryTransform(entryId, { rotation: v })}
            />
            <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs text-gray-600"
                onClick={() => resetEntryTransform(entryId)}
            >
                Reset Transform
            </Button>
        </div>
    );
}

// ── Motion tab ─────────────────────────────────────────────────────────────

interface MotionTabProps {
    entryId: string;
    inTime?: number | null;
    exitTime?: number | null;
}

function MotionTab({ entryId, inTime, exitTime }: MotionTabProps) {
    const {
        entryTransitions,
        naturalDurations,
        updateEntryTransition,
        fitAnimationsToDuration,
        meta,
    } = useVideoEditorStore(
        useShallow((s) => ({
            entryTransitions: s.entryTransitions,
            naturalDurations: s.naturalDurations,
            updateEntryTransition: s.updateEntryTransition,
            fitAnimationsToDuration: s.fitAnimationsToDuration,
            meta: s.meta,
        }))
    );
    const transitions = entryTransitions[entryId];

    const setTransition = (which: 'in' | 'out', type: TransitionType | '') => {
        if (!type) {
            updateEntryTransition(entryId, which, null);
            return;
        }
        const existing = transitions?.[which];
        updateEntryTransition(entryId, which, {
            type,
            duration: existing?.duration ?? 0.4,
            easing: existing?.easing,
        });
    };
    const setDuration = (which: 'in' | 'out', duration: number) => {
        const existing = transitions?.[which];
        if (!existing) return;
        updateEntryTransition(entryId, which, { ...existing, duration });
    };

    /** Apply an easing CSS value to whichever transitions are set. Users who
     *  want different easings for in vs out can use the Advanced section
     *  below (per-side raw cubic-bezier input). */
    const setEasingForBoth = (css: string) => {
        if (transitions?.in) {
            updateEntryTransition(entryId, 'in', { ...transitions.in, easing: css });
        }
        if (transitions?.out) {
            updateEntryTransition(entryId, 'out', { ...transitions.out, easing: css });
        }
    };
    const setEasingForSide = (which: 'in' | 'out', css: string) => {
        const existing = transitions?.[which];
        if (!existing) return;
        updateEntryTransition(entryId, which, {
            ...existing,
            easing: css.trim() || undefined,
        });
    };

    // Both transitions sharing the same easing → highlight it on the
    // segmented picker. Different easings → no preset active; user can
    // either re-pick a preset (sets both) or use Advanced per-side.
    //
    // Subtle: `easing` is optional in the schema. An undefined easing is
    // visually `ease` (the CSS default), which is our "Smooth" preset. So
    // we treat `undefined` as `'ease'` when comparing for divergence and
    // when looking up the matching preset. Without this normalization a
    // pair of transitions that both omit `easing` would compare equal but
    // a pair of (undefined, 'linear') would diverge — and (more importantly)
    // a genuinely-divergent pair would fall through to easingPresetFor(undef)
    // which returns Smooth, lying about state.
    const hasAnyTransition = !!(transitions?.in || transitions?.out);
    const inEffective = transitions?.in ? transitions.in.easing ?? 'ease' : null;
    const outEffective = transitions?.out ? transitions.out.easing ?? 'ease' : null;
    const effectiveEasing: string | null =
        inEffective !== null && outEffective !== null
            ? inEffective === outEffective
                ? inEffective
                : null
            : inEffective ?? outEffective;
    const activePreset = effectiveEasing != null ? easingPresetFor(effectiveEasing) : null;

    const renderTransitionRow = (which: 'in' | 'out', label: string) => {
        const current: Transition | undefined = transitions?.[which];
        return (
            <div className="flex items-center gap-1.5">
                <label className="w-8 text-[10px] font-medium text-gray-600">{label}</label>
                <select
                    value={current?.type ?? ''}
                    onChange={(e) => setTransition(which, e.target.value as TransitionType | '')}
                    className="h-7 flex-1 rounded border border-gray-200 bg-white px-1 text-[11px] focus:border-indigo-400 focus:outline-none"
                >
                    <option value="">None</option>
                    {TRANSITION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <input
                    type="number"
                    step={0.05}
                    min={0.05}
                    max={3}
                    value={current?.duration ?? ''}
                    disabled={!current}
                    placeholder="0.4s"
                    onChange={(e) => setDuration(which, parseFloat(e.target.value) || 0.4)}
                    className="h-7 w-14 rounded border border-gray-200 bg-white px-1 text-center font-mono text-[11px] disabled:bg-gray-50 disabled:text-gray-300"
                />
            </div>
        );
    };

    const currentDur = (exitTime ?? 0) - (inTime ?? 0);
    const baseDur = naturalDurations[entryId];
    const canFit =
        currentDur > 0 && baseDur != null && baseDur > 0 && Math.abs(currentDur - baseDur) > 0.05;
    const currentSpeed = baseDur != null && currentDur > 0 ? baseDur / currentDur : null;

    return (
        <div className="space-y-3 p-3">
            {/* Transitions */}
            <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50 p-2">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-700">Transitions</span>
                </div>
                {renderTransitionRow('in', 'In')}
                {renderTransitionRow('out', 'Out')}
                <div className="text-[10px] text-gray-400">
                    Plays at the shot&apos;s start / end. Duration in seconds.
                </div>

                {/* Easing picker — friendly preset row applied to both
                    transitions. Disabled until at least one transition is
                    set. Per-side custom CSS easing lives in Advanced below. */}
                <div className="space-y-1 pt-1">
                    <label className="text-[10px] font-medium text-gray-500">Easing</label>
                    <div className="flex flex-wrap gap-1">
                        {EASING_PRESETS.map((p) => {
                            const isActive = activePreset?.id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    disabled={!hasAnyTransition}
                                    onClick={() => setEasingForBoth(p.css)}
                                    title={p.description}
                                    className={[
                                        'h-6 rounded px-2 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                        isActive
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-white text-gray-600 hover:text-gray-900',
                                    ].join(' ')}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                    {hasAnyTransition && activePreset && (
                        <p className="text-[10px] text-gray-400">{activePreset.description}</p>
                    )}
                    {hasAnyTransition && !activePreset && (
                        <p className="text-[10px] text-amber-700">
                            Custom easing — see Advanced below.
                        </p>
                    )}
                </div>

                <AdvancedSection label="Custom easing per side">
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">In</label>
                        <input
                            type="text"
                            value={transitions?.in?.easing ?? ''}
                            disabled={!transitions?.in}
                            placeholder="ease-in-out or cubic-bezier(0.5,0,0.5,1)"
                            onChange={(e) => setEasingForSide('in', e.currentTarget.value)}
                            className="h-7 w-full rounded border border-gray-300 px-2 font-mono text-[11px] disabled:bg-gray-50 disabled:text-gray-300"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Out</label>
                        <input
                            type="text"
                            value={transitions?.out?.easing ?? ''}
                            disabled={!transitions?.out}
                            placeholder="ease-in-out or cubic-bezier(0.5,0,0.5,1)"
                            onChange={(e) => setEasingForSide('out', e.currentTarget.value)}
                            className="h-7 w-full rounded border border-gray-300 px-2 font-mono text-[11px] disabled:bg-gray-50 disabled:text-gray-300"
                        />
                    </div>
                    <p className="text-[10px] text-gray-400">
                        Any CSS timing function. Different in/out values bypass the preset picker
                        above.
                    </p>
                </AdvancedSection>
            </div>

            {/* Animation speed — only meaningful for time_driven */}
            {meta.navigation === 'time_driven' && (
                <div className="space-y-1 rounded-md border border-gray-200 bg-gray-50 p-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-700">
                            Animation speed
                        </span>
                        {currentSpeed != null && (
                            <span className="font-mono text-[10px] text-indigo-600">
                                {currentSpeed.toFixed(2)}×
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        Natural: {baseDur != null ? `${baseDur.toFixed(1)}s` : '—'}
                        {' · '}Current: {currentDur > 0 ? `${currentDur.toFixed(1)}s` : '—'}
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-full text-xs text-gray-600 disabled:opacity-40"
                        disabled={!canFit}
                        onClick={() => fitAnimationsToDuration(entryId)}
                    >
                        Fit animations to duration
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Text tab ───────────────────────────────────────────────────────────────

const FONT_SIZES = [
    '10px',
    '12px',
    '14px',
    '16px',
    '18px',
    '20px',
    '24px',
    '28px',
    '32px',
    '40px',
    '48px',
    '56px',
    '64px',
    '80px',
    '96px',
];
const FONT_WEIGHTS = [
    { label: 'Normal', value: 'normal' },
    { label: 'Bold', value: 'bold' },
    { label: '300', value: '300' },
    { label: '500', value: '500' },
    { label: '700', value: '700' },
    { label: '900', value: '900' },
];
const ALIGN_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'L', value: 'left' },
    { label: 'C', value: 'center' },
    { label: 'R', value: 'right' },
];

interface TextItemProps {
    el: TextElement;
    canvasW: number;
    canvasH: number;
    onPatch: (index: number, patch: Parameters<typeof applyTextPatch>[2]) => void;
    onDelete: (index: number) => void;
}

function TextItem({ el, canvasW, canvasH, onPatch, onDelete }: TextItemProps) {
    const [open, setOpen] = useState(false);
    const [localText, setLocalText] = useState(el.text);

    // Sync when el.text changes externally (undo, remake accept, etc.)
    useEffect(() => {
        setLocalText(el.text);
    }, [el.text]);

    return (
        <div className="border-b border-gray-100 last:border-0">
            {/* Row header */}
            <div className="flex items-center">
                <button
                    className="flex flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => setOpen((v) => !v)}
                >
                    <span className="shrink-0 rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] uppercase text-gray-500">
                        {el.tagName.toLowerCase()}
                    </span>
                    <span className="flex-1 truncate text-[11px] text-gray-700">{el.text}</span>
                    <span className="text-[10px] text-gray-400">{open ? '▲' : '▼'}</span>
                </button>
                <button
                    className="p-2 text-gray-300 transition-colors hover:text-red-500"
                    title="Delete text element"
                    onClick={() => onDelete(el.index)}
                >
                    <Trash2 className="size-3" />
                </button>
            </div>

            {open && (
                <div className="space-y-2 bg-gray-50 px-3 pb-3 pt-1">
                    {/* Text content */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Text</label>
                        <textarea
                            rows={3}
                            value={localText}
                            onChange={(e) => setLocalText(e.target.value)}
                            onBlur={() => {
                                if (localText !== el.text) {
                                    onPatch(el.index, { text: localText });
                                }
                            }}
                            className="w-full resize-none rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                        />
                    </div>

                    {/* Font size — preset dropdown + freeform numeric input */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Font Size</label>
                        <div className="flex gap-1">
                            <select
                                value={FONT_SIZES.includes(el.fontSize) ? el.fontSize : ''}
                                onChange={(e) => onPatch(el.index, { fontSize: e.target.value })}
                                className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                            >
                                <option value="">preset…</option>
                                {FONT_SIZES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min={4}
                                max={400}
                                value={parseFloat(el.fontSize) || ''}
                                placeholder="px"
                                onChange={(e) => {
                                    const v = e.target.value;
                                    onPatch(el.index, { fontSize: v ? `${v}px` : '' });
                                }}
                                className="w-16 rounded border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Wrap & line height — fixes the "ZER / O" word-break issue */}
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-medium text-gray-500">Wrap</label>
                        <div className="flex gap-1">
                            {(
                                [
                                    { label: 'Wrap', value: '' },
                                    { label: 'Nowrap', value: 'nowrap' },
                                    { label: 'Pre', value: 'pre' },
                                ] as const
                            ).map((w) => (
                                <button
                                    key={w.value || 'default'}
                                    onClick={() => onPatch(el.index, { whiteSpace: w.value })}
                                    className={[
                                        'h-6 rounded border px-2 text-[10px] transition-colors',
                                        (el.whiteSpace || '') === w.value
                                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                                    ].join(' ')}
                                >
                                    {w.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Line Height</label>
                        <div className="flex gap-1">
                            <input
                                type="number"
                                step={0.05}
                                min={0.5}
                                max={3}
                                value={
                                    el.lineHeight && !isNaN(parseFloat(el.lineHeight))
                                        ? parseFloat(el.lineHeight)
                                        : ''
                                }
                                placeholder="1.2"
                                onChange={(e) =>
                                    onPatch(el.index, {
                                        lineHeight: e.target.value || '',
                                    })
                                }
                                className="w-20 rounded border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                            />
                            {el.lineHeight && (
                                <button
                                    onClick={() => onPatch(el.index, { lineHeight: '' })}
                                    className="text-[10px] text-gray-400 hover:text-gray-700"
                                >
                                    reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-medium text-gray-500">Color</label>
                        <input
                            type="color"
                            value={el.color || '#000000'}
                            onChange={(e) => onPatch(el.index, { color: e.target.value })}
                            className="h-6 w-10 cursor-pointer rounded border border-gray-200 p-0.5"
                        />
                        <span className="font-mono text-[10px] text-gray-400">
                            {el.color || 'inherited'}
                        </span>
                    </div>

                    {/* Font weight */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-gray-500">Weight</label>
                        <select
                            value={el.fontWeight || ''}
                            onChange={(e) => onPatch(el.index, { fontWeight: e.target.value })}
                            className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-400 focus:outline-none"
                        >
                            <option value="">— inherited —</option>
                            {FONT_WEIGHTS.map((w) => (
                                <option key={w.value} value={w.value}>
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Alignment */}
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-medium text-gray-500">Align</label>
                        <div className="flex gap-1">
                            {ALIGN_OPTIONS.map((a) => (
                                <button
                                    key={a.value}
                                    onClick={() => onPatch(el.index, { textAlign: a.value })}
                                    className={[
                                        'h-6 w-7 rounded border text-[10px] transition-colors',
                                        el.textAlign === a.value
                                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                                    ].join(' ')}
                                >
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Position (translate) */}
                    <div className="space-y-2 border-t border-gray-200 pt-2">
                        <label className="text-[10px] font-medium text-gray-500">Position</label>
                        <SliderField
                            label="X"
                            value={el.translateX}
                            min={-Math.round(canvasW / 2)}
                            max={Math.round(canvasW / 2)}
                            step={10}
                            unit="px"
                            onChange={(v) => onPatch(el.index, { translateX: v })}
                        />
                        <SliderField
                            label="Y"
                            value={el.translateY}
                            min={-Math.round(canvasH / 2)}
                            max={Math.round(canvasH / 2)}
                            step={10}
                            unit="px"
                            onChange={(v) => onPatch(el.index, { translateY: v })}
                        />
                        {(el.translateX !== 0 || el.translateY !== 0) && (
                            <button
                                onClick={() => onPatch(el.index, { translateX: 0, translateY: 0 })}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700"
                            >
                                Reset position
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

interface TextTabProps {
    entryId: string;
    entryHtml: string;
    canvasW: number;
    canvasH: number;
}

function TextTab({ entryId, entryHtml, canvasW, canvasH }: TextTabProps) {
    const updateEntryHtml = useVideoEditorStore((s) => s.updateEntryHtml);

    const textElements = useMemo(() => extractTextElements(entryHtml), [entryHtml]);

    // Read fresh HTML from store at call-time to avoid stale closure when
    // multiple patches are applied in quick succession.
    const handlePatch = useCallback(
        (index: number, patch: Parameters<typeof applyTextPatch>[2]) => {
            const currentHtml =
                useVideoEditorStore.getState().entries.find((e) => e.id === entryId)?.html ?? '';
            updateEntryHtml(entryId, applyTextPatch(currentHtml, index, patch));
        },
        [entryId, updateEntryHtml]
    );

    const handleDelete = useCallback(
        (index: number) => {
            const currentHtml =
                useVideoEditorStore.getState().entries.find((e) => e.id === entryId)?.html ?? '';
            updateEntryHtml(entryId, deleteTextElement(currentHtml, index));
        },
        [entryId, updateEntryHtml]
    );

    if (textElements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <Type className="mb-2 size-6 text-gray-300" />
                <p className="text-xs text-gray-400">No editable text found in this entry</p>
            </div>
        );
    }

    return (
        <div>
            {textElements.map((el) => (
                <TextItem
                    key={el.index}
                    el={el}
                    canvasW={canvasW}
                    canvasH={canvasH}
                    onPatch={handlePatch}
                    onDelete={handleDelete}
                />
            ))}
        </div>
    );
}

// ── Media tab ──────────────────────────────────────────────────────────────

interface MediaItemProps {
    el: MediaElement;
    onReplace: (index: number, newSrc: string) => void;
    onDelete: (index: number) => void;
}

function MediaItem({ el, onReplace, onDelete }: MediaItemProps) {
    const { uploadFile, getPublicUrl } = useFileUpload();
    const [uploading, setUploading] = useState(false);

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
                const fileId = await uploadFile({
                    file,
                    setIsUploading: () => {},
                    userId: getUserId(),
                    source: 'VIDEO_EDITOR_MEDIA',
                    sourceId: 'ADMIN',
                    publicUrl: true,
                });
                if (fileId) {
                    const url = await getPublicUrl(fileId as string);
                    if (url) onReplace(el.index, url);
                }
            } finally {
                setUploading(false);
            }
        },
        [el.index, onReplace, uploadFile, getPublicUrl]
    );

    return (
        <div className="border-b border-gray-100 p-3 last:border-0">
            {/* Preview */}
            <div className="mb-2 overflow-hidden rounded border border-gray-200 bg-gray-100">
                {el.tagName === 'IMG' ? (
                    <img
                        src={el.src}
                        alt={el.alt || 'media'}
                        className="max-h-24 w-full object-contain"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <video src={el.src} className="max-h-24 w-full object-contain" muted />
                )}
            </div>
            <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] uppercase text-gray-500">
                    {el.tagName.toLowerCase()}
                </span>
                <div className="flex items-center gap-2">
                    <span className="max-w-[110px] truncate text-[10px] text-gray-400">
                        {el.src.split('/').pop()}
                    </span>
                    <button
                        onClick={() => onDelete(el.index)}
                        className="text-gray-300 transition-colors hover:text-red-500"
                        title="Delete media element"
                    >
                        <Trash2 className="size-3" />
                    </button>
                </div>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-1.5 text-[11px] text-gray-500 transition-colors hover:border-indigo-400 hover:text-indigo-600">
                {uploading ? (
                    <>
                        <Loader2 className="size-3 animate-spin" />
                        Uploading…
                    </>
                ) : (
                    <>
                        <Image className="size-3" />
                        Replace {el.tagName === 'VIDEO' ? 'video' : 'image'}
                    </>
                )}
                <input
                    type="file"
                    accept={el.tagName === 'VIDEO' ? 'video/*' : 'image/*'}
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
            </label>
        </div>
    );
}

interface MediaTabProps {
    entryId: string;
    entryHtml: string;
}

function MediaTab({ entryId, entryHtml }: MediaTabProps) {
    const updateEntryHtml = useVideoEditorStore((s) => s.updateEntryHtml);

    const mediaElements = useMemo(() => extractMediaElements(entryHtml), [entryHtml]);

    const handleReplace = useCallback(
        (index: number, newSrc: string) => {
            const currentHtml =
                useVideoEditorStore.getState().entries.find((e) => e.id === entryId)?.html ?? '';
            updateEntryHtml(entryId, replaceMediaSrc(currentHtml, index, newSrc));
        },
        [entryId, updateEntryHtml]
    );

    const handleDelete = useCallback(
        (index: number) => {
            const currentHtml =
                useVideoEditorStore.getState().entries.find((e) => e.id === entryId)?.html ?? '';
            updateEntryHtml(entryId, deleteMediaElement(currentHtml, index));
        },
        [entryId, updateEntryHtml]
    );

    if (mediaElements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <Image className="mb-2 size-6 text-gray-300" />
                <p className="text-xs text-gray-400">No images or videos found in this entry</p>
            </div>
        );
    }

    return (
        <div>
            {mediaElements.map((el) => (
                <MediaItem
                    key={el.index}
                    el={el}
                    onReplace={handleReplace}
                    onDelete={handleDelete}
                />
            ))}
        </div>
    );
}

// ── Raw HTML tab ───────────────────────────────────────────────────────────

interface HtmlTabProps {
    entryId: string;
    entryHtml: string;
}

function HtmlTab({ entryId, entryHtml }: HtmlTabProps) {
    const updateEntryHtml = useVideoEditorStore((s) => s.updateEntryHtml);
    const viewMode = useVideoEditorStore((s) => s.viewMode);
    const [localHtml, setLocalHtml] = useState(entryHtml);
    const [isDirty, setIsDirty] = useState(false);

    // Sync when entryHtml changes externally (undo, remake accept, etc.)
    useEffect(() => {
        setLocalHtml(entryHtml);
        setIsDirty(false);
    }, [entryHtml]);

    const handleChange = useCallback(
        (next: string) => {
            setLocalHtml(next);
            setIsDirty(next !== entryHtml);
        },
        [entryHtml]
    );

    const handleApply = useCallback(() => {
        if (!localHtml.trim()) return;
        updateEntryHtml(entryId, localHtml);
        setIsDirty(false);
    }, [entryId, localHtml, updateEntryHtml]);

    const handleReset = useCallback(() => {
        setLocalHtml(entryHtml);
        setIsDirty(false);
    }, [entryHtml]);

    const sizeKb = (new TextEncoder().encode(localHtml).length / 1024).toFixed(1);
    const isLarge = parseFloat(sizeKb) > 50;
    const inline = useMemo(() => countInlineBase64(localHtml), [localHtml]);

    return (
        <div className="flex h-full flex-col">
            {/* Simple-mode warning — editing raw HTML can break the
                layout. Power users can switch to developer mode (or just
                ignore this banner) to skip the warning. */}
            {viewMode === 'simple' && (
                <div className="flex items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5">
                    <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                    <span className="text-[10px] text-amber-700">
                        Editing raw code can break the layout. Most edits are easier in the other
                        tabs.
                    </span>
                </div>
            )}
            {isLarge && (
                <div className="flex items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5">
                    <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                    <span className="text-[10px] text-amber-700">
                        Large HTML ({sizeKb} KB)
                        {inline.count > 0 && (
                            <>
                                {' '}
                                — {inline.count} inline image{inline.count === 1 ? '' : 's'} folded
                                (hover to preview)
                            </>
                        )}
                    </span>
                </div>
            )}
            <div className="flex-1 bg-[#1e1e1e]">
                <MonacoHtmlEditor value={localHtml} onChange={handleChange} onApply={handleApply} />
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 py-2">
                <span className="flex-1 font-mono text-[10px] text-gray-400">{sizeKb} KB</span>
                {isDirty && (
                    <>
                        <button
                            onClick={handleReset}
                            className="text-[11px] text-gray-400 hover:text-gray-700"
                        >
                            Reset
                        </button>
                        <Button
                            size="sm"
                            className="h-6 gap-1 bg-indigo-600 px-3 text-[11px] text-white hover:bg-indigo-700"
                            onClick={handleApply}
                        >
                            <Check className="size-3" />
                            Apply
                        </Button>
                    </>
                )}
                {!isDirty && <span className="text-[10px] text-gray-400">⌘↵ to apply</span>}
            </div>
        </div>
    );
}

// ── Overlays tab ───────────────────────────────────────────────────────────

interface OverlaysTabProps {
    entryId: string;
    entryHtml: string;
    canvasW: number;
    canvasH: number;
}

function OverlayEditor({
    overlay,
    selected,
    onSelect,
    onPatch,
    onDelete,
    onReplaceSrc,
}: {
    overlay: Overlay;
    selected: boolean;
    onSelect: () => void;
    onPatch: (patch: Partial<Overlay>) => void;
    onDelete: () => void;
    onReplaceSrc: () => void;
}) {
    return (
        <div
            className={[
                'space-y-2 rounded-md border p-2 transition-colors',
                selected
                    ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-gray-50',
            ].join(' ')}
        >
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

function OverlaysTab({ entryId, entryHtml, canvasW, canvasH }: OverlaysTabProps) {
    const updateEntryHtml = useVideoEditorStore((s) => s.updateEntryHtml);
    const selectLayer = useVideoEditorStore((s) => s.selectLayer);
    const selectedLayerPath = useVideoEditorStore((s) => s.selectedLayerPath);
    const { uploadFile, getPublicUrl } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const replaceTargetRef = useRef<{ id: string; kind: 'image' | 'video' } | null>(null);

    // Pass canvas dims so px-valued geometry (committed by the canvas drag/
    // resize handles via patchNodeStyle) is converted back to % at parse
    // time. Without this, a drag would silently snap left/top to 0.
    const overlays = useMemo(
        () => listOverlays(entryHtml, { w: canvasW, h: canvasH }),
        [entryHtml, canvasW, canvasH]
    );

    const patchHtml = useCallback(
        (nextHtml: string) => {
            updateEntryHtml(entryId, nextHtml);
        },
        [entryId, updateEntryHtml]
    );

    const selectOverlay = useCallback(
        (overlayId: string) => {
            const path = findOverlayPath(entryHtml, overlayId);
            if (path) selectLayer(path);
        },
        [entryHtml, selectLayer]
    );

    const handleAddText = () => {
        patchHtml(upsertOverlay(entryHtml, newTextOverlay('New text')));
    };

    const openFilePicker = (kind: 'image' | 'video', overlayId: string) => {
        replaceTargetRef.current = { id: overlayId, kind };
        const input = fileInputRef.current;
        if (!input) return;
        input.accept = kind === 'image' ? 'image/*' : 'video/*';
        input.value = '';
        input.click();
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const target = replaceTargetRef.current;
        if (!file || !target) return;
        try {
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId(),
                source: 'VIDEO_EDITOR_MEDIA',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (!fileId) throw new Error('Upload failed');
            const url = await getPublicUrl(fileId as string);
            if (!url) throw new Error('Failed to get public URL');

            // If it's a "create new" stub (id == 'NEW'), add; otherwise replace src
            if (target.id === 'NEW') {
                const fresh = target.kind === 'image' ? newImageOverlay(url) : newVideoOverlay(url);
                patchHtml(upsertOverlay(entryHtml, fresh));
            } else {
                const existing = overlays.find((o) => o.id === target.id);
                if (existing && existing.kind !== 'text') {
                    patchHtml(upsertOverlay(entryHtml, { ...existing, src: url }));
                }
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            replaceTargetRef.current = null;
        }
    };

    const handlePatch = (overlayId: string) => (patch: Partial<Overlay>) => {
        const current = listOverlays(entryHtml).find((o) => o.id === overlayId);
        if (!current) return;
        patchHtml(upsertOverlay(entryHtml, { ...current, ...patch } as Overlay));
    };

    const handleDelete = (overlayId: string) => () => {
        patchHtml(deleteOverlay(entryHtml, overlayId));
    };

    return (
        <div className="space-y-2 p-3">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
            <div className="grid grid-cols-3 gap-1.5">
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={handleAddText}
                >
                    <Type className="size-3" />
                    Text
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => openFilePicker('image', 'NEW')}
                >
                    <Image className="size-3" />
                    Image
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => openFilePicker('video', 'NEW')}
                >
                    <Film className="size-3" />
                    Video
                </Button>
            </div>

            {overlays.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-gray-400">
                    No overlays yet — add text, image, or video above.
                </p>
            ) : (
                overlays.map((o) => {
                    const path = findOverlayPath(entryHtml, o.id);
                    const isSelected = !!path && pathsEqual(path, selectedLayerPath);
                    return (
                        <OverlayEditor
                            key={o.id}
                            overlay={o}
                            selected={isSelected}
                            onSelect={() => selectOverlay(o.id)}
                            onPatch={handlePatch(o.id)}
                            onDelete={handleDelete(o.id)}
                            onReplaceSrc={() => o.kind !== 'text' && openFilePicker(o.kind, o.id)}
                        />
                    );
                })
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────

type Tab = 'layers' | 'transform' | 'motion' | 'text' | 'media' | 'overlays' | 'code';

interface PropertiesPanelProps {
    /**
     * 'column' (default) — fixed-width right column for landscape layout.
     * 'drawer'           — full-width bottom panel for portrait layout.
     */
    variant?: 'column' | 'drawer';
}

/**
 * Properties panel: transform controls + text editing + media replace.
 * Works as a right column (landscape) or bottom drawer (portrait).
 */
export function PropertiesPanel({ variant = 'column' }: PropertiesPanelProps) {
    const {
        entries,
        meta,
        selectedEntryId,
        deleteEntry,
        updateEntryHtml,
        videoId,
        apiKey,
        seek,
        viewMode,
        displayNames,
    } = useVideoEditorStore(
        useShallow((s) => ({
            entries: s.entries,
            meta: s.meta,
            selectedEntryId: s.selectedEntryId,
            deleteEntry: s.deleteEntry,
            updateEntryHtml: s.updateEntryHtml,
            videoId: s.videoId,
            apiKey: s.apiKey,
            seek: s.seek,
            viewMode: s.viewMode,
            displayNames: s.displayNames,
        }))
    );
    const [tab, setTab] = useState<Tab>('layers');

    // ── Remake state ───────────────────────────────────────────────────────
    const [remakeOpen, setRemakeOpen] = useState(false);
    const [remakePrompt, setRemakePrompt] = useState('');
    const [remakeState, setRemakeState] = useState<'idle' | 'loading' | 'preview'>('idle');
    const [remakeNewHtml, setRemakeNewHtml] = useState<string | null>(null);

    // Reset remake panel whenever a different entry is selected
    useEffect(() => {
        setRemakeOpen(false);
        setRemakeState('idle');
        setRemakeNewHtml(null);
        setRemakePrompt('');
    }, [selectedEntryId]);

    const entry = selectedEntryId ? entries.find((e) => e.id === selectedEntryId) : null;
    const canvasW = meta.dimensions?.width ?? 1920;
    const canvasH = meta.dimensions?.height ?? 1080;

    const isDrawer = variant === 'drawer';

    // ── Outer wrapper classes ──────────────────────────────────────────────
    const wrapperCls = isDrawer
        ? 'flex w-full shrink-0 flex-col overflow-hidden border-t border-gray-200 bg-white'
        : 'flex h-full w-64 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white';

    // ── Empty state ────────────────────────────────────────────────────────
    if (!entry) {
        if (isDrawer) {
            // In portrait, hide the drawer entirely when nothing is selected
            return null;
        }
        return (
            <div className="flex h-full w-64 shrink-0 flex-col items-center justify-center border-l border-gray-200 bg-white px-4 text-center">
                <Layers className="mb-2 size-8 text-gray-300" />
                <p className="text-xs text-gray-400">
                    Click an entry in the timeline or list to edit its properties
                </p>
            </div>
        );
    }

    const inTime = entry.inTime ?? entry.start;
    const outTime = entry.exitTime ?? entry.end;
    const entryId = entry.id;

    const entryIndex = entries.indexOf(entry);

    const handleJumpToEntry = () => {
        if (meta.navigation === 'time_driven') {
            seek(inTime ?? 0);
        } else {
            seek(entryIndex);
        }
    };

    // Timestamp to pass to regenerate: inTime for time_driven, array index otherwise
    const remakeTimestamp =
        meta.navigation === 'time_driven' ? inTime ?? 0 : entries.indexOf(entry);

    // Pre-fill prompt from entry_meta if available
    const entryMeta = (entry as unknown as Record<string, unknown>).entry_meta as
        | Record<string, unknown>
        | undefined;
    const defaultPrompt = (entryMeta?.audio_text as string) ?? (entryMeta?.text as string) ?? '';

    const handleRemakeOpen = () => {
        if (!remakeOpen) {
            setRemakePrompt(remakePrompt || defaultPrompt);
            setRemakeState('idle');
            setRemakeNewHtml(null);
        }
        setRemakeOpen((v) => !v);
    };

    const handleRemakeGenerate = async () => {
        if (!remakePrompt.trim() || !videoId || !apiKey) return;
        setRemakeState('loading');
        try {
            const result = await regenerateFrame(videoId, apiKey, remakeTimestamp, remakePrompt);
            setRemakeNewHtml(result.new_html);
            setRemakeState('preview');
        } catch (err) {
            setRemakeState('idle');
            toast.error(err instanceof Error ? err.message : 'Regeneration failed');
        }
    };

    const handleRemakeAccept = () => {
        if (remakeNewHtml) {
            updateEntryHtml(entryId, remakeNewHtml);
        }
        setRemakeOpen(false);
        setRemakeState('idle');
        setRemakeNewHtml(null);
    };

    const handleRemakeDiscard = () => {
        setRemakeState('idle');
        setRemakeNewHtml(null);
    };

    return (
        <div className={wrapperCls} style={isDrawer ? { maxHeight: 280 } : undefined}>
            {/* Header */}
            <div className="shrink-0 border-b border-gray-200 px-3 py-1.5">
                <div className="flex items-center gap-2">
                    {/* Header label: friendly entry name in both modes. The
                        underlying `entry.id` only appears (in dim mono) when
                        developer mode is on. */}
                    <p
                        className="flex-1 truncate text-xs font-semibold text-gray-800"
                        title={entry.id}
                    >
                        {friendlyEntryName(entry, entryIndex, entries, displayNames)}
                        {viewMode === 'developer' && (
                            <span className="ml-1 font-mono text-[10px] text-gray-400">
                                {entry.id}
                            </span>
                        )}
                    </p>
                    <OutsidePlayheadBadge
                        navigation={meta.navigation}
                        inTime={inTime}
                        outTime={outTime}
                        entryIndex={entryIndex}
                        onJump={handleJumpToEntry}
                    />
                    <span className="text-[10px] text-gray-400">
                        {/* z-index only surfaced in developer mode — it's
                            noise for a layman user. */}
                        {viewMode === 'developer' && <span>z:{entry.z ?? 0} </span>}
                        {meta.navigation === 'time_driven' ? (
                            <span>
                                {formatTime(inTime)} → {formatTime(outTime)}
                            </span>
                        ) : (
                            <span>#{entries.indexOf(entry) + 1}</span>
                        )}
                    </span>
                    {/* Remake button — only shown when apiKey is available.
                        Prominent because AI-remake is the differentiator the
                        editor is built around. */}
                    {apiKey && (
                        <button
                            data-tour="editor-remake"
                            onClick={handleRemakeOpen}
                            className={[
                                'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition',
                                remakeOpen
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                            ].join(' ')}
                            title="Remake this shot with AI"
                        >
                            <Wand2 className="size-3" />
                            Remake
                        </button>
                    )}
                    <button
                        onClick={() => {
                            downloadShotHtml(
                                entry,
                                meta,
                                entries.indexOf(entry) > 0 && !entry.id?.startsWith('branding-')
                            );
                            toast.success('Shot HTML downloaded — open it in a browser to preview');
                        }}
                        className="shrink-0 text-gray-300 transition-colors hover:text-indigo-500"
                        title="Download this shot as a standalone HTML file"
                    >
                        <Download className="size-3.5" />
                    </button>
                    <button
                        onClick={() => deleteEntry(entryId)}
                        className="shrink-0 text-gray-300 transition-colors hover:text-red-500"
                        title="Delete entry"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>

                {/* Remake panel */}
                {remakeOpen && (
                    <div className="mt-2 space-y-2">
                        <textarea
                            rows={3}
                            value={remakePrompt}
                            onChange={(e) => setRemakePrompt(e.target.value)}
                            placeholder="Describe what to change… e.g. 'Make the title blue and add a subtitle'"
                            className="w-full resize-none rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-800 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none"
                            disabled={remakeState === 'loading'}
                        />

                        {remakeState === 'preview' ? (
                            <div className="space-y-1.5">
                                <p className="text-[10px] text-green-600">
                                    ✓ New version ready — accept to apply, or discard.
                                </p>
                                <div className="flex gap-1.5">
                                    <Button
                                        size="sm"
                                        className="h-6 flex-1 gap-1 bg-green-600 px-2 text-[11px] text-white hover:bg-green-700"
                                        onClick={handleRemakeAccept}
                                    >
                                        <Check className="size-3" />
                                        Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 flex-1 gap-1 border-gray-300 px-2 text-[11px] text-gray-600"
                                        onClick={handleRemakeDiscard}
                                    >
                                        <X className="size-3" />
                                        Discard
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                className="h-6 w-full gap-1 bg-indigo-600 px-2 text-[11px] text-white hover:bg-indigo-700 disabled:opacity-50"
                                disabled={!remakePrompt.trim() || remakeState === 'loading'}
                                onClick={handleRemakeGenerate}
                            >
                                {remakeState === 'loading' ? (
                                    <>
                                        <Loader2 className="size-3 animate-spin" />
                                        Generating…
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="size-3" />
                                        Generate
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Tab bar — horizontally scrollable so narrow panels still reveal every tab */}
            <div
                data-tour="editor-properties-tabs"
                className="flex shrink-0 overflow-x-auto border-b border-gray-200 [scrollbar-width:thin]"
            >
                {(
                    [
                        { id: 'layers', icon: <Layers className="size-3" />, label: 'Elements' },
                        {
                            id: 'transform',
                            icon: <Sliders className="size-3" />,
                            label: 'Position & Size',
                        },
                        { id: 'motion', icon: <Zap className="size-3" />, label: 'Transitions' },
                        { id: 'text', icon: <Type className="size-3" />, label: 'Text' },
                        {
                            id: 'media',
                            icon: <Image className="size-3" />,
                            label: 'Images & Video',
                        },
                        {
                            id: 'overlays',
                            icon: <Shapes className="size-3" />,
                            label: 'Overlays',
                        },
                        { id: 'code', icon: <Code2 className="size-3" />, label: 'Code' },
                    ] as const
                ).map(({ id, icon, label }) => (
                    <button
                        key={id}
                        className={[
                            'flex shrink-0 items-center justify-center gap-1 whitespace-nowrap px-3 py-2 text-[11px] transition-colors',
                            tab === id
                                ? 'border-b-2 border-indigo-500 text-indigo-600'
                                : 'text-gray-500 hover:text-gray-700',
                        ].join(' ')}
                        onClick={() => setTab(id)}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div
                className={['flex-1', tab === 'code' ? 'overflow-hidden' : 'overflow-y-auto'].join(
                    ' '
                )}
            >
                {tab === 'transform' && (
                    <TransformTab entryId={entryId} canvasW={canvasW} canvasH={canvasH} />
                )}
                {tab === 'motion' && (
                    <MotionTab entryId={entryId} inTime={inTime} exitTime={outTime} />
                )}
                {tab === 'text' && (
                    <TextTab
                        entryId={entryId}
                        entryHtml={entry.html}
                        canvasW={canvasW}
                        canvasH={canvasH}
                    />
                )}
                {tab === 'media' && <MediaTab entryId={entryId} entryHtml={entry.html} />}
                {tab === 'overlays' && (
                    <OverlaysTab
                        entryId={entryId}
                        entryHtml={entry.html}
                        canvasW={canvasW}
                        canvasH={canvasH}
                    />
                )}
                {tab === 'layers' && (
                    <>
                        <ShotCaptionOverride entryId={entryId} />
                        <LayersTab entryId={entryId} entryHtml={entry.html} />
                    </>
                )}
                {tab === 'code' && <HtmlTab entryId={entryId} entryHtml={entry.html} />}
            </div>

            {/* Footer: HTML size */}
            <div className="shrink-0 border-t border-gray-100 px-3 py-1">
                <span className="text-[10px] text-gray-400">
                    HTML: {(new TextEncoder().encode(entry.html).length / 1024).toFixed(1)} KB
                    {entry.audio_url && <span className="ml-2 text-green-600">• audio</span>}
                </span>
            </div>
        </div>
    );
}
