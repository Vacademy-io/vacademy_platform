import type { CSSProperties } from 'react';

interface EntryBox {
    htmlStartX?: number;
    htmlStartY?: number;
    htmlEndX?: number;
    htmlEndY?: number;
}

const FULL_FRAME: CSSProperties = { left: 0, top: 0, width: '100%', height: '100%' };

/**
 * Where a timeline entry's layer sits on the canvas.
 *
 * Most AI videos are one full-frame shot at a time, but lesson videos stack
 * positioned layers (board above a caption band, teacher in a corner or side
 * panel). Drawing every layer full-frame let the caption band — the top
 * layer — paint over the whole video. Entries without usable coordinates, or
 * covering the whole canvas, keep the full-frame layout.
 */
export function entryBoxStyle(
    entry: EntryBox,
    canvasWidth: number,
    canvasHeight: number
): CSSProperties {
    const { htmlStartX: x0, htmlStartY: y0, htmlEndX: x1, htmlEndY: y1 } = entry;
    if (
        typeof x0 !== 'number' ||
        typeof y0 !== 'number' ||
        typeof x1 !== 'number' ||
        typeof y1 !== 'number' ||
        !Number.isFinite(x0 + y0 + x1 + y1) ||
        x1 <= x0 ||
        y1 <= y0 ||
        !(canvasWidth > 0) ||
        !(canvasHeight > 0)
    ) {
        return FULL_FRAME;
    }
    if (x0 <= 0 && y0 <= 0 && x1 >= canvasWidth && y1 >= canvasHeight) return FULL_FRAME;
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    return {
        left: pct(x0, canvasWidth),
        top: pct(y0, canvasHeight),
        width: pct(x1 - x0, canvasWidth),
        height: pct(y1 - y0, canvasHeight),
    };
}
