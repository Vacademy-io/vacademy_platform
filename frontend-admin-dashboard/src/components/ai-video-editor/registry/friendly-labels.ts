/**
 * Friendly-labels registry.
 *
 * Single source of truth for every techy term shown in the AI video editor.
 * Maps HTML tags / CSS-derived kinds / branding-prefixed IDs to user-facing
 * labels so non-coders see "Container" instead of "div" and "Layer order"
 * instead of "z-index".
 *
 * Design rule: every control reachable in both viewModes. The registry
 * affects *presentation* (labels, icons, what's tucked under `Advanced ▾`),
 * not *capability*. A "advanced: true" entry means the row gets hidden from
 * the Layers tree in simple mode — but the underlying property is still
 * editable via the inspector's `Advanced ▾` disclosure.
 */

import {
    Box,
    Type,
    Image as ImageIcon,
    Film,
    Shapes,
    Heading1,
    Rows3,
    Columns3,
    Grid3x3,
    type LucideIcon,
} from 'lucide-react';
import type { Entry } from '@/components/ai-video-player/types';

// ── Node display metadata ──────────────────────────────────────────────────

export interface NodeDisplayMeta {
    /** User-facing label. Replaces the raw HTML tag in the Layers tree. */
    label: string;
    /** Lucide icon component for the row. */
    icon: LucideIcon;
    /** When true, this node row is filtered out of the Layers tree in simple
     *  viewMode. The user can still reach the underlying element via the
     *  Layers-tab Advanced section or by switching to developer mode. */
    advanced: boolean;
}

/** SVG filter primitive tags — hidden from the simple-mode tree because they
 *  only make sense to graphics-savvy users. The parent `svg` element still
 *  shows as "Graphic" so the overall structure is visible. */
const SVG_FILTER_TAGS = new Set([
    'defs',
    'filter',
    'feturbulence',
    'fedisplacementmap',
    'feoffset',
    'fegaussianblur',
    'fecomposite',
    'feblend',
    'fecolormatrix',
    'femorphology',
    'feflood',
    'femerge',
    'femergenode',
    'fespecularlighting',
    'fediffuselighting',
    'lineargradient',
    'radialgradient',
    'stop',
    'mask',
    'pattern',
    'clippath',
]);

/** Container layout inference. Reads computed/inline style props to pick the
 *  friendliest possible label for a div. */
function containerLabel(style: Record<string, string>): { label: string; icon: LucideIcon } {
    const display = (style.display ?? '').toLowerCase();
    const direction = (style['flex-direction'] ?? '').toLowerCase();
    if (display === 'flex') {
        if (direction.startsWith('column')) return { label: 'Vertical Layout', icon: Columns3 };
        return { label: 'Horizontal Layout', icon: Rows3 };
    }
    if (display === 'grid' || display === 'inline-grid') {
        return { label: 'Grid Layout', icon: Grid3x3 };
    }
    return { label: 'Container', icon: Box };
}

export interface InferInput {
    tag: string;
    /** Existing html-tree kind: text / image / video / svg / group / other. */
    kind: 'text' | 'image' | 'video' | 'svg' | 'group' | 'other';
    style: Record<string, string>;
}

/**
 * Resolve the friendly label, icon, and advanced-flag for a Layers-tree node.
 * Driven by tag first (so SVG filter primitives can be recognised), then
 * falls back to kind + inline style for layout inference.
 */
export function inferDisplayMeta(node: InferInput): NodeDisplayMeta {
    const tag = node.tag.toLowerCase();

    if (SVG_FILTER_TAGS.has(tag)) {
        // Capitalize the tag for the label so dev-mode users still get
        // something readable instead of the raw lowercase tag.
        return { label: prettifyTag(tag), icon: Box, advanced: true };
    }

    if (tag === 'svg' || node.kind === 'svg') {
        return { label: 'Graphic', icon: Shapes, advanced: false };
    }

    if (node.kind === 'image' || tag === 'img') {
        return { label: 'Image', icon: ImageIcon, advanced: false };
    }
    if (node.kind === 'video' || tag === 'video') {
        return { label: 'Video', icon: Film, advanced: false };
    }
    if (node.kind === 'text') {
        return { label: 'Text', icon: Type, advanced: false };
    }
    if (/^h[1-6]$/.test(tag)) {
        return { label: 'Heading', icon: Heading1, advanced: false };
    }
    if (tag === 'p' || tag === 'span') {
        return { label: 'Text', icon: Type, advanced: false };
    }

    if (node.kind === 'group') {
        const { label, icon } = containerLabel(node.style);
        return { label, icon, advanced: false };
    }

    return { label: 'Element', icon: Box, advanced: false };
}

function prettifyTag(tag: string): string {
    // 'feTurbulence' → 'Turbulence'; 'fedisplacementmap' → 'Displacement Map'.
    const stripped = tag.replace(/^fe/, '');
    return stripped
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

// ── Property-label table ───────────────────────────────────────────────────

export interface PropertyMeta {
    /** User-facing label. */
    label: string;
    /** When true, the property's editor is rendered inside `Advanced ▾`
     *  rather than as a primary control. */
    advanced: boolean;
}

/** Curated list. Anything not listed here falls back to a humanized version
 *  of the raw CSS prop name (e.g. `font-style` → `Font Style`). */
export const PROPERTY_META: Record<string, PropertyMeta> = {
    // Geometry — primary controls
    left: { label: 'X position', advanced: false },
    top: { label: 'Y position', advanced: false },
    width: { label: 'Width', advanced: false },
    height: { label: 'Height', advanced: false },
    opacity: { label: 'Opacity', advanced: false },
    // Typography
    'font-size': { label: 'Text size', advanced: false },
    color: { label: 'Color', advanced: false },
    'font-weight': { label: 'Text weight', advanced: false },
    'text-align': { label: 'Alignment', advanced: false },
    // Layer order — primary control replaces raw z-index
    'z-index': { label: 'Layer order', advanced: false },
    // Advanced — rendered inside `Advanced ▾` in simple mode
    transform: { label: 'Transform', advanced: true },
    filter: { label: 'Filter', advanced: true },
    'mix-blend-mode': { label: 'Blend mode', advanced: true },
    'background-image': { label: 'Background image', advanced: true },
    background: { label: 'Background', advanced: true },
    class: { label: 'CSS class', advanced: true },
    id: { label: 'CSS id', advanced: true },
};

export function propertyMeta(prop: string): PropertyMeta {
    return (
        PROPERTY_META[prop.toLowerCase()] ?? {
            label: prop.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            advanced: false,
        }
    );
}

// ── Channel labels ─────────────────────────────────────────────────────────

export const CHANNEL_DISPLAY_LABELS: Record<string, string> = {
    base: 'Main',
    overlay: 'On top',
    ui: 'Watermarks',
};

export function friendlyChannelLabel(id: string): string {
    return CHANNEL_DISPLAY_LABELS[id] ?? id;
}

// ── Entry display names ────────────────────────────────────────────────────

/**
 * Resolve the friendly display name for an entry. Precedence:
 *   1. User-set override (from store.displayNames[entryId])
 *   2. Branding-prefixed canonical names (Intro / Outro / Watermark)
 *   3. Overlay-prefixed (Image overlay / Video overlay / Text overlay,
 *      numbered by appearance)
 *   4. Derived `Scene N` numbering for everything else, skipping branding
 *      and overlay entries in the count so scene numbers line up with
 *      what the viewer sees.
 */
export function friendlyEntryName(
    entry: Entry,
    index: number,
    entries: Entry[],
    overrides: Record<string, string>
): string {
    const override = overrides[entry.id];
    if (override) return override;

    const id = entry.id;
    if (id === 'branding-intro') return 'Intro';
    if (id === 'branding-outro') return 'Outro';
    if (id.startsWith('branding-watermark')) return 'Watermark';
    if (id.startsWith('branding-')) return prettifyTag(id.replace('branding-', ''));

    if (id.startsWith('user-overlay-')) {
        const overlayIndex = entries
            .slice(0, index + 1)
            .filter((e) => e.id.startsWith('user-overlay-')).length;
        return `Overlay ${overlayIndex}`;
    }

    if (id.startsWith('segment-')) {
        const seg = id.replace('segment-', '');
        return `Segment ${seg}`;
    }

    const sceneIndex = entries
        .slice(0, index + 1)
        .filter((e) => !e.id.startsWith('branding-') && !e.id.startsWith('user-overlay-')).length;
    return `Scene ${sceneIndex}`;
}
