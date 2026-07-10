/**
 * CATALOGUE DECORATIONS — canonical, shared by BOTH apps.
 * ========================================================
 * Byte-identical copies live at:
 *   learner: frontend-learner-dashboard-app/src/routes/$tagName/-utils/catalogue-decorations.tsx
 *   admin:   frontend-admin-dashboard/src/routes/manage-pages/-utils/catalogue-decorations.tsx
 *
 * Edit ONE copy, then run `node scripts/check-style-engine-sync.mjs --fix`.
 * MUST stay self-contained (react-only imports) — the two apps have different
 * alias setups and the style-engine file has a different NAME per app, so
 * this file cannot import from either.
 *
 * Ornaments = ambient decorative shapes (blobs, glow orbs, dot grids…)
 * painted behind section content. Dividers = shaped SVG edges (wave/angle/
 * curve) that blend a section into its neighbours. Both are rendered by the
 * component wrappers inside a positioned, overflow-clipped node at z:0 with
 * content lifted to z:1 — they can never intercept clicks (pointer-events
 * none, aria-hidden).
 */
import React from 'react';

/* ─── Types (imported by the style engine for ComponentStyle) ──────────── */

export interface OrnamentConfig {
    preset: 'blob' | 'ring' | 'dots' | 'grid' | 'glow-orb';
    /** CSS left/top of the ornament box, e.g. '72%' or '-40px'. */
    x?: string;
    y?: string;
    /** Box size (width = height), e.g. '320px' or '100%'. */
    size?: string;
    /** Any CSS color; defaults ride the active primary tokens. */
    color?: string;
    /** 0–1 (defaults are deliberately faint). */
    opacity?: number;
    /** Softening blur in px. */
    blur?: number;
}

export interface DividerConfig {
    shape: 'wave' | 'angle' | 'curve';
    /** Edge height in px (default 72). */
    height?: number;
    /** Mirror the shape horizontally. */
    flip?: boolean;
    /** Fill color — visually this is the ADJACENT section's background.
     *  Defaults to the page background token. */
    color?: string;
}

export interface SectionDividers {
    top?: DividerConfig;
    bottom?: DividerConfig;
}

export const hasDecorations = (
    ornaments?: OrnamentConfig[],
    dividers?: SectionDividers,
): boolean => !!(ornaments?.length || dividers?.top || dividers?.bottom);

/* ─── Ornament rendering ───────────────────────────────────────────────── */

const DEFAULT_ORNAMENT_COLOR = 'hsl(var(--primary-300))';

function ornamentStyle(o: OrnamentConfig): React.CSSProperties {
    const size = o.size ?? '280px';
    const color = o.color ?? DEFAULT_ORNAMENT_COLOR;
    const base: React.CSSProperties = {
        position: 'absolute',
        left: o.x ?? '70%',
        top: o.y ?? '8%',
        width: size,
        height: size,
        opacity: o.opacity ?? 0.4,
        filter: o.blur ? `blur(${o.blur}px)` : undefined,
        pointerEvents: 'none',
    };
    switch (o.preset) {
        case 'glow-orb':
            return { ...base, background: `radial-gradient(circle, ${color} 0%, transparent 70%)` };
        case 'blob':
            return { ...base, background: color, borderRadius: '42% 58% 62% 38% / 45% 42% 58% 55%' };
        case 'ring':
            return { ...base, border: `2px solid ${color}`, borderRadius: '50%' };
        case 'dots':
            return {
                ...base,
                backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.5px)`,
                backgroundSize: '18px 18px',
            };
        case 'grid':
            return {
                ...base,
                backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
            };
        default:
            return base;
    }
}

/* ─── Divider rendering ────────────────────────────────────────────────── */

/** Shapes drawn in a 1440×96 box with the FILL anchored to the bottom edge;
 *  the top divider reuses them rotated 180°. preserveAspectRatio="none"
 *  stretches them to any width/height. */
const DIVIDER_PATHS: Record<DividerConfig['shape'], string> = {
    wave: 'M0,64 C240,96 480,32 720,56 C960,80 1200,40 1440,72 L1440,96 L0,96 Z',
    angle: 'M0,96 L1440,32 L1440,96 Z',
    curve: 'M0,96 C480,24 960,24 1440,96 Z',
};

const DEFAULT_DIVIDER_COLOR = 'hsl(var(--catalogue-bg))';

const DividerEdge: React.FC<{ config: DividerConfig; edge: 'top' | 'bottom' }> = ({ config, edge }) => {
    const height = config.height ?? 72;
    const transforms: string[] = [];
    if (edge === 'top') transforms.push('rotate(180deg)');
    if (config.flip) transforms.push('scaleX(-1)');
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                [edge]: 0,
                height: `${height}px`,
                transform: transforms.length ? transforms.join(' ') : undefined,
                pointerEvents: 'none',
                lineHeight: 0,
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 1440 96"
                preserveAspectRatio="none"
                style={{ display: 'block' }}
            >
                <path d={DIVIDER_PATHS[config.shape]} fill={config.color ?? DEFAULT_DIVIDER_COLOR} />
            </svg>
        </div>
    );
};

/* ─── Combined layer ───────────────────────────────────────────────────── */

/**
 * Renders every configured decoration for one section. The PARENT must be
 * positioned (relative/sticky) and, when ornaments are present, should clip
 * overflow — the wrappers own that. Render this ABOVE any scrim/overlay div
 * and keep section content at z:1.
 */
export const SectionDecorations: React.FC<{
    ornaments?: OrnamentConfig[];
    dividers?: SectionDividers;
}> = ({ ornaments, dividers }) => {
    if (!hasDecorations(ornaments, dividers)) return null;
    return (
        <>
            {(ornaments || []).map((o, i) => (
                <div key={`orn-${i}`} aria-hidden="true" style={{ ...ornamentStyle(o), zIndex: 0 }} />
            ))}
            {dividers?.top && <DividerEdge config={dividers.top} edge="top" />}
            {dividers?.bottom && <DividerEdge config={dividers.bottom} edge="bottom" />}
        </>
    );
};

/* ─── Curated presets (editor pick-list; presets-first guardrail) ──────── */

export interface OrnamentPreset {
    id: string;
    label: string;
    ornaments: OrnamentConfig[];
}

export const ORNAMENT_PRESETS: OrnamentPreset[] = [
    {
        id: 'glow-tr',
        label: 'Glow · top right',
        ornaments: [{ preset: 'glow-orb', x: '68%', y: '-20%', size: '480px', opacity: 0.35, blur: 40 }],
    },
    {
        id: 'glow-duo',
        label: 'Glow · corners',
        ornaments: [
            { preset: 'glow-orb', x: '-12%', y: '-25%', size: '420px', opacity: 0.3, blur: 40 },
            { preset: 'glow-orb', x: '75%', y: '55%', size: '460px', opacity: 0.25, blur: 48, color: 'hsl(var(--primary-200))' },
        ],
    },
    {
        id: 'blob-left',
        label: 'Blob · left',
        ornaments: [{ preset: 'blob', x: '-8%', y: '18%', size: '340px', opacity: 0.22, blur: 32 }],
    },
    {
        id: 'dots-corner',
        label: 'Dot grid · corner',
        ornaments: [{ preset: 'dots', x: '3%', y: '10%', size: '220px', opacity: 0.35, color: 'hsl(var(--primary-400))' }],
    },
    {
        id: 'ring-tr',
        label: 'Ring · top right',
        ornaments: [
            { preset: 'ring', x: '82%', y: '-14%', size: '300px', opacity: 0.3 },
            { preset: 'ring', x: '87%', y: '-6%', size: '190px', opacity: 0.2 },
        ],
    },
    {
        id: 'grid-wash',
        label: 'Grid lines',
        ornaments: [{ preset: 'grid', x: '0', y: '0', size: '100%', opacity: 0.12, color: 'hsl(var(--primary-400))' }],
    },
];

export const DIVIDER_SHAPES: DividerConfig['shape'][] = ['wave', 'angle', 'curve'];
