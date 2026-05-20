import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComponentStyle, AnimationEntrance } from '../-types/editor-types';

// ─── buildComponentStyle — shared helper used by canvas + learner renderer ────

export function buildComponentStyle(style?: ComponentStyle): React.CSSProperties {
    if (!style) return {};
    const css: React.CSSProperties = {};

    if (style.paddingTop) css.paddingTop = style.paddingTop;
    if (style.paddingBottom) css.paddingBottom = style.paddingBottom;
    if (style.paddingLeft) css.paddingLeft = style.paddingLeft;
    if (style.paddingRight) css.paddingRight = style.paddingRight;
    if (style.marginTop) css.marginTop = style.marginTop;
    if (style.marginBottom) css.marginBottom = style.marginBottom;

    if (style.backgroundColor) css.backgroundColor = style.backgroundColor;

    if (style.borderStyle && style.borderStyle !== 'none') {
        css.borderStyle = style.borderStyle;
        if (style.borderWidth) css.borderWidth = style.borderWidth;
        if (style.borderColor) css.borderColor = style.borderColor;
    }
    if (style.borderRadius) css.borderRadius = style.borderRadius;

    if (style.opacity !== undefined && style.opacity < 1) css.opacity = style.opacity;

    if (style.boxShadow && style.boxShadow !== 'none') {
        const shadows: Record<string, string> = {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        };
        css.boxShadow = shadows[style.boxShadow] ?? style.boxShadow;
    }

    if (style.maxWidth) css.maxWidth = style.maxWidth;
    if (style.minHeight) css.minHeight = style.minHeight;

    if (style.typography) {
        const t = style.typography;
        if (t.fontSize) css.fontSize = t.fontSize;
        if (t.fontWeight) css.fontWeight = t.fontWeight as React.CSSProperties['fontWeight'];
        if (t.lineHeight) css.lineHeight = t.lineHeight;
        if (t.letterSpacing) css.letterSpacing = t.letterSpacing;
        if (t.textColor) css.color = t.textColor;
        if (t.textAlign) css.textAlign = t.textAlign;
    }

    return css;
}

// ─── Animation class / style for learner renderer ────────────────────────────

const KEYFRAMES = `
@keyframes _dp_fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes _dp_fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes _dp_fadeInDown { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes _dp_fadeInLeft { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes _dp_fadeInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes _dp_scaleUp { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes _dp_slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;

let keyframesInjected = false;
export function ensureAnimationKeyframes() {
    if (keyframesInjected || typeof document === 'undefined') return;
    keyframesInjected = true;
    const tag = document.createElement('style');
    tag.id = 'dp-keyframes';
    tag.textContent = KEYFRAMES;
    document.head.appendChild(tag);
}

export function getAnimationStyle(style?: ComponentStyle): React.CSSProperties {
    const entrance = style?.animation?.entrance;
    if (!entrance || entrance.type === 'none') return {};
    ensureAnimationKeyframes();
    const map: Record<string, string> = {
        fadeIn: '_dp_fadeIn',
        fadeInUp: '_dp_fadeInUp',
        fadeInDown: '_dp_fadeInDown',
        fadeInLeft: '_dp_fadeInLeft',
        fadeInRight: '_dp_fadeInRight',
        scaleUp: '_dp_scaleUp',
        slideUp: '_dp_slideUp',
    };
    const name = map[entrance.type];
    if (!name) return {};
    const duration = entrance.duration ?? 600;
    const delay = entrance.delay ?? 0;
    const easing = entrance.easing ?? 'ease-out';
    return { animation: `${name} ${duration}ms ${easing} ${delay}ms both` };
}

// ─── Spacing presets ──────────────────────────────────────────────────────────

const PADDING_PRESETS = [
    { label: 'None', value: undefined },
    { label: 'XS', value: '8px' },
    { label: 'S', value: '16px' },
    { label: 'M', value: '24px' },
    { label: 'L', value: '40px' },
    { label: 'XL', value: '64px' },
] as const;

const MARGIN_PRESETS = [
    { label: 'None', value: undefined },
    { label: 'XS', value: '8px' },
    { label: 'S', value: '16px' },
    { label: 'M', value: '32px' },
    { label: 'L', value: '48px' },
    { label: 'XL', value: '80px' },
] as const;

const SpacingPresets = ({
    label,
    presets,
    current,
    onSelect,
    onClear,
}: {
    label: string;
    presets: ReadonlyArray<{ label: string; value: string | undefined }>;
    current: Record<string, string | undefined>;
    onSelect: (v: string | undefined) => void;
    onClear: () => void;
}) => {
    const allValues = Object.values(current).filter(Boolean);
    const active = allValues.length > 0 && allValues.every((v) => v === allValues[0]) ? allValues[0] : undefined;

    return (
        <div className="space-y-1.5">
            <Label className="block text-[10px] text-neutral-400">{label}</Label>
            <div className="flex flex-wrap gap-1">
                {presets.map((p) => {
                    const isActive = p.value === undefined ? !active : active === p.value;
                    return (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => p.value === undefined ? onClear() : onSelect(p.value)}
                            className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                isActive
                                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                            }`}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>
            {active && (
                <p className="text-[9px] text-neutral-400">Applied: {active} on all sides</p>
            )}
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-neutral-100 last:border-0">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-2 rounded px-1 py-2.5 text-left transition-colors hover:bg-neutral-50"
            >
                <ChevronRight className={`size-3.5 shrink-0 text-neutral-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
                <span className="text-[11px] font-semibold tracking-wider text-neutral-500">{label}</span>
            </button>
            {open && <div className="space-y-3 px-1 pb-3">{children}</div>}
        </div>
    );
};

const ColorPicker = ({ label, value, onChange }: {
    label: string; value?: string; onChange: (v: string) => void;
}) => (
    <div className="flex items-center gap-2">
        <input
            type="color"
            value={value || '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="size-6 shrink-0 cursor-pointer rounded border border-neutral-200"
        />
        <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={label}
            className="h-7 flex-1 font-mono text-xs"
        />
        {value && (
            <button type="button" onClick={() => onChange('')} className="shrink-0 text-[10px] text-neutral-400 hover:text-neutral-600">✕</button>
        )}
    </div>
);

// ─── Main panel ───────────────────────────────────────────────────────────────

interface ComponentDesignPanelProps {
    style?: ComponentStyle;
    onChange: (style: ComponentStyle) => void;
}

export const ComponentDesignPanel: React.FC<ComponentDesignPanelProps> = ({ style = {}, onChange }) => {
    const update = (partial: Partial<ComponentStyle>) => onChange({ ...style, ...partial });

    const updateTypo = (partial: Partial<NonNullable<ComponentStyle['typography']>>) =>
        update({ typography: { ...style.typography, ...partial } });

    const updateEntrance = (partial: Partial<AnimationEntrance>) =>
        update({
            animation: {
                ...style.animation,
                entrance: { ...(style.animation?.entrance ?? { type: 'none' }), ...partial } as AnimationEntrance,
            },
        });

    const hasAnimation = style.animation?.entrance?.type && style.animation.entrance.type !== 'none';

    return (
        <div>
            {/* SPACING */}
            <Section label="SPACING">
                <SpacingPresets
                    label="Padding"
                    presets={PADDING_PRESETS}
                    current={{ top: style.paddingTop, right: style.paddingRight, bottom: style.paddingBottom, left: style.paddingLeft }}
                    onSelect={(v) => update({ paddingTop: v, paddingRight: v, paddingBottom: v, paddingLeft: v })}
                    onClear={() => update({ paddingTop: undefined, paddingRight: undefined, paddingBottom: undefined, paddingLeft: undefined })}
                />
                <SpacingPresets
                    label="Margin"
                    presets={MARGIN_PRESETS}
                    current={{ top: style.marginTop, bottom: style.marginBottom }}
                    onSelect={(v) => update({ marginTop: v, marginBottom: v })}
                    onClear={() => update({ marginTop: undefined, marginBottom: undefined })}
                />
            </Section>

            {/* BACKGROUND */}
            <Section label="BACKGROUND">
                <ColorPicker
                    label="Background color"
                    value={style.backgroundColor}
                    onChange={(v) => update({ backgroundColor: v || undefined })}
                />
            </Section>

            {/* BORDER & SHADOW */}
            <Section label="BORDER & SHADOW">
                <div className="space-y-1">
                    <Label className="text-[10px] text-neutral-400">Style</Label>
                    <select
                        value={style.borderStyle || 'none'}
                        onChange={(e) => update({ borderStyle: e.target.value as ComponentStyle['borderStyle'] })}
                        className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs focus:outline-none"
                    >
                        <option value="none">None</option>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                    </select>
                </div>
                {style.borderStyle && style.borderStyle !== 'none' && (
                    <>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-neutral-400">Width</Label>
                            <div className="flex gap-1">
                                {(['1px', '2px', '4px', '8px'] as const).map((w) => (
                                    <button key={w} type="button"
                                        onClick={() => update({ borderWidth: w })}
                                        className={`flex-1 rounded border py-0.5 text-[10px] font-medium transition-colors ${style.borderWidth === w ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                                        {w}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <ColorPicker label="Border color" value={style.borderColor} onChange={(v) => update({ borderColor: v || undefined })} />
                    </>
                )}
                <div className="space-y-1">
                    <Label className="text-[10px] text-neutral-400">Radius</Label>
                    <div className="flex gap-1">
                        {([['None', undefined], ['S', '4px'], ['M', '8px'], ['L', '12px'], ['XL', '9999px']] as const).map(([lbl, val]) => (
                            <button key={lbl} type="button"
                                onClick={() => update({ borderRadius: val })}
                                className={`flex-1 rounded border py-0.5 text-[10px] font-medium transition-colors ${(style.borderRadius ?? undefined) === val ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                                {lbl}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] text-neutral-400">Shadow</Label>
                    <div className="flex flex-wrap gap-1">
                        {(['none', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => update({ boxShadow: s === 'none' ? undefined : s })}
                                className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                    (style.boxShadow ?? 'none') === s
                                        ? 'border-primary-400 bg-primary-50 text-primary-600'
                                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* EFFECTS */}
            <Section label="EFFECTS">
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-neutral-400">Opacity</Label>
                        <span className="font-mono text-[10px] text-neutral-500">
                            {Math.round((style.opacity ?? 1) * 100)}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={style.opacity ?? 1}
                        onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
                        className="w-full accent-primary-500"
                    />
                </div>
            </Section>

            {/* TYPOGRAPHY */}
            <Section label="TYPOGRAPHY">
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-neutral-400">Font size</Label>
                        <Input
                            value={style.typography?.fontSize || ''}
                            onChange={(e) => updateTypo({ fontSize: e.target.value || undefined })}
                            placeholder="16px"
                            className="h-7 text-xs"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-neutral-400">Weight</Label>
                        <select
                            value={style.typography?.fontWeight || ''}
                            onChange={(e) => updateTypo({ fontWeight: (e.target.value as NonNullable<ComponentStyle['typography']>['fontWeight']) || undefined })}
                            className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-xs focus:outline-none"
                        >
                            <option value="">Default</option>
                            <option value="400">400 Regular</option>
                            <option value="500">500 Medium</option>
                            <option value="600">600 Semi-Bold</option>
                            <option value="700">700 Bold</option>
                            <option value="800">800 Extra-Bold</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-neutral-400">Letter spacing</Label>
                        <Input
                            value={style.typography?.letterSpacing || ''}
                            onChange={(e) => updateTypo({ letterSpacing: e.target.value || undefined })}
                            placeholder="0.05em"
                            className="h-7 text-xs"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-neutral-400">Line height</Label>
                        <Input
                            value={style.typography?.lineHeight || ''}
                            onChange={(e) => updateTypo({ lineHeight: e.target.value || undefined })}
                            placeholder="1.6"
                            className="h-7 text-xs"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] text-neutral-400">Text color</Label>
                    <ColorPicker
                        label="Color"
                        value={style.typography?.textColor}
                        onChange={(v) => updateTypo({ textColor: v || undefined })}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] text-neutral-400">Alignment</Label>
                    <div className="flex gap-1">
                        {(['left', 'center', 'right'] as const).map((a) => (
                            <button
                                key={a}
                                type="button"
                                onClick={() => updateTypo({ textAlign: a })}
                                className={`flex-1 rounded border py-1 text-xs capitalize transition-colors ${
                                    (style.typography?.textAlign ?? 'left') === a
                                        ? 'border-primary-400 bg-primary-50 text-primary-600'
                                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                }`}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ANIMATION */}
            <Section label="ANIMATION">
                <div className="space-y-1">
                    <Label className="text-[10px] text-neutral-400">Entrance effect</Label>
                    <select
                        value={style.animation?.entrance?.type || 'none'}
                        onChange={(e) => updateEntrance({ type: e.target.value as AnimationEntrance['type'] })}
                        className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:outline-none"
                    >
                        <option value="none">None</option>
                        <option value="fadeIn">Fade In</option>
                        <option value="fadeInUp">Fade In Up</option>
                        <option value="fadeInDown">Fade In Down</option>
                        <option value="fadeInLeft">Fade In Left</option>
                        <option value="fadeInRight">Fade In Right</option>
                        <option value="scaleUp">Scale Up</option>
                        <option value="slideUp">Slide Up</option>
                    </select>
                </div>
                {hasAnimation && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-neutral-400">Duration (ms)</Label>
                            <Input
                                type="number"
                                min={100}
                                max={3000}
                                step={100}
                                value={style.animation?.entrance?.duration ?? 600}
                                onChange={(e) => updateEntrance({ duration: parseInt(e.target.value) || 600 })}
                                className="h-7 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-neutral-400">Delay (ms)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={2000}
                                step={100}
                                value={style.animation?.entrance?.delay ?? 0}
                                onChange={(e) => updateEntrance({ delay: parseInt(e.target.value) || 0 })}
                                className="h-7 text-xs"
                            />
                        </div>
                    </div>
                )}
                {hasAnimation && (
                    <div className="space-y-1">
                        <Label className="text-[10px] text-neutral-400">Easing</Label>
                        <select
                            value={style.animation?.entrance?.easing || 'ease-out'}
                            onChange={(e) => updateEntrance({ easing: e.target.value as AnimationEntrance['easing'] })}
                            className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs focus:outline-none"
                        >
                            <option value="ease">Ease</option>
                            <option value="ease-in">Ease In</option>
                            <option value="ease-out">Ease Out</option>
                            <option value="ease-in-out">Ease In Out</option>
                        </select>
                    </div>
                )}
            </Section>

            {/* VISIBILITY */}
            <Section label="VISIBILITY">
                <div className="space-y-2">
                    {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
                        <label key={v} className="flex cursor-pointer items-center justify-between">
                            <span className="text-xs capitalize text-neutral-700">Show on {v}</span>
                            <input
                                type="checkbox"
                                checked={style.visibility?.[v] !== false}
                                onChange={(e) => update({
                                    visibility: { ...style.visibility, [v]: e.target.checked },
                                })}
                                className="size-4 accent-primary-500"
                            />
                        </label>
                    ))}
                    <p className="text-[10px] text-neutral-400">Uncheck to hide on that screen size.</p>
                </div>
            </Section>
        </div>
    );
};
