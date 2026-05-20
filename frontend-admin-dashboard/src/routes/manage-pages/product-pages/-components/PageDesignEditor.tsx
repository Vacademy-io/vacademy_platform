import React, { useState, useCallback } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
import {
    ChevronDown,
    ChevronUp,
    Trash2,
    Eye,
    EyeOff,
    Plus,
    Type,
    Code,
    Rows3,
    LayoutTemplate,
    PanelTop,
    PanelBottom,
    GripVertical,
    List,
    Puzzle,
    BarChart3,
    Quote,
    HelpCircle,
    PlayCircle,
    Megaphone,
    Sparkles,
    ListOrdered,
    ImageIcon,
    Monitor,
    Tablet,
    Smartphone,
    X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { renderComponentPreview } from '../../-components/ComponentPreviews';
import { getComponentTemplate } from '../../-utils/component-templates';
import { ImageUploadField } from '../../-components/ImageUploadField';
import { RichTextField } from '../../-components/RichTextField';
import { ComponentDesignPanel, buildComponentStyle } from '../../-components/ComponentDesignPanel';
import type { Component } from '../../-types/editor-types';
import type { PageJson } from '../-types/product-page-types';

// ─── Supported component types for the product page palette ──────────────────

type ProductPageType =
    | 'header'
    | 'heroSection'
    | 'productCourseGrid'
    | 'textBlock'
    | 'imageBlock'
    | 'htmlBlock'
    | 'footer'
    | 'statsHighlights'
    | 'testimonialSection'
    | 'faqSection'
    | 'videoEmbed'
    | 'ctaBanner'
    | 'featureGrid'
    | 'stepsProcess'
    | 'marquee';

const COMPONENT_PALETTE: {
    type: ProductPageType;
    label: string;
    icon: React.ReactNode;
    description: string;
    group: string;
}[] = [
    { type: 'header', label: 'Header', icon: <PanelTop className="size-4" />, description: 'Logo + navigation bar', group: 'Layout' },
    { type: 'heroSection', label: 'Hero Banner', icon: <LayoutTemplate className="size-4" />, description: 'Split layout with photo collage', group: 'Layout' },
    { type: 'footer', label: 'Footer', icon: <PanelBottom className="size-4" />, description: 'Links + copyright bar', group: 'Layout' },
    { type: 'productCourseGrid', label: 'Course Grid', icon: <Rows3 className="size-4" />, description: 'Course listing with filters', group: 'Course' },
    { type: 'textBlock', label: 'Text Block', icon: <Type className="size-4" />, description: 'Rich text paragraph', group: 'Content' },
    { type: 'imageBlock', label: 'Image', icon: <ImageIcon className="size-4" />, description: 'Full-width clickable image', group: 'Content' },
    { type: 'videoEmbed', label: 'Video Embed', icon: <PlayCircle className="size-4" />, description: 'YouTube / Vimeo embed', group: 'Content' },
    { type: 'htmlBlock', label: 'HTML Block', icon: <Code className="size-4" />, description: 'Custom HTML / CSS / JS', group: 'Content' },
    { type: 'statsHighlights', label: 'Stats', icon: <BarChart3 className="size-4" />, description: 'Key numbers highlight', group: 'Marketing' },
    { type: 'testimonialSection', label: 'Testimonials', icon: <Quote className="size-4" />, description: 'Student reviews', group: 'Marketing' },
    { type: 'faqSection', label: 'FAQ', icon: <HelpCircle className="size-4" />, description: 'Frequently asked questions', group: 'Marketing' },
    { type: 'ctaBanner', label: 'CTA Banner', icon: <Megaphone className="size-4" />, description: 'Call-to-action section', group: 'Marketing' },
    { type: 'featureGrid', label: 'Feature Grid', icon: <Sparkles className="size-4" />, description: 'Program highlights', group: 'Marketing' },
    { type: 'stepsProcess', label: 'Steps / Process', icon: <ListOrdered className="size-4" />, description: 'How it works', group: 'Marketing' },
    { type: 'marquee', label: 'Marquee', icon: <List className="size-4" />, description: 'Scrolling ticker strip', group: 'Marketing' },
];

const SINGLE_ONLY = new Set<ProductPageType>(['header', 'footer', 'productCourseGrid', 'heroSection']);

// ─── Migrate old product-page format → catalogue component format ─────────────

const TYPE_MAP: Record<string, string> = {
    Header: 'header',
    HeroBanner: 'heroSection',
    CourseGrid: 'productCourseGrid',
    TextBlock: 'textBlock',
    ImageBanner: 'imageBlock',
    HTML: 'htmlBlock',
    Footer: 'footer',
    StatsHighlights: 'statsHighlights',
    TestimonialSection: 'testimonialSection',
    FaqSection: 'faqSection',
    VideoEmbed: 'videoEmbed',
    CtaBanner: 'ctaBanner',
    FeatureGrid: 'featureGrid',
    StepsProcess: 'stepsProcess',
    FilterBar: '__REMOVE__',
};

const migrateComponent = (c: Component): Component | null => {
    const newType = TYPE_MAP[c.type];
    if (newType === '__REMOVE__') return null;
    if (!newType) return c; // already new format

    const p = c.props as Record<string, unknown>;

    switch (c.type) {
        case 'Header':
            return { ...c, type: 'header', props: { logo: '', title: p['title'] ?? '', navigation: [], authLinks: [] } };
        case 'HeroBanner': {
            const collage = (p['collageImages'] as string[] | undefined) ?? [];
            return {
                ...c, type: 'heroSection',
                props: {
                    layout: 'split',
                    backgroundColor: p['backgroundColor'] ?? '#F8FAFC',
                    left: {
                        title: p['title'] ?? '',
                        description: p['subtitle'] ?? '',
                        button: { enabled: p['buttonEnabled'] ?? false, text: p['buttonText'] ?? 'Enroll Now', action: 'navigate', target: '' },
                    },
                    right: { image: '', alt: '', imageCollage: collage },
                    styles: { padding: '40px', roundedEdges: true, textAlign: 'left' },
                },
            };
        }
        case 'CourseGrid':
            return { ...c, type: 'productCourseGrid', props: { columns: p['columns'] ?? 3, showPrice: p['showPrice'] ?? true, showBadge: p['showBadge'] ?? true, showFilters: true } };
        case 'TextBlock':
            return { ...c, type: 'textBlock', props: { content: p['content'] ?? '', alignment: 'left', maxWidth: '800px' } };
        case 'ImageBanner':
            return { ...c, type: 'imageBlock', props: { src: '', alt: p['altText'] ?? '', linkUrl: p['linkUrl'] ?? '', alignment: 'center', maxWidth: '100%' } };
        case 'HTML':
            return { ...c, type: 'htmlBlock', props: { html: p['html'] ?? '' } };
        case 'Footer': {
            const sections = (p['sections'] as Array<{ title: string; links: Array<{ label: string; url: string }> }> | undefined) ?? [];
            return {
                ...c, type: 'footer',
                props: {
                    leftSection: { title: p['brandName'] ?? '', text: p['brandTagline'] ?? '', socials: [] },
                    rightSection1: sections[0] ? { title: sections[0].title, links: sections[0].links.map((l) => ({ label: l.label, url: l.url })) } : undefined,
                    rightSection2: sections[1] ? { title: sections[1].title, links: sections[1].links.map((l) => ({ label: l.label, url: l.url })) } : undefined,
                    bottomNote: p['copyrightText'] ?? '',
                },
            };
        }
        case 'StatsHighlights':
            return { ...c, type: 'statsHighlights', props: { ...p, styles: {} } };
        case 'TestimonialSection':
            return {
                ...c, type: 'testimonialSection',
                props: {
                    headerText: p['headerText'] ?? '',
                    description: p['description'] ?? '',
                    layout: p['layout'] === 'scroll' ? 'grid-scroll' : 'grid-scroll',
                    testimonials: ((p['testimonials'] as Array<{ name: string; role: string; feedback: string }> | undefined) ?? []).map((t) => ({ author: t.name, role: t.role, content: t.feedback, avatar: '' })),
                    styles: {},
                },
            };
        case 'FaqSection':
            return { ...c, type: 'faqSection', props: { ...p } };
        case 'VideoEmbed':
            return { ...c, type: 'videoEmbed', props: { ...p, autoplay: false } };
        case 'CtaBanner':
            return {
                ...c, type: 'ctaBanner',
                props: {
                    heading: p['heading'] ?? '',
                    subheading: p['subheading'] ?? '',
                    backgroundColor: p['backgroundColor'] ?? '#1e40af',
                    textColor: p['textColor'] ?? '#ffffff',
                    layout: 'centered',
                    button: {
                        enabled: (p['button'] as Record<string, unknown>)?.['enabled'] ?? false,
                        text: (p['button'] as Record<string, unknown>)?.['text'] ?? 'Enroll Now',
                        action: 'navigate',
                        target: (p['button'] as Record<string, unknown>)?.['url'] ?? '',
                        style: 'solid',
                    },
                },
            };
        case 'FeatureGrid':
            return {
                ...c, type: 'featureGrid',
                props: {
                    headerText: p['headerText'] ?? '',
                    subheading: p['subheading'] ?? '',
                    columns: p['columns'] ?? 3,
                    features: p['features'] ?? [],
                    style: p['style'] ?? 'cards',
                    iconSize: 'large',
                    backgroundColor: '#ffffff',
                },
            };
        case 'StepsProcess':
            return {
                ...c, type: 'stepsProcess',
                props: {
                    headerText: p['headerText'] ?? '',
                    subheading: p['subheading'] ?? '',
                    layout: p['layout'] ?? 'horizontal',
                    steps: ((p['steps'] as Array<{ title: string; description: string }> | undefined) ?? []).map((s, i) => ({ number: String(i + 1), title: s.title, description: s.description })),
                    connectorStyle: 'line',
                    backgroundColor: '#ffffff',
                    accentColor: p['accentColor'] ?? '',
                },
            };
        default:
            return c;
    }
};

export const normalizePageJson = (json: PageJson): PageJson => ({
    ...json,
    components: (json.components ?? [])
        .map((c) => migrateComponent(c as Component))
        .filter((c): c is Component => c !== null),
});

// ─── Property Editors ─────────────────────────────────────────────────────────

type EditorProps = { props: Record<string, any>; onChange: (p: Record<string, any>) => void };

const ColorField = ({ label, value, defaultValue, onChange }: {
    label: string; value?: string; defaultValue: string; onChange: (v: string) => void;
}) => (
    <div className="space-y-1">
        <Label className="text-xs text-neutral-500">{label}</Label>
        <div className="flex items-center gap-2">
            <input type="color" value={value || defaultValue} onChange={(e) => onChange(e.target.value)} className="size-7 cursor-pointer rounded border border-neutral-200" />
            <Input value={value || defaultValue} onChange={(e) => onChange(e.target.value)} className="h-7 font-mono text-xs" />
            {value && value !== defaultValue && (
                <button type="button" onClick={() => onChange(defaultValue)} className="shrink-0 text-[10px] text-neutral-400 hover:text-neutral-600">reset</button>
            )}
        </div>
    </div>
);

const HERO_LAYOUTS = [
    { id: 'split', label: 'Split', preview: '▐░░░░░░░▌▐░░░░░▌', description: 'Text left, image right' },
    { id: 'centered', label: 'Centered', preview: '░░░░░▐░░░░░▌░░░░░', description: 'Text centered, full-width' },
] as const;

const HeroSectionEditor = ({ props: p, onChange }: EditorProps) => {
    const layout: string = p['layout'] ?? 'split';
    const collage: string[] = (p['right']?.imageCollage ?? []).filter(Boolean);
    const tags: string[] = p['left']?.tags ?? [];
    const updateLeft = (k: string, v: unknown) => onChange({ ...p, left: { ...p['left'], [k]: v } });
    const updateBtn = (k: string, v: unknown) => onChange({ ...p, left: { ...p['left'], button: { ...p['left']?.button, [k]: v } } });
    const setCollage = (imgs: string[]) => onChange({ ...p, right: { ...p['right'], imageCollage: imgs, image: '' } });
    const updateCollageSlot = (i: number, url: string) => {
        const next = [...collage];
        if (url) { next[i] = url; } else { next.splice(i, 1); }
        setCollage(next);
    };

    return (
        <div className="space-y-3">
            {/* Layout preset */}
            <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Layout</p>
                <div className="grid grid-cols-2 gap-2">
                    {HERO_LAYOUTS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChange({ ...p, layout: opt.id })}
                            className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-center transition-all ${
                                layout === opt.id
                                    ? 'border-primary-400 bg-primary-50'
                                    : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                        >
                            <span className="font-mono text-[10px] tracking-widest text-neutral-400">{opt.preview}</span>
                            <span className={`text-xs font-semibold ${layout === opt.id ? 'text-primary-600' : 'text-neutral-600'}`}>{opt.label}</span>
                            <span className="text-[10px] text-neutral-400">{opt.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Colors */}
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#F8FAFC" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#111827" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>

            {/* Tags */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-neutral-500">Tags</Label>
                    <button type="button" onClick={() => updateLeft('tags', [...tags, ''])} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                        <Plus className="size-3" /> Add tag
                    </button>
                </div>
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag, i) => (
                            <div key={i} className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 pl-2 pr-1 py-0.5">
                                <input
                                    value={tag}
                                    onChange={(e) => { const t = [...tags]; t[i] = e.target.value; updateLeft('tags', t); }}
                                    placeholder="Tag"
                                    className="w-14 bg-transparent text-xs focus:outline-none"
                                />
                                <button type="button" onClick={() => updateLeft('tags', tags.filter((_, j) => j !== i))} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3" /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Heading</Label>
                <Input value={p['left']?.title || ''} onChange={(e) => updateLeft('title', e.target.value)} placeholder="Building Strong Foundations…" />
            </div>

            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Subheading</Label>
                <Input value={p['left']?.subheading || ''} onChange={(e) => updateLeft('subheading', e.target.value)} placeholder="A short supporting headline…" />
            </div>

            <RichTextField label="Description" value={p['left']?.description || ''} onChange={(v) => updateLeft('description', v)} placeholder="Add a supporting description…" />

            {/* CTA Button */}
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={p['left']?.button?.enabled ?? false} onChange={(e) => updateBtn('enabled', e.target.checked)} className="size-4 accent-primary-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">CTA Button</span>
                </label>
                {p['left']?.button?.enabled && (
                    <div className="space-y-2 pt-1">
                        <Input value={p['left']?.button?.text || ''} onChange={(e) => updateBtn('text', e.target.value)} placeholder="Explore Courses" className="h-7 text-xs" />
                        <Input value={p['left']?.button?.target || ''} onChange={(e) => updateBtn('target', e.target.value)} placeholder="URL or #courses" className="h-7 text-xs" />
                        <ColorField label="Button Background" value={p['left']?.button?.bgColor} defaultValue="#4F46E5" onChange={(v) => updateBtn('bgColor', v)} />
                        <ColorField label="Button Text Color" value={p['left']?.button?.textColor} defaultValue="#FFFFFF" onChange={(v) => updateBtn('textColor', v)} />
                    </div>
                )}
            </div>

            {/* Right side image (only for split layout) */}
            {layout === 'split' && (
                <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 space-y-3">
                    <Label className="text-xs font-semibold text-neutral-500">Right Side Image</Label>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-400">Single Image</Label>
                        <ImageUploadField label="" value={p['right']?.image || ''} onChange={(url) => onChange({ ...p, right: { ...p['right'], image: url, imageCollage: [] } })} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-neutral-400">Photo Collage (up to 5)</Label>
                            {collage.length < 5 && (
                                <button type="button" onClick={() => setCollage([...collage, ''])} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                                    <Plus className="size-3" /> Add
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-neutral-400">Appears as a mosaic grid on the right.</p>
                        {collage.map((url, i) => (
                            <ImageUploadField key={i} label={`Photo ${i + 1}`} value={url} onChange={(u) => updateCollageSlot(i, u)} />
                        ))}
                    </div>
                </div>
            )}

            {/* Background image for centered layout */}
            {layout === 'centered' && (
                <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 space-y-2">
                    <Label className="text-xs font-semibold text-neutral-500">Background Image (optional)</Label>
                    <ImageUploadField label="" value={p['backgroundImage'] || ''} onChange={(url) => onChange({ ...p, backgroundImage: url })} />
                    <p className="text-[11px] text-neutral-400">Shown as a full-width background behind the centered text.</p>
                </div>
            )}
        </div>
    );
};

const HeaderEditor = ({ props: p, onChange }: EditorProps) => {
    const navigation: Array<{ label: string; url?: string; route?: string }> = p['navigation'] ?? [];
    const cta = (p['ctaButton'] as Record<string, unknown>) ?? {};
    const updateCta = (k: string, v: unknown) => onChange({ ...p, ctaButton: { ...cta, [k]: v } });

    return (
        <div className="space-y-3">
            {/* Colors */}
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#4F46E5" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Nav Link Color" value={p['textColor']} defaultValue="#FFFFFF" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>

            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Site Title</Label>
                <Input value={p['title'] || ''} onChange={(e) => onChange({ ...p, title: e.target.value })} placeholder="My Academy" />
            </div>
            <ImageUploadField label="Logo" value={p['logo'] || ''} onChange={(url) => onChange({ ...p, logo: url })} />

            {/* Nav Links */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-neutral-500">Nav Links</Label>
                    {navigation.length < 6 && (
                        <button type="button" onClick={() => onChange({ ...p, navigation: [...navigation, { label: '', url: '' }] })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                            <Plus className="size-3" /> Add link
                        </button>
                    )}
                </div>
                {navigation.map((nav, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <Input value={nav.label} onChange={(e) => { const n = [...navigation]; n[i] = { ...n[i]!, label: e.target.value }; onChange({ ...p, navigation: n }); }} placeholder="Label" className="h-7 text-xs" />
                        <Input value={nav.url || nav.route || ''} onChange={(e) => { const n = [...navigation]; n[i] = { ...n[i]!, url: e.target.value }; onChange({ ...p, navigation: n }); }} placeholder="URL or #section" className="h-7 text-xs" />
                        <button type="button" onClick={() => onChange({ ...p, navigation: navigation.filter((_, j) => j !== i) })} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                    </div>
                ))}
            </div>

            {/* CTA Button */}
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={(cta.enabled as boolean) ?? false} onChange={(e) => updateCta('enabled', e.target.checked)} className="size-4 accent-primary-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">CTA Button</span>
                </label>
                {!!(cta.enabled) && (
                    <div className="space-y-2 pt-1">
                        <Input value={(cta.text as string) || ''} onChange={(e) => updateCta('text', e.target.value)} placeholder="Enroll Now" className="h-7 text-xs" />
                        <Input value={(cta.url as string) || ''} onChange={(e) => updateCta('url', e.target.value)} placeholder="URL or #section" className="h-7 text-xs" />
                        <ColorField label="Button Background" value={cta.bgColor as string} defaultValue="#FFFFFF" onChange={(v) => updateCta('bgColor', v)} />
                        <ColorField label="Button Text Color" value={cta.textColor as string} defaultValue="#4F46E5" onChange={(v) => updateCta('textColor', v)} />
                    </div>
                )}
            </div>
        </div>
    );
};

const FooterEditor = ({ props: p, onChange }: EditorProps) => {
    const updateLeft = (k: string, v: unknown) => onChange({ ...p, leftSection: { ...p['leftSection'], [k]: v } });
    const sections = [p['rightSection1'], p['rightSection2'], p['rightSection3']].filter(Boolean) as Array<{ title: string; links: Array<{ label: string; url: string }> }>;
    const setSection = (i: number, val: { title: string; links: Array<{ label: string; url: string }> } | undefined) => {
        const keys = ['rightSection1', 'rightSection2', 'rightSection3'] as const;
        onChange({ ...p, [keys[i]!]: val });
    };
    const addSection = () => {
        const empty = { title: '', links: [] };
        if (!p['rightSection1']) onChange({ ...p, rightSection1: empty });
        else if (!p['rightSection2']) onChange({ ...p, rightSection2: empty });
        else if (!p['rightSection3']) onChange({ ...p, rightSection3: empty });
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#F9FAFB" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#374151" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Brand Name</Label>
                <Input value={p['leftSection']?.title || ''} onChange={(e) => updateLeft('title', e.target.value)} placeholder="My Academy" />
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Brand Tagline</Label>
                <Input value={p['leftSection']?.text || ''} onChange={(e) => updateLeft('text', e.target.value)} placeholder="Learn without limits." />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-neutral-500">Link Sections</Label>
                    {sections.length < 3 && (
                        <button type="button" onClick={addSection} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                            <Plus className="size-3" /> Add
                        </button>
                    )}
                </div>
                {sections.map((sec, si) => (
                    <div key={si} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Input value={sec.title} onChange={(e) => setSection(si, { ...sec, title: e.target.value })} placeholder="Section title" className="h-7 text-xs font-medium" />
                            <button type="button" onClick={() => setSection(si, undefined)} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                        </div>
                        {sec.links.map((lnk, li) => (
                            <div key={li} className="flex items-center gap-1.5 pl-2">
                                <Input value={lnk.label} onChange={(e) => { const ls = [...sec.links]; ls[li] = { ...ls[li]!, label: e.target.value }; setSection(si, { ...sec, links: ls }); }} placeholder="Label" className="h-6 text-xs" />
                                <Input value={lnk.url} onChange={(e) => { const ls = [...sec.links]; ls[li] = { ...ls[li]!, url: e.target.value }; setSection(si, { ...sec, links: ls }); }} placeholder="URL" className="h-6 text-xs" />
                                <button type="button" onClick={() => setSection(si, { ...sec, links: sec.links.filter((_, j) => j !== li) })} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3" /></button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setSection(si, { ...sec, links: [...sec.links, { label: '', url: '' }] })} className="flex items-center gap-1 pl-2 text-[11px] text-primary-600 hover:underline">
                            <Plus className="size-2.5" /> Add link
                        </button>
                    </div>
                ))}
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Copyright Note</Label>
                <Input value={p['bottomNote'] || ''} onChange={(e) => onChange({ ...p, bottomNote: e.target.value })} placeholder={`© ${new Date().getFullYear()} My Academy`} />
            </div>
        </div>
    );
};

const ProductCourseGridEditor = ({ props: p, onChange }: EditorProps) => (
    <div className="space-y-3">
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Section Title</Label>
            <Input value={p['title'] as string || ''} onChange={(e) => onChange({ ...p, title: e.target.value })} placeholder="Our Courses" />
        </div>
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Layout Preset</Label>
            <div className="flex gap-1.5">
                {([['grid3', 'Grid 3', 3], ['grid4', 'Grid 4', 4], ['list', 'List', 1]] as const).map(([key, label, cols]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange({ ...p, columns: cols, layout: key === 'list' ? 'list' : 'grid' })}
                        className={`flex-1 rounded border py-1.5 text-xs font-medium transition-colors ${
                            (key === 'list' ? (p['layout'] === 'list' || p['columns'] === 1) : p['columns'] === cols && p['layout'] !== 'list')
                                ? 'border-primary-400 bg-primary-50 text-primary-600'
                                : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
        <div className="flex flex-col gap-2">
            {[['showFilters', 'Show Filters'], ['showPrice', 'Show Price'], ['showBadge', 'Show Badge']].map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={p[key as string] ?? true} onChange={(e) => onChange({ ...p, [key as string]: e.target.checked })} className="size-4 accent-primary-500" />
                    {label}
                </label>
            ))}
        </div>
        <ColorField label="Background Color" value={p['backgroundColor']} defaultValue="#F8FAFC" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
    </div>
);

const TextBlockEditor = ({ props: p, onChange }: EditorProps) => (
    <div className="space-y-3">
        <RichTextField label="Content" value={p['content'] || ''} onChange={(v) => onChange({ ...p, content: v })} placeholder="Write your text here…" />
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Alignment</Label>
            <select value={p['alignment'] || 'left'} onChange={(e) => onChange({ ...p, alignment: e.target.value })} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
            </select>
        </div>
        <ColorField label="Background Color" value={p['backgroundColor']} defaultValue="#FFFFFF" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
    </div>
);

const ImageBlockEditor = ({ props: p, onChange }: EditorProps) => (
    <div className="space-y-3">
        <ImageUploadField label="Image" value={p['src'] || ''} onChange={(url) => onChange({ ...p, src: url })} />
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Alt Text</Label>
            <Input value={p['alt'] || ''} onChange={(e) => onChange({ ...p, alt: e.target.value })} placeholder="Descriptive alt text" />
        </div>
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Link URL (optional)</Label>
            <Input value={p['linkUrl'] || ''} onChange={(e) => onChange({ ...p, linkUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Alignment</Label>
            <select value={p['alignment'] || 'center'} onChange={(e) => onChange({ ...p, alignment: e.target.value })} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
            </select>
        </div>
    </div>
);

const HtmlBlockEditor = ({ props: p, onChange }: EditorProps) => (
    <div className="space-y-1">
        <Label className="text-xs text-neutral-500">HTML</Label>
        <textarea rows={6} value={p['html'] || ''} onChange={(e) => onChange({ ...p, html: e.target.value })} placeholder="<div>Custom content</div>" className="w-full rounded-md border border-neutral-200 px-3 py-2 font-mono text-xs focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300" />
    </div>
);

const StatsHighlightsEditor = ({ props: p, onChange }: EditorProps) => {
    const stats: Array<{ label: string; value: string }> = p['stats'] ?? [];
    return (
        <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Heading</Label><Input value={p['headerText'] || ''} onChange={(e) => onChange({ ...p, headerText: e.target.value })} placeholder="Our Numbers" /></div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Description</Label><Input value={p['description'] || ''} onChange={(e) => onChange({ ...p, description: e.target.value })} /></div>
            <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-neutral-500">Stats</Label><button type="button" onClick={() => onChange({ ...p, stats: [...stats, { label: '', value: '' }] })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Plus className="size-3" /> Add</button></div>
                {stats.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input value={s.value} onChange={(e) => { const ns = [...stats]; ns[i] = { ...ns[i]!, value: e.target.value }; onChange({ ...p, stats: ns }); }} placeholder="10,000+" className="h-7 text-xs" />
                        <Input value={s.label} onChange={(e) => { const ns = [...stats]; ns[i] = { ...ns[i]!, label: e.target.value }; onChange({ ...p, stats: ns }); }} placeholder="Students" className="h-7 text-xs" />
                        <button type="button" onClick={() => onChange({ ...p, stats: stats.filter((_, j) => j !== i) })} className="text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                    </div>
                ))}
            </div>
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#FFFFFF" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#111827" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>
        </div>
    );
};

const TestimonialSectionEditor = ({ props: p, onChange }: EditorProps) => {
    const testimonials: Array<{ author: string; role: string; content: string; avatar: string }> = p['testimonials'] ?? [];
    return (
        <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Heading</Label><Input value={p['headerText'] || ''} onChange={(e) => onChange({ ...p, headerText: e.target.value })} placeholder="What Our Learners Say" /></div>
            <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-neutral-500">Testimonials</Label><button type="button" onClick={() => onChange({ ...p, testimonials: [...testimonials, { author: '', role: '', content: '', avatar: '' }] })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Plus className="size-3" /> Add</button></div>
                {testimonials.map((t, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                        <div className="flex items-center gap-1">
                            <Input value={t.author} onChange={(e) => { const nt = [...testimonials]; nt[i] = { ...nt[i]!, author: e.target.value }; onChange({ ...p, testimonials: nt }); }} placeholder="Name" className="h-7 text-xs" />
                            <Input value={t.role} onChange={(e) => { const nt = [...testimonials]; nt[i] = { ...nt[i]!, role: e.target.value }; onChange({ ...p, testimonials: nt }); }} placeholder="Role" className="h-7 text-xs" />
                            <button type="button" onClick={() => onChange({ ...p, testimonials: testimonials.filter((_, j) => j !== i) })} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                        </div>
                        <textarea rows={2} value={t.content} onChange={(e) => { const nt = [...testimonials]; nt[i] = { ...nt[i]!, content: e.target.value }; onChange({ ...p, testimonials: nt }); }} placeholder="Feedback…" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-xs focus:outline-none" />
                    </div>
                ))}
            </div>
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#F9FAFB" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#111827" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>
        </div>
    );
};

const FaqSectionEditor = ({ props: p, onChange }: EditorProps) => {
    const faqs: Array<{ question: string; answer: string }> = p['faqs'] ?? [];
    return (
        <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Heading</Label><Input value={p['headerText'] || ''} onChange={(e) => onChange({ ...p, headerText: e.target.value })} placeholder="FAQ" /></div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Subheading</Label><Input value={p['subheading'] || ''} onChange={(e) => onChange({ ...p, subheading: e.target.value })} /></div>
            <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-neutral-500">Questions</Label><button type="button" onClick={() => onChange({ ...p, faqs: [...faqs, { question: '', answer: '' }] })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Plus className="size-3" /> Add</button></div>
                {faqs.map((faq, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Input value={faq.question} onChange={(e) => { const nf = [...faqs]; nf[i] = { ...nf[i]!, question: e.target.value }; onChange({ ...p, faqs: nf }); }} placeholder="Question?" className="h-7 flex-1 text-xs font-medium" />
                            <button type="button" onClick={() => onChange({ ...p, faqs: faqs.filter((_, j) => j !== i) })} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                        </div>
                        <textarea rows={2} value={faq.answer} onChange={(e) => { const nf = [...faqs]; nf[i] = { ...nf[i]!, answer: e.target.value }; onChange({ ...p, faqs: nf }); }} placeholder="Answer…" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-xs focus:outline-none" />
                    </div>
                ))}
            </div>
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#F9FAFB" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#111827" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>
        </div>
    );
};

const VideoEmbedEditor = ({ props: p, onChange }: EditorProps) => (
    <div className="space-y-3">
        <div className="space-y-1"><Label className="text-xs text-neutral-500">Video URL</Label><Input value={p['url'] || ''} onChange={(e) => onChange({ ...p, url: e.target.value })} placeholder="https://youtube.com/watch?v=…" /></div>
        <div className="space-y-1"><Label className="text-xs text-neutral-500">Title</Label><Input value={p['title'] || ''} onChange={(e) => onChange({ ...p, title: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs text-neutral-500">Caption</Label><Input value={p['caption'] || ''} onChange={(e) => onChange({ ...p, caption: e.target.value })} /></div>
        <div className="space-y-1">
            <Label className="text-xs text-neutral-500">Aspect Ratio</Label>
            <select value={p['aspectRatio'] || '16:9'} onChange={(e) => onChange({ ...p, aspectRatio: e.target.value })} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none">
                <option value="16:9">16:9</option><option value="4:3">4:3</option><option value="1:1">1:1</option>
            </select>
        </div>
        <ColorField label="Background Color" value={p['backgroundColor']} defaultValue="#000000" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
    </div>
);

const CtaBannerEditor = ({ props: p, onChange }: EditorProps) => {
    const btn = p['button'] ?? {};
    const updateBtn = (k: string, v: unknown) => onChange({ ...p, button: { ...btn, [k]: v } });
    return (
        <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Heading</Label><Input value={p['heading'] || ''} onChange={(e) => onChange({ ...p, heading: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Subheading</Label><Input value={p['subheading'] || ''} onChange={(e) => onChange({ ...p, subheading: e.target.value })} /></div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Background Color</Label>
                <div className="flex items-center gap-2"><input type="color" value={p['backgroundColor'] || '#1e40af'} onChange={(e) => onChange({ ...p, backgroundColor: e.target.value })} className="size-7 cursor-pointer rounded border border-neutral-200" /><Input value={p['backgroundColor'] || '#1e40af'} onChange={(e) => onChange({ ...p, backgroundColor: e.target.value })} className="h-7 font-mono text-xs" /></div>
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Text Color</Label>
                <div className="flex items-center gap-2"><input type="color" value={p['textColor'] || '#ffffff'} onChange={(e) => onChange({ ...p, textColor: e.target.value })} className="size-7 cursor-pointer rounded border border-neutral-200" /><Input value={p['textColor'] || '#ffffff'} onChange={(e) => onChange({ ...p, textColor: e.target.value })} className="h-7 font-mono text-xs" /></div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={btn.enabled ?? false} onChange={(e) => updateBtn('enabled', e.target.checked)} className="size-4 accent-primary-500" />
                Show Button
            </label>
            {btn.enabled && <Input value={btn.text || ''} onChange={(e) => updateBtn('text', e.target.value)} placeholder="Enroll Now" />}
        </div>
    );
};

const FeatureGridEditor = ({ props: p, onChange }: EditorProps) => {
    const features: Array<{ icon: string; title: string; description: string }> = p['features'] ?? [];
    return (
        <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#FFFFFF" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#111827" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Heading</Label><Input value={p['headerText'] || ''} onChange={(e) => onChange({ ...p, headerText: e.target.value })} placeholder="Why Choose Us" /></div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Subheading</Label><Input value={p['subheading'] || ''} onChange={(e) => onChange({ ...p, subheading: e.target.value })} /></div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Columns</Label>
                <select value={p['columns'] ?? 3} onChange={(e) => onChange({ ...p, columns: parseInt(e.target.value) })} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none">
                    <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                </select>
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-neutral-500">Features</Label><button type="button" onClick={() => onChange({ ...p, features: [...features, { icon: '✨', title: '', description: '' }] })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Plus className="size-3" /> Add</button></div>
                {features.map((f, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Input value={f.icon} onChange={(e) => { const nf = [...features]; nf[i] = { ...nf[i]!, icon: e.target.value }; onChange({ ...p, features: nf }); }} placeholder="Icon/emoji" className="h-7 w-16 text-center text-xs" />
                            <Input value={f.title} onChange={(e) => { const nf = [...features]; nf[i] = { ...nf[i]!, title: e.target.value }; onChange({ ...p, features: nf }); }} placeholder="Title" className="h-7 flex-1 text-xs" />
                            <button type="button" onClick={() => onChange({ ...p, features: features.filter((_, j) => j !== i) })} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                        </div>
                        <Input value={f.description} onChange={(e) => { const nf = [...features]; nf[i] = { ...nf[i]!, description: e.target.value }; onChange({ ...p, features: nf }); }} placeholder="Description" className="h-7 text-xs" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const StepsProcessEditor = ({ props: p, onChange }: EditorProps) => {
    const steps: Array<{ number: string; title: string; description: string }> = p['steps'] ?? [];
    return (
        <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Section Colors</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#FFFFFF" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#111827" onChange={(v) => onChange({ ...p, textColor: v })} />
            </div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Heading</Label><Input value={p['headerText'] || ''} onChange={(e) => onChange({ ...p, headerText: e.target.value })} placeholder="How It Works" /></div>
            <div className="space-y-1"><Label className="text-xs text-neutral-500">Subheading</Label><Input value={p['subheading'] || ''} onChange={(e) => onChange({ ...p, subheading: e.target.value })} /></div>
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Layout</Label>
                <select value={p['layout'] || 'horizontal'} onChange={(e) => onChange({ ...p, layout: e.target.value })} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none">
                    <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
                </select>
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-neutral-500">Steps</Label><button type="button" onClick={() => onChange({ ...p, steps: [...steps, { number: String(steps.length + 1), title: '', description: '' }] })} className="flex items-center gap-1 text-xs text-primary-600 hover:underline"><Plus className="size-3" /> Add</button></div>
                {steps.map((s, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Input value={s.title} onChange={(e) => { const ns = [...steps]; ns[i] = { ...ns[i]!, title: e.target.value }; onChange({ ...p, steps: ns }); }} placeholder="Step title" className="h-7 flex-1 text-xs font-medium" />
                            <button type="button" onClick={() => onChange({ ...p, steps: steps.filter((_, j) => j !== i) })} className="shrink-0 text-neutral-300 hover:text-danger-500"><X className="size-3.5" /></button>
                        </div>
                        <textarea rows={2} value={s.description} onChange={(e) => { const ns = [...steps]; ns[i] = { ...ns[i]!, description: e.target.value }; onChange({ ...p, steps: ns }); }} placeholder="Description…" className="w-full rounded-md border border-neutral-200 px-3 py-2 text-xs focus:outline-none" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const MARQUEE_ICON_OPTIONS = [
    { value: '', label: 'None' },
    { value: '⭐', label: '⭐ Star' },
    { value: '✓', label: '✓ Check' },
    { value: '🎓', label: '🎓 Graduate' },
    { value: '🏆', label: '🏆 Trophy' },
    { value: '🚀', label: '🚀 Rocket' },
    { value: '💡', label: '💡 Bulb' },
    { value: '📚', label: '📚 Books' },
    { value: '🔥', label: '🔥 Fire' },
    { value: '✨', label: '✨ Sparkle' },
    { value: '◆', label: '◆ Diamond' },
    { value: '●', label: '● Circle' },
    { value: '|', label: '| Pipe' },
];

const MarqueeEditor = ({ props: p, onChange }: EditorProps) => {
    const items: Array<{ icon: string; text: string }> = p['items'] ?? [
        { icon: '⭐', text: 'Item 1' },
        { icon: '⭐', text: 'Item 2' },
    ];

    const addItem = () => onChange({ ...p, items: [...items, { icon: p['defaultIcon'] ?? '⭐', text: 'New item' }] });
    const removeItem = (i: number) => onChange({ ...p, items: items.filter((_, j) => j !== i) });
    const updateItem = (i: number, field: 'icon' | 'text', val: string) => {
        const next = [...items];
        next[i] = { ...next[i]!, [field]: val };
        onChange({ ...p, items: next });
    };

    return (
        <div className="space-y-4">
            {/* Appearance */}
            <div className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Appearance</p>
                <ColorField label="Background" value={p['backgroundColor']} defaultValue="#1e1b4b" onChange={(v) => onChange({ ...p, backgroundColor: v })} />
                <ColorField label="Text Color" value={p['textColor']} defaultValue="#ffffff" onChange={(v) => onChange({ ...p, textColor: v })} />
                <ColorField label="Icon Color" value={p['iconColor']} defaultValue="#facc15" onChange={(v) => onChange({ ...p, iconColor: v })} />
                <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Font Size</Label>
                    <div className="flex gap-1">
                        {(['xs', 'sm', 'base', 'lg', 'xl'] as const).map((s) => (
                            <button key={s} type="button"
                                onClick={() => onChange({ ...p, fontSize: s })}
                                className={`flex-1 rounded border py-0.5 text-[10px] font-medium transition-colors ${(p['fontSize'] ?? 'sm') === s ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Motion */}
            <div className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Motion</p>
                <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Speed</Label>
                    <div className="flex gap-1">
                        {([['slow', '40s'], ['medium', '25s'], ['fast', '14s']] as const).map(([key, _]) => (
                            <button key={key} type="button"
                                onClick={() => onChange({ ...p, speed: key })}
                                className={`flex-1 rounded border py-1 text-xs font-medium capitalize transition-colors ${(p['speed'] ?? 'medium') === key ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                                {key}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-neutral-500">Direction</Label>
                    <div className="flex gap-1">
                        {(['left', 'right'] as const).map((dir) => (
                            <button key={dir} type="button"
                                onClick={() => onChange({ ...p, direction: dir })}
                                className={`flex-1 rounded border py-1 text-xs font-medium capitalize transition-colors ${(p['direction'] ?? 'left') === dir ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}>
                                {dir === 'left' ? '← Left' : '→ Right'}
                            </button>
                        ))}
                    </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={p['pauseOnHover'] !== false} onChange={(e) => onChange({ ...p, pauseOnHover: e.target.checked })} className="size-4 accent-primary-500" />
                    Pause on hover
                </label>
            </div>

            {/* Default icon for new items */}
            <div className="space-y-1">
                <Label className="text-xs text-neutral-500">Default separator icon</Label>
                <select value={p['defaultIcon'] ?? '⭐'} onChange={(e) => onChange({ ...p, defaultIcon: e.target.value })} className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:outline-none">
                    {MARQUEE_ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            {/* Items */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-neutral-500">Items</Label>
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                        <Plus className="size-3" /> Add item
                    </button>
                </div>
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <select
                            value={item.icon}
                            onChange={(e) => updateItem(i, 'icon', e.target.value)}
                            className="w-16 shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-1 text-xs focus:outline-none"
                        >
                            {MARQUEE_ICON_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <Input
                            value={item.text}
                            onChange={(e) => updateItem(i, 'text', e.target.value)}
                            placeholder="Item text"
                            className="h-7 flex-1 text-xs"
                        />
                        <button type="button" onClick={() => removeItem(i)} className="shrink-0 text-neutral-300 hover:text-danger-500">
                            <X className="size-3.5" />
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <p className="text-[11px] text-neutral-400">No items yet. Add some above.</p>
                )}
            </div>
        </div>
    );
};

const PropEditorDispatch = ({ component, onChange }: { component: Component; onChange: (c: Component) => void }) => {
    const update = (props: Record<string, unknown>) => onChange({ ...component, props });
    const p = component.props;
    switch (component.type) {
        case 'heroSection': return <HeroSectionEditor props={p} onChange={update} />;
        case 'header': return <HeaderEditor props={p} onChange={update} />;
        case 'footer': return <FooterEditor props={p} onChange={update} />;
        case 'productCourseGrid': return <ProductCourseGridEditor props={p} onChange={update} />;
        case 'textBlock': return <TextBlockEditor props={p} onChange={update} />;
        case 'imageBlock': return <ImageBlockEditor props={p} onChange={update} />;
        case 'htmlBlock': return <HtmlBlockEditor props={p} onChange={update} />;
        case 'statsHighlights': return <StatsHighlightsEditor props={p} onChange={update} />;
        case 'testimonialSection': return <TestimonialSectionEditor props={p} onChange={update} />;
        case 'faqSection': return <FaqSectionEditor props={p} onChange={update} />;
        case 'videoEmbed': return <VideoEmbedEditor props={p} onChange={update} />;
        case 'ctaBanner': return <CtaBannerEditor props={p} onChange={update} />;
        case 'featureGrid': return <FeatureGridEditor props={p} onChange={update} />;
        case 'stepsProcess': return <StepsProcessEditor props={p} onChange={update} />;
        case 'marquee': return <MarqueeEditor props={p} onChange={update} />;
        default: return <p className="text-xs text-neutral-400">No editor for "{component.type}"</p>;
    }
};

// ─── DnD palette item ─────────────────────────────────────────────────────────

const DraggablePaletteItem = ({
    type, label, icon, description, disabled, onAdd,
}: {
    type: string; label: string; icon: React.ReactNode; description: string;
    disabled: boolean; onAdd: () => void;
}) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `palette-${type}`,
        data: { type },
        disabled,
    });

    return (
        <div
            ref={setNodeRef}
            className={`group flex items-center gap-2 rounded-lg border p-2 transition-all ${
                disabled
                    ? 'cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-40'
                    : isDragging
                    ? 'border-blue-300 bg-blue-50 opacity-70'
                    : 'cursor-grab border-neutral-200 bg-white hover:border-primary-200 hover:bg-primary-50/30'
            }`}
            {...attributes}
            {...listeners}
        >
            <GripVertical className="size-3.5 shrink-0 text-neutral-300" />
            <span className="shrink-0 text-neutral-500">{icon}</span>
            <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-neutral-700">{label}</div>
                <div className="truncate text-[10px] text-neutral-400">{description}</div>
            </div>
            {!disabled && (
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onAdd}
                    className="shrink-0 rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-primary-600 group-hover:opacity-100"
                >
                    <Plus className="size-3.5" />
                </button>
            )}
        </div>
    );
};

const GROUPS = ['Layout', 'Course', 'Content', 'Marketing'];

const PalettePanel = ({ existingTypes, onAdd }: { existingTypes: Set<string>; onAdd: (type: ProductPageType) => void }) => (
    <div className="flex flex-1 flex-col gap-0 overflow-y-auto p-3">
        {GROUPS.map((group) => {
            const items = COMPONENT_PALETTE.filter((p) => p.group === group);
            return (
                <div key={group} className="mb-3">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{group}</div>
                    <div className="space-y-1">
                        {items.map((item) => (
                            <DraggablePaletteItem
                                key={item.type}
                                type={item.type}
                                label={item.label}
                                icon={item.icon}
                                description={item.description}
                                disabled={SINGLE_ONLY.has(item.type) && existingTypes.has(item.type)}
                                onAdd={() => onAdd(item.type)}
                            />
                        ))}
                    </div>
                </div>
            );
        })}
    </div>
);

const LayersPanelLocal = ({ components, selectedId, onSelect, onToggle }: {
    components: Component[]; selectedId: string | null;
    onSelect: (id: string) => void; onToggle: (id: string) => void;
}) => {
    const paletteMap = Object.fromEntries(COMPONENT_PALETTE.map((p) => [p.type, p]));
    return (
        <div className="flex flex-1 flex-col overflow-y-auto p-2">
            {components.length === 0 ? (
                <p className="mt-4 text-center text-xs text-neutral-400">No components yet</p>
            ) : (
                components.map((c, i) => {
                    const info = paletteMap[c.type];
                    return (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelect(c.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${c.id === selectedId ? 'bg-primary-50 text-primary-700' : 'hover:bg-neutral-50'}`}
                        >
                            <span className="w-5 shrink-0 text-center text-[10px] font-mono text-neutral-300">{i + 1}</span>
                            <span className="shrink-0 text-neutral-400">{info?.icon ?? <Puzzle className="size-3.5" />}</span>
                            <span className="flex-1 truncate text-xs font-medium text-neutral-700">{info?.label ?? c.type}</span>
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); onToggle(c.id); }}
                                className="shrink-0 text-neutral-300 hover:text-neutral-600"
                            >
                                {c.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5 text-neutral-200" />}
                            </button>
                        </button>
                    );
                })
            )}
        </div>
    );
};

// ─── Canvas ───────────────────────────────────────────────────────────────────

const CanvasItem = ({
    component, isSelected, isFirst, isLast,
    onClick, onMoveUp, onMoveDown, onToggleEnabled, onRemove,
}: {
    component: Component; isSelected: boolean; isFirst: boolean; isLast: boolean;
    onClick: () => void; onMoveUp: () => void; onMoveDown: () => void;
    onToggleEnabled: () => void; onRemove: () => void;
}) => (
    <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`group relative cursor-pointer transition-all ${!component.enabled ? 'opacity-40' : ''}`}
    >
        {/* Hover outline (light blue) */}
        {!isSelected && (
            <div
                className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                style={{ boxShadow: 'inset 0 0 0 2px #93C5FD' }}
            />
        )}
        {/* Selection outline (solid blue) */}
        {isSelected && (
            <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{ boxShadow: 'inset 0 0 0 3px #3B82F6' }}
            />
        )}

        {/* Inline toolbar — always visible on hover, more actions when selected */}
        <div
            className={`absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-lg border bg-white shadow-md transition-opacity duration-100 ${
                isSelected ? 'border-blue-100 opacity-100' : 'border-neutral-100 opacity-0 group-hover:opacity-100'
            } px-1 py-0.5`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <button type="button" disabled={isFirst} onClick={onMoveUp} title="Move up"
                className="flex size-6 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-25">
                <ChevronUp className="size-3.5" />
            </button>
            <button type="button" disabled={isLast} onClick={onMoveDown} title="Move down"
                className="flex size-6 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-25">
                <ChevronDown className="size-3.5" />
            </button>
            {isSelected && (
                <>
                    <div className="mx-0.5 h-3.5 w-px bg-neutral-200" />
                    <button type="button" onClick={onToggleEnabled} title={component.enabled ? 'Hide component' : 'Show component'}
                        className={`flex size-6 items-center justify-center rounded transition-colors ${
                            component.enabled ? 'text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700' : 'text-neutral-200 hover:bg-neutral-50 hover:text-neutral-500'
                        }`}>
                        {component.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                    <button type="button" onClick={onRemove} title="Remove component"
                        className="flex size-6 items-center justify-center rounded text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="size-3.5" />
                    </button>
                </>
            )}
        </div>

        {/* Hidden badge */}
        {!component.enabled && (
            <div className="absolute left-2 top-2 z-10 rounded bg-neutral-800/60 px-1.5 py-0.5 text-[9px] font-medium text-white">hidden</div>
        )}

        <div style={{ pointerEvents: 'none', ...buildComponentStyle(component.style) }}>
            {renderComponentPreview(component)}
        </div>
    </div>
);

const VIEWPORT_WIDTHS = { desktop: 860, tablet: 768, mobile: 375 } as const;

const ProductCanvas = ({
    components, selectedId, onSelect, viewport, onViewportChange,
    onMoveUp, onMoveDown, onToggleEnabled, onRemove,
}: {
    components: Component[]; selectedId: string | null;
    onSelect: (id: string | null) => void;
    viewport: 'desktop' | 'tablet' | 'mobile';
    onViewportChange: (v: 'desktop' | 'tablet' | 'mobile') => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onToggleEnabled: (id: string) => void;
    onRemove: (id: string) => void;
}) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' });
    return (
        <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b bg-white px-3 py-2">
                <span className="text-xs text-neutral-400">
                    {components.length === 0 ? 'Drag components here or click + to add' : `${components.length} component${components.length !== 1 ? 's' : ''} · click to select`}
                </span>
                <div className="ml-auto flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                    {(['desktop', 'tablet', 'mobile'] as const).map((v) => {
                        const Icon = v === 'desktop' ? Monitor : v === 'tablet' ? Tablet : Smartphone;
                        return (
                            <button key={v} onClick={() => onViewportChange(v)} className={`flex size-6 items-center justify-center rounded transition-colors ${viewport === v ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title={v}>
                                <Icon className="size-3.5" />
                            </button>
                        );
                    })}
                </div>
            </div>
            <div ref={setNodeRef} className={`flex-1 overflow-auto p-6 transition-colors ${isOver ? 'bg-blue-50' : ''}`} onClick={() => onSelect(null)}>
                <div
                    className={`relative mx-auto bg-white shadow-lg transition-all ${isOver ? 'ring-2 ring-blue-400' : ''}`}
                    style={{ maxWidth: VIEWPORT_WIDTHS[viewport], minHeight: '100%' }}
                >
                    {components.length === 0 ? (
                        <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
                            <div className="rounded-xl border-2 border-dashed border-neutral-200 px-12 py-16 text-center">
                                <LayoutTemplate className="mx-auto mb-3 size-10 text-neutral-200" />
                                <p className="text-sm font-medium text-neutral-400">This page is empty</p>
                                <p className="mt-1 text-xs text-neutral-300">Drag from the left panel or click + to add components</p>
                            </div>
                        </div>
                    ) : (
                        components.map((comp, idx) => (
                            <CanvasItem
                                key={comp.id}
                                component={comp}
                                isSelected={comp.id === selectedId}
                                isFirst={idx === 0}
                                isLast={idx === components.length - 1}
                                onClick={() => onSelect(comp.id)}
                                onMoveUp={() => onMoveUp(comp.id)}
                                onMoveDown={() => onMoveDown(comp.id)}
                                onToggleEnabled={() => onToggleEnabled(comp.id)}
                                onRemove={() => onRemove(comp.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Right panel ──────────────────────────────────────────────────────────────

const RightPanel = ({
    selectedComponent, selectedIndex, totalComponents, globalSettings,
    onUpdateComponent, onMoveUp, onMoveDown, onToggleEnabled, onRemove, onUpdateGlobal,
}: {
    selectedComponent: Component | null; selectedIndex: number; totalComponents: number;
    globalSettings: { primaryColor: string; logoFileId: string };
    onUpdateComponent: (c: Component) => void;
    onMoveUp: () => void; onMoveDown: () => void;
    onToggleEnabled: () => void; onRemove: () => void;
    onUpdateGlobal: (s: { primaryColor: string; logoFileId: string }) => void;
}) => {
    const info = selectedComponent
        ? COMPONENT_PALETTE.find((p) => p.type === selectedComponent.type)
        : null;

    if (!selectedComponent) {
        return (
            <div className="flex h-full flex-col">
                <div className="border-b px-4 py-3 text-sm font-semibold text-neutral-700">Page Settings</div>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-neutral-500">Brand Color</Label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={globalSettings.primaryColor} onChange={(e) => onUpdateGlobal({ ...globalSettings, primaryColor: e.target.value })} className="size-7 cursor-pointer rounded border border-neutral-200" />
                            <Input value={globalSettings.primaryColor} onChange={(e) => onUpdateGlobal({ ...globalSettings, primaryColor: e.target.value })} className="h-7 font-mono text-xs" />
                        </div>
                    </div>
                    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-[11px] text-neutral-400">
                        Click any component on the canvas to edit its properties.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="text-primary-400">{info?.icon}</span>
                    <span className="text-sm font-semibold text-neutral-800">{info?.label ?? selectedComponent.type}</span>
                </div>
                {info?.description && <p className="mt-0.5 text-[11px] text-neutral-400">{info.description}</p>}
            </div>
            <div className="flex items-center gap-1 border-b px-3 py-2">
                <button type="button" disabled={selectedIndex <= 0} onClick={onMoveUp} className="flex size-7 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-50 disabled:opacity-30" title="Move up"><ChevronUp className="size-3.5" /></button>
                <button type="button" disabled={selectedIndex >= totalComponents - 1} onClick={onMoveDown} className="flex size-7 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-400 hover:bg-neutral-50 disabled:opacity-30" title="Move down"><ChevronDown className="size-3.5" /></button>
                <button type="button" onClick={onToggleEnabled} className={`flex size-7 items-center justify-center rounded border bg-white transition-colors ${selectedComponent.enabled ? 'border-neutral-200 text-success-500' : 'border-neutral-200 text-neutral-300'}`} title={selectedComponent.enabled ? 'Hide' : 'Show'}>
                    {selectedComponent.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
                <div className="flex-1" />
                <button type="button" onClick={onRemove} className="flex size-7 items-center justify-center rounded border border-neutral-200 bg-white text-neutral-300 hover:border-danger-200 hover:bg-danger-50 hover:text-danger-500" title="Remove"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <PropEditorDispatch component={selectedComponent} onChange={onUpdateComponent} />
                <div className="mt-4 border-t border-neutral-100 pt-3">
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Design</p>
                    <ComponentDesignPanel
                        style={selectedComponent.style}
                        onChange={(newStyle) => onUpdateComponent({ ...selectedComponent, style: newStyle })}
                    />
                </div>
            </div>
        </div>
    );
};

// ─── Main export ──────────────────────────────────────────────────────────────

interface PageDesignEditorProps {
    pageJson: PageJson;
    onChange: (updated: PageJson) => void;
}

export const PageDesignEditor = ({ pageJson, onChange }: PageDesignEditorProps) => {
    const normalized = React.useMemo(() => normalizePageJson(pageJson), [pageJson]);
    const { components, globalSettings } = normalized;

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'add' | 'layers'>('add');
    const [activeDragType, setActiveDragType] = useState<string | null>(null);
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const selectedIndex = selectedId ? components.findIndex((c) => c.id === selectedId) : -1;
    const selectedComponent = selectedIndex >= 0 ? (components[selectedIndex] ?? null) : null;
    const existingTypes = new Set(components.map((c) => c.type));

    const emit = useCallback((components: Component[]) => onChange({ ...normalized, components }), [normalized, onChange]);

    const addComponent = useCallback((type: ProductPageType) => {
        const newComp = getComponentTemplate(type);
        emit([...components, newComp]);
        setSelectedId(newComp.id);
        setSidebarTab('layers');
    }, [components, emit]);

    const removeComponent = useCallback((id: string) => {
        if (selectedId === id) setSelectedId(null);
        emit(components.filter((c) => c.id !== id));
    }, [components, emit, selectedId]);

    const moveComponent = useCallback((index: number, direction: 'up' | 'down') => {
        const next = [...components];
        const swap = direction === 'up' ? index - 1 : index + 1;
        if (swap < 0 || swap >= next.length) return;
        [next[index], next[swap]] = [next[swap]!, next[index]!];
        emit(next);
    }, [components, emit]);

    const updateComponent = useCallback((updated: Component) => {
        emit(components.map((c) => (c.id === updated.id ? updated : c)));
    }, [components, emit]);

    const toggleEnabled = useCallback((id: string) => {
        emit(components.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
    }, [components, emit]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveDragType((event.active.data.current?.type as string) ?? null);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over?.id === 'canvas-drop-zone' && active.data.current?.type) {
            addComponent(active.data.current.type as ProductPageType);
        }
        setActiveDragType(null);
    }, [addComponent]);

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full">
                {/* Left sidebar */}
                <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r bg-white">
                    <div className="flex shrink-0 border-b">
                        <button onClick={() => setSidebarTab('add')} className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${sidebarTab === 'add' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-neutral-500 hover:text-neutral-700'}`}>
                            <Puzzle className="size-3.5" /> Add
                        </button>
                        <button onClick={() => setSidebarTab('layers')} className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${sidebarTab === 'layers' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-neutral-500 hover:text-neutral-700'}`}>
                            <List className="size-3.5" /> Layers
                        </button>
                    </div>
                    <div className="flex flex-1 flex-col overflow-hidden">
                        {sidebarTab === 'add' && <PalettePanel existingTypes={existingTypes} onAdd={addComponent} />}
                        {sidebarTab === 'layers' && <LayersPanelLocal components={components} selectedId={selectedId} onSelect={setSelectedId} onToggle={toggleEnabled} />}
                    </div>
                </div>

                {/* Center canvas */}
                <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
                    <ProductCanvas
                        components={components}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        viewport={viewport}
                        onViewportChange={setViewport}
                        onMoveUp={(id) => { const idx = components.findIndex((c) => c.id === id); moveComponent(idx, 'up'); }}
                        onMoveDown={(id) => { const idx = components.findIndex((c) => c.id === id); moveComponent(idx, 'down'); }}
                        onToggleEnabled={toggleEnabled}
                        onRemove={removeComponent}
                    />
                </div>

                {/* Right property panel */}
                <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l bg-white">
                    <RightPanel
                        selectedComponent={selectedComponent}
                        selectedIndex={selectedIndex}
                        totalComponents={components.length}
                        globalSettings={globalSettings}
                        onUpdateComponent={updateComponent}
                        onMoveUp={() => moveComponent(selectedIndex, 'up')}
                        onMoveDown={() => moveComponent(selectedIndex, 'down')}
                        onToggleEnabled={() => selectedComponent && toggleEnabled(selectedComponent.id)}
                        onRemove={() => selectedComponent && removeComponent(selectedComponent.id)}
                        onUpdateGlobal={(s) => onChange({ ...normalized, globalSettings: s })}
                    />
                </div>
            </div>

            <DragOverlay dropAnimation={null}>
                {activeDragType && (
                    <div className="pointer-events-none z-[9999] rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-xl">
                        + {activeDragType}
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
};
