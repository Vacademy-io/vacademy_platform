import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ColorPickerField } from './ColorPickerField';
import { ImageUploadField } from './ImageUploadField';
import type { ComponentStyle, TypographyStyle, AnimationConfig, AnimationEntrance, Component } from '../-types/editor-types';

interface StyleEditorProps {
    style: ComponentStyle;
    onChange: (style: ComponentStyle) => void;
}

/* ─── Collapsible Section ─────────────────────────────────────────────── */

const Section = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-gray-100 pb-3">
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
            >
                {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                {title}
            </button>
            {open && <div className="flex flex-col gap-3 pl-1 pt-1">{children}</div>}
        </div>
    );
};

/* ─── Preset Button Row ───────────────────────────────────────────────── */

const PresetRow = ({ options, value, onChange, label }: { options: { label: string; value: string }[]; value?: string; onChange: (v: string) => void; label?: string }) => (
    <div>
        {label && <Label className="mb-1 text-xs">{label}</Label>}
        <div className="flex flex-wrap gap-1">
            {options.map((o) => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                        value === o.value
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    </div>
);

/* ─── Spacing presets ─────────────────────────────────────────────────── */

const SPACING_PRESETS = [
    { label: '0', value: '0px' },
    { label: '8', value: '8px' },
    { label: '16', value: '16px' },
    { label: '24', value: '24px' },
    { label: '32', value: '32px' },
    { label: '48', value: '48px' },
    { label: '64', value: '64px' },
    { label: '80', value: '80px' },
];

const SHADOW_PRESETS = [
    { label: 'None', value: 'none' },
    { label: 'SM', value: 'sm' },
    { label: 'MD', value: 'md' },
    { label: 'LG', value: 'lg' },
    { label: 'XL', value: 'xl' },
    { label: '2XL', value: '2xl' },
];

const FONT_SIZE_PRESETS = [
    { label: '14', value: '14px' },
    { label: '16', value: '16px' },
    { label: '18', value: '18px' },
    { label: '20', value: '20px' },
    { label: '24', value: '24px' },
    { label: '30', value: '30px' },
    { label: '36', value: '36px' },
    { label: '48', value: '48px' },
];

const FONT_WEIGHT_PRESETS = [
    { label: 'Regular', value: '400' },
    { label: 'Medium', value: '500' },
    { label: 'Semi', value: '600' },
    { label: 'Bold', value: '700' },
    { label: 'Extra', value: '800' },
];

const FONT_FAMILIES = [
    { label: 'Default', value: '' },
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Open Sans', value: '"Open Sans", sans-serif' },
    { label: 'Poppins', value: 'Poppins, sans-serif' },
    { label: 'Lato', value: 'Lato, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, sans-serif' },
    { label: 'Playfair', value: '"Playfair Display", serif' },
];

const ENTRANCE_TYPES = [
    { label: 'None', value: 'none' },
    { label: 'Fade In', value: 'fadeIn' },
    { label: 'Fade Up', value: 'fadeInUp' },
    { label: 'Fade Down', value: 'fadeInDown' },
    { label: 'Fade Left', value: 'fadeInLeft' },
    { label: 'Fade Right', value: 'fadeInRight' },
    { label: 'Scale Up', value: 'scaleUp' },
    { label: 'Slide Up', value: 'slideUp' },
];

const HOVER_TYPES = [
    { label: 'None', value: 'none' },
    { label: 'Lift', value: 'lift' },
    { label: 'Glow', value: 'glow' },
    { label: 'Scale', value: 'scale' },
    { label: 'Brighten', value: 'brighten' },
];

/* ─── Main StyleEditor ────────────────────────────────────────────────── */

export const StyleEditor = ({ style, onChange }: StyleEditorProps) => {
    const update = (partial: Partial<ComponentStyle>) => {
        onChange({ ...style, ...partial });
    };

    const updateTypography = (partial: Partial<TypographyStyle>) => {
        onChange({ ...style, typography: { ...style.typography, ...partial } });
    };

    const updateAnimation = (partial: Partial<AnimationConfig>) => {
        onChange({ ...style, animation: { ...style.animation, ...partial } });
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Design
            </div>

            {/* ─── Spacing ─────────────────────────────────────────── */}
            <Section title="Spacing" defaultOpen={false}>
                <PresetRow
                    label="Padding Top"
                    options={SPACING_PRESETS}
                    value={style.paddingTop}
                    onChange={(v) => update({ paddingTop: v })}
                />
                <PresetRow
                    label="Padding Bottom"
                    options={SPACING_PRESETS}
                    value={style.paddingBottom}
                    onChange={(v) => update({ paddingBottom: v })}
                />
                <PresetRow
                    label="Padding Left"
                    options={SPACING_PRESETS}
                    value={style.paddingLeft}
                    onChange={(v) => update({ paddingLeft: v })}
                />
                <PresetRow
                    label="Padding Right"
                    options={SPACING_PRESETS}
                    value={style.paddingRight}
                    onChange={(v) => update({ paddingRight: v })}
                />
                <PresetRow
                    label="Margin Top"
                    options={SPACING_PRESETS}
                    value={style.marginTop}
                    onChange={(v) => update({ marginTop: v })}
                />
                <PresetRow
                    label="Margin Bottom"
                    options={SPACING_PRESETS}
                    value={style.marginBottom}
                    onChange={(v) => update({ marginBottom: v })}
                />
            </Section>

            {/* ─── Background ──────────────────────────────────────── */}
            <Section title="Background">
                <ColorPickerField
                    label="Background Color"
                    value={style.backgroundColor || '#ffffff'}
                    onChange={(c) => update({ backgroundColor: c })}
                />
                <ImageUploadField
                    label="Background Image"
                    value={style.backgroundImage || ''}
                    onChange={(url) => update({ backgroundImage: url })}
                    placeholder="Image URL or upload"
                />
                {style.backgroundImage && (
                    <>
                        <PresetRow
                            label="Background Size"
                            options={[
                                { label: 'Cover', value: 'cover' },
                                { label: 'Contain', value: 'contain' },
                                { label: 'Auto', value: 'auto' },
                            ]}
                            value={style.backgroundSize || 'cover'}
                            onChange={(v) => update({ backgroundSize: v as 'cover' | 'contain' | 'auto' })}
                        />
                        <ColorPickerField
                            label="Overlay Color"
                            value={style.backgroundOverlay || 'rgba(0,0,0,0)'}
                            onChange={(c) => update({ backgroundOverlay: c })}
                        />
                    </>
                )}
                {/* Gradient toggle */}
                <div>
                    <Label className="mb-1 text-xs">Gradient</Label>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (style.gradient) {
                                    update({ gradient: undefined });
                                } else {
                                    update({
                                        gradient: {
                                            type: 'linear',
                                            angle: 180,
                                            stops: [
                                                { color: '#3B82F6', position: 0 },
                                                { color: '#8B5CF6', position: 100 },
                                            ],
                                        },
                                    });
                                }
                            }}
                            className={`rounded px-2 py-1 text-[11px] font-medium ${
                                style.gradient ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {style.gradient ? 'Enabled' : 'Off'}
                        </button>
                    </div>
                </div>
                {style.gradient && (
                    <div className="flex flex-col gap-2 rounded border border-gray-100 bg-gray-50 p-2">
                        <PresetRow
                            label="Type"
                            options={[
                                { label: 'Linear', value: 'linear' },
                                { label: 'Radial', value: 'radial' },
                            ]}
                            value={style.gradient.type}
                            onChange={(v) => update({ gradient: { ...style.gradient!, type: v as 'linear' | 'radial' } })}
                        />
                        {style.gradient.type === 'linear' && (
                            <div>
                                <Label className="text-xs">Angle ({style.gradient.angle ?? 180}&deg;)</Label>
                                <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    value={style.gradient.angle ?? 180}
                                    onChange={(e) =>
                                        update({ gradient: { ...style.gradient!, angle: Number(e.target.value) } })
                                    }
                                    className="w-full"
                                />
                            </div>
                        )}
                        {style.gradient.stops.map((stop, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <ColorPickerField
                                    label={`Stop ${i + 1}`}
                                    value={stop.color}
                                    onChange={(c) => {
                                        const newStops = [...style.gradient!.stops];
                                        newStops[i] = { ...newStops[i]!, color: c };
                                        update({ gradient: { ...style.gradient!, stops: newStops } });
                                    }}
                                />
                                <div className="flex-shrink-0">
                                    <Label className="text-xs">{stop.position}%</Label>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={stop.position}
                                        onChange={(e) => {
                                            const newStops = [...style.gradient!.stops];
                                            newStops[i] = { ...newStops[i]!, position: Number(e.target.value) };
                                            update({ gradient: { ...style.gradient!, stops: newStops } });
                                        }}
                                        className="w-20"
                                    />
                                </div>
                            </div>
                        ))}
                        {style.gradient.stops.length < 4 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                    const newStops = [...style.gradient!.stops, { color: '#10B981', position: 50 }];
                                    update({ gradient: { ...style.gradient!, stops: newStops } });
                                }}
                            >
                                + Add Stop
                            </Button>
                        )}
                    </div>
                )}
            </Section>

            {/* ─── Border & Shadow ─────────────────────────────────── */}
            <Section title="Border & Shadow">
                <div>
                    <Label className="mb-1 text-xs">Border Width</Label>
                    <div className="flex flex-wrap gap-1">
                        {['0', '1px', '2px', '3px', '4px'].map((v) => (
                            <button
                                key={v}
                                onClick={() => update({ borderWidth: v })}
                                className={`rounded px-2 py-1 text-[11px] font-medium ${
                                    (style.borderWidth || '0') === v
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
                {style.borderWidth && style.borderWidth !== '0' && (
                    <>
                        <ColorPickerField
                            label="Border Color"
                            value={style.borderColor || '#E5E7EB'}
                            onChange={(c) => update({ borderColor: c })}
                        />
                        <PresetRow
                            label="Border Style"
                            options={[
                                { label: 'Solid', value: 'solid' },
                                { label: 'Dashed', value: 'dashed' },
                                { label: 'Dotted', value: 'dotted' },
                            ]}
                            value={style.borderStyle || 'solid'}
                            onChange={(v) => update({ borderStyle: v as 'solid' | 'dashed' | 'dotted' })}
                        />
                    </>
                )}
                <div>
                    <Label className="mb-1 text-xs">Border Radius</Label>
                    <div className="flex flex-wrap gap-1">
                        {[
                            { label: 'None', value: '0' },
                            { label: '4px', value: '4px' },
                            { label: '8px', value: '8px' },
                            { label: '12px', value: '12px' },
                            { label: '16px', value: '16px' },
                            { label: '24px', value: '24px' },
                            { label: 'Full', value: '9999px' },
                        ].map((o) => (
                            <button
                                key={o.value}
                                onClick={() => update({ borderRadius: o.value })}
                                className={`rounded px-2 py-1 text-[11px] font-medium ${
                                    style.borderRadius === o.value
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                <PresetRow
                    label="Box Shadow"
                    options={SHADOW_PRESETS}
                    value={style.boxShadow || 'none'}
                    onChange={(v) => update({ boxShadow: v as ComponentStyle['boxShadow'] })}
                />
            </Section>

            {/* ─── Effects ─────────────────────────────────────────── */}
            <Section title="Effects">
                <div>
                    <Label className="mb-1 text-xs">Opacity ({Math.round((style.opacity ?? 1) * 100)}%)</Label>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((style.opacity ?? 1) * 100)}
                        onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
                        className="w-full"
                    />
                </div>
                <div>
                    <Label className="mb-1 text-xs">Max Width</Label>
                    <div className="flex flex-wrap gap-1">
                        {[
                            { label: 'None', value: '' },
                            { label: '800px', value: '800px' },
                            { label: '1024px', value: '1024px' },
                            { label: '1200px', value: '1200px' },
                            { label: '1400px', value: '1400px' },
                            { label: '100%', value: '100%' },
                        ].map((o) => (
                            <button
                                key={o.value}
                                onClick={() => update({ maxWidth: o.value || undefined })}
                                className={`rounded px-2 py-1 text-[11px] font-medium ${
                                    (style.maxWidth || '') === o.value
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <Label className="mb-1 text-xs">Min Height</Label>
                    <Input
                        value={style.minHeight || ''}
                        onChange={(e) => update({ minHeight: e.target.value || undefined })}
                        placeholder="e.g. 400px"
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="mb-1 text-xs">Custom CSS Class</Label>
                    <Input
                        value={style.customClass || ''}
                        onChange={(e) => update({ customClass: e.target.value || undefined })}
                        placeholder="e.g. my-hero-section"
                        className="h-8 text-xs"
                    />
                </div>
            </Section>

            {/* ─── Typography ──────────────────────────────────────── */}
            <Section title="Typography">
                <div>
                    <Label className="mb-1 text-xs">Font Family</Label>
                    <select
                        value={style.typography?.fontFamily || ''}
                        onChange={(e) => updateTypography({ fontFamily: e.target.value || undefined })}
                        className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
                    >
                        {FONT_FAMILIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                    </select>
                </div>
                <PresetRow
                    label="Font Size"
                    options={FONT_SIZE_PRESETS}
                    value={style.typography?.fontSize}
                    onChange={(v) => updateTypography({ fontSize: v })}
                />
                <PresetRow
                    label="Font Weight"
                    options={FONT_WEIGHT_PRESETS}
                    value={style.typography?.fontWeight}
                    onChange={(v) => updateTypography({ fontWeight: v as TypographyStyle['fontWeight'] })}
                />
                <div>
                    <Label className="mb-1 text-xs">Line Height ({style.typography?.lineHeight || '1.5'})</Label>
                    <input
                        type="range"
                        min={100}
                        max={250}
                        step={10}
                        value={Math.round(parseFloat(style.typography?.lineHeight || '1.5') * 100)}
                        onChange={(e) => updateTypography({ lineHeight: (Number(e.target.value) / 100).toFixed(1) })}
                        className="w-full"
                    />
                </div>
                <div>
                    <Label className="mb-1 text-xs">Letter Spacing</Label>
                    <div className="flex flex-wrap gap-1">
                        {[
                            { label: 'Tight', value: '-0.02em' },
                            { label: 'Normal', value: '0' },
                            { label: 'Wide', value: '0.05em' },
                            { label: 'Wider', value: '0.1em' },
                        ].map((o) => (
                            <button
                                key={o.value}
                                onClick={() => updateTypography({ letterSpacing: o.value })}
                                className={`rounded px-2 py-1 text-[11px] font-medium ${
                                    (style.typography?.letterSpacing || '0') === o.value
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                <ColorPickerField
                    label="Text Color"
                    value={style.typography?.textColor || '#000000'}
                    onChange={(c) => updateTypography({ textColor: c })}
                />
                <PresetRow
                    label="Text Align"
                    options={[
                        { label: 'Left', value: 'left' },
                        { label: 'Center', value: 'center' },
                        { label: 'Right', value: 'right' },
                    ]}
                    value={style.typography?.textAlign}
                    onChange={(v) => updateTypography({ textAlign: v as TypographyStyle['textAlign'] })}
                />
                <PresetRow
                    label="Text Transform"
                    options={[
                        { label: 'None', value: 'none' },
                        { label: 'UPPER', value: 'uppercase' },
                        { label: 'lower', value: 'lowercase' },
                        { label: 'Title', value: 'capitalize' },
                    ]}
                    value={style.typography?.textTransform}
                    onChange={(v) => updateTypography({ textTransform: v as TypographyStyle['textTransform'] })}
                />
            </Section>

            {/* ─── Animation ───────────────────────────────────────── */}
            <Section title="Animation">
                <div>
                    <Label className="mb-1 text-xs">Entrance Animation</Label>
                    <select
                        value={style.animation?.entrance?.type || 'none'}
                        onChange={(e) =>
                            updateAnimation({
                                entrance: {
                                    ...style.animation?.entrance,
                                    type: e.target.value as AnimationEntrance['type'],
                                },
                            })
                        }
                        className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
                    >
                        {ENTRANCE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
                {style.animation?.entrance?.type && style.animation.entrance.type !== 'none' && (
                    <>
                        <div>
                            <Label className="mb-1 text-xs">
                                Duration ({style.animation.entrance.duration ?? 600}ms)
                            </Label>
                            <input
                                type="range"
                                min={200}
                                max={2000}
                                step={100}
                                value={style.animation.entrance.duration ?? 600}
                                onChange={(e) =>
                                    updateAnimation({
                                        entrance: { ...style.animation!.entrance!, duration: Number(e.target.value) },
                                    })
                                }
                                className="w-full"
                            />
                        </div>
                        <div>
                            <Label className="mb-1 text-xs">
                                Delay ({style.animation.entrance.delay ?? 0}ms)
                            </Label>
                            <input
                                type="range"
                                min={0}
                                max={1000}
                                step={50}
                                value={style.animation.entrance.delay ?? 0}
                                onChange={(e) =>
                                    updateAnimation({
                                        entrance: { ...style.animation!.entrance!, delay: Number(e.target.value) },
                                    })
                                }
                                className="w-full"
                            />
                        </div>
                        <PresetRow
                            label="Easing"
                            options={[
                                { label: 'Ease', value: 'ease' },
                                { label: 'Ease In', value: 'ease-in' },
                                { label: 'Ease Out', value: 'ease-out' },
                                { label: 'Ease In-Out', value: 'ease-in-out' },
                            ]}
                            value={style.animation.entrance.easing || 'ease-out'}
                            onChange={(v) =>
                                updateAnimation({
                                    entrance: { ...style.animation!.entrance!, easing: v as 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' },
                                })
                            }
                        />
                    </>
                )}
                <PresetRow
                    label="Hover Effect"
                    options={HOVER_TYPES}
                    value={style.animation?.hover?.type || 'none'}
                    onChange={(v) => updateAnimation({ hover: { type: v as 'none' | 'lift' | 'glow' | 'scale' | 'brighten' } })}
                />
            </Section>

            {/* ─── Responsive Visibility ───────────────────────────── */}
            <Section title="Visibility">
                <div className="flex flex-col gap-2">
                    {(['desktop', 'tablet', 'mobile'] as const).map((vp) => (
                        <label key={vp} className="flex items-center gap-2 text-xs">
                            <input
                                type="checkbox"
                                checked={style.visibility?.[vp] !== false}
                                onChange={(e) =>
                                    update({
                                        visibility: {
                                            ...style.visibility,
                                            [vp]: e.target.checked,
                                        },
                                    })
                                }
                                className="rounded"
                            />
                            <span className="capitalize">{vp}</span>
                        </label>
                    ))}
                </div>
            </Section>
        </div>
    );
};
