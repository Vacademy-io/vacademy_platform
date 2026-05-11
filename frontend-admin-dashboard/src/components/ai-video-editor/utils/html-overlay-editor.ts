/**
 * Combined-HTML overlay layer — inserts text/image/video as positioned children
 * of a single `.vx-overlay` container appended to the shot's body. The
 * container is `pointer-events:none` so it never steals clicks from the base
 * content; individual children can opt back into events if needed.
 *
 * Geometry is stored as percentages of the canvas so a shot renders
 * identically at 1080p preview and 4K export. Each overlay carries a stable
 * `data-vx-overlay-id` for deterministic lookup — we never rely on child
 * indices, so reordering doesn't corrupt edits.
 */

import { sanitizeMediaUrl } from './html-media-editor';

export type OverlayKind = 'text' | 'image' | 'video';

/** Alignment point on the overlay that the (left, top) coordinate refers to. */
export type Anchor = 'tl' | 'center' | 'br';

export interface OverlayBase {
    id: string;
    kind: OverlayKind;
    /** % of canvas width, 0–100 */
    left: number;
    /** % of canvas height, 0–100 */
    top: number;
    /** % of canvas width, 0–100; undefined = auto */
    width?: number;
    /** % of canvas height, 0–100; undefined = auto */
    height?: number;
    anchor: Anchor;
    rotation: number;
    opacity: number;
    /** Shot-local seconds. undefined = shown for whole shot. */
    appearAt?: number;
    disappearAt?: number;
}

export interface TextOverlay extends OverlayBase {
    kind: 'text';
    text: string;
    fontPx: number;
    color: string;
    weight: number;
    align: 'left' | 'center' | 'right';
}

export interface ImageOverlay extends OverlayBase {
    kind: 'image';
    src: string;
    objectFit: 'contain' | 'cover' | 'fill';
}

export interface VideoOverlay extends OverlayBase {
    kind: 'video';
    src: string;
    objectFit: 'contain' | 'cover' | 'fill';
    muted: boolean;
    loop: boolean;
}

export type Overlay = TextOverlay | ImageOverlay | VideoOverlay;

const OVERLAY_CONTAINER_CLASS = 'vx-overlay';
const OVERLAY_ATTR = 'data-vx-overlay-id';

// ── Serialization ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildTransformForAnchor(anchor: Anchor, rotation: number): string {
    const parts: string[] = [];
    if (anchor === 'center') parts.push('translate(-50%, -50%)');
    else if (anchor === 'br') parts.push('translate(-100%, -100%)');
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    return parts.join(' ');
}

function overlayPositionStyles(o: OverlayBase): string[] {
    const styles: string[] = ['position:absolute', `left:${o.left}%`, `top:${o.top}%`];
    if (o.width != null) styles.push(`width:${o.width}%`);
    if (o.height != null) styles.push(`height:${o.height}%`);
    const tf = buildTransformForAnchor(o.anchor, o.rotation);
    if (tf) styles.push(`transform:${tf}`);
    if (o.opacity !== 1) styles.push(`opacity:${o.opacity}`);
    return styles;
}

function buildOverlayEl(o: Overlay): string {
    const styles = overlayPositionStyles(o);
    const dataAttrs: string[] = [`${OVERLAY_ATTR}="${o.id}"`, `data-vx-kind="${o.kind}"`];
    if (o.appearAt != null) dataAttrs.push(`data-vx-t-in="${o.appearAt}"`);
    if (o.disappearAt != null) dataAttrs.push(`data-vx-t-out="${o.disappearAt}"`);

    if (o.kind === 'text') {
        styles.push(
            `font-size:${o.fontPx}px`,
            `color:${o.color}`,
            `font-weight:${o.weight}`,
            `text-align:${o.align}`,
            'line-height:1.2',
            'font-family:system-ui,sans-serif'
        );
        return `<div ${dataAttrs.join(' ')} style="${styles.join(';')}">${escapeHtml(o.text)}</div>`;
    }

    const safeSrc = sanitizeMediaUrl(o.src);
    if (!safeSrc) return '';
    // When height is auto (undefined), drop object-fit and let the inner
    // element size to its natural aspect ratio. object-fit only matters
    // when both dimensions are explicit and the container's aspect differs
    // from the content's.
    const innerStyle =
        o.height != null
            ? `width:100%;height:100%;object-fit:${o.objectFit};display:block`
            : `width:100%;height:auto;display:block`;

    if (o.kind === 'image') {
        return `<div ${dataAttrs.join(' ')} style="${styles.join(';')}"><img src="${escapeHtml(safeSrc)}" style="${innerStyle}" alt=""/></div>`;
    }
    // video
    const videoAttrs = ['autoplay', 'playsinline'];
    if (o.muted) videoAttrs.push('muted');
    if (o.loop) videoAttrs.push('loop');
    return `<div ${dataAttrs.join(' ')} style="${styles.join(';')}"><video src="${escapeHtml(safeSrc)}" ${videoAttrs.join(' ')} style="${innerStyle}"></video></div>`;
}

// ── Parsing ────────────────────────────────────────────────────────────────

function parseStyle(el: HTMLElement): Record<string, string> {
    const out: Record<string, string> = {};
    const decls = (el.getAttribute('style') ?? '').split(';');
    for (const d of decls) {
        const idx = d.indexOf(':');
        if (idx < 0) continue;
        const k = d.slice(0, idx).trim().toLowerCase();
        const v = d.slice(idx + 1).trim();
        if (k) out[k] = v;
    }
    return out;
}

/**
 * Parse a CSS length that may be expressed as a percentage *or* a pixel
 * value, and return the result as a percentage of `axisSizePx`. Used to
 * tolerate the px values written back by the canvas drag/resize handles
 * (which target a generic DOM path and can't know our overlay model is
 * stored in %). Returns `undefined` for anything we can't parse.
 */
function parsePercentOrPx(
    v: string | undefined,
    axisSizePx: number | undefined
): number | undefined {
    if (!v) return undefined;
    const pct = v.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (pct) return parseFloat(pct[1]!);
    if (axisSizePx == null || !Number.isFinite(axisSizePx) || axisSizePx <= 0) return undefined;
    const px = v.match(/^(-?\d+(?:\.\d+)?)px$/);
    if (px) return (parseFloat(px[1]!) / axisSizePx) * 100;
    return undefined;
}

function inferAnchor(transform: string): Anchor {
    if (/translate\(\s*-100%\s*,\s*-100%\s*\)/.test(transform)) return 'br';
    if (/translate\(\s*-50%\s*,\s*-50%\s*\)/.test(transform)) return 'center';
    return 'tl';
}

function parseRotation(transform: string): number {
    const m = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
    return m ? parseFloat(m[1]!) : 0;
}

function toOverlay(el: HTMLElement, canvas?: { w: number; h: number }): Overlay | null {
    const id = el.getAttribute(OVERLAY_ATTR);
    const kind = el.getAttribute('data-vx-kind') as OverlayKind | null;
    if (!id || !kind) return null;

    const style = parseStyle(el);
    // Tolerate px values for left/top/width/height — the canvas drag handles
    // commit pixel-valued patches via a generic patchNodeStyle path. We
    // normalize back to % so the overlay model stays resolution-independent.
    const left = parsePercentOrPx(style['left'], canvas?.w) ?? 0;
    const top = parsePercentOrPx(style['top'], canvas?.h) ?? 0;
    const width = parsePercentOrPx(style['width'], canvas?.w);
    const height = parsePercentOrPx(style['height'], canvas?.h);
    const transform = style['transform'] ?? '';
    const opacity = style['opacity'] ? parseFloat(style['opacity']!) : 1;
    const appearAt = el.getAttribute('data-vx-t-in');
    const disappearAt = el.getAttribute('data-vx-t-out');

    const base: OverlayBase = {
        id,
        kind,
        left,
        top,
        width,
        height,
        anchor: inferAnchor(transform),
        rotation: parseRotation(transform),
        opacity,
        appearAt: appearAt != null ? parseFloat(appearAt) : undefined,
        disappearAt: disappearAt != null ? parseFloat(disappearAt) : undefined,
    };

    if (kind === 'text') {
        const fontPx = style['font-size'] ? parseFloat(style['font-size']!.replace('px', '')) : 32;
        const weight = style['font-weight'] ? parseInt(style['font-weight']!, 10) : 400;
        const align = (style['text-align'] ?? 'center') as 'left' | 'center' | 'right';
        return {
            ...base,
            kind: 'text',
            text: el.textContent ?? '',
            fontPx: Number.isFinite(fontPx) ? fontPx : 32,
            color: style['color'] ?? '#ffffff',
            weight: Number.isFinite(weight) ? weight : 400,
            align,
        };
    }

    const media = el.querySelector(kind === 'image' ? 'img' : 'video') as HTMLElement | null;
    const src = media?.getAttribute('src') ?? '';
    const mediaStyle = media ? parseStyle(media) : {};
    const objectFit = (mediaStyle['object-fit'] ?? 'contain') as 'contain' | 'cover' | 'fill';

    if (kind === 'image') {
        return { ...base, kind: 'image', src, objectFit };
    }
    return {
        ...base,
        kind: 'video',
        src,
        objectFit,
        muted: media?.hasAttribute('muted') ?? true,
        loop: media?.hasAttribute('loop') ?? true,
    };
}

function getContainer(doc: Document, create: boolean): HTMLElement | null {
    let container = doc.body.querySelector(`.${OVERLAY_CONTAINER_CLASS}`) as HTMLElement | null;
    if (container || !create) return container;
    container = doc.createElement('div');
    container.className = OVERLAY_CONTAINER_CLASS;
    container.setAttribute('style', 'position:absolute;inset:0;z-index:500;pointer-events:none');
    doc.body.appendChild(container);
    return container;
}

function parseFragment(html: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, 'text/html');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function listOverlays(html: string, canvas?: { w: number; h: number }): Overlay[] {
    if (typeof window === 'undefined' || !html) return [];
    try {
        const doc = parseFragment(html);
        const container = getContainer(doc, false);
        if (!container) return [];
        const nodes = container.querySelectorAll(`[${OVERLAY_ATTR}]`);
        const out: Overlay[] = [];
        nodes.forEach((n) => {
            const o = toOverlay(n as HTMLElement, canvas);
            if (o) out.push(o);
        });
        return out;
    } catch {
        return [];
    }
}

/**
 * Resolve the path-from-body of the overlay element with the given id,
 * using the same visible-child indexing that html-tree.ts and
 * editor-iframe-agent.ts use. Returns `null` if the overlay is missing.
 *
 * Used to bridge an Overlays-tab selection into the store's
 * `selectedLayerPath`, which drives the canvas drag/resize handles.
 */
const PATH_IGNORED_TAGS = new Set(['script', 'style', 'link', 'meta']);

export function findOverlayPath(html: string, overlayId: string): number[] | null {
    if (typeof window === 'undefined' || !html) return null;
    try {
        const doc = parseFragment(html);
        const target = doc.body.querySelector(`[${OVERLAY_ATTR}="${overlayId}"]`);
        if (!target) return null;
        const path: number[] = [];
        let cur: Element | null = target;
        while (cur && cur !== doc.body) {
            const parent: Element | null = cur.parentElement;
            if (!parent) return null;
            const visible: Element[] = [];
            for (let i = 0; i < parent.children.length; i++) {
                const child = parent.children[i]!;
                if (!PATH_IGNORED_TAGS.has(child.tagName.toLowerCase())) visible.push(child);
            }
            const idx = visible.indexOf(cur);
            if (idx < 0) return null;
            path.unshift(idx);
            cur = parent;
        }
        return path;
    } catch {
        return null;
    }
}

export function upsertOverlay(html: string, overlay: Overlay): string {
    if (typeof window === 'undefined') return html;
    try {
        const doc = parseFragment(html);
        const container = getContainer(doc, true)!;
        const existing = container.querySelector(`[${OVERLAY_ATTR}="${overlay.id}"]`);
        const fragment = buildOverlayEl(overlay);
        if (!fragment) return html;
        const temp = doc.createElement('div');
        temp.innerHTML = fragment;
        const newNode = temp.firstElementChild;
        if (!newNode) return html;
        if (existing) {
            existing.replaceWith(newNode);
        } else {
            container.appendChild(newNode);
        }
        return doc.body.innerHTML;
    } catch {
        return html;
    }
}

export function deleteOverlay(html: string, overlayId: string): string {
    if (typeof window === 'undefined') return html;
    try {
        const doc = parseFragment(html);
        const container = getContainer(doc, false);
        if (!container) return html;
        const target = container.querySelector(`[${OVERLAY_ATTR}="${overlayId}"]`);
        target?.remove();
        // Clean up empty container so re-parses don't keep a stray div around.
        if (!container.firstElementChild) container.remove();
        return doc.body.innerHTML;
    } catch {
        return html;
    }
}

// ── Factory helpers ────────────────────────────────────────────────────────

export function newTextOverlay(text = 'Text'): TextOverlay {
    return {
        id: `ov-${crypto.randomUUID()}`,
        kind: 'text',
        left: 50,
        top: 50,
        width: 40,
        anchor: 'center',
        rotation: 0,
        opacity: 1,
        text,
        fontPx: 48,
        color: '#ffffff',
        weight: 600,
        align: 'center',
    };
}

export function newImageOverlay(src: string): ImageOverlay {
    return {
        id: `ov-${crypto.randomUUID()}`,
        kind: 'image',
        left: 50,
        top: 50,
        width: 30,
        // height intentionally undefined → image renders at natural aspect ratio.
        anchor: 'center',
        rotation: 0,
        opacity: 1,
        src,
        objectFit: 'contain',
    };
}

export function newVideoOverlay(src: string): VideoOverlay {
    return {
        id: `ov-${crypto.randomUUID()}`,
        kind: 'video',
        left: 50,
        top: 50,
        width: 40,
        // height intentionally undefined → video renders at natural aspect ratio.
        anchor: 'center',
        rotation: 0,
        opacity: 1,
        src,
        objectFit: 'cover',
        muted: true,
        loop: true,
    };
}
