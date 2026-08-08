import { useEditorStore } from '../-stores/editor-store';
import { CATALOGUE_FONTS } from '../-utils/catalogue-fonts';
import { componentTemplates } from '../-utils/component-templates';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Plus,
    Trash as Trash2,
    CaretDown as ChevronDown,
    CaretUp as ChevronUp,
    Gear as Settings,
    Copy,
    ArrowUp,
    ArrowDown,
    SquaresFour as LayoutGrid,
    Clipboard,
    ClipboardText as ClipboardPaste,
    Anchor,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { ColorPickerField } from './ColorPickerField';
import { ImageUploadField } from './ImageUploadField';
import { VideoUploadField } from './VideoUploadField';
import { VariantSwitcher } from './VariantSwitcher';
import { RichTextField } from './RichTextField';
import { StyleEditor } from './StyleEditor';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllProductPages } from '../product-pages/-services/product-pages-service';
import { handleFetchCampaignsList } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import { fetchCampaignLeads } from '@/routes/audience-manager/list/-services/get-campaign-users';
import { SUBMIT_CATALOGUE_LEAD_URL, AUDIENCE_CAMPAIGN } from '@/constants/urls';
import axios from 'axios';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { LinkPicker } from './LinkPicker';
import type { ComponentStyle } from '../-types/editor-types';

export const PropertyPanel = () => {
    const {
        config,
        selectedComponentId,
        selectedPageId,
        selectedGlobalSettings,
        selectedGlobalLayout,
        updateComponent,
        updateGlobalSettings,
        deleteComponent,
        duplicateComponent,
        reorderComponents,
        updatePageSeo,
        updatePageBackgroundColor,
        copyComponent,
        pasteComponent,
        clipboard,
    } = useEditorStore();

    if (!config) return null;

    // Global Settings Editor
    if (selectedGlobalSettings) {
        return <GlobalSettingsEditor config={config} updateGlobalSettings={updateGlobalSettings} />;
    }

    // Global Header / Footer Editor
    if (selectedGlobalLayout === 'header' || selectedGlobalLayout === 'footer') {
        return (
            <GlobalLayoutEditor
                config={config}
                section={selectedGlobalLayout}
                updateGlobalSettings={updateGlobalSettings}
            />
        );
    }

    if (selectedComponentId) {
        // Recursive find — searches top-level and inside columnLayout slots
        const findComponent = (components: any[]): any | null => {
            for (const c of components) {
                if (c.id === selectedComponentId) return c;
                if (Array.isArray(c.props?.slots)) {
                    for (const slot of c.props.slots as any[][]) {
                        const found = findComponent(slot);
                        if (found) return found;
                    }
                }
            }
            return null;
        };

        let component: (typeof config.pages)[number]['components'][number] | null = null;
        let pageId = '';
        // Component ids are only unique WITHIN a page (the server dedupes
        // per-page), so an id like "hero" can exist on several pages at once.
        // Resolve against the page the admin is actually editing first — a
        // first-match scan across all pages used to show (and WRITE TO) another
        // page's hero when ids collided. The global scan stays only as a
        // fallback for selections made outside a page context.
        const selectedPage = config.pages.find((p) => p.id === selectedPageId);
        const orderedPages = selectedPage
            ? [selectedPage, ...config.pages.filter((p) => p.id !== selectedPageId)]
            : config.pages;
        for (const p of orderedPages) {
            const c = findComponent(p.components);
            if (c) {
                component = c;
                pageId = p.id;
                break;
            }
        }

        if (!component) return <div className="p-4">Component not found</div>;

        // Compute position within page for reorder
        const pageComponents = config.pages.find((p) => p.id === pageId)?.components ?? [];
        const componentIndex = pageComponents.findIndex((c) => c.id === component!.id);
        // componentIndex === -1 means the selected component lives inside a slot (nested)
        const isNested = componentIndex === -1;
        const isFirst = componentIndex === 0;
        const isLast = componentIndex === pageComponents.length - 1;

        const moveUp = () => {
            if (isFirst) return;
            const next = [...pageComponents];
            [next[componentIndex - 1], next[componentIndex]] = [next[componentIndex]!, next[componentIndex - 1]!];
            reorderComponents(pageId, next);
        };

        const moveDown = () => {
            if (isLast) return;
            const next = [...pageComponents];
            [next[componentIndex], next[componentIndex + 1]] = [next[componentIndex + 1]!, next[componentIndex]!];
            reorderComponents(pageId, next);
        };

        return (
            <div className="flex flex-col gap-6 p-4">
                {/* Component Header + Action Bar */}
                <div className="border-b pb-4">
                    <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            {component.type === 'columnLayout' && (
                                <LayoutGrid className="size-4 text-teal-500" />
                            )}
                            <div>
                                <h3 className={`text-base font-semibold capitalize ${component.type === 'columnLayout' ? 'text-teal-700' : ''}`}>
                                    {component.type === 'columnLayout'
                                        ? `${component.props?.slots?.length ?? 2} Column Layout`
                                        : component.type.replace(/([A-Z])/g, ' $1').trim()}
                                </h3>
                                <div className="text-xs text-gray-400">ID: {component.id}</div>
                            </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-gray-900"
                                disabled={isFirst || isNested}
                                onClick={moveUp}
                                title={isNested ? 'Cannot reorder nested components' : 'Move up'}
                            >
                                <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-gray-900"
                                disabled={isLast || isNested}
                                onClick={moveDown}
                                title={isNested ? 'Cannot reorder nested components' : 'Move down'}
                            >
                                <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-blue-600"
                                disabled={isNested}
                                onClick={() => duplicateComponent(pageId, component!.id)}
                                title={isNested ? 'Cannot duplicate nested components' : 'Duplicate'}
                            >
                                <Copy className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-red-600"
                                onClick={() => deleteComponent(pageId, component!.id)}
                                title="Delete"
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="enabled-switch">Enabled</Label>
                    <Switch
                        id="enabled-switch"
                        checked={component.enabled}
                        onCheckedChange={(c) =>
                            updateComponent(pageId, component!.id, { enabled: c })
                        }
                    />
                </div>

                {/* Anchor ID */}
                <div className="space-y-1">
                    <Label className="flex items-center gap-1 text-xs text-gray-500">
                        <Anchor className="size-3" /> Anchor ID
                    </Label>
                    <Input
                        value={component.anchorId || ''}
                        onChange={(e) => updateComponent(pageId, component!.id, { anchorId: e.target.value.replace(/[^a-zA-Z0-9-_]/g, '') })}
                        placeholder="e.g. pricing, faq, contact"
                        className="h-7 text-xs"
                    />
                    {component.anchorId && (
                        <p className="text-caption text-gray-400">Link to this: <code className="rounded bg-gray-100 px-1">#{component.anchorId}</code></p>
                    )}
                </div>

                {/* Copy component */}
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => copyComponent(pageId, component!.id)}
                >
                    <Clipboard className="mr-1.5 size-3" /> Copy to Clipboard
                </Button>

                {/* Component-specific editors */}
                <ComponentEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />

                {/* Universal style editor — spacing, background, border, typography, animation */}
                <div className="border-t border-gray-100 pt-4">
                    <StyleEditor
                        style={component.style || {}}
                        onChange={(newStyle: ComponentStyle) =>
                            updateComponent(pageId, component!.id, { style: newStyle })
                        }
                    />
                </div>
            </div>
        );
    }

    if (selectedPageId) {
        const page = config.pages.find((p) => p.id === selectedPageId);
        if (page) {
            return (
                <div className="flex flex-col gap-5 p-4">
                    <h3 className="text-base font-semibold">Page Settings</h3>

                    {/* Per-page publish toggle removed: the flag was never
                        enforced learner-side ("Hidden from visitors" was
                        untrue). The site-level Draft/Publish in the editor
                        header is the single gate. */}
                    <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-500">
                        Pages go live together when you hit Publish in the top bar.
                    </div>

                    {/* Basic info (read-only) */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Page Title</Label>
                            <Input value={page.title || ''} readOnly disabled />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Route Slug</Label>
                            <Input value={page.route} readOnly disabled />
                        </div>
                    </div>

                    {/* Page Background Color */}
                    <ColorPickerField
                        label="Page Background Color"
                        value={page.backgroundColor || '#ffffff'} // design-lint-ignore: color-editor swatch/seed value
                        onChange={(c) => updatePageBackgroundColor(page.id, c)}
                    />

                    {/* Paste component */}
                    {clipboard && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => pasteComponent(page.id)}
                        >
                            <ClipboardPaste className="mr-1.5 size-3" /> Paste: {clipboard.type.replace(/([A-Z])/g, ' $1').trim()}
                        </Button>
                    )}

                    {/* SEO */}
                    <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">SEO</h4>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Meta Title</Label>
                            <Input
                                value={page.seo?.metaTitle || ''}
                                placeholder={page.title || page.route}
                                onChange={(e) => updatePageSeo(page.id, { metaTitle: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Meta Description</Label>
                            <Textarea
                                rows={2}
                                value={page.seo?.metaDescription || ''}
                                placeholder="Brief page description for search engines..."
                                onChange={(e) => updatePageSeo(page.id, { metaDescription: e.target.value })}
                            />
                        </div>
                        <ImageUploadField
                            label="OG Image"
                            value={page.seo?.ogImage || ''}
                            onChange={(url) => updatePageSeo(page.id, { ogImage: url })}
                            placeholder="Social share image URL"
                        />
                    </div>
                </div>
            );
        }
    }

    return <div className="p-8 text-center text-gray-400">Select an item to edit</div>;
};

// Global Layout Editor — edits globalSettings.layout.header or .footer
const GlobalLayoutEditor = ({
    config,
    section,
    updateGlobalSettings,
}: {
    config: any;
    section: 'header' | 'footer';
    updateGlobalSettings: (updates: any) => void;
}) => {
    const layoutData = config.globalSettings?.layout?.[section];
    const props = layoutData?.props || {};

    const isEnabled = layoutData?.enabled !== false;

    // Wrap in a fake component shape for HeaderEditor / FooterEditor
    const fakeComponent = { id: '__global__', type: section, enabled: isEnabled, props };
    const fakeUpdateComponent = (_pageId: string, _id: string, patch: any) => {
        if (patch.props) {
            updateGlobalSettings({
                layout: {
                    ...config.globalSettings.layout,
                    [section]: { ...layoutData, props: { ...props, ...patch.props } },
                },
            });
        }
    };

    const toggleEnabled = (enabled: boolean) => {
        updateGlobalSettings({
            layout: {
                ...config.globalSettings.layout,
                [section]: { ...layoutData, enabled },
            },
        });
    };

    const removeSection = () => {
        const newLayout = { ...config.globalSettings.layout };
        delete newLayout[section];
        updateGlobalSettings({ layout: newLayout });
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="border-b pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-base font-semibold capitalize">
                            Global {section === 'header' ? 'Header' : 'Footer'}
                        </h3>
                        <p className="mt-0.5 text-xs text-purple-600">
                            Appears on every page
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-gray-400 hover:text-red-600"
                        onClick={removeSection}
                        title={`Remove global ${section}`}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
            </div>

            {isEnabled && (section === 'header' ? (
                <HeaderEditor
                    component={fakeComponent}
                    pageId="__global__"
                    updateComponent={fakeUpdateComponent}
                />
            ) : (
                <FooterEditor
                    component={fakeComponent}
                    pageId="__global__"
                    updateComponent={fakeUpdateComponent}
                />
            ))}
        </div>
    );
};

// Global Settings Editor Component
const GlobalSettingsEditor = ({
    config,
    updateGlobalSettings,
}: {
    config: any;
    updateGlobalSettings: (updates: any) => void;
}) => {
    const gs = config.globalSettings || {};

    const updateField = (path: string, value: any) => {
        const keys = path.split('.');
        const key0 = keys[0] as string;
        const key1 = keys[1] as string | undefined;
        const key2 = keys[2] as string | undefined;

        if (keys.length === 1) {
            updateGlobalSettings({ [key0]: value });
        } else if (keys.length === 2 && key1) {
            updateGlobalSettings({
                [key0]: {
                    ...gs[key0],
                    [key1]: value,
                },
            });
        } else if (keys.length === 3 && key1 && key2) {
            updateGlobalSettings({
                [key0]: {
                    ...gs[key0],
                    [key1]: {
                        ...gs[key0]?.[key1],
                        [key2]: value,
                    },
                },
            });
        }
    };

    return (
        <div className="flex flex-col gap-6 overflow-auto p-4">
            <div className="flex items-center gap-2 border-b pb-4">
                <Settings className="size-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Global Settings</h3>
            </div>

            {/* Catalogue Type */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Catalogue Type</h4>
                <div className="flex items-center justify-between">
                    <Label>Type</Label>
                    <select
                        className="rounded border px-3 py-1.5 text-sm"
                        value={gs.courseCatalogeType?.value || 'Course'}
                        onChange={(e) => updateField('courseCatalogeType.value', e.target.value)}
                    >
                        <option value="Course">Course</option>
                        <option value="Product">Product</option>
                    </select>
                </div>
            </div>

            {/* Theme Settings */}
            <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Theme</h4>

                {/* Color Presets */}
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Color Preset</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {(
                            [
                                { key: 'default', label: 'Default',  color: '#3B82F6' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'ocean',   label: 'Ocean',    color: '#0EA5E9' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'forest',  label: 'Forest',   color: '#16A34A' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'sunset',  label: 'Sunset',   color: '#F97316' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'midnight',label: 'Midnight', color: '#7C3AED' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'rose',    label: 'Rose',     color: '#E11D48' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'violet',  label: 'Violet',   color: '#8B5CF6' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'amber',   label: 'Amber',    color: '#D97706' }, // design-lint-ignore: color-editor swatch/seed value
                                { key: 'slate',   label: 'Slate',    color: '#334155' }, // design-lint-ignore: color-editor swatch/seed value
                            ] as const
                        ).map(({ key, label, color }) => {
                            const isActive = (gs.theme?.preset || 'default') === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    title={label}
                                    onClick={() => updateField('theme.preset', key)}
                                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 text-caption font-medium transition-all ${
                                        isActive
                                            ? 'border-gray-800 bg-white shadow-sm'
                                            : 'border-transparent hover:border-gray-300'
                                    }`}
                                >
                                    <span
                                        className="size-6 rounded-full shadow-sm"
                                        style={{ backgroundColor: color }}
                                    />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Custom primary color override */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-gray-500">Custom Color Override</Label>
                        {gs.theme?.primaryColor && (
                            <button
                                type="button"
                                onClick={() => updateField('theme.primaryColor', undefined)}
                                className="text-caption text-gray-400 hover:text-red-500"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={gs.theme?.primaryColor || '#3B82F6'} // design-lint-ignore: color-editor swatch/seed value
                            onChange={(e) => updateField('theme.primaryColor', e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border bg-white p-0.5"
                        />
                        <span className="font-mono text-xs text-gray-500">
                            {gs.theme?.primaryColor || 'Using preset'}
                        </span>
                    </div>
                    <p className="text-caption text-gray-400">
                        Overrides the preset color with a custom brand color.
                    </p>
                </div>

                {/* Border Radius */}
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Corner Style</Label>
                    <div className="flex gap-2">
                        {(
                            [
                                { key: 'sharp',   label: 'Sharp',   preview: '2px'    },
                                { key: 'rounded', label: 'Rounded', preview: '8px'    },
                                { key: 'pill',    label: 'Pill',    preview: '9999px' },
                            ] as const
                        ).map(({ key, label, preview }) => {
                            const isActive = (gs.theme?.borderRadius || 'rounded') === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => updateField('theme.borderRadius', key)}
                                    className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border-2 py-2 text-caption font-medium transition-all ${
                                        isActive
                                            ? 'border-gray-800 bg-white shadow-sm'
                                            : 'border-transparent bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <span
                                        className="h-4 w-8 border-2 border-gray-600 bg-transparent"
                                        style={{ borderRadius: preview }}
                                    />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Heading Scale */}
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Heading Scale</Label>
                    <div className="flex gap-2">
                        {(
                            [
                                { key: 'compact',  label: 'Compact' },
                                { key: 'default',  label: 'Default' },
                                { key: 'large',    label: 'Large' },
                                { key: 'display',  label: 'Display' },
                            ] as const
                        ).map(({ key, label }) => {
                            const isActive = (gs.theme?.headingScale || 'default') === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => updateField('theme.headingScale', key)}
                                    className={`flex-1 rounded-lg border-2 py-1.5 text-caption font-medium transition-all ${
                                        isActive
                                            ? 'border-gray-800 bg-white shadow-sm'
                                            : 'border-transparent bg-white hover:border-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Atmosphere — page canvas treatment (data-catalogue-atmosphere) */}
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Atmosphere</Label>
                    <div className="flex gap-2">
                        {(
                            [
                                { key: 'flat',   label: 'Flat' },
                                { key: 'soft',   label: 'Soft' },
                                { key: 'mesh',   label: 'Mesh' },
                                { key: 'aurora', label: 'Aurora' },
                            ] as const
                        ).map(({ key, label }) => {
                            const isActive = (gs.theme?.atmosphere?.canvas || 'flat') === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() =>
                                        updateField('theme.atmosphere', {
                                            ...(gs.theme?.atmosphere || {}),
                                            canvas: key,
                                        })
                                    }
                                    className={`flex-1 rounded-lg border-2 py-1.5 text-caption font-medium transition-all ${
                                        isActive
                                            ? 'border-gray-800 bg-white shadow-sm'
                                            : 'border-transparent bg-white hover:border-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {(gs.theme?.atmosphere?.canvas || 'flat') !== 'flat' && (
                        <div className="flex gap-2">
                            {(
                                [
                                    { key: 'subtle', label: 'Subtle' },
                                    { key: 'medium', label: 'Medium' },
                                    { key: 'bold',   label: 'Bold' },
                                ] as const
                            ).map(({ key, label }) => {
                                const isActive = (gs.theme?.atmosphere?.intensity || 'subtle') === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() =>
                                            updateField('theme.atmosphere', {
                                                ...(gs.theme?.atmosphere || { canvas: 'mesh' }),
                                                intensity: key,
                                            })
                                        }
                                        className={`flex-1 rounded-lg border-2 py-1 text-caption font-medium transition-all ${
                                            isActive
                                                ? 'border-gray-800 bg-white shadow-sm'
                                                : 'border-transparent bg-white hover:border-gray-300'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Motion personality — entrance duration/easing site-wide */}
                <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Motion</Label>
                    <div className="flex gap-2">
                        {(
                            [
                                { key: 'none',     label: 'None' },
                                { key: 'calm',     label: 'Calm' },
                                { key: 'balanced', label: 'Balanced' },
                                { key: 'dynamic',  label: 'Dynamic' },
                            ] as const
                        ).map(({ key, label }) => {
                            // Unset ≠ Balanced: legacy configs omit the attribute and keep
                            // the :root motion fallbacks, so no button is pre-lit.
                            const isActive = gs.motion?.personality === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => updateField('motion', { personality: key })}
                                    className={`flex-1 rounded-lg border-2 py-1.5 text-caption font-medium transition-all ${
                                        isActive
                                            ? 'border-gray-800 bg-white shadow-sm'
                                            : 'border-transparent bg-white hover:border-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Back to Top Button */}
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500">Back to Top Button</Label>
                    <Switch
                        checked={gs.backToTop || false}
                        onCheckedChange={(c) => updateField('backToTop', c)}
                    />
                </div>

                {/* Mode */}
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500">Mode</Label>
                    <div className="flex overflow-hidden rounded-lg border">
                        {(['light', 'dark'] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => updateField('mode', m)}
                                className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                                    (gs.mode || 'light') === m
                                        ? 'bg-gray-800 text-white'
                                        : 'bg-white text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500">Compactness</Label>
                    <select
                        className="rounded border px-3 py-1.5 text-sm"
                        value={gs.compactness || 'medium'}
                        onChange={(e) => updateField('compactness', e.target.value)}
                    >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                    </select>
                </div>
            </div>

            {/* Fonts */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Typography</h4>
                <div className="flex items-center justify-between">
                    <Label>Custom Fonts</Label>
                    <Switch
                        checked={gs.fonts?.enabled || false}
                        onCheckedChange={(c) => updateField('fonts.enabled', c)}
                    />
                </div>
                {gs.fonts?.enabled && (
                    <div className="space-y-2">
                        <Label className="text-xs">Body Font</Label>
                        <select
                            className="w-full rounded border px-3 py-1.5 text-sm"
                            value={gs.fonts?.family || 'Inter, sans-serif'}
                            onChange={(e) => updateField('fonts.family', e.target.value)}
                        >
                            {CATALOGUE_FONTS.map((f) => (
                                <option key={f.label} value={f.stack}>{f.label}</option>
                            ))}
                        </select>
                        <Label className="text-xs">Heading Font</Label>
                        <select
                            className="w-full rounded border px-3 py-1.5 text-sm"
                            value={gs.fonts?.headingFamily || ''}
                            onChange={(e) => updateField('fonts.headingFamily', e.target.value || undefined)}
                        >
                            <option value="">Same as body</option>
                            {CATALOGUE_FONTS.map((f) => (
                                <option key={f.label} value={f.stack}>
                                    {f.label}{f.serif ? ' (serif)' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-caption text-gray-400">
                            Pair a serif heading with a sans body for an editorial, premium feel.
                        </p>
                    </div>
                )}
            </div>

            {/* Payment Settings */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Payment</h4>
                <div className="flex items-center justify-between">
                    <Label>Enable Payments</Label>
                    <Switch
                        checked={gs.payment?.enabled || false}
                        onCheckedChange={(c) => updateField('payment.enabled', c)}
                    />
                </div>
                {gs.payment?.enabled && (
                    <div className="space-y-2">
                        <Label className="text-xs">Provider</Label>
                        <select
                            className="w-full rounded border px-3 py-1.5 text-sm"
                            value={gs.payment?.provider || 'razorpay'}
                            onChange={(e) => updateField('payment.provider', e.target.value)}
                        >
                            <option value="razorpay">Razorpay</option>
                            <option value="stripe">Stripe</option>
                            <option value="PHONEPE">PhonePe</option>
                            <option value="paypal">PayPal</option>
                        </select>
                    </div>
                )}
            </div>

            {/* WhatsApp — the highest-intent contact channel in this market;
                a floating button on every page, tracked as a conversion. */}
            <div className="space-y-3 border-b pb-4">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-700">WhatsApp button</h4>
                    <Switch
                        checked={gs.whatsapp?.enabled || false}
                        onCheckedChange={(c) => updateField('whatsapp.enabled', c)}
                    />
                </div>
                <p className="text-caption text-gray-400">
                    Shows a floating WhatsApp button on every page of your website. Taps are counted
                    as enquiries in your analytics.
                </p>
                {gs.whatsapp?.enabled && (
                    <>
                        <div>
                            <Label className="text-xs">WhatsApp number (with country code)</Label>
                            <Input className="mt-1" placeholder="919895603342" value={gs.whatsapp?.phone || ''} onChange={(e) => updateField('whatsapp.phone', e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Prefilled message</Label>
                            <Input className="mt-1" placeholder="Hi! I'd like to know about your batches." value={gs.whatsapp?.message || ''} onChange={(e) => updateField('whatsapp.message', e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Button label (optional)</Label>
                            <Input className="mt-1" placeholder="Chat with us" value={gs.whatsapp?.label || ''} onChange={(e) => updateField('whatsapp.label', e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Position</Label>
                            <div className="mt-1 flex gap-1">
                                {(['right', 'left'] as const).map((pos) => (
                                    <button key={pos} onClick={() => updateField('whatsapp.position', pos)}
                                        className={`rounded px-2.5 py-1 text-caption font-medium capitalize ${(gs.whatsapp?.position || 'right') === pos ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{pos}</button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Tracking & Analytics — the measurement layer for the whole site.
                Stored in the catalogue JSON, injected on learner catalogue
                routes only; lead submissions fire a standard Lead event. */}
            <div className="space-y-3 border-b pb-4">
                <h4 className="font-medium text-gray-700">Tracking &amp; Analytics</h4>
                <p className="text-caption text-gray-400">
                    Paste IDs from Google Analytics / Meta Events Manager. They load only on your
                    public website pages, and every form submission fires a Lead conversion event
                    automatically — so ad campaigns can optimise on real enquiries.
                </p>
                <div>
                    <Label className="text-xs">Google Analytics 4 — Measurement ID</Label>
                    <Input className="mt-1" placeholder="G-XXXXXXXXXX" value={gs.tracking?.ga4MeasurementId || ''} onChange={(e) => updateField('tracking.ga4MeasurementId', e.target.value.trim())} />
                </div>
                <div>
                    <Label className="text-xs">Meta (Facebook) Pixel ID</Label>
                    <Input className="mt-1" placeholder="1234567890" value={gs.tracking?.metaPixelId || ''} onChange={(e) => updateField('tracking.metaPixelId', e.target.value.trim())} />
                </div>
                <div>
                    <Label className="text-xs">Google Tag Manager — Container ID</Label>
                    <Input className="mt-1" placeholder="GTM-XXXXXXX" value={gs.tracking?.gtmId || ''} onChange={(e) => updateField('tracking.gtmId', e.target.value.trim())} />
                    <p className="mt-1 text-caption text-gray-400">Use GTM alone, or GA4/Pixel directly — both work.</p>
                </div>
            </div>

            {/* Lead Collection */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Lead Collection</h4>
                <div className="flex items-center justify-between">
                    <Label>Enable Lead Form</Label>
                    <Switch
                        checked={gs.leadCollection?.enabled || false}
                        onCheckedChange={(c) => updateField('leadCollection.enabled', c)}
                    />
                </div>
                {gs.leadCollection?.enabled && (
                    <>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Mandatory</Label>
                            <Switch
                                checked={gs.leadCollection?.mandatory || false}
                                onCheckedChange={(c) => updateField('leadCollection.mandatory', c)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Invite Link</Label>
                            <Input
                                value={gs.leadCollection?.inviteLink || ''}
                                onChange={(e) =>
                                    updateField('leadCollection.inviteLink', e.target.value)
                                }
                                placeholder="Optional invite link"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Enquiry */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Enquiry</h4>
                <div className="flex items-center justify-between">
                    <Label>Enable Enquiry</Label>
                    <Switch
                        checked={gs.enrquiry?.enabled || false}
                        onCheckedChange={(c) => updateField('enrquiry.enabled', c)}
                    />
                </div>
            </div>
        </div>
    );
};

// ── Column Layout Editor ──────────────────────────────────────────────────────
const ColumnLayoutEditor = ({ component, pageId, updateComponent }: any) => {
    const { selectComponent, deleteFromSlot } = useEditorStore();
    const { slots = [] as any[][], columnWidths = [] as string[], gap = 'md', align = 'top', stackOnMobile = true } = component.props;

    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...component.props, [key]: value } });

    // Default width fraction for a given column count
    const defaultWidthForCount: Record<number, string> = { 2: '1/2', 3: '1/3', 4: '1/4' };
    const defaultWidth = defaultWidthForCount[slots.length] || '1/2';

    const changeColumnCount = (newCount: number) => {
        if (newCount === slots.length) return;
        const def = defaultWidthForCount[newCount] || '1/2';
        const newSlots = Array.from({ length: newCount }, (_, i) => slots[i] ?? []);
        const newWidths = Array.from({ length: newCount }, (_, i) => columnWidths[i] ?? def);
        updateComponent(pageId, component.id, {
            // columnFr is a per-count precise ratio — clear it on count change or a
            // stale 2-column ratio silently re-activates when switching back to 2.
            props: { ...component.props, columns: newCount, slots: newSlots, columnWidths: newWidths, columnFr: undefined },
        });
    };

    const TYPE_LABEL: Record<string, string> = {
        heroSection: 'Hero Section', courseCatalog: 'Course Catalog', bookCatalogue: 'Book Catalogue',
        statsHighlights: 'Stats', testimonialSection: 'Testimonials', mediaShowcase: 'Media Showcase',
        faqSection: 'FAQ', ctaBanner: 'CTA Banner', pricingTable: 'Pricing', contactForm: 'Contact Form',
        teamSection: 'Team', announcementFeed: 'Announcements', imageGallery: 'Image Gallery',
        videoEmbed: 'Video', buyRentSection: 'Buy/Rent', policyRenderer: 'Policy',
        cartComponent: 'Cart', courseDetails: 'Course Details', bookDetails: 'Book Details',
        spacer: 'Spacer', tabsAccordion: 'Tabs/Accordion', logoCloud: 'Logo Cloud', trustChip: 'Trust Chip',
        sectionHeading: 'Section Heading',
        mapEmbed: 'Map', countdownTimer: 'Countdown', textBlock: 'Text Block',
        featureGrid: 'Feature Grid', imageBlock: 'Image', buttonBlock: 'Button',
        newsletterSignup: 'Newsletter', stepsProcess: 'Steps/Process',
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Layout Settings */}
            <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Layout Settings</p>

                {/* Column count */}
                <div>
                    <Label className="text-xs">Columns</Label>
                    <div className="mt-1 flex gap-1.5">
                        {[2, 3, 4].map((n) => (
                            <button
                                key={n}
                                onClick={() => changeColumnCount(n)}
                                className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${slots.length === n ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Gap */}
                <div>
                    <Label className="text-xs">Column Gap</Label>
                    <div className="mt-1 flex gap-1.5">
                        {(['none', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((g) => (
                            <button
                                key={g}
                                onClick={() => updateProp('gap', g)}
                                className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${gap === g ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Align */}
                <div>
                    <Label className="text-xs">Vertical Align</Label>
                    <div className="mt-1 flex gap-1.5">
                        {(['top', 'center', 'bottom', 'stretch'] as const).map((a) => (
                            <button
                                key={a}
                                onClick={() => updateProp('align', a)}
                                className={`flex-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${align === a ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Column widths */}
                <div>
                    <Label className="text-xs">Column Widths</Label>
                    <div className="mt-1 flex gap-1.5">
                        {slots.map((_: any, i: number) => (
                            <div key={i} className="flex-1">
                                <Label className="text-caption text-gray-400">Col {i + 1}</Label>
                                <select
                                    value={columnWidths[i] || defaultWidth}
                                    onChange={(e) => {
                                        const updated = [...columnWidths];
                                        updated[i] = e.target.value;
                                        // Last-touched control wins: columnFr overrides these
                                        // widths on both renderers, so clear it in the SAME update
                                        updateComponent(pageId, component.id, {
                                            props: { ...component.props, columnWidths: updated, columnFr: undefined },
                                        });
                                    }}
                                    className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs"
                                >
                                    <option value="1/4">1/4</option>
                                    <option value="1/3">1/3</option>
                                    <option value="1/2">1/2</option>
                                    <option value="2/3">2/3</option>
                                    <option value="3/4">3/4</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Precise 2-column ratio — writes columnFr (true track sizes),
                    which beats the legacy width fractions on both renderers */}
                {slots.length === 2 && (
                    <div>
                        <Label className="text-xs">Width Ratio (precise)</Label>
                        <div className="mt-1 flex gap-1.5">
                            {[
                                { label: 'Auto', fr: undefined as string[] | undefined },
                                { label: '50/50', fr: ['1fr', '1fr'] },
                                { label: '60/40', fr: ['3fr', '2fr'] },
                                { label: '40/60', fr: ['2fr', '3fr'] },
                                { label: '66/33', fr: ['2fr', '1fr'] },
                                { label: '33/66', fr: ['1fr', '2fr'] },
                            ].map((o) => {
                                const active = o.fr
                                    ? JSON.stringify(component.props.columnFr) === JSON.stringify(o.fr)
                                    : !component.props.columnFr;
                                return (
                                    <button
                                        key={o.label}
                                        onClick={() => updateProp('columnFr', o.fr)}
                                        className={`flex-1 rounded border px-1 py-1 text-caption font-medium transition-colors ${active ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                    >
                                        {o.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Stack on mobile */}
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Stack on mobile</Label>
                    <Switch
                        checked={stackOnMobile}
                        onCheckedChange={(v) => updateProp('stackOnMobile', v)}
                    />
                </div>
                {stackOnMobile && (
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Reverse order on mobile</Label>
                        <Switch
                            checked={component.props.reverseOnMobile || false}
                            onCheckedChange={(v) => updateProp('reverseOnMobile', v || undefined)}
                        />
                    </div>
                )}
            </div>

            {/* Slot Contents */}
            {slots.map((slotComps: any[], slotIdx: number) => (
                <div key={slotIdx} className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                        Slot {slotIdx + 1}
                        <span className="ml-2 normal-case font-normal text-gray-400">
                            {slotComps.length} component{slotComps.length !== 1 ? 's' : ''}
                        </span>
                    </p>
                    {slotComps.length === 0 ? (
                        <p className="text-xs text-gray-300">Empty — drag a component here from the library</p>
                    ) : (
                        slotComps.map((child: any) => (
                            <div
                                key={child.id}
                                className="flex items-center gap-2 rounded border bg-gray-50 px-2 py-1.5"
                            >
                                <button
                                    className="flex-1 text-left text-xs font-medium text-gray-700 hover:text-blue-600 truncate"
                                    onClick={() => selectComponent(child.id)}
                                    title="Click to edit"
                                >
                                    {TYPE_LABEL[child.type] || child.type.replace(/([A-Z])/g, ' $1').trim()}
                                </button>
                                <button
                                    onClick={() => deleteFromSlot(pageId, component.id, slotIdx, child.id)}
                                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                                    title="Remove from slot"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            ))}
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

// Component-specific editor
const ComponentEditor = ({ component, pageId, updateComponent }: any) => {
    const { type } = component;

    switch (type) {
        case 'header':
            return (
                <HeaderEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'footer':
            return (
                <FooterEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'heroSection':
            return (
                <HeroSectionEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'MediaShowcaseComponent':
        case 'mediaShowcase':
            return (
                <MediaShowcaseEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'bookCatalogue':
        case 'courseCatalog':
            return (
                <BookCatalogueEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'bookDetails':
            return (
                <BookDetailsEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'cartComponent':
            return (
                <CartComponentEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'buyRentSection':
            return (
                <BuyRentEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'statsHighlights':
            return (
                <StatsHighlightsEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'testimonialSection':
            return (
                <TestimonialsEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'policyRenderer':
            return (
                <PolicyRendererEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'faqSection':
            return <FaqSectionEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'videoEmbed':
            return <VideoEmbedEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'ctaBanner':
            return <CtaBannerEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'pricingTable':
            return <PricingTableEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'contactForm':
            return <ContactFormEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'teamSection':
            return <TeamSectionEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'announcementFeed':
            return <AnnouncementFeedEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'imageGallery':
            return <ImageGalleryEditor component={component} pageId={pageId} updateComponent={updateComponent} />;

        case 'columnLayout':
            return <ColumnLayoutEditor component={component} pageId={pageId} updateComponent={updateComponent} />;

        case 'trustChip':
            return <TrustChipEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'sectionHeading':
            return <SectionHeadingEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'spacer':
            return <SpacerEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'htmlBlock':
            return <HtmlBlockEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'productPageOffer':
            return <ProductPageOfferEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'leadForm':
            return <LeadFormEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'productCourseGrid':
            return <ProductCourseGridEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'tabsAccordion':
            return <TabsAccordionEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'logoCloud':
            return <LogoCloudEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'mapEmbed':
            return <MapEmbedEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'countdownTimer':
            return <CountdownTimerEditor component={component} pageId={pageId} updateComponent={updateComponent} />;

        case 'textBlock':
            return <TextBlockEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'featureGrid':
            return <FeatureGridEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'detailBlocks':
            return <DetailBlocksEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'imageBlock':
            return <ImageBlockEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'buttonBlock':
            return <ButtonBlockEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'newsletterSignup':
            return <NewsletterSignupEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'stepsProcess':
            return <StepsProcessEditor component={component} pageId={pageId} updateComponent={updateComponent} />;

        default:
            return (
                <GenericEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );
    }
};

// Media Showcase Editor with slide management
const MediaShowcaseEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedSlide, setExpandedSlide] = useState<number | null>(null);
    const [expandedMedia, setExpandedMedia] = useState<number | null>(null);

    const layout = props.layout || 'slider';
    const isSliderMode = layout === 'slider';

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    // ── Slider slide helpers ────────────────────────────────────────────
    const addSlide = () => {
        const newSlide = {
            backgroundImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
            heading: 'New Slide',
            description: 'Add your description here',
            button: { enabled: false, text: 'Learn More', action: 'navigate', target: 'homepage' },
        };
        updateProp('slides', [...(props.slides || []), newSlide]);
    };

    const deleteSlide = (index: number) => {
        const newSlides = (props.slides || []).filter((_: any, i: number) => i !== index);
        updateProp('slides', newSlides);
        if (expandedSlide === index) setExpandedSlide(null);
    };

    const updateSlide = (index: number, field: string, value: any) => {
        const newSlides = [...(props.slides || [])];
        if (field.startsWith('button.')) {
            const buttonField = field.split('.')[1] as string;
            newSlides[index] = { ...newSlides[index], button: { ...newSlides[index].button, [buttonField]: value } };
        } else {
            newSlides[index] = { ...newSlides[index], [field]: value };
        }
        updateProp('slides', newSlides);
    };

    // ── Media item helpers (carousel / grid) ───────────────────────────
    const addMediaItem = () => {
        const newItem = { type: 'video', url: '', caption: 'New item' };
        updateProp('media', [...(props.media || []), newItem]);
    };

    const deleteMediaItem = (index: number) => {
        const newMedia = (props.media || []).filter((_: any, i: number) => i !== index);
        updateProp('media', newMedia);
        if (expandedMedia === index) setExpandedMedia(null);
    };

    const updateMediaItem = (index: number, field: string, value: any) => {
        const newMedia = [...(props.media || [])];
        newMedia[index] = { ...newMedia[index], [field]: value };
        updateProp('media', newMedia);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Showcase Settings</h4>

            <VariantSwitcher
                componentType="mediaShowcase"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={layout}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="slider">Slider (hero with headings)</option>
                    <option value="carousel">Carousel (video / images)</option>
                    <option value="grid">Grid (video / images)</option>
                </select>
            </div>

            {isSliderMode && (
                <div className="flex items-center justify-between">
                    <Label>Autoplay</Label>
                    <Switch
                        checked={props.autoplay || false}
                        onCheckedChange={(c) => updateProp('autoplay', c)}
                    />
                </div>
            )}

            {isSliderMode && props.autoplay && (
                <div className="space-y-2">
                    <Label>Autoplay Interval (ms)</Label>
                    <Input
                        type="number"
                        value={props.autoplayInterval || 3000}
                        onChange={(e) => updateProp('autoplayInterval', parseInt(e.target.value))}
                    />
                </div>
            )}

            {/* ── Slider mode: manage slides ── */}
            {isSliderMode && (
                <div className="border-t pt-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-medium">Slides ({props.slides?.length || 0})</h4>
                        <Button size="sm" onClick={addSlide}>
                            <Plus className="mr-1 size-4" />
                            Add Slide
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {(props.slides || []).map((slide: any, index: number) => (
                            <div key={index} className="rounded border bg-gray-50 p-3">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => setExpandedSlide(expandedSlide === index ? null : index)}
                                        className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                                    >
                                        {expandedSlide === index ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                        Slide {index + 1}: {slide.heading}
                                    </button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteSlide(index)}
                                        className="size-8 p-0 text-red-600 hover:text-red-700">
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>

                                {expandedSlide === index && (
                                    <div className="mt-3 space-y-3 border-t pt-3">
                                        <ImageUploadField
                                            label="Background Image"
                                            value={slide.backgroundImage || ''}
                                            onChange={(url) => updateSlide(index, 'backgroundImage', url)}
                                        />
                                        <div className="space-y-2">
                                            <Label className="text-xs">Heading</Label>
                                            <Input value={slide.heading} onChange={(e) => updateSlide(index, 'heading', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Description</Label>
                                            <Textarea value={slide.description} onChange={(e) => updateSlide(index, 'description', e.target.value)} rows={2} />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs">Button</Label>
                                                <Switch checked={slide.button?.enabled || false} onCheckedChange={(c) => updateSlide(index, 'button.enabled', c)} />
                                            </div>
                                            {slide.button?.enabled && (
                                                <div className="ml-4 space-y-2">
                                                    <Input placeholder="Button text" value={slide.button.text} onChange={(e) => updateSlide(index, 'button.text', e.target.value)} />
                                                    <LinkPicker
                                                        label="Button Link"
                                                        value={slide.button.target || ''}
                                                        onChange={(v) => updateSlide(index, 'button.target', v)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Carousel / Grid mode: manage media items ── */}
            {!isSliderMode && (
                <div className="border-t pt-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-medium">Media Items ({(props.media || []).length})</h4>
                        <Button size="sm" onClick={addMediaItem}>
                            <Plus className="mr-1 size-4" />
                            Add Item
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {(props.media || []).map((item: any, index: number) => (
                            <div key={index} className="rounded border bg-gray-50 p-3">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => setExpandedMedia(expandedMedia === index ? null : index)}
                                        className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                                    >
                                        {expandedMedia === index ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                        <span className="capitalize text-gray-500">{item.type || 'media'}</span>
                                        <span className="truncate">{item.caption || `Item ${index + 1}`}</span>
                                    </button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteMediaItem(index)}
                                        className="size-8 p-0 text-red-600 hover:text-red-700">
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>

                                {expandedMedia === index && (
                                    <div className="mt-3 space-y-3 border-t pt-3">
                                        <div className="space-y-2">
                                            <Label className="text-xs">Type</Label>
                                            <select
                                                className="w-full rounded border px-3 py-2 text-sm"
                                                value={item.type || 'video'}
                                                onChange={(e) => updateMediaItem(index, 'type', e.target.value)}
                                            >
                                                <option value="video">Video</option>
                                                <option value="image">Image</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">URL</Label>
                                            <Input
                                                placeholder={item.type === 'image' ? 'https://... or /assets/...' : 'https://youtube.com/... or /assets/video.mp4'}
                                                value={item.url || ''}
                                                onChange={(e) => updateMediaItem(index, 'url', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs">Caption</Label>
                                            <Input
                                                value={item.caption || ''}
                                                onChange={(e) => updateMediaItem(index, 'caption', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {(props.media || []).length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-3">No media items yet. Click "Add Item" to get started.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Book Catalogue Editor
// Sort modes the learner catalogue understands. The stored value IS the label —
// it must stay byte-identical to COURSE_CATALOG_SORT_OPTIONS in the learner app
// (frontend-learner-dashboard-app .../-types/course-catalogue-types.ts), which
// falls back to "Newest" for anything it does not recognise.
const COURSE_CATALOG_SORT_OPTIONS = [
    'Newest',
    'Oldest',
    'Price: Low to High',
    'Price: High to Low',
    'Rating',
    'Name A-Z',
    'Name Z-A',
];

const BookCatalogueEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Catalogue Settings</h4>

            <VariantSwitcher
                componentType={component.type}
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Title</Label>
                <Input
                    value={props.title || ''}
                    onChange={(e) => updateProp('title', e.target.value)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Filters</Label>
                <Switch
                    checked={props.showFilters || false}
                    onCheckedChange={(c) => updateProp('showFilters', c)}
                />
            </div>

            {/* How a preview image sits in the card's image band. `cover` fills
                it but crops the edges — which eats the logo/headline on wide
                marketing banners. `contain` shows the whole artwork. */}
            <div className="space-y-2">
                <Label>Course Image Fit</Label>
                <select
                    className="w-full rounded border px-3 py-1.5 text-sm"
                    value={props.render?.styles?.imageFit || 'cover'}
                    onChange={(e) =>
                        updateProp('render', {
                            ...(props.render || {}),
                            styles: { ...(props.render?.styles || {}), imageFit: e.target.value },
                        })
                    }
                >
                    <option value="cover">Fill (crops edges)</option>
                    <option value="contain">Fit whole image</option>
                </select>
                <p className="text-xs text-gray-500">
                    Use &quot;Fit whole image&quot; when covers are wide banners
                    with text near the edges.
                </p>
            </div>

            {component.type === 'courseCatalog' && (
                <div className="space-y-2">
                    <Label>Default Sort</Label>
                    <select
                        className="w-full rounded border px-3 py-1.5 text-sm"
                        value={props.defaultSort || 'Newest'}
                        onChange={(e) => updateProp('defaultSort', e.target.value)}
                    >
                        {COURSE_CATALOG_SORT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-neutral-500">
                        How courses are ordered when the page opens. Learners can still change
                        it. Pick &ldquo;Price: Low to High&rdquo; to show free courses first.
                    </p>
                </div>
            )}

            <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                Advanced filter configuration and cart settings coming soon.
            </div>
        </div>
    );
};

// Buy/Rent Section Editor
const BuyRentEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (path: string, value: any) => {
        const keys = path.split('.');
        const key0 = keys[0] as string;
        const key1 = keys[1] as string | undefined;
        let newProps = { ...props };

        if (keys.length === 2 && key1) {
            newProps = {
                ...newProps,
                [key0]: {
                    ...newProps[key0],
                    [key1]: value,
                },
            };
        } else {
            newProps[path] = value;
        }

        updateComponent(pageId, component.id, { props: newProps });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Buy/Rent Settings</h4>

            <div className="space-y-2">
                <Label>Heading</Label>
                <Input
                    value={props.heading || ''}
                    onChange={(e) => updateProp('heading', e.target.value)}
                />
            </div>

            <div className="border-t pt-4">
                <h5 className="mb-2 text-xs font-semibold">Buy Option</h5>
                <div className="space-y-2">
                    <Input
                        placeholder="Button label"
                        value={props.buy?.buttonLabel || ''}
                        onChange={(e) => updateProp('buy.buttonLabel', e.target.value)}
                    />
                    <Input
                        placeholder="Level filter value"
                        value={props.buy?.levelFilterValue || ''}
                        onChange={(e) => updateProp('buy.levelFilterValue', e.target.value)}
                    />
                </div>
            </div>

            <div className="border-t pt-4">
                <h5 className="mb-2 text-xs font-semibold">Rent Option</h5>
                <div className="space-y-2">
                    <Input
                        placeholder="Button label"
                        value={props.rent?.buttonLabel || ''}
                        onChange={(e) => updateProp('rent.buttonLabel', e.target.value)}
                    />
                    <Input
                        placeholder="Level filter value"
                        value={props.rent?.levelFilterValue || ''}
                        onChange={(e) => updateProp('rent.levelFilterValue', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

// Generic editor for other components
const GenericEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Properties</h4>
            {Object.entries(props).map(([key, value]) => {
                if (typeof value === 'string' || typeof value === 'number') {
                    return (
                        <div key={key} className="space-y-2">
                            <Label className="capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Label>
                            <Input
                                value={value}
                                onChange={(e) =>
                                    updateComponent(pageId, component.id, {
                                        props: {
                                            ...props,
                                            [key]: e.target.value,
                                        },
                                    })
                                }
                            />
                        </div>
                    );
                }
                if (typeof value === 'boolean') {
                    return (
                        <div key={key} className="flex items-center justify-between">
                            <Label className="capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Label>
                            <Switch
                                checked={value}
                                onCheckedChange={(c) =>
                                    updateComponent(pageId, component.id, {
                                        props: {
                                            ...props,
                                            [key]: c,
                                        },
                                    })
                                }
                            />
                        </div>
                    );
                }
                return null;
            })}
            {Object.values(props).some((v) => typeof v === 'object') && (
                <div className="rounded border border-yellow-100 bg-yellow-50 p-4 text-xs text-yellow-800">
                    Some complex properties are hidden. Expand component details to view full JSON.
                </div>
            )}
        </div>
    );
};

// Header Editor
const HeaderEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedNav, setExpandedNav] = useState<number | null>(null);
    const [expandedAuth, setExpandedAuth] = useState<number | null>(null);

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addNavItem = () => {
        const newItem = { label: 'New Link', route: '/', openInSameTab: true };
        updateProp('navigation', [...(props.navigation || []), newItem]);
    };

    const updateNavItem = (index: number, field: string, value: any) => {
        const newNav = [...(props.navigation || [])];
        newNav[index] = { ...newNav[index], [field]: value };
        updateProp('navigation', newNav);
    };

    const deleteNavItem = (index: number) => {
        updateProp('navigation', (props.navigation || []).filter((_: any, i: number) => i !== index));
    };

    const addAuthLink = () => {
        updateProp('authLinks', [...(props.authLinks || []), { label: 'Login', route: 'login' }]);
    };

    // 'get-started' is the canonical route the learner header recognises as the
    // lead-collection / enrollment CTA (see isLeadFormLink in the learner HeaderComponent).
    const addGetStartedLink = () => {
        updateProp('authLinks', [...(props.authLinks || []), { label: 'Get Started', route: 'get-started' }]);
    };

    const updateAuthLink = (index: number, field: string, value: any) => {
        const updated = [...(props.authLinks || [])];
        updated[index] = { ...updated[index], [field]: value };
        updateProp('authLinks', updated);
    };

    const deleteAuthLink = (index: number) => {
        updateProp('authLinks', (props.authLinks || []).filter((_: any, i: number) => i !== index));
    };

    const config = useEditorStore((s) => s.config);
    const updateGlobalSettings = useEditorStore((s) => s.updateGlobalSettings);

    const syncNavFromPages = () => {
        if (!config) return;
        const navItems = config.pages
            .filter((p) => p.published !== false)
            .map((p) => {
                const isHome = p.id === 'home' || p.route === 'homepage' || p.route === '/' || p.route === '';
                return {
                    label: p.title || p.route || p.id,
                    route: isHome ? 'homepage' : p.route,
                    openInSameTab: true,
                };
            });
        updateProp('navigation', navItems);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Header Settings</h4>

            <VariantSwitcher
                componentType="header"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <ImageUploadField
                label="Logo"
                value={props.logo || ''}
                onChange={(url) => updateProp('logo', url)}
                placeholder="https://example.com/logo.png"
            />

            <div className="space-y-2">
                <Label>Title</Label>
                <Input
                    value={props.title || ''}
                    onChange={(e) => updateProp('title', e.target.value)}
                />
            </div>

            <ColorPickerField
                label="Background Color"
                value={props.backgroundColor || '#ffffff'} // design-lint-ignore: color-editor swatch/seed value
                onChange={(c) => updateProp('backgroundColor', c)}
            />

            <ColorPickerField
                label="Text Color"
                value={props.textColor || '#000000'} // design-lint-ignore: color-editor swatch/seed value
                onChange={(c) => updateProp('textColor', c)}
            />

{/* Sticky Header toggle REMOVED (2026-07-29): it wrote
                globalSettings.stickyHeader, which nothing ever read — the learner
                header is unconditionally `fixed`, and both the page offset
                (pt-16 md:pt-20) and the mobile action bar are built around that.
                Wiring it was the wrong fix: every existing site has the toggle
                reading "off" while being sticky, so honouring the value would
                silently un-stick every live header. The header is sticky by
                design; offering a switch that does nothing was the bug. */}

            {/* Navigation Links */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Navigation Links</Label>
                    <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={syncNavFromPages} title="Auto-generate from published pages" className="text-xs text-blue-600">
                            Sync Pages
                        </Button>
                        <Button size="sm" variant="outline" onClick={addNavItem}>
                            <Plus className="mr-1 size-3" /> Add
                        </Button>
                    </div>
                </div>
                {(props.navigation || []).map((item: any, index: number) => (
                    <div key={index} className="rounded border bg-gray-50 p-2">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setExpandedNav(expandedNav === index ? null : index)}
                                className="flex-1 text-left text-sm font-medium"
                            >
                                {expandedNav === index ? (
                                    <ChevronUp className="mr-1 inline size-3" />
                                ) : (
                                    <ChevronDown className="mr-1 inline size-3" />
                                )}
                                {item.label}
                            </button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteNavItem(index)}
                                className="size-6 p-0 text-red-600"
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                        {expandedNav === index && (
                            <div className="mt-2 space-y-2">
                                <Input
                                    placeholder="Label"
                                    value={item.label}
                                    onChange={(e) => updateNavItem(index, 'label', e.target.value)}
                                />
                                <LinkPicker
                                    label="Route"
                                    value={item.route || ''}
                                    onChange={(v) => updateNavItem(index, 'route', v)}
                                />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Open in same tab</Label>
                                    <Switch
                                        checked={!!item.openInSameTab}
                                        onCheckedChange={(c) =>
                                            updateNavItem(index, 'openInSameTab', c)
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Auth / CTA Buttons */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Auth / CTA Buttons</Label>
                    <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={addGetStartedLink}>
                            <Plus className="mr-1 size-3" /> Get Started
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateProp('authLinks', [...(props.authLinks || []), { label: 'Enquire Now', route: '', audienceId: ' ', formTitle: '' }])}>
                            <Plus className="mr-1 size-3" /> Enquire (form)
                        </Button>
                        <Button size="sm" variant="outline" onClick={addAuthLink}>
                            <Plus className="mr-1 size-3" /> Add
                        </Button>
                    </div>
                </div>
                <p className="text-caption text-gray-400">
                    Buttons shown on the right side of the header (e.g. Login, Sign Up). A
                    &ldquo;Get Started&rdquo; button opens the legacy lead-collection form;
                    &ldquo;Open form popup&rdquo; opens any Audience campaign&apos;s form (Enquire
                    Now, event registration) — pick the campaign below the toggle.
                </p>
                {(props.authLinks || []).map((link: any, index: number) => (
                    <div key={index} className="rounded border bg-gray-50 p-2">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setExpandedAuth(expandedAuth === index ? null : index)}
                                className="flex-1 text-left text-sm font-medium"
                            >
                                {expandedAuth === index ? (
                                    <ChevronUp className="mr-1 inline size-3" />
                                ) : (
                                    <ChevronDown className="mr-1 inline size-3" />
                                )}
                                {link.label || `Button ${index + 1}`}
                            </button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteAuthLink(index)}
                                className="size-6 p-0 text-red-600"
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                        {expandedAuth === index && (
                            <div className="mt-2 space-y-2">
                                <Input
                                    placeholder="Label (e.g. Login)"
                                    value={link.label || ''}
                                    onChange={(e) => updateAuthLink(index, 'label', e.target.value)}
                                />
                                <div>
                                    <Label className="text-xs">On click</Label>
                                    <div className="mt-1 flex gap-1">
                                        {([['route', 'Open a link'], ['openForm', 'Open form popup']] as const).map(([v, l]) => (
                                            <button key={v}
                                                onClick={() => updateAuthLink(index, 'audienceId', v === 'openForm' ? (link.audienceId || ' ') : '')}
                                                className={`rounded px-2.5 py-1 text-caption font-medium ${(link.audienceId ? 'openForm' : 'route') === v ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                                        ))}
                                    </div>
                                </div>
                                {link.audienceId ? (
                                    <>
                                        <CampaignPicker
                                            label="Form to open (campaign)"
                                            allowEmpty={false}
                                            value={(link.audienceId || '').trim()}
                                            onChange={(id) => updateAuthLink(index, 'audienceId', id)}
                                        />
                                        <Input
                                            placeholder="Popup title (defaults to the label)"
                                            value={link.formTitle || ''}
                                            onChange={(e) => updateAuthLink(index, 'formTitle', e.target.value)}
                                        />
                                    </>
                                ) : (
                                    <LinkPicker
                                        label="Route"
                                        value={link.route || ''}
                                        onChange={(v) => updateAuthLink(index, 'route', v)}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Footer Editor
const FooterEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const updateLeftSection = (field: string, value: any) => {
        updateProp('leftSection', { ...props.leftSection, [field]: value });
    };

    // Footer social links (Column 1 — Brand). platform drives both the label
    // and the icon the learner footer renders (icon = platform lowercased).
    const SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'Twitter'];

    const updateSocial = (index: number, field: string, value: any) => {
        const socials = [...(props.leftSection?.socials || [])];
        socials[index] = { ...socials[index], [field]: value };
        updateLeftSection('socials', socials);
    };

    const updateSocialPlatform = (index: number, platform: string) => {
        const socials = [...(props.leftSection?.socials || [])];
        socials[index] = { ...socials[index], platform, icon: platform.toLowerCase() };
        updateLeftSection('socials', socials);
    };

    const addSocial = () => {
        const socials = [
            ...(props.leftSection?.socials || []),
            { platform: 'Facebook', icon: 'facebook', url: '', openInSameTab: false },
        ];
        updateLeftSection('socials', socials);
    };

    const deleteSocial = (index: number) => {
        const socials = (props.leftSection?.socials || []).filter(
            (_: any, i: number) => i !== index,
        );
        updateLeftSection('socials', socials);
    };

    // Helper to update a right section's field
    const updateRightSection = (sectionKey: string, field: string, value: any) => {
        updateProp(sectionKey, { ...(props[sectionKey] || {}), [field]: value });
    };

    // Helper to update a specific link within a right section
    const updateRightSectionLink = (sectionKey: string, linkIndex: number, field: string, value: any) => {
        const section = props[sectionKey] || { title: '', links: [] };
        const links = [...(section.links || [])];
        links[linkIndex] = { ...links[linkIndex], [field]: value };
        updateProp(sectionKey, { ...section, links });
    };

    const addRightSectionLink = (sectionKey: string) => {
        const section = props[sectionKey] || { title: '', links: [] };
        const links = [...(section.links || []), { label: 'New Link', route: '/' }];
        updateProp(sectionKey, { ...section, links });
    };

    const deleteRightSectionLink = (sectionKey: string, linkIndex: number) => {
        const section = props[sectionKey] || { title: '', links: [] };
        const links = (section.links || []).filter((_: any, i: number) => i !== linkIndex);
        updateProp(sectionKey, { ...section, links });
    };

    const layout = props.layout || 'four-column';
    // Determine which right sections to show based on layout
    const rightSectionKeys = layout === 'two-column'
        ? ['rightSection1']
        : layout === 'three-column'
        ? ['rightSection1', 'rightSection2']
        : ['rightSection1', 'rightSection2', 'rightSection3'];

    const sectionLabels: Record<string, string> = {
        rightSection1: 'Column 2',
        rightSection2: 'Column 3',
        rightSection3: 'Column 4',
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Footer Settings</h4>

            <VariantSwitcher
                componentType="footer"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={layout}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="two-column">Two Column</option>
                    <option value="three-column">Three Column</option>
                    <option value="four-column">Four Column</option>
                </select>
            </div>

            {/* Left Section */}
            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Column 1 — Brand</h5>
                <div className="space-y-2">
                    <Label className="text-xs">Title</Label>
                    <Input
                        value={props.leftSection?.title || ''}
                        onChange={(e) => updateLeftSection('title', e.target.value)}
                    />
                </div>
                <RichTextField
                    label="Description"
                    value={props.leftSection?.text || ''}
                    onChange={(html) => updateLeftSection('text', html)}
                    placeholder="Platform description..."
                />

                {/* Social Links */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Social Links</Label>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={addSocial}
                        >
                            <Plus className="mr-1 size-3" /> Add
                        </Button>
                    </div>
                    {(props.leftSection?.socials || []).map((social: any, si: number) => (
                        <div key={si} className="flex items-center gap-1.5">
                            <select
                                className="h-7 shrink-0 rounded border px-2 text-xs"
                                value={social.platform || 'Facebook'}
                                onChange={(e) => updateSocialPlatform(si, e.target.value)}
                            >
                                {SOCIAL_PLATFORMS.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                            <Input
                                className="h-7 text-xs"
                                placeholder="https://..."
                                value={social.url || ''}
                                onChange={(e) => updateSocial(si, 'url', e.target.value)}
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="size-7 shrink-0 p-0 text-red-500"
                                onClick={() => deleteSocial(si)}
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                    ))}
                    {(props.leftSection?.socials || []).length === 0 && (
                        <p className="text-xs text-gray-400">
                            No social links yet — click Add.
                        </p>
                    )}
                </div>
            </div>

            {/* Right Sections (link columns) */}
            {rightSectionKeys.map((sectionKey) => {
                const section = props[sectionKey] || { title: '', links: [] };
                return (
                    <div key={sectionKey} className="space-y-3 rounded border bg-gray-50 p-3">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {sectionLabels[sectionKey]}
                        </h5>
                        <div className="space-y-2">
                            <Label className="text-xs">Section Title</Label>
                            <Input
                                value={section.title || ''}
                                placeholder="e.g. Quick Links"
                                onChange={(e) => updateRightSection(sectionKey, 'title', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Links</Label>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => addRightSectionLink(sectionKey)}
                                >
                                    <Plus className="mr-1 size-3" /> Add
                                </Button>
                            </div>
                            {(section.links || []).map((link: any, li: number) => (
                                <div key={li} className="flex items-center gap-1.5">
                                    <Input
                                        className="h-7 text-xs"
                                        placeholder="Label"
                                        value={link.label || ''}
                                        onChange={(e) => updateRightSectionLink(sectionKey, li, 'label', e.target.value)}
                                    />
                                    <LinkPicker
                                        label=""
                                        value={link.route || ''}
                                        onChange={(v) => updateRightSectionLink(sectionKey, li, 'route', v)}
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="size-7 shrink-0 p-0 text-red-500"
                                        onClick={() => deleteRightSectionLink(sectionKey, li)}
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Bottom Note */}
            <div className="space-y-2">
                <Label>Bottom Note</Label>
                <Input
                    value={props.bottomNote || ''}
                    placeholder="© 2025 Your Company. All rights reserved."
                    onChange={(e) => updateProp('bottomNote', e.target.value)}
                />
            </div>
        </div>
    );
};

// Hero Section Editor
const HeroSectionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const updateLeft = (field: string, value: any) => {
        updateProp('left', { ...props.left, [field]: value });
    };

    const updateRight = (field: string, value: any) => {
        updateProp('right', { ...props.right, [field]: value });
    };

    // Hero carousel images. 2+ → the learner hero renders an auto-playing
    // carousel; 1 → single image; 0 → falls back to the single "Right Image".
    const updateRightImage = (index: number, field: string, value: any) => {
        const images = [...(props.right?.images || [])];
        images[index] = { ...images[index], [field]: value };
        updateRight('images', images);
    };
    const addRightImage = () => {
        updateRight('images', [...(props.right?.images || []), { image: '', alt: '' }]);
    };
    const deleteRightImage = (index: number) => {
        updateRight(
            'images',
            (props.right?.images || []).filter((_: any, i: number) => i !== index),
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Hero Section Settings</h4>

            <VariantSwitcher
                componentType="heroSection"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.layout || 'split'}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="split">Split</option>
                    <option value="centered">Centered</option>
                    <option value="fullwidth">Full Width</option>
                </select>
            </div>

            <ImageUploadField
                label="Background Image"
                value={props.backgroundImage || ''}
                onChange={(url) => updateProp('backgroundImage', url)}
            />
            <p className="-mt-2 text-caption text-neutral-500">
                A background image covers the background color. Clear it to use the color below.
            </p>

            <ColorPickerField
                label="Background Color"
                value={props.backgroundColor || '#ffffff'} // design-lint-ignore: color-editor swatch/seed value
                onChange={(c) => updateProp('backgroundColor', c)}
            />

            {/* ── Eyebrow (badge above the title) ── */}
            <div className="space-y-2 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Eyebrow Badge</h5>
                <Input
                    placeholder="e.g. COHORT 4 · STARTS JULY"
                    value={props.eyebrow?.text || ''}
                    onChange={(e) =>
                        updateProp(
                            'eyebrow',
                            e.target.value
                                ? { ...(props.eyebrow || {}), text: e.target.value }
                                : undefined,
                        )
                    }
                />
                {props.eyebrow?.text && (
                    <select
                        className="w-full rounded border px-3 py-2 text-sm"
                        value={props.eyebrow?.style || 'badge'}
                        onChange={(e) => updateProp('eyebrow', { ...props.eyebrow, style: e.target.value })}
                    >
                        <option value="badge">Badge (pill + live dot)</option>
                        <option value="plain">Plain (accent label)</option>
                    </select>
                )}
            </div>

            {/* ── Stat chips row ── */}
            <div className="space-y-2 rounded border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold">Stat Chips</h5>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={(props.statChips || []).length >= 4}
                        onClick={() =>
                            updateProp('statChips', [
                                ...(props.statChips || []),
                                { value: '', label: '' },
                            ])
                        }
                    >
                        + Add
                    </Button>
                </div>
                <p className="text-caption text-gray-400">Learner shows up to 4 chips.</p>
                {(props.statChips || []).map((chip: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                        <Input
                            className="flex-1"
                            placeholder="20,000+"
                            value={chip.value || ''}
                            onChange={(e) => {
                                const next = [...(props.statChips || [])];
                                next[i] = { ...next[i], value: e.target.value };
                                updateProp('statChips', next);
                            }}
                        />
                        <Input
                            className="flex-1"
                            placeholder="Engineers taught"
                            value={chip.label || ''}
                            onChange={(e) => {
                                const next = [...(props.statChips || [])];
                                next[i] = { ...next[i], label: e.target.value };
                                updateProp('statChips', next);
                            }}
                        />
                        <button
                            type="button"
                            aria-label="Remove stat chip"
                            className="text-xs text-red-500 hover:text-red-700"
                            onClick={() =>
                                updateProp(
                                    'statChips',
                                    (props.statChips || []).filter((_: any, j: number) => j !== i),
                                )
                            }
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            {/* ── Trust chip ── */}
            <div className="space-y-2 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Trust Chip</h5>
                <Input
                    placeholder='e.g. "Trusted by 20,000+ students"'
                    value={props.trust?.text || ''}
                    onChange={(e) =>
                        updateProp(
                            'trust',
                            e.target.value || props.trust?.rating
                                ? { ...(props.trust || {}), text: e.target.value }
                                : undefined,
                        )
                    }
                />
                <div className="flex items-center gap-2">
                    <Label className="text-xs">Rating (0 = off)</Label>
                    <Input
                        type="number"
                        min={0}
                        max={5}
                        step={0.1}
                        className="w-24"
                        value={props.trust?.rating ?? 0}
                        onChange={(e) => {
                            const rating = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                            updateProp('trust', {
                                ...(props.trust || {}),
                                rating: rating > 0 ? rating : undefined,
                            });
                        }}
                    />
                </div>
            </div>

            {/* ── CTA buttons (multi) ── */}
            <div className="space-y-2 rounded border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold">CTA Buttons (multi)</h5>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={(props.left?.buttons || []).length >= 3}
                        onClick={() =>
                            updateLeft('buttons', [
                                ...(props.left?.buttons || []),
                                { text: '', action: 'navigate', target: '', variant: (props.left?.buttons || []).length === 0 ? 'primary' : 'secondary' },
                            ])
                        }
                    >
                        + Add
                    </Button>
                </div>
                <p className="text-caption text-gray-400">
                    When any button has text here, it replaces the single legacy button below. Learner shows up to 3.
                </p>
                {(props.left?.buttons || []).map((b: any, i: number) => (
                    <div key={i} className="space-y-1 rounded border bg-white p-2">
                        <div className="flex items-center gap-2">
                            <Input
                                className="flex-1"
                                placeholder="Button text"
                                value={b.text || ''}
                                onChange={(e) => {
                                    const next = [...(props.left?.buttons || [])];
                                    next[i] = { ...next[i], text: e.target.value };
                                    updateLeft('buttons', next);
                                }}
                            />
                            <select
                                className="rounded border px-2 py-1.5 text-xs"
                                value={b.variant || 'secondary'}
                                onChange={(e) => {
                                    const next = [...(props.left?.buttons || [])];
                                    next[i] = { ...next[i], variant: e.target.value };
                                    updateLeft('buttons', next);
                                }}
                            >
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                            </select>
                            <button
                                type="button"
                                aria-label="Remove button"
                                className="text-xs text-red-500 hover:text-red-700"
                                onClick={() =>
                                    updateLeft(
                                        'buttons',
                                        (props.left?.buttons || []).filter((_: any, j: number) => j !== i),
                                    )
                                }
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                className="rounded border px-2 py-1.5 text-xs"
                                value={b.action || 'navigate'}
                                onChange={(e) => {
                                    const next = [...(props.left?.buttons || [])];
                                    next[i] = { ...next[i], action: e.target.value };
                                    updateLeft('buttons', next);
                                }}
                            >
                                <option value="navigate">Navigate</option>
                                <option value="openLeadCollection">Open lead form (legacy)</option>
                                <option value="openForm">Open campaign form (popup)</option>
                            </select>
                            {(b.action || 'navigate') === 'navigate' && (
                                <Input
                                    className="flex-1"
                                    placeholder="Target route / URL"
                                    value={b.target || ''}
                                    onChange={(e) => {
                                        const next = [...(props.left?.buttons || [])];
                                        next[i] = { ...next[i], target: e.target.value };
                                        updateLeft('buttons', next);
                                    }}
                                />
                            )}
                        </div>
                        {b.action === 'openForm' && (
                            <CampaignPicker
                                label="Audience list / campaign to connect"
                                allowEmpty={false}
                                value={b.audienceId || ''}
                                onChange={(id) => {
                                    const next = [...(props.left?.buttons || [])];
                                    next[i] = { ...next[i], audienceId: id };
                                    updateLeft('buttons', next);
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Left Content</h5>
                <div className="space-y-2">
                    <Label className="text-xs">Title</Label>
                    <Input
                        value={props.left?.title || ''}
                        onChange={(e) => updateLeft('title', e.target.value)}
                    />
                </div>
                <RichTextField
                    label="Description"
                    value={props.left?.description || ''}
                    onChange={(html) => updateLeft('description', html)}
                    placeholder="Enter section description..."
                />
            </div>

            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Right Image</h5>
                <ImageUploadField
                    label="Image"
                    value={props.right?.image || ''}
                    onChange={(url) => updateRight('image', url)}
                />
                <div className="space-y-2">
                    <Label className="text-xs">Alt Text</Label>
                    <Input
                        value={props.right?.alt || ''}
                        onChange={(e) => updateRight('alt', e.target.value)}
                    />
                </div>
            </div>

            {/* Right Video — a YouTube/Vimeo link or an uploaded file. When set
                it replaces the image/carousel in the hero media slot. */}
            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Right Video</h5>
                <VideoUploadField
                    label="Video"
                    value={props.right?.video || ''}
                    onChange={(url) => updateRight('video', url)}
                />
                <p className="text-xs text-gray-500">
                    Paste a YouTube or Vimeo link, or upload a video file. A video
                    takes priority over the image and carousel above.
                </p>
                {props.right?.video && (
                    <ImageUploadField
                        label="Poster (uploaded video only)"
                        value={props.right?.videoPoster || ''}
                        onChange={(url) => updateRight('videoPoster', url)}
                    />
                )}
            </div>

            {/* Carousel Images */}
            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold">Carousel Images</h5>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={addRightImage}
                    >
                        <Plus className="mr-1 size-3" /> Add
                    </Button>
                </div>
                <p className="text-xs text-gray-500">
                    Add 2 or more images to turn the hero media into an
                    auto-playing carousel. With one image it stays a single
                    image; with none it uses the Right Image above.
                </p>
                {(props.right?.images || []).map((img: any, i: number) => (
                    <div key={i} className="space-y-2 rounded border bg-white p-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                                Slide {i + 1}
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="size-6 shrink-0 p-0 text-red-500"
                                onClick={() => deleteRightImage(i)}
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                        <ImageUploadField
                            label="Image"
                            value={img.image || ''}
                            onChange={(url) => updateRightImage(i, 'image', url)}
                        />
                        <Input
                            className="h-7 text-xs"
                            placeholder="Alt text"
                            value={img.alt || ''}
                            onChange={(e) => updateRightImage(i, 'alt', e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

// Book Details Editor
const BookDetailsEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Book Details Settings</h4>

            <div className="flex items-center justify-between">
                <Label>Show Enquiry</Label>
                <Switch
                    checked={props.showEnquiry || false}
                    onCheckedChange={(c) => updateProp('showEnquiry', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Payment</Label>
                <Switch
                    checked={props.showPayment || false}
                    onCheckedChange={(c) => updateProp('showPayment', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Add to Cart</Label>
                <Switch
                    checked={props.showAddToCart || false}
                    onCheckedChange={(c) => updateProp('showAddToCart', c)}
                />
            </div>
        </div>
    );
};

// Cart Component Editor
const CartComponentEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Cart Settings</h4>

            <div className="flex items-center justify-between">
                <Label>Show Item Image</Label>
                <Switch
                    checked={props.showItemImage ?? true}
                    onCheckedChange={(c) => updateProp('showItemImage', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Item Title</Label>
                <Switch
                    checked={props.showItemTitle ?? true}
                    onCheckedChange={(c) => updateProp('showItemTitle', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Quantity Selector</Label>
                <Switch
                    checked={props.showQuantitySelector ?? true}
                    onCheckedChange={(c) => updateProp('showQuantitySelector', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Remove Button</Label>
                <Switch
                    checked={props.showRemoveButton ?? true}
                    onCheckedChange={(c) => updateProp('showRemoveButton', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Price</Label>
                <Switch
                    checked={props.showPrice ?? true}
                    onCheckedChange={(c) => updateProp('showPrice', c)}
                />
            </div>

            <div className="space-y-2">
                <Label>Empty State Message</Label>
                <Input
                    value={props.emptyStateMessage || ''}
                    onChange={(e) => updateProp('emptyStateMessage', e.target.value)}
                />
            </div>
        </div>
    );
};

// Stats Highlights Editor
const StatsHighlightsEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addStat = () => {
        const newStat = { label: 'New Stat', value: '0' };
        updateProp('stats', [...(props.stats || []), newStat]);
    };

    const updateStat = (index: number, field: string, value: string) => {
        const newStats = [...(props.stats || [])];
        newStats[index] = { ...newStats[index], [field]: value };
        updateProp('stats', newStats);
    };

    const deleteStat = (index: number) => {
        updateProp(
            'stats',
            props.stats.filter((_: any, i: number) => i !== index)
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Stats Highlights Settings</h4>

            <div className="space-y-2">
                <Label>Header Text</Label>
                <Input
                    value={props.headerText || ''}
                    onChange={(e) => updateProp('headerText', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Style</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.style || 'card'}
                    onChange={(e) => updateProp('style', e.target.value)}
                >
                    <option value="circle">Circle</option>
                    <option value="card">Card</option>
                    <option value="minimal">Minimal</option>
                </select>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Stats</Label>
                    <Button size="sm" variant="outline" onClick={addStat}>
                        <Plus className="mr-1 size-3" /> Add
                    </Button>
                </div>
                {props.stats?.map((stat: any, index: number) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 rounded border bg-gray-50 p-2"
                    >
                        <Input
                            placeholder="Label"
                            value={stat.label}
                            onChange={(e) => updateStat(index, 'label', e.target.value)}
                            className="flex-1"
                        />
                        <Input
                            placeholder="Value"
                            value={stat.value}
                            onChange={(e) => updateStat(index, 'value', e.target.value)}
                            className="w-24"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteStat(index)}
                            className="size-8 p-0 text-red-600"
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Testimonials Editor
const TestimonialsEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addTestimonial = () => {
        const newItem = {
            name: 'Customer Name',
            role: 'Role',
            feedback: 'Great experience!',
            avatar: '',
        };
        updateProp('testimonials', [...(props.testimonials || []), newItem]);
    };

    const updateTestimonial = (index: number, field: string, value: string) => {
        const newItems = [...(props.testimonials || [])];
        newItems[index] = { ...newItems[index], [field]: value };
        updateProp('testimonials', newItems);
    };

    const deleteTestimonial = (index: number) => {
        updateProp(
            'testimonials',
            props.testimonials.filter((_: any, i: number) => i !== index)
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Testimonials Settings</h4>

            <div className="space-y-2">
                <Label>Header Text</Label>
                <Input
                    value={props.headerText || ''}
                    onChange={(e) => updateProp('headerText', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.layout || 'carousel'}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="carousel">Carousel</option>
                    <option value="grid-scroll">Grid Scroll</option>
                    <option value="static-grid">Static Grid</option>
                </select>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Testimonials</Label>
                    <Button size="sm" variant="outline" onClick={addTestimonial}>
                        <Plus className="mr-1 size-3" /> Add
                    </Button>
                </div>
                {props.testimonials?.map((item: any, index: number) => (
                    <div key={index} className="space-y-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Testimonial {index + 1}</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTestimonial(index)}
                                className="size-6 p-0 text-red-600"
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                        <Input
                            placeholder="Name"
                            value={item.name}
                            onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                        />
                        <Input
                            placeholder="Role"
                            value={item.role}
                            onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                        />
                        <Textarea
                            placeholder="Feedback"
                            rows={2}
                            value={item.feedback}
                            onChange={(e) => updateTestimonial(index, 'feedback', e.target.value)}
                        />
                        <Input
                            placeholder="Avatar URL"
                            value={item.avatar}
                            onChange={(e) => updateTestimonial(index, 'avatar', e.target.value)}
                        />
                        <div className="flex items-center gap-3">
                            <Label className="text-xs">Rating (0 = off)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={5}
                                step={1}
                                className="w-20"
                                value={item.rating ?? 0}
                                onChange={(e) => {
                                    const next = [...(props.testimonials || [])];
                                    // Integer stars, clamped — the live card rounds and caps at 5
                                    const r = Math.round(Math.min(5, Math.max(0, Number(e.target.value) || 0)));
                                    next[index] = { ...next[index], rating: r > 0 ? r : undefined };
                                    updateProp('testimonials', next);
                                }}
                            />
                            <Label className="text-xs">Featured</Label>
                            <Switch
                                checked={item.highlight || false}
                                onCheckedChange={(c) => {
                                    const next = [...(props.testimonials || [])];
                                    next[index] = { ...next[index], highlight: c || undefined };
                                    updateProp('testimonials', next);
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Policy Renderer Editor
const PolicyRendererEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updatePolicy = (policyKey: string, field: string, value: string) => {
        const policies = props.policies || {};
        updateComponent(pageId, component.id, {
            props: {
                ...props,
                policies: {
                    ...policies,
                    [policyKey]: {
                        ...policies[policyKey],
                        [field]: value,
                    },
                },
            },
        });
    };

    const addPolicy = () => {
        const key = `policy_${Date.now()}`;
        const policies = props.policies || {};
        updateComponent(pageId, component.id, {
            props: {
                ...props,
                policies: {
                    ...policies,
                    [key]: { title: 'New Policy', content: '<p>Policy content here...</p>' },
                },
            },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Policy Settings</h4>

            <div className="flex items-center justify-between">
                <Label>Policies</Label>
                <Button size="sm" variant="outline" onClick={addPolicy}>
                    <Plus className="mr-1 size-3" /> Add
                </Button>
            </div>

            {Object.entries(props.policies || {}).map(([key, policy]: [string, any]) => (
                <div key={key} className="space-y-2 rounded border bg-gray-50 p-3">
                    <div className="space-y-2">
                        <Label className="text-xs">Title</Label>
                        <Input
                            value={policy.title || ''}
                            onChange={(e) => updatePolicy(key, 'title', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Content (HTML)</Label>
                        <Textarea
                            rows={4}
                            value={policy.content || ''}
                            onChange={(e) => updatePolicy(key, 'content', e.target.value)}
                            className="font-mono text-xs"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

// FAQ Section Editor
const FaqSectionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addFaq = () => updateProp('faqs', [...(props.faqs || []), { question: 'New Question', answer: 'Answer here.' }]);
    const deleteFaq = (i: number) => updateProp('faqs', props.faqs.filter((_: any, idx: number) => idx !== i));
    const updateFaq = (i: number, field: string, value: string) => {
        const next = [...(props.faqs || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('faqs', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">FAQ Settings</h4>
            <div className="space-y-2">
                <Label>Header Text</Label>
                <Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Subheading</Label>
                <Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} />
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#F9FAFB' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Questions ({props.faqs?.length || 0})</Label>
                    <Button size="sm" onClick={addFaq}><Plus className="mr-1 size-3" />Add</Button>
                </div>
                {props.faqs?.map((faq: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedFaq === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {faq.question}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deleteFaq(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedFaq === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <Input placeholder="Question" value={faq.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} />
                                <Textarea placeholder="Answer" rows={2} value={faq.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Video Embed Editor
const VideoEmbedEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Video Embed Settings</h4>
            <div className="space-y-2">
                <Label>YouTube / Vimeo URL</Label>
                <Input value={props.url || ''} placeholder="https://youtu.be/..." onChange={(e) => updateProp('url', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Title</Label>
                <Input value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Caption</Label>
                <Input value={props.caption || ''} placeholder="Optional caption below video" onChange={(e) => updateProp('caption', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.aspectRatio || '16:9'} onChange={(e) => updateProp('aspectRatio', e.target.value)}>
                    <option value="16:9">16:9 (Widescreen)</option>
                    <option value="4:3">4:3 (Standard)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="9:16">9:16 (Vertical)</option>
                </select>
            </div>
            <div className="flex items-center justify-between">
                <Label>Autoplay</Label>
                <Switch checked={props.autoplay || false} onCheckedChange={(c) => updateProp('autoplay', c)} />
            </div>
        </div>
    );
};

// CTA Banner Editor
const CtaBannerEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">CTA Banner Settings</h4>
            <div className="space-y-2">
                <Label>Heading</Label>
                <Input value={props.heading || ''} onChange={(e) => updateProp('heading', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Subheading</Label>
                <Textarea rows={2} value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Layout</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.layout || 'centered'} onChange={(e) => updateProp('layout', e.target.value)}>
                    <option value="centered">Centered</option>
                    <option value="split">Split (text left, button right)</option>
                </select>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#3B82F6' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <ColorPickerField label="Text Color" value={props.textColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('textColor', c)} />
            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Button</h5>
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Button</Label>
                    <Switch checked={props.button?.enabled || false} onCheckedChange={(c) => updateProp('button', { ...props.button, enabled: c })} />
                </div>
                {props.button?.enabled && (
                    <>
                        <Input placeholder="Button text" value={props.button?.text || ''} onChange={(e) => updateProp('button', { ...props.button, text: e.target.value })} />
                        <div>
                            <Label className="text-xs">On click</Label>
                            <div className="mt-1 flex gap-1">
                                {([['navigate', 'Open a link'], ['openForm', 'Open form popup']] as const).map(([v, l]) => (
                                    <button key={v} onClick={() => updateProp('button', { ...props.button, action: v })}
                                        className={`rounded px-2.5 py-1 text-caption font-medium ${(props.button?.action || 'navigate') === v ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                                ))}
                            </div>
                        </div>
                        {props.button?.action === 'openForm' ? (
                            <CampaignPicker
                                label="Form to open (campaign)"
                                allowEmpty={false}
                                value={props.button?.audienceId || ''}
                                onChange={(id) => updateProp('button', { ...props.button, audienceId: id })}
                            />
                        ) : (
                            <LinkPicker
                                label="Button Link"
                                value={props.button?.target || ''}
                                onChange={(v) => updateProp('button', { ...props.button, target: v })}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// Pricing Table Editor
const PricingTableEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addPlan = () => updateProp('plans', [...(props.plans || []), { name: 'New Plan', price: '₹0', period: '/month', description: '', features: ['Feature 1'], highlighted: false, buttonText: 'Get Started', buttonTarget: '' }]);
    const deletePlan = (i: number) => updateProp('plans', props.plans.filter((_: any, idx: number) => idx !== i));
    const updatePlan = (i: number, field: string, value: any) => {
        const next = [...(props.plans || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('plans', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Pricing Table Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} /></div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Plans ({props.plans?.length || 0})</Label>
                    <Button size="sm" onClick={addPlan}><Plus className="mr-1 size-3" />Add Plan</Button>
                </div>
                {props.plans?.map((plan: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedPlan(expandedPlan === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedPlan === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {plan.name} — {plan.price}{plan.period}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deletePlan(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedPlan === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <Input placeholder="Plan name" value={plan.name} onChange={(e) => updatePlan(i, 'name', e.target.value)} />
                                <div className="flex gap-2">
                                    <Input placeholder="Price (e.g. ₹999)" value={plan.price} onChange={(e) => updatePlan(i, 'price', e.target.value)} className="flex-1" />
                                    <Input placeholder="/month" value={plan.period} onChange={(e) => updatePlan(i, 'period', e.target.value)} className="w-24" />
                                </div>
                                <Input placeholder="Description" value={plan.description || ''} onChange={(e) => updatePlan(i, 'description', e.target.value)} />
                                <div className="space-y-1">
                                    <Label className="text-xs">Features (one per line)</Label>
                                    <Textarea rows={3} value={(plan.features || []).join('\n')} onChange={(e) => updatePlan(i, 'features', e.target.value.split('\n').filter(Boolean))} />
                                </div>
                                <Input placeholder="Button text" value={plan.buttonText || ''} onChange={(e) => updatePlan(i, 'buttonText', e.target.value)} />
                                <LinkPicker label="Button Link" value={plan.buttonTarget || ''} onChange={(v) => updatePlan(i, 'buttonTarget', v)} />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Highlighted (recommended)</Label>
                                    <Switch checked={plan.highlighted || false} onCheckedChange={(c) => updatePlan(i, 'highlighted', c)} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Contact Form Editor
const ContactFormEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Contact Form Settings</h4>
            <div className="space-y-2"><Label>Heading</Label><Input value={props.heading || ''} onChange={(e) => updateProp('heading', e.target.value)} /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} /></div>
            <div className="space-y-2"><Label>Submit Button Label</Label><Input value={props.submitLabel || 'Send Message'} onChange={(e) => updateProp('submitLabel', e.target.value)} /></div>
            <div className="space-y-2"><Label>Success Message</Label><Input value={props.successMessage || ''} onChange={(e) => updateProp('successMessage', e.target.value)} /></div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <CampaignPicker
                value={props.audienceId || ''}
                onChange={(id, name) => updateComponent(pageId, component.id, { props: { ...props, audienceId: id, audienceName: name } })}
            />
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-caption text-gray-500">
                Submissions land as leads in the campaign above (or the default website-leads list)
                — visible in Audience Manager → Recent Leads, with dedup and counsellor assignment.
            </div>
        </div>
    );
};

// Team Section Editor
const TeamSectionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedMember, setExpandedMember] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addMember = () => updateProp('members', [...(props.members || []), { name: 'Team Member', role: 'Role', bio: '', avatar: '' }]);
    const deleteMember = (i: number) => updateProp('members', props.members.filter((_: any, idx: number) => idx !== i));
    const updateMember = (i: number, field: string, value: string) => {
        const next = [...(props.members || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('members', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Team Section Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} /></div>
            <div className="space-y-2">
                <Label>Columns</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.columns || 3} onChange={(e) => updateProp('columns', parseInt(e.target.value))}>
                    <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                </select>
            </div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Members ({props.members?.length || 0})</Label>
                    <Button size="sm" onClick={addMember}><Plus className="mr-1 size-3" />Add</Button>
                </div>
                {props.members?.map((m: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedMember(expandedMember === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedMember === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {m.name} — {m.role}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deleteMember(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedMember === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <ImageUploadField label="Avatar" value={m.avatar || ''} onChange={(url) => updateMember(i, 'avatar', url)} />
                                <Input placeholder="Name" value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} />
                                <Input placeholder="Role / Title" value={m.role} onChange={(e) => updateMember(i, 'role', e.target.value)} />
                                <Textarea placeholder="Short bio" rows={2} value={m.bio || ''} onChange={(e) => updateMember(i, 'bio', e.target.value)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Announcement Feed Editor
const AnnouncementFeedEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addAnnouncement = () => updateProp('announcements', [...(props.announcements || []), { title: 'New Announcement', date: new Date().toISOString().slice(0, 10), summary: 'Summary here.', tag: 'News' }]);
    const deleteAnnouncement = (i: number) => updateProp('announcements', props.announcements.filter((_: any, idx: number) => idx !== i));
    const updateAnnouncement = (i: number, field: string, value: string) => {
        const next = [...(props.announcements || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('announcements', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Announcement Feed Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2"><Label>Layout</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.layout || 'list'} onChange={(e) => updateProp('layout', e.target.value)}>
                    <option value="list">List</option><option value="grid">Grid</option>
                </select>
            </div>
            <div className="flex items-center justify-between"><Label>Show Date</Label><Switch checked={props.showDate ?? true} onCheckedChange={(c) => updateProp('showDate', c)} /></div>
            <div className="flex items-center justify-between"><Label>Show Tag</Label><Switch checked={props.showTag ?? true} onCheckedChange={(c) => updateProp('showTag', c)} /></div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Announcements ({props.announcements?.length || 0})</Label>
                    <Button size="sm" onClick={addAnnouncement}><Plus className="mr-1 size-3" />Add</Button>
                </div>
                {props.announcements?.map((a: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedItem(expandedItem === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedItem === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {a.title}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deleteAnnouncement(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedItem === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <Input placeholder="Title" value={a.title} onChange={(e) => updateAnnouncement(i, 'title', e.target.value)} />
                                <Input type="date" value={a.date || ''} onChange={(e) => updateAnnouncement(i, 'date', e.target.value)} />
                                <Input placeholder="Tag (e.g. News, Update)" value={a.tag || ''} onChange={(e) => updateAnnouncement(i, 'tag', e.target.value)} />
                                <Textarea placeholder="Summary" rows={2} value={a.summary || ''} onChange={(e) => updateAnnouncement(i, 'summary', e.target.value)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Image Gallery Editor
const ImageGalleryEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addImage = () => updateProp('images', [...(props.images || []), { src: '', alt: '', caption: '' }]);
    const deleteImage = (i: number) => updateProp('images', props.images.filter((_: any, idx: number) => idx !== i));
    const updateImage = (i: number, field: string, value: string) => {
        const next = [...(props.images || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('images', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Image Gallery Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2">
                <Label>Columns</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.columns || 3} onChange={(e) => updateProp('columns', parseInt(e.target.value))}>
                    <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                </select>
            </div>
            <div className="flex items-center justify-between"><Label>Show Captions</Label><Switch checked={props.showCaptions || false} onCheckedChange={(c) => updateProp('showCaptions', c)} /></div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Images ({props.images?.length || 0})</Label>
                    <Button size="sm" onClick={addImage}><Plus className="mr-1 size-3" />Add Image</Button>
                </div>
                {props.images?.map((img: any, i: number) => (
                    <div key={i} className="mb-2 space-y-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Image {i + 1}</span>
                            <Button size="sm" variant="ghost" onClick={() => deleteImage(i)} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        <ImageUploadField label="Image" value={img.src || ''} onChange={(url) => updateImage(i, 'src', url)} aiKind="photo" />
                        <Input placeholder="Alt text" value={img.alt || ''} onChange={(e) => updateImage(i, 'alt', e.target.value)} />
                        {props.showCaptions && <Input placeholder="Caption" value={img.caption || ''} onChange={(e) => updateImage(i, 'caption', e.target.value)} />}
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── Spacer Editor ────────────────────────────────────────────────────── */
/**
 * Campaign (audience list) picker — the shared "where do these leads go?"
 * control for every website capture point. Lists the institute's ACTIVE
 * campaigns from Audience Manager; the empty choice means the auto-provisioned
 * default website-leads list.
 */
const CampaignPicker = ({ value, onChange, label = 'Send responses to', allowEmpty = true }: {
    value: string;
    onChange: (id: string, name: string) => void;
    label?: string;
    allowEmpty?: boolean;
}) => {
    const instituteId = getCurrentInstituteId();
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        ...handleFetchCampaignsList({ institute_id: instituteId || '', status: 'ACTIVE', page: 0, size: 100 }),
        enabled: !!instituteId,
    });
    const campaigns = ((data?.content || []) as any[])
        .map((c) => ({ id: c.id || c.audience_id || c.campaign_id, name: c.campaign_name }))
        .filter((c) => c.id);

    // Inline creation: without it, "connect a form" meant leaving the editor
    // for Audience Manager, building a campaign + its fields, and finding the
    // way back — the single most common place a non-technical admin lost the
    // thread. A new campaign here starts with Name / Email / Phone, which is
    // what a website enquiry form needs; richer fields stay in Audience Manager.
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const createMutation = useMutation({
        mutationFn: async (campaignName: string) => {
            const mkField = (fieldName: string, fieldType: string, isMandatory: boolean, order: number) => ({
                instituteId,
                type: 'AUDIENCE_FORM',
                groupName: '',
                individualOrder: order,
                groupInternalOrder: 0,
                isMandatory,
                status: 'ACTIVE',
                customField: { fieldName, fieldType, defaultValue: '', config: '{}', formOrder: order, isMandatory, status: 'ACTIVE' },
            });
            const { data: newId } = await axios.post(
                AUDIENCE_CAMPAIGN,
                {
                    institute_id: instituteId,
                    campaign_name: campaignName,
                    campaign_type: 'WEBSITE',
                    campaign_objective: 'LEAD_GENERATION',
                    description: 'Created from the website builder',
                    status: 'ACTIVE',
                    institute_custom_fields: [
                        mkField('Full Name', 'TEXT', true, 1),
                        mkField('Email', 'TEXT', true, 2),
                        mkField('Phone Number', 'TEXT', false, 3),
                    ],
                },
                { headers: { Authorization: `Bearer ${getTokenFromCookie(TokenKey.accessToken)}` } },
            );
            return { id: String(newId).replace(/^"|"$/g, ''), name: campaignName };
        },
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ['campaignsList'] });
            onChange(created.id, created.name);
            setCreating(false);
            setNewName('');
        },
    });

    return (
        <div>
            <Label className="text-xs">{label}</Label>
            <select
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
                value={value || ''}
                onChange={(e) => {
                    const picked = campaigns.find((c) => c.id === e.target.value);
                    onChange(e.target.value, picked?.name || '');
                }}
            >
                <option value="">
                    {isLoading ? 'Loading campaigns…' : allowEmpty ? 'Default website leads list' : 'Select a campaign'}
                </option>
                {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            {creating ? (
                <div className="mt-2 space-y-2 rounded border border-primary-200 bg-primary-50 p-2">
                    <Label className="text-xs">New campaign name</Label>
                    <Input
                        autoFocus
                        className="mt-1"
                        placeholder="e.g. Website Enquiries"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newName.trim()) createMutation.mutate(newName.trim());
                            if (e.key === 'Escape') setCreating(false);
                        }}
                    />
                    <p className="text-caption text-gray-500">
                        Starts with Full Name, Email and Phone Number. Add more fields any time in
                        Audience Manager.
                    </p>
                    <div className="flex gap-1">
                        <Button size="sm" className="h-7 text-caption" disabled={!newName.trim() || createMutation.isPending} onClick={() => createMutation.mutate(newName.trim())}>
                            {createMutation.isPending ? 'Creating…' : 'Create & use'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-caption" onClick={() => setCreating(false)}>Cancel</Button>
                    </div>
                    {createMutation.isError && (
                        <p className="text-caption text-danger-600">Could not create it — please try again.</p>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="mt-1 text-caption font-medium text-primary-500 hover:underline"
                >
                    + New campaign
                </button>
            )}
            <p className="mt-1 text-caption text-gray-400">
                Campaigns come from Audience Manager — edit their form fields there.
            </p>
            {value && <CampaignHealth audienceId={value} />}
        </div>
    );
};

/**
 * Proof-of-life under every campaign picker: how many leads this campaign has
 * ever received, when the last one arrived, and a one-click test submission
 * that exercises the REAL public pipeline end-to-end.
 *
 * WHY: capture failures here have historically been silent — the contact form
 * discarded every submission for months while looking perfectly healthy. An
 * admin placing a form must be able to see “it works” without leaving the
 * editor or waiting for a real visitor.
 */
const CampaignHealth = ({ audienceId }: { audienceId: string }) => {
    const instituteId = getCurrentInstituteId();
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['CAMPAIGN_HEALTH', audienceId],
        queryFn: async () => {
            const res = await fetchCampaignLeads({
                audience_id: audienceId,
                conversion_status_filter: 'ALL',
                page: 0,
                size: 1,
                sort_by: 'submittedAt',
                sort_direction: 'DESC',
            } as any);
            const rows = (res as any)?.content || [];
            return {
                total: (res as any)?.totalElements ?? 0,
                lastAt: rows[0]?.submitted_at_local as string | undefined,
            };
        },
        enabled: !!audienceId,
        staleTime: 30_000,
    });

    const testMutation = useMutation({
        mutationFn: async () => {
            // The exact endpoint + shape the live site submits through — if this
            // round-trips, a visitor's submission will too.
            const stamp = Date.now();
            await axios.post(SUBMIT_CATALOGUE_LEAD_URL, {
                institute_id: instituteId,
                audience_id: audienceId,
                full_name: 'TEST LEAD — sent from the page builder',
                email: `test-lead-${stamp}@test.vacademy.io`,
                mobile_number: '',
                source_type: 'TEST_SUBMISSION',
                source_id: 'builder-test-lead',
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['CAMPAIGN_HEALTH', audienceId] });
        },
    });

    return (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
            <span className="text-caption text-gray-500">
                {isLoading
                    ? 'Checking submissions…'
                    : `${data?.total ?? 0} lead${(data?.total ?? 0) === 1 ? '' : 's'} received${
                          data?.lastAt ? ` · last ${new Date(data.lastAt).toLocaleDateString()}` : ''
                      }`}
            </span>
            <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="rounded px-2 py-0.5 text-caption font-medium text-primary-500 hover:bg-primary-50 disabled:opacity-50"
            >
                {testMutation.isPending
                    ? 'Sending…'
                    : testMutation.isSuccess
                      ? '✓ Test lead delivered'
                      : testMutation.isError
                        ? 'Failed — retry?'
                        : 'Send test lead'}
            </button>
        </div>
    );
};

/**
 * Editor for `leadForm` — an Audience campaign's form embedded on the page.
 * The FIELDS are not edited here by design: they live on the campaign in
 * Audience Manager, so one definition serves every placement (inline, popup,
 * standalone /audience-response page).
 */
const LeadFormEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-caption text-gray-500">
                Renders a campaign&apos;s registration form right on the page. Fields, options and
                mandatory flags are configured on the campaign in Audience Manager; submissions land
                in that campaign with dedup, scoring and counsellor assignment.
            </div>
            <CampaignPicker
                label="Campaign (form + destination)"
                allowEmpty={false}
                value={props.audienceId || ''}
                onChange={(id, name) => updateComponent(pageId, component.id, { props: { ...props, audienceId: id, audienceName: name } })}
            />
            <div>
                <Label className="text-xs">Title</Label>
                <Input className="mt-1" value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} placeholder="Register your interest" />
            </div>
            <div>
                <Label className="text-xs">Subtitle</Label>
                <Textarea className="mt-1" rows={2} value={props.subtitle || ''} onChange={(e) => updateProp('subtitle', e.target.value)} />
            </div>
            <div>
                <Label className="text-xs">Submit button label</Label>
                <Input className="mt-1" value={props.submitLabel || ''} onChange={(e) => updateProp('submitLabel', e.target.value)} placeholder="Submit" />
            </div>
            <div>
                <Label className="text-xs">Success message</Label>
                <Input className="mt-1" value={props.successMessage || ''} onChange={(e) => updateProp('successMessage', e.target.value)} placeholder="Thank you! We've received your details." />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs">Style</Label>
                    <div className="mt-1 flex gap-1">
                        {(['card', 'bare'] as const).map((v) => (
                            <button key={v} onClick={() => updateProp('layout', v)}
                                className={`rounded px-2.5 py-1 text-caption font-medium capitalize ${(props.layout || 'card') === v ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{v}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Header align</Label>
                    <div className="mt-1 flex gap-1">
                        {(['center', 'left'] as const).map((v) => (
                            <button key={v} onClick={() => updateProp('align', v)}
                                className={`rounded px-2.5 py-1 text-caption font-medium capitalize ${(props.align || 'center') === v ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{v}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProductPageOfferEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const instituteId = getCurrentInstituteId();
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    // Only ACTIVE/DRAFT pages come back; a DRAFT page will not render publicly,
    // so it is labelled rather than hidden (admins often build both together).
    const { data: pages, isLoading } = useQuery({
        queryKey: ['PRODUCT_PAGES_FOR_CATALOGUE', instituteId],
        queryFn: () => getAllProductPages(instituteId!),
        enabled: !!instituteId,
        staleTime: 60_000,
    });

    const selected = (pages || []).find((p: any) => p.code === props.productPageCode);

    return (
        <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-caption text-gray-500">
                Shows a product page&apos;s courses here and sends each click straight into that
                page&apos;s cart. The course list, prices and images are read live from the product
                page — edit them there, not here.
            </div>

            <div>
                <Label className="text-xs">Product page</Label>
                <select
                    className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
                    value={props.productPageCode || ''}
                    onChange={(e) => {
                        const page = (pages || []).find((p: any) => p.code === e.target.value);
                        updateComponent(pageId, component.id, {
                            props: {
                                ...props,
                                productPageCode: e.target.value,
                                productPageName: page?.name || '',
                            },
                        });
                    }}
                >
                    <option value="">{isLoading ? 'Loading product pages…' : 'Select a product page'}</option>
                    {(pages || []).map((p: any) => (
                        <option key={p.id} value={p.code}>
                            {p.name}{p.status !== 'ACTIVE' ? ` (${p.status})` : ''}
                        </option>
                    ))}
                </select>
                {selected && selected.status !== 'ACTIVE' && (
                    <p className="mt-1 text-caption text-warning-600">
                        This page is {selected.status} — set it ACTIVE or the section stays hidden to visitors.
                    </p>
                )}
                {selected && (
                    <p className="mt-1 text-caption text-gray-400">
                        {selected.mappings?.filter((m: any) => (m.status ?? 'ACTIVE') === 'ACTIVE').length ?? 0}{' '}
                        course(s) will render.
                    </p>
                )}
                {!isLoading && (pages || []).length === 0 && (
                    <p className="mt-1 text-caption text-gray-400">
                        No product pages yet — create one under Manage Pages &gt; Product Pages.
                    </p>
                )}
            </div>

            <div>
                <Label className="text-xs">Title</Label>
                <Input className="mt-1" value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} placeholder="Our Programs" />
            </div>
            <div>
                <Label className="text-xs">Subtitle</Label>
                <Textarea className="mt-1" rows={2} value={props.subtitle || ''} onChange={(e) => updateProp('subtitle', e.target.value)} placeholder="Pick a program and enrol in minutes." />
            </div>
            <div>
                <Label className="text-xs">Button label</Label>
                <Input className="mt-1" value={props.ctaLabel || ''} onChange={(e) => updateProp('ctaLabel', e.target.value)} placeholder="Enrol now" />
            </div>

            <div className="flex items-center justify-between">
                <Label className="text-xs">“View course” button on each card</Label>
                <Switch
                    checked={props.showViewCourse !== false}
                    onCheckedChange={(c) => updateProp('showViewCourse', c)}
                />
            </div>
            {props.showViewCourse !== false && (
                <div>
                    <Label className="text-xs">“View course” label</Label>
                    <Input className="mt-1" value={props.viewCourseLabel || ''} onChange={(e) => updateProp('viewCourseLabel', e.target.value)} placeholder="View course" />
                    <p className="mt-1 text-caption text-gray-400">
                        Opens the course details page; enrolling from there returns to this
                        product page&apos;s checkout.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs">Header alignment</Label>
                    <div className="mt-1 flex gap-1">
                        {([
                            ['left', 'Left'],
                            ['center', 'Center'],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => updateProp('align', value)}
                                className={`rounded px-2.5 py-1 text-caption font-medium ${(props.align || 'center') === value ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Header size</Label>
                    <div className="mt-1 flex gap-1">
                        {([
                            ['md', 'Compact'],
                            ['lg', 'Large'],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => updateProp('headerScale', value)}
                                className={`rounded px-2.5 py-1 text-caption font-medium ${(props.headerScale || 'lg') === value ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <Label className="text-xs">“See all” link to the product page</Label>
                <Switch checked={!!props.showViewAll} onCheckedChange={(c) => updateProp('showViewAll', c)} />
            </div>
            {props.showViewAll && (
                <div>
                    <Label className="text-xs">Link label</Label>
                    <Input className="mt-1" value={props.viewAllLabel || ''} onChange={(e) => updateProp('viewAllLabel', e.target.value)} placeholder="See all" />
                </div>
            )}

            <div>
                <Label className="text-xs">Layout</Label>
                <div className="mt-1 grid grid-cols-2 gap-1">
                    {([
                        ['grid', 'Grid', 'Wraps onto rows'],
                        ['carousel', 'Horizontal', 'One swipeable row'],
                    ] as const).map(([value, label, hint]) => (
                        <button
                            key={value}
                            onClick={() => updateProp('layout', value)}
                            title={hint}
                            className={`rounded px-2 py-1.5 text-caption font-medium ${(props.layout || 'grid') === value ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {(props.layout || 'grid') === 'carousel' && (
                    <p className="mt-1 text-caption text-gray-400">
                        Cards sit in one row that visitors swipe or scroll sideways; arrows appear
                        when there is more to see. Columns sets how many are visible at once.
                    </p>
                )}
            </div>

            <div>
                <Label className="text-xs">Columns{(props.layout || 'grid') === 'carousel' ? ' visible' : ''}</Label>
                <div className="mt-1 flex gap-1">
                    {[2, 3, 4].map((c) => (
                        <button key={c} onClick={() => updateProp('columns', c)}
                            className={`rounded px-3 py-1 text-caption font-medium ${(props.columns || 3) === c ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
                    ))}
                </div>
            </div>

            <div className="space-y-3 rounded border border-dashed border-gray-200 p-2">
                <p className="text-caption font-medium text-gray-500">Browsing</p>

                <div>
                    <Label className="text-xs">Courses per page</Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {[6, 9, 12, 24, 0].map((n) => (
                            <button
                                key={n}
                                onClick={() => updateProp('pageSize', n)}
                                className={`rounded px-2.5 py-1 text-caption font-medium ${(props.pageSize ?? 9) === n ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {n === 0 ? 'All' : n}
                            </button>
                        ))}
                    </div>
                    <p className="mt-1 text-caption text-gray-400">
                        {(props.pageSize ?? 9) === 0
                            ? 'Every course renders in one long grid — only sensible for short lists.'
                            : 'Visitors page through the list; the canvas shows the first page.'}
                    </p>
                </div>

                {(props.layout || 'grid') === 'carousel' && (props.pageSize ?? 9) === 0 && (
                    <div>
                        <Label className="text-xs">Cards in the row</Label>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {[8, 12, 20, 0].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => updateProp('railMaxCards', n)}
                                    className={`rounded px-2.5 py-1 text-caption font-medium ${(props.railMaxCards ?? 12) === n ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}
                                >
                                    {n === 0 ? 'All' : n}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-caption text-gray-400">
                            {(props.railMaxCards ?? 12) === 0
                                ? 'Every course sits in one row — a long product page makes that row very long.'
                                : 'The row stops here and ends with a card linking to the full product page.'}
                        </p>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <Label className="text-xs">Search box</Label>
                    <Switch checked={props.showSearch !== false} onCheckedChange={(c) => updateProp('showSearch', c)} />
                </div>
                <p className="-mt-1 text-caption text-gray-400">
                    Shown only when the product page has 8+ courses.
                </p>

                {/* Vertical scroll is a grid-only concern — a carousel already
                    scrolls, sideways. */}
                {(props.layout || 'grid') !== 'carousel' && (
                    <>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Scroll inside the section</Label>
                            <Switch checked={!!props.scrollable} onCheckedChange={(c) => updateProp('scrollable', c)} />
                        </div>
                        {props.scrollable && (
                            <div>
                                <Label className="text-xs">Max height (px)</Label>
                                <Input
                                    className="mt-1"
                                    type="number"
                                    min={240}
                                    step={40}
                                    value={props.scrollMaxHeight ?? 640}
                                    onChange={(e) => updateProp('scrollMaxHeight', Number(e.target.value) || 640)}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="space-y-2 rounded border border-dashed border-gray-200 p-2">
                <p className="text-caption font-medium text-gray-500">Show on each card</p>
                {([
                    ['showImage', 'Preview image'],
                    ['showChips', 'Level / session chips'],
                    ['showDescription', 'Short description'],
                    ['showValidity', 'Access period'],
                    ['showPrice', 'Price & discount'],
                ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                        <Label className="text-xs">{label}</Label>
                        <Switch checked={props[key] !== false} onCheckedChange={(c) => updateProp(key, c)} />
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Catalogue-side editor for `productCourseGrid`.
 *
 * This type is inherited from the product-pages designer, where the page itself
 * IS the product context. On a catalogue page there is no such context, so the
 * learner renderer aliases it to the full institute course catalog — which is
 * why it has no "product page" field and never could. Admins reasonably expect
 * one, so the editor says so plainly and offers a one-click switch to
 * `productPageOffer`, which is the product-page-scoped component.
 */
const ProductCourseGridEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const convertToOffer = () =>
        updateComponent(pageId, component.id, {
            type: 'productPageOffer',
            props: {
                ...(componentTemplates.productPageOffer?.props ?? {}),
                title: props.title || '',
                columns: props.columns ?? 3,
                showPrice: props.showPrice !== false,
            },
        });

    return (
        <div className="space-y-4">
            <div className="rounded border border-warning-200 bg-warning-50 p-2 text-caption text-warning-700">
                This block shows your <strong>entire course catalogue</strong> — it is not tied to a
                product page, so there is no product page to pick here. To show one product
                page&apos;s courses (and send clicks into its cart), switch to Product Page Offer.
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={convertToOffer}>
                Switch to Product Page Offer
            </Button>

            <div>
                <Label className="text-xs">Title</Label>
                <Input className="mt-1" value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} placeholder="All Courses" />
            </div>

            <div>
                <Label className="text-xs">Columns</Label>
                <div className="mt-1 flex gap-1">
                    {[2, 3, 4].map((c) => (
                        <button key={c} onClick={() => updateProp('columns', c)}
                            className={`rounded px-3 py-1 text-caption font-medium ${(props.columns || 3) === c ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
                    ))}
                </div>
            </div>

            <div className="space-y-2 rounded border border-dashed border-gray-200 p-2">
                {([
                    ['showFilters', 'Filters sidebar'],
                    ['showPrice', 'Price'],
                    ['showBadge', 'Badges'],
                ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                        <Label className="text-xs">{label}</Label>
                        <Switch checked={props[key] !== false} onCheckedChange={(c) => updateProp(key, c)} />
                    </div>
                ))}
            </div>
        </div>
    );
};

const HtmlBlockEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-caption text-gray-500">
                Custom section — rendered sandboxed (no scripts). Style it with the CSS field
                below using theme variables like <code>var(--primary-500)</code>,{' '}
                <code>var(--catalogue-text-primary)</code> and{' '}
                <code>var(--catalogue-heading-font)</code> so it follows your site theme.
            </div>
            {props.prompt && (
                <div>
                    <Label className="text-xs">AI section brief</Label>
                    <p className="mt-1 rounded border border-gray-200 bg-white p-2 text-caption text-gray-600">
                        {props.prompt}
                    </p>
                    <p className="mt-1 text-caption text-gray-400">
                        Tip: ask the AI copilot to “redesign this section” — it uses this brief.
                    </p>
                </div>
            )}
            <div>
                <Label className="text-xs">HTML</Label>
                <Textarea
                    value={props.html || ''}
                    onChange={(e) => updateProp('html', e.target.value)}
                    rows={10}
                    className="mt-1 font-mono text-caption"
                    placeholder="<section class='my-band'>…</section>"
                />
            </div>
            <div>
                <Label className="text-xs">CSS (scoped to this section)</Label>
                <Textarea
                    value={props.css || ''}
                    onChange={(e) => updateProp('css', e.target.value)}
                    rows={8}
                    className="mt-1 font-mono text-caption"
                    placeholder=".my-band { background: var(--primary-50); }"
                />
            </div>
        </div>
    );
};

const SpacerEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-xs">Height</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                    {['16px', '24px', '32px', '48px', '64px', '80px', '120px'].map((v) => (
                        <button key={v} onClick={() => updateProp('height', v)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.height === v ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v}</button>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between">
                <Label className="text-xs">Show Divider</Label>
                <Switch checked={props.showDivider || false} onCheckedChange={(c) => updateProp('showDivider', c)} />
            </div>
            {props.showDivider && (
                <>
                    <div>
                        <Label className="text-xs">Divider Style</Label>
                        <div className="flex gap-1 mt-1">
                            {['solid', 'dashed', 'dotted'].map((s) => (
                                <button key={s} onClick={() => updateProp('dividerStyle', s)}
                                    className={`rounded px-2 py-1 text-caption font-medium capitalize ${props.dividerStyle === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
                            ))}
                        </div>
                    </div>
                    <ColorPickerField label="Divider Color" value={props.dividerColor || '#E5E7EB' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('dividerColor', c)} />
                    <div>
                        <Label className="text-xs">Divider Width</Label>
                        <div className="flex gap-1 mt-1">
                            {['1px', '2px', '3px', '4px'].map((w) => (
                                <button key={w} onClick={() => updateProp('dividerWidth', w)}
                                    className={`rounded px-2 py-1 text-caption font-medium ${props.dividerWidth === w ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{w}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Max Width</Label>
                        <div className="flex gap-1 mt-1">
                            {['40%', '60%', '80%', '100%'].map((w) => (
                                <button key={w} onClick={() => updateProp('maxWidth', w)}
                                    className={`rounded px-2 py-1 text-caption font-medium ${props.maxWidth === w ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{w}</button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

/* ─── Tabs / Accordion Editor ──────────────────────────────────────────── */
const TabsAccordionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const items = props.items || [];
    const [expandedItem, setExpandedItem] = useState<number | null>(null);

    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addItem = () => updateProp('items', [...items, { title: `Item ${items.length + 1}`, content: '<p>New content</p>' }]);
    const deleteItem = (i: number) => { updateProp('items', items.filter((_: any, idx: number) => idx !== i)); if (expandedItem === i) setExpandedItem(null); };
    const updateItem = (i: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[i] = { ...newItems[i], [field]: value };
        updateProp('items', newItems);
    };

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-xs">Mode</Label>
                <div className="flex gap-1 mt-1">
                    {['tabs', 'accordion'].map((m) => (
                        <button key={m} onClick={() => updateProp('mode', m)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.mode === m ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{m}</button>
                    ))}
                </div>
            </div>
            {props.mode === 'accordion' && (
                <>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Allow Multiple Open</Label>
                        <Switch checked={props.allowMultiple || false} onCheckedChange={(c) => updateProp('allowMultiple', c)} />
                    </div>
                    <div>
                        <Label className="text-xs">Accordion Style</Label>
                        <div className="flex gap-1 mt-1">
                            {[
                                { key: 'plain', label: 'Plain' },
                                { key: 'boxed', label: 'Boxed' },
                                { key: 'split', label: 'Split + Panel' },
                            ].map((v) => (
                                <button key={v.key} onClick={() => updateProp('variant', v.key)}
                                    className={`rounded px-3 py-1 text-caption font-medium ${(props.variant || 'plain') === v.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{v.label}</button>
                            ))}
                        </div>
                        {(props.variant || 'plain') === 'split' && (
                            <p className="mt-1 text-caption text-gray-400">
                                Split shows the open item's panel on the right (desktop). Panels
                                can hold nested components via JSON/templates; rich text renders otherwise.
                            </p>
                        )}
                    </div>
                </>
            )}
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Items ({items.length})</Label>
                    <Button variant="ghost" size="sm" onClick={addItem} className="h-6 text-xs"><Plus className="size-3 mr-1" /> Add</Button>
                </div>
                <div className="space-y-2">
                    {items.map((item: any, i: number) => (
                        <div key={i} className="rounded border bg-gray-50 p-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <button onClick={() => setExpandedItem(expandedItem === i ? null : i)} className="text-xs font-medium text-left flex-1">
                                    {item.title || `Item ${i + 1}`}
                                </button>
                                <Button variant="ghost" size="sm" onClick={() => deleteItem(i)} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                            </div>
                            {expandedItem === i && (
                                <div className="space-y-2">
                                    <Input value={item.title || ''} onChange={(e) => updateItem(i, 'title', e.target.value)} placeholder="Title" />
                                    <div className="flex gap-2">
                                        <Input className="flex-1" value={item.icon || ''} onChange={(e) => updateItem(i, 'icon', e.target.value)} placeholder="Icon (emoji or e.g. Rocket)" />
                                        <Input className="flex-1" value={item.meta || ''} onChange={(e) => updateItem(i, 'meta', e.target.value)} placeholder="Meta (e.g. 6 lessons)" />
                                    </div>
                                    <RichTextField label="Content" value={item.content || ''} onChange={(html) => updateItem(i, 'content', html)} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Trust Chip Editor ────────────────────────────────────────────────── */
const TrustChipEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    const avatars: string[] = props.avatars || [];

    return (
        <div className="space-y-4">
            <Input
                value={props.text || ''}
                onChange={(e) => updateProp('text', e.target.value)}
                placeholder='e.g. "Trusted by 10,000+ learners"'
            />
            <div className="flex items-center gap-3">
                <Label className="text-xs">Rating (0 = off)</Label>
                <Input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    className="w-24"
                    value={props.rating ?? 0}
                    onChange={(e) => {
                        const r = Math.min(5, Math.max(0, Number(e.target.value) || 0));
                        updateProp('rating', r > 0 ? r : undefined);
                    }}
                />
            </div>
            <div>
                <Label className="text-xs">Alignment</Label>
                <div className="flex gap-1 mt-1">
                    {['left', 'center', 'right'].map((a) => (
                        <button key={a} onClick={() => updateProp('alignment', a)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${(props.alignment || 'center') === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                    ))}
                </div>
            </div>
            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Avatars ({avatars.length}/4)</Label>
                    <Button variant="ghost" size="sm" disabled={avatars.length >= 4} onClick={() => updateProp('avatars', [...avatars, ''])} className="h-6 text-xs"><Plus className="size-3 mr-1" /> Add</Button>
                </div>
                <div className="space-y-2">
                    {avatars.map((src: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="flex-1">
                                <ImageUploadField label="" value={src} onChange={(url) => {
                                    const next = [...avatars];
                                    next[i] = url;
                                    updateProp('avatars', next);
                                }} />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => updateProp('avatars', avatars.filter((_: string, j: number) => j !== i))} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Section Heading Editor ───────────────────────────────────────────── */
const SectionHeadingEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-xs">Eyebrow (small label above the title)</Label>
                <Input value={props.eyebrow || ''} onChange={(e) => updateProp('eyebrow', e.target.value || undefined)} placeholder="e.g. Why choose us" />
            </div>
            <div>
                <Label className="text-xs">Title</Label>
                <Input value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} placeholder="Section title" />
            </div>
            <div className="rounded border bg-gray-50 p-3 space-y-2">
                <Label className="text-xs font-medium">Highlight a phrase</Label>
                <Input
                    value={props.highlight?.text || ''}
                    onChange={(e) =>
                        updateProp(
                            'highlight',
                            e.target.value
                                ? { ...(props.highlight || {}), text: e.target.value, style: props.highlight?.style || 'gradient' }
                                : undefined,
                        )
                    }
                    placeholder="Exact words from the title"
                />
                {props.highlight?.text && (
                    <div className="flex gap-1">
                        {['gradient', 'underline', 'mark'].map((s) => (
                            <button
                                key={s}
                                onClick={() => updateProp('highlight', { ...props.highlight, style: s })}
                                className={`rounded px-3 py-1 text-caption font-medium capitalize ${(props.highlight?.style || 'gradient') === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                {props.highlight?.text && !(typeof props.title === 'string' && props.title.includes(props.highlight.text)) && (
                    <p className="text-caption text-warning-600">Not found in the title — the highlight will not show.</p>
                )}
            </div>
            <div>
                <Label className="text-xs">Lead (supporting line)</Label>
                <Textarea value={props.lead || ''} onChange={(e) => updateProp('lead', e.target.value || undefined)} rows={2} placeholder="One-sentence supporting copy under the title" />
            </div>
            <div>
                <Label className="text-xs">Alignment</Label>
                <div className="flex gap-1 mt-1">
                    {['center', 'left'].map((a) => (
                        <button key={a} onClick={() => updateProp('align', a === 'center' ? undefined : a)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${(props.align || 'center') === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Size</Label>
                <div className="flex gap-1 mt-1">
                    {['md', 'lg', 'xl'].map((s) => (
                        <button key={s} onClick={() => updateProp('size', s === 'lg' ? undefined : s)}
                            className={`rounded px-3 py-1 text-caption font-medium uppercase ${(props.size || 'lg') === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Logo Cloud Editor ────────────────────────────────────────────────── */
const LogoCloudEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const logos = props.logos || [];

    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addLogo = () => updateProp('logos', [...logos, { image: '', alt: `Logo ${logos.length + 1}`, url: '' }]);
    const deleteLogo = (i: number) => updateProp('logos', logos.filter((_: any, idx: number) => idx !== i));
    const updateLogo = (i: number, field: string, value: any) => {
        const newLogos = [...logos];
        newLogos[i] = { ...newLogos[i], [field]: value };
        updateProp('logos', newLogos);
    };

    return (
        <div className="space-y-4">
            <Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} placeholder="Header text" />
            <Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} placeholder="Subheading" />
            <div>
                <Label className="text-xs">Layout</Label>
                <div className="flex gap-1 mt-1">
                    {['grid', 'marquee'].map((l) => (
                        <button key={l} onClick={() => updateProp('layout', l)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.layout === l ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Columns</Label>
                <div className="flex gap-1 mt-1">
                    {[3, 4, 5, 6].map((c) => (
                        <button key={c} onClick={() => updateProp('columns', c)}
                            className={`rounded px-3 py-1 text-caption font-medium ${props.columns === c ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between">
                <Label className="text-xs">Grayscale</Label>
                <Switch checked={props.grayscale !== false} onCheckedChange={(c) => updateProp('grayscale', c)} />
            </div>
            <div>
                <Label className="text-xs">Display</Label>
                <div className="flex gap-1 mt-1">
                    {[
                        { key: 'logo', label: 'Logo' },
                        { key: 'logo+label', label: 'Logo + Label' },
                        { key: 'label-pill', label: 'Label Pills' },
                    ].map((d) => (
                        <button key={d.key} onClick={() => updateProp('display', d.key)}
                            className={`rounded px-3 py-1 text-caption font-medium ${(props.display || 'logo') === d.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{d.label}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Tile</Label>
                <div className="flex gap-1 mt-1">
                    {['none', 'card', 'pill'].map((t) => (
                        <button key={t} onClick={() => updateProp('tile', t)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${(props.tile || 'none') === t ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{t}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Logo Height</Label>
                <div className="flex gap-1 mt-1">
                    {['sm', 'md', 'lg'].map((h) => (
                        <button key={h} onClick={() => updateProp('logoHeight', h)}
                            className={`rounded px-3 py-1 text-caption font-medium uppercase ${(props.logoHeight || 'md') === h ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{h}</button>
                    ))}
                </div>
            </div>
            {props.layout === 'marquee' && (
                <div>
                    <Label className="text-xs">Marquee Speed</Label>
                    <div className="flex gap-1 mt-1">
                        {['slow', 'medium', 'fast'].map((sp) => (
                            <button key={sp} onClick={() => updateProp('marqueeSpeed', sp)}
                                className={`rounded px-3 py-1 text-caption font-medium capitalize ${(props.marqueeSpeed || 'medium') === sp ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{sp}</button>
                        ))}
                    </div>
                </div>
            )}
            {props.display === 'label-pill' ? (
                // Text ticker (no images) — fast add/edit of sliding points.
                <div>
                    <Label className="text-xs font-medium">Ticker items ({logos.length})</Label>
                    <p className="mb-1 text-caption text-gray-400">One announcement per line — these scroll across the band.</p>
                    <ListField
                        value={logos.map((l: any) => l.label).filter((s: any) => s != null)}
                        onCommit={(items) => updateProp('logos', items.map((label: string) => ({ label })))}
                        separator="newline"
                        placeholder={'e.g.\nGATE 2026 batches open\nISRO/BARC post-GATE batches\n30,000+ students trained'}
                        rows={5}
                    />
                </div>
            ) : (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium">Logos ({logos.length})</Label>
                        <Button variant="ghost" size="sm" onClick={addLogo} className="h-6 text-xs"><Plus className="size-3 mr-1" /> Add</Button>
                    </div>
                    <div className="space-y-2">
                        {logos.map((logo: any, i: number) => (
                            <div key={i} className="rounded border bg-gray-50 p-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">Logo {i + 1}</span>
                                    <Button variant="ghost" size="sm" onClick={() => deleteLogo(i)} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                                </div>
                                <ImageUploadField label="Image" value={logo.image || ''} onChange={(url) => updateLogo(i, 'image', url)} aiKind="logo" />
                                <Input placeholder="Alt text" value={logo.alt || ''} onChange={(e) => updateLogo(i, 'alt', e.target.value)} />
                                <Input placeholder="Label (company name, shown in labeled modes)" value={logo.label || ''} onChange={(e) => updateLogo(i, 'label', e.target.value)} />
                                <Input placeholder="Link URL (optional)" value={logo.url || ''} onChange={(e) => updateLogo(i, 'url', e.target.value)} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─── Map Embed Editor ─────────────────────────────────────────────────── */
const MapEmbedEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-xs">Title</Label>
                <Input value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} placeholder="Our Location" />
            </div>
            <div>
                <Label className="text-xs">Google Maps Embed URL</Label>
                <Textarea value={props.embedUrl || ''} onChange={(e) => updateProp('embedUrl', e.target.value)} placeholder="https://www.google.com/maps/embed?pb=..." rows={3} />
            </div>
            <div>
                <Label className="text-xs">Height</Label>
                <div className="flex gap-1 mt-1">
                    {['300px', '400px', '500px', '600px'].map((h) => (
                        <button key={h} onClick={() => updateProp('height', h)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.height === h ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{h}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Border Radius</Label>
                <div className="flex gap-1 mt-1">
                    {['0', '4px', '8px', '16px', '24px'].map((r) => (
                        <button key={r} onClick={() => updateProp('borderRadius', r)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.borderRadius === r ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r || '0'}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Countdown Timer Editor ───────────────────────────────────────────── */
const CountdownTimerEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <div>
                <Label className="text-xs">Heading</Label>
                <Input value={props.heading || ''} onChange={(e) => updateProp('heading', e.target.value)} placeholder="Event Starts In" />
            </div>
            <div>
                <Label className="text-xs">Target Date</Label>
                <Input type="datetime-local" value={props.targetDate || ''} onChange={(e) => updateProp('targetDate', e.target.value)} />
            </div>
            <div>
                <Label className="text-xs">Expired Message</Label>
                <Input value={props.expiredMessage || ''} onChange={(e) => updateProp('expiredMessage', e.target.value)} placeholder="The event has started!" />
            </div>
            <div>
                <Label className="text-xs">Style</Label>
                <div className="flex gap-1 mt-1">
                    {['cards', 'minimal'].map((s) => (
                        <button key={s} onClick={() => updateProp('style', s)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.style === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
                    ))}
                </div>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#1E293B' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <ColorPickerField label="Text Color" value={props.textColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('textColor', c)} />
        </div>
    );
};

/* ─── Text Block Editor ────────────────────────────────────────────────── */
const TextBlockEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <RichTextField
                label="Content"
                value={props.content || ''}
                onChange={(html) => updateProp('content', html)}
            />
            <div>
                <Label className="text-xs">Max Width</Label>
                <div className="flex gap-1 mt-1">
                    {['600px', '800px', '1000px', '100%'].map((w) => (
                        <button key={w} onClick={() => updateProp('maxWidth', w)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.maxWidth === w ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{w}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Alignment</Label>
                <div className="flex gap-1 mt-1">
                    {['left', 'center', 'right'].map((a) => (
                        <button key={a} onClick={() => updateProp('alignment', a)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.alignment === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── List Field (raw-buffer editor for string[] props) ────────────────── */
/* Parsing on every keystroke resets the input to the normalized join — a
   trailing comma/newline/space gets stripped before the next item can be
   typed. Buffer the raw text locally and commit the parsed array on blur. */
const ListField = ({
    value,
    onCommit,
    separator,
    placeholder,
    rows,
}: {
    value: string[] | undefined;
    onCommit: (items: string[]) => void;
    separator: 'comma' | 'newline';
    placeholder?: string;
    rows?: number;
}) => {
    const sep = separator === 'comma' ? ', ' : '\n';
    const joined = (value || []).join(sep);
    const [raw, setRaw] = useState<string | null>(null);
    const commit = () => {
        const text = raw ?? joined;
        const items = text
            .split(separator === 'comma' ? ',' : '\n')
            .map((s) => s.trim())
            .filter(Boolean);
        onCommit(items);
        setRaw(null);
    };
    const shared = {
        value: raw ?? joined,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setRaw(e.target.value),
        onBlur: commit,
        placeholder,
    };
    return separator === 'comma' ? <Input {...shared} /> : <Textarea {...shared} rows={rows ?? 3} />;
};

/* ─── Feature Grid Editor ──────────────────────────────────────────────── */
/**
 * Editor for `detailBlocks`.
 *
 * A fully-populated block is ~1 title + 1 description + 6 items × 2 fields +
 * 4 specs × 2 fields, so eight programmes would be ~160 inputs. Items and specs
 * are therefore edited as BULK TEXT (one per line) and parsed, which is also how
 * an admin naturally has this content to hand — pasted from a prospectus.
 *
 * Without this editor the component would be permanently uneditable by a human:
 * GenericEditor only renders string/number/boolean props, so array props get no
 * UI at all.
 */
const DetailBlocksEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const blocks: any[] = Array.isArray(props.blocks) ? props.blocks : [];
    const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    const setBlocks = (next: any[]) => updateProp('blocks', next);
    const updateBlock = (i: number, key: string, value: any) =>
        setBlocks(blocks.map((b, idx) => (idx === i ? { ...b, [key]: value } : b)));

    const addBlock = () =>
        setBlocks([...blocks, { title: 'New Program', tag: '', description: '', items: [], specs: [] }]);
    const deleteBlock = (i: number) => {
        setBlocks(blocks.filter((_, idx) => idx !== i));
        if (expandedIdx === i) setExpandedIdx(null);
    };
    const moveBlock = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= blocks.length) return;
        const next = [...blocks];
        [next[i], next[j]] = [next[j], next[i]];
        setBlocks(next);
        setExpandedIdx(j);
    };

    // "Title — Description" per line. Accepts em dash, en dash or a pipe so a
    // paste from a doc or a spreadsheet both work.
    const itemsToText = (items: any[]) =>
        (items || []).map((it) => (it?.description ? `${it.title} — ${it.description}` : it?.title || '')).join('\n');
    const textToItems = (text: string) =>
        text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const m = line.match(/^(.*?)\s*[—–|]\s*(.*)$/);
                return m ? { title: m[1]!.trim(), description: m[2]!.trim() } : { title: line };
            });

    // "Label: Value" per line — split on the FIRST colon only, so values
    // containing colons survive.
    const specsToText = (specs: any[]) =>
        (specs || []).map((s) => `${s?.label || ''}: ${s?.value || ''}`).join('\n');
    const textToSpecs = (text: string) =>
        text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const idx = line.indexOf(':');
                return idx === -1
                    ? { label: line, value: '' }
                    : { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
            });

    const pill = (active: boolean) =>
        `rounded px-2.5 py-1 text-caption font-medium ${active ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`;

    return (
        <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-caption text-gray-500">
                One block per programme — a detail table plus a label/value spec strip. Built for
                reference pages, so it carries no price or enrol button by design.
            </div>

            <div>
                <Label className="text-xs">Section heading</Label>
                <Input className="mt-1" value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} placeholder="(optional)" />
            </div>
            <div>
                <Label className="text-xs">Section subheading</Label>
                <Textarea className="mt-1" rows={2} value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} placeholder="(optional)" />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs">Detail columns</Label>
                    <div className="mt-1 flex gap-1">
                        {[1, 2, 3].map((c) => (
                            <button key={c} onClick={() => updateProp('columns', c)} className={pill((props.columns ?? 3) === c)}>{c}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Spec columns</Label>
                    <div className="mt-1 flex gap-1">
                        {[2, 3, 4].map((c) => (
                            <button key={c} onClick={() => updateProp('specColumns', c)} className={pill((props.specColumns ?? 4) === c)}>{c}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Blocks ({blocks.length})</Label>
                    <Button variant="outline" size="sm" className="h-7 text-caption" onClick={addBlock}>+ Add block</Button>
                </div>

                {blocks.map((b, i) => (
                    <div key={i} className="rounded border border-gray-200">
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5">
                            <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} className="flex-1 truncate text-left text-xs font-medium">
                                {b?.title || `Block ${i + 1}`}
                            </button>
                            <Button variant="ghost" size="sm" className="size-6 p-0" disabled={i === 0} onClick={() => moveBlock(i, -1)} title="Move up">↑</Button>
                            <Button variant="ghost" size="sm" className="size-6 p-0" disabled={i === blocks.length - 1} onClick={() => moveBlock(i, 1)} title="Move down">↓</Button>
                            <Button variant="ghost" size="sm" className="size-6 p-0 text-danger-600" onClick={() => deleteBlock(i)} title="Delete">×</Button>
                        </div>

                        {expandedIdx === i && (
                            <div className="space-y-3 p-2">
                                <div>
                                    <Label className="text-xs">Title</Label>
                                    <Input className="mt-1" value={b?.title || ''} onChange={(e) => updateBlock(i, 'title', e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-xs">Tag / eyebrow</Label>
                                    <Input className="mt-1" value={b?.tag || ''} onChange={(e) => updateBlock(i, 'tag', e.target.value)} placeholder="Flagship Program" />
                                </div>
                                <div>
                                    <Label className="text-xs">Description</Label>
                                    <Textarea className="mt-1" rows={3} value={b?.description || ''} onChange={(e) => updateBlock(i, 'description', e.target.value)} />
                                </div>

                                <div>
                                    <Label className="text-xs">Header style</Label>
                                    <div className="mt-1 flex gap-1">
                                        {(['subtle', 'tint', 'solid'] as const).map((v) => (
                                            <button key={v} onClick={() => updateBlock(i, 'headerVariant', v)} className={pill((b?.headerVariant || 'subtle') === v)}>{v}</button>
                                        ))}
                                    </div>
                                    <p className="mt-1 text-caption text-gray-400">Give just one block “solid” so the flagship stands out.</p>
                                </div>

                                <div>
                                    <Label className="text-xs">Detail items — one per line, “Title — Description”</Label>
                                    <Textarea
                                        className="mt-1 font-mono text-caption"
                                        rows={6}
                                        value={itemsToText(b?.items)}
                                        onChange={(e) => updateBlock(i, 'items', textToItems(e.target.value))}
                                        placeholder={'Complete Syllabus Coverage — Every topic with structured notes\n200+ Test Series — Topic, subject and full-length mocks'}
                                    />
                                </div>

                                <div>
                                    <Label className="text-xs">Specs — one per line, “Label: Value”</Label>
                                    <Textarea
                                        className="mt-1 font-mono text-caption"
                                        rows={4}
                                        value={specsToText(b?.specs)}
                                        onChange={(e) => updateBlock(i, 'specs', textToSpecs(e.target.value))}
                                        placeholder={'Eligibility: Any engineering graduate\nMode: Classroom + online'}
                                    />
                                </div>

                                <div>
                                    <Label className="text-xs">Note strip</Label>
                                    <Textarea className="mt-1" rows={2} value={b?.note || ''} onChange={(e) => updateBlock(i, 'note', e.target.value)} placeholder="(optional)" />
                                    {b?.note && (
                                        <div className="mt-1 flex gap-1">
                                            {(['warn', 'info', 'plain'] as const).map((t) => (
                                                <button key={t} onClick={() => updateBlock(i, 'noteTone', t)} className={pill((b?.noteTone || 'warn') === t)}>{t}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label className="text-xs">Deep-link anchor</Label>
                                    <Input className="mt-1" value={b?.anchor || ''} onChange={(e) => updateBlock(i, 'anchor', e.target.value)} placeholder="auto from title" />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const FeatureGridEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const features = props.features || [];
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addFeature = () => updateProp('features', [...features, { icon: '⭐', title: 'New Feature', description: 'Description here' }]);
    const deleteFeature = (i: number) => { updateProp('features', features.filter((_: any, idx: number) => idx !== i)); if (expandedIdx === i) setExpandedIdx(null); };
    const updateFeature = (i: number, field: string, value: any) => {
        const updated = [...features];
        updated[i] = { ...updated[i], [field]: value };
        updateProp('features', updated);
    };

    return (
        <div className="space-y-4">
            <Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} placeholder="Header text" />
            <Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} placeholder="Subheading" />
            <div>
                <Label className="text-xs">Columns</Label>
                <div className="flex gap-1 mt-1">
                    {[2, 3, 4].map((c) => (
                        <button key={c} onClick={() => updateProp('columns', c)}
                            className={`rounded px-3 py-1 text-caption font-medium ${props.columns === c ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Style</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                    {['cards', 'minimal', 'bordered', 'glass', 'gradient-border', 'tinted', 'panel'].map((s) => (
                        <button key={s} onClick={() => updateProp('style', s)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.style === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s.replace('-', ' ')}</button>
                    ))}
                </div>
                {props.style === 'panel' && (
                    <p className="mt-1 text-caption text-gray-400">
                        Panel = tinted-header division cards. Per card, set a Badge and a Header
                        color/style below.
                    </p>
                )}
            </div>
            <div>
                <Label className="text-xs">Text Alignment</Label>
                <div className="flex gap-1 mt-1">
                    {['center', 'left'].map((a) => (
                        <button key={a} onClick={() => updateProp('align', a)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${(props.align || 'center') === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Icon Size</Label>
                <div className="flex gap-1 mt-1">
                    {['small', 'medium', 'large'].map((s) => (
                        <button key={s} onClick={() => updateProp('iconSize', s)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.iconSize === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
                    ))}
                </div>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Features ({features.length})</Label>
                    <Button variant="ghost" size="sm" onClick={addFeature} className="h-6 text-xs"><Plus className="size-3 mr-1" /> Add</Button>
                </div>
                <div className="space-y-2">
                    {features.map((f: any, i: number) => (
                        <div key={i} className="rounded border bg-gray-50 p-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} className="text-xs font-medium text-left flex-1 truncate">
                                    {f.icon} {f.title || `Feature ${i + 1}`}
                                </button>
                                <Button variant="ghost" size="sm" onClick={() => deleteFeature(i)} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                            </div>
                            {expandedIdx === i && (
                                <div className="space-y-2">
                                    <Input value={f.icon || ''} onChange={(e) => updateFeature(i, 'icon', e.target.value)} placeholder="Icon (emoji or text)" />
                                    <select
                                        className="w-full rounded border px-2 py-1.5 text-xs"
                                        value={f.iconName || ''}
                                        onChange={(e) => updateFeature(i, 'iconName', e.target.value || undefined)}
                                    >
                                        <option value="">Icon library: none (use emoji above)</option>
                                        {['GraduationCap','Rocket','Target','UsersThree','Code','Brain','Trophy','Lightbulb','ShieldCheck','ChartLineUp','Clock','Star','BookOpen','Certificate','ChatsCircle','Wrench','Sparkle','Medal','Briefcase','Globe'].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                    <Input value={f.title || ''} onChange={(e) => updateFeature(i, 'title', e.target.value)} placeholder="Title" />
                                    <Textarea value={f.description || ''} onChange={(e) => updateFeature(i, 'description', e.target.value)} placeholder="Description" rows={2} />
                                    {props.style === 'panel' && (
                                        <div className="space-y-2 rounded border border-dashed border-gray-200 p-2">
                                            <p className="text-caption font-medium text-gray-500">Panel header</p>
                                            <Input value={f.badge || ''} onChange={(e) => updateFeature(i, 'badge', e.target.value)} placeholder="Badge (e.g. Training Division)" />
                                            <div className="flex gap-1">
                                                {['tint', 'solid'].map((v) => (
                                                    <button key={v} onClick={() => updateFeature(i, 'headerVariant', v)}
                                                        className={`rounded px-3 py-1 text-caption font-medium capitalize ${(f.headerVariant || 'tint') === v && !f.headerColor ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{v}</button>
                                                ))}
                                            </div>
                                            <ColorPickerField label="Header color (optional override)" value={f.headerColor || ''} onChange={(c) => updateFeature(i, 'headerColor', c || undefined)} />
                                        </div>
                                    )}
                                    <ListField
                                        value={f.chips}
                                        onCommit={(items) => updateFeature(i, 'chips', items)}
                                        separator="comma"
                                        placeholder="Chips (comma-separated, e.g. Beginner, Live)"
                                    />
                                    <ListField
                                        value={f.bullets}
                                        onCommit={(items) => updateFeature(i, 'bullets', items)}
                                        separator="newline"
                                        placeholder="Checklist bullets (one per line)"
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <Input className="flex-1" value={f.link?.text || ''} onChange={(e) => updateFeature(i, 'link', { ...(f.link || {}), text: e.target.value })} placeholder="Link text" />
                                        <Input className="flex-1" value={f.link?.url || ''} onChange={(e) => updateFeature(i, 'link', { ...(f.link || {}), url: e.target.value })} placeholder="Link URL" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Image Block Editor ───────────────────────────────────────────────── */
const ImageBlockEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <ImageUploadField label="Image" value={props.src || ''} onChange={(url) => updateProp('src', url)} aiKind="image" />
            <Input value={props.alt || ''} onChange={(e) => updateProp('alt', e.target.value)} placeholder="Alt text" />
            <Input value={props.caption || ''} onChange={(e) => updateProp('caption', e.target.value)} placeholder="Caption (optional)" />
            <LinkPicker
                label="Link (optional)"
                value={props.linkUrl || ''}
                onChange={(v) => updateProp('linkUrl', v)}
                showTarget
                target={props.linkTarget}
                onTargetChange={(t) => updateProp('linkTarget', t)}
                placeholder="Link this image to a page or URL"
            />
            <div>
                <Label className="text-xs">Alignment</Label>
                <div className="flex gap-1 mt-1">
                    {['left', 'center', 'right'].map((a) => (
                        <button key={a} onClick={() => updateProp('alignment', a)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.alignment === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Max Width</Label>
                <div className="flex gap-1 mt-1">
                    {['300px', '500px', '800px', '100%'].map((w) => (
                        <button key={w} onClick={() => updateProp('maxWidth', w)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.maxWidth === w ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{w}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Border Radius</Label>
                <div className="flex gap-1 mt-1">
                    {['0', '4px', '8px', '16px', '9999px'].map((r) => (
                        <button key={r} onClick={() => updateProp('borderRadius', r)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.borderRadius === r ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r === '9999px' ? 'Full' : r}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Aspect Ratio</Label>
                <div className="flex gap-1 mt-1">
                    {['auto', '16/9', '4/3', '1/1', '3/4'].map((r) => (
                        <button key={r} onClick={() => updateProp('aspectRatio', r)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.aspectRatio === r ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Button Block Editor ──────────────────────────────────────────────── */
const ButtonBlockEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <Input value={props.text || ''} onChange={(e) => updateProp('text', e.target.value)} placeholder="Button text" />
            <div>
                <Label className="text-xs">On click</Label>
                <div className="mt-1 flex gap-1">
                    {([['link', 'Open a link'], ['openForm', 'Open form popup'], ['whatsapp', 'WhatsApp chat']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => updateProp('action', v)}
                            className={`rounded px-2.5 py-1 text-caption font-medium ${(props.action || 'link') === v ? 'bg-primary-100 text-primary-500' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                    ))}
                </div>
            </div>
            {(props.action || 'link') === 'whatsapp' ? (
                <>
                    <div>
                        <Label className="text-xs">WhatsApp number (with country code)</Label>
                        <Input className="mt-1" value={props.whatsappPhone || ''} onChange={(e) => updateProp('whatsappPhone', e.target.value)} placeholder="919895603342" />
                        <p className="mt-1 text-caption text-gray-400">Leave blank to use the site-wide number from Global Settings.</p>
                    </div>
                    <div>
                        <Label className="text-xs">Prefilled message</Label>
                        <Input className="mt-1" value={props.whatsappMessage || ''} onChange={(e) => updateProp('whatsappMessage', e.target.value)} placeholder="Hi! I'd like to know about…" />
                    </div>
                </>
            ) : (props.action || 'link') === 'openForm' ? (
                <>
                    <CampaignPicker
                        label="Form to open (campaign)"
                        allowEmpty={false}
                        value={props.audienceId || ''}
                        onChange={(id) => updateProp('audienceId', id)}
                    />
                    <div>
                        <Label className="text-xs">Popup title</Label>
                        <Input className="mt-1" value={props.formTitle || ''} onChange={(e) => updateProp('formTitle', e.target.value)} placeholder="Defaults to the button text" />
                    </div>
                </>
            ) : (
                <LinkPicker
                    label="Link Destination"
                    value={props.url || ''}
                    onChange={(v) => updateProp('url', v)}
                    showTarget
                    target={props.target}
                    onTargetChange={(t) => updateProp('target', t)}
                />
            )}
            <div>
                <Label className="text-xs">Variant</Label>
                <div className="flex gap-1 mt-1">
                    {['filled', 'outline', 'ghost'].map((v) => (
                        <button key={v} onClick={() => updateProp('variant', v)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.variant === v ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{v}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Size</Label>
                <div className="flex gap-1 mt-1">
                    {['small', 'medium', 'large'].map((s) => (
                        <button key={s} onClick={() => updateProp('size', s)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.size === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Alignment</Label>
                <div className="flex gap-1 mt-1">
                    {['left', 'center', 'right'].map((a) => (
                        <button key={a} onClick={() => updateProp('alignment', a)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.alignment === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{a}</button>
                    ))}
                </div>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#3B82F6' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <ColorPickerField label="Text Color" value={props.textColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('textColor', c)} />
            <div>
                <Label className="text-xs">Border Radius</Label>
                <div className="flex gap-1 mt-1">
                    {['4px', '8px', '12px', '9999px'].map((r) => (
                        <button key={r} onClick={() => updateProp('borderRadius', r)}
                            className={`rounded px-2 py-1 text-caption font-medium ${props.borderRadius === r ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{r === '9999px' ? 'Pill' : r}</button>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between">
                <Label className="text-xs">Full Width</Label>
                <Switch checked={props.fullWidth || false} onCheckedChange={(c) => updateProp('fullWidth', c)} />
            </div>
        </div>
    );
};

/* ─── Newsletter Signup Editor ─────────────────────────────────────────── */
const NewsletterSignupEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    return (
        <div className="space-y-4">
            <Input value={props.heading || ''} onChange={(e) => updateProp('heading', e.target.value)} placeholder="Heading" />
            <Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} placeholder="Subheading" />
            <Input value={props.placeholder || ''} onChange={(e) => updateProp('placeholder', e.target.value)} placeholder="Input placeholder" />
            <Input value={props.buttonText || ''} onChange={(e) => updateProp('buttonText', e.target.value)} placeholder="Button text" />
            <Input value={props.successMessage || ''} onChange={(e) => updateProp('successMessage', e.target.value)} placeholder="Success message" />
            <CampaignPicker
                value={props.audienceId || ''}
                onChange={(id, name) => updateComponent(pageId, component.id, { props: { ...props, audienceId: id, audienceName: name } })}
            />
            <div>
                <Label className="text-xs">Layout</Label>
                <div className="flex gap-1 mt-1">
                    {['inline', 'stacked'].map((l) => (
                        <button key={l} onClick={() => updateProp('layout', l)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.layout === l ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                    ))}
                </div>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#F8FAFC' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
        </div>
    );
};

/* ─── Steps / Process Editor ───────────────────────────────────────────── */
const StepsProcessEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const steps = props.steps || [];
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addStep = () => updateProp('steps', [...steps, { number: String(steps.length + 1), title: `Step ${steps.length + 1}`, description: 'Description here' }]);
    const deleteStep = (i: number) => { updateProp('steps', steps.filter((_: any, idx: number) => idx !== i)); if (expandedIdx === i) setExpandedIdx(null); };
    const updateStep = (i: number, field: string, value: any) => {
        const updated = [...steps];
        updated[i] = { ...updated[i], [field]: value };
        updateProp('steps', updated);
    };

    return (
        <div className="space-y-4">
            <Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} placeholder="Header text" />
            <Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} placeholder="Subheading" />
            <div>
                <Label className="text-xs">Layout</Label>
                <div className="flex gap-1 mt-1">
                    {['horizontal', 'vertical'].map((l) => (
                        <button key={l} onClick={() => updateProp('layout', l)}
                            className={`rounded px-3 py-1 text-caption font-medium capitalize ${props.layout === l ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
                    ))}
                </div>
            </div>
            <div>
                <Label className="text-xs">Variant</Label>
                <div className="flex gap-1 mt-1">
                    {[
                        { key: 'plain', label: 'Plain' },
                        { key: 'timeline-cards', label: 'Timeline Cards' },
                        { key: 'alternating', label: 'Alternating' },
                    ].map((v) => (
                        <button key={v.key} onClick={() => updateProp('variant', v.key)}
                            className={`rounded px-2 py-1 text-caption font-medium ${(props.variant || 'plain') === v.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{v.label}</button>
                    ))}
                </div>
            </div>
            {(props.variant || 'plain') !== 'plain' && (
                <>
                    <div>
                        <Label className="text-xs">Node Style</Label>
                        <div className="flex gap-1 mt-1">
                            {['number', 'icon', 'dot'].map((n) => (
                                <button key={n} onClick={() => updateProp('nodeStyle', n)}
                                    className={`rounded px-2 py-1 text-caption font-medium capitalize ${(props.nodeStyle || 'number') === n ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{n}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Gradient Rail</Label>
                        <Switch checked={props.connectorGradient || false} onCheckedChange={(c) => updateProp('connectorGradient', c)} />
                    </div>
                </>
            )}
            <div>
                <Label className="text-xs">Connector Style (plain variant)</Label>
                <div className="flex gap-1 mt-1">
                    {['line', 'dashed', 'dots', 'none'].map((s) => (
                        <button key={s} onClick={() => updateProp('connectorStyle', s)}
                            className={`rounded px-2 py-1 text-caption font-medium capitalize ${props.connectorStyle === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
                    ))}
                </div>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#FFFFFF' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('backgroundColor', c)} />
            <ColorPickerField label="Accent Color" value={props.accentColor || '#3B82F6' /* design-lint-ignore: page-builder default color */} onChange={(c) => updateProp('accentColor', c)} />
            <div>
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">Steps ({steps.length})</Label>
                    <Button variant="ghost" size="sm" onClick={addStep} className="h-6 text-xs"><Plus className="size-3 mr-1" /> Add</Button>
                </div>
                <div className="space-y-2">
                    {steps.map((step: any, i: number) => (
                        <div key={i} className="rounded border bg-gray-50 p-2 space-y-2">
                            <div className="flex items-center justify-between">
                                <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} className="text-xs font-medium text-left flex-1 truncate">
                                    {step.number || i + 1}. {step.title || `Step ${i + 1}`}
                                </button>
                                <Button variant="ghost" size="sm" onClick={() => deleteStep(i)} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                            </div>
                            {expandedIdx === i && (
                                <div className="space-y-2">
                                    <Input value={step.number || ''} onChange={(e) => updateStep(i, 'number', e.target.value)} placeholder="Step number/label" />
                                    <Input value={step.title || ''} onChange={(e) => updateStep(i, 'title', e.target.value)} placeholder="Title" />
                                    <Textarea value={step.description || ''} onChange={(e) => updateStep(i, 'description', e.target.value)} placeholder="Description" rows={2} />
                                    <Input value={step.meta || ''} onChange={(e) => updateStep(i, 'meta', e.target.value)} placeholder="Meta (e.g. Weeks 1-4)" />
                                    <ListField
                                        value={step.chips}
                                        onCommit={(items) => updateStep(i, 'chips', items)}
                                        separator="comma"
                                        placeholder="Chips (comma-separated)"
                                    />
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Highlight this step</Label>
                                        <Switch
                                            checked={step.state === 'highlight'}
                                            onCheckedChange={(c) => updateStep(i, 'state', c ? 'highlight' : undefined)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
