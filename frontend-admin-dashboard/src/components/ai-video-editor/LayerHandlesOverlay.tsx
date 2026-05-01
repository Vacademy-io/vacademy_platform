import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './stores/video-editor-store';
import { screenToCanvas } from './utils/coord-convert';
import { patchNodeStyle } from './utils/html-tree';

interface LayerHandlesOverlayProps {
    /** Scale factor: canvas-space (1920×1080) → screen pixels. */
    scale: number;
}

interface CanvasRect {
    /** Visual (post-transform) bounding rect — used for handle positioning. */
    left: number;
    top: number;
    width: number;
    height: number;
    /** Resolved CSS `left`/`top` in pixels (null if `auto`/static). Used as
     *  the source-of-truth for move commits — gsap/anime animate `transform`,
     *  which means writing position via transform gets clobbered on every
     *  iframe re-mount. Writing `left`/`top` instead is stable. */
    leftPx: number | null;
    topPx: number | null;
    /** Inline `transform` string at the moment we read the rect — captured so
     *  rotate composes with whatever the LLM authored. */
    transform: string;
}

type ResizeHandlePos = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type Handle = 'move' | 'rotate' | ResizeHandlePos;

/**
 * Screen-space drag/resize/rotate handles for the layer at `selectedLayerPath`
 * within the iframe of `selectedEntryId`. Renders nothing when no layer is
 * selected.
 *
 * The handles live in the same coordinate system as the iframes (inside the
 * scaled 1920×1080 canvas div), so positions just use canvas-space numbers
 * straight from `getBoundingClientRect()` inside the iframe. Visual sizes
 * are counter-scaled so they stay constant at any canvas zoom.
 */
export function LayerHandlesOverlay({ scale }: LayerHandlesOverlayProps) {
    const { selectedEntryId, selectedLayerPath, updateEntryHtml } = useVideoEditorStore(
        useShallow((s) => ({
            selectedEntryId: s.selectedEntryId,
            selectedLayerPath: s.selectedLayerPath,
            updateEntryHtml: s.updateEntryHtml,
        }))
    );

    const [rect, setRect] = useState<CanvasRect | null>(null);
    /** Live preview overlay during a drag — rect in canvas-space. */
    const [previewRect, setPreviewRect] = useState<CanvasRect | null>(null);
    /** Live rotation in degrees during a drag (composes with original transform). */
    const [previewRotate, setPreviewRotate] = useState<number | null>(null);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const requestIdRef = useRef(0);

    // Resolve which iframe to talk to whenever the selection changes.
    useEffect(() => {
        if (!selectedEntryId || !selectedLayerPath) {
            iframeRef.current = null;
            setRect(null);
            return;
        }
        const el = document.querySelector<HTMLIFrameElement>(
            `iframe[data-vx-entry-id="${cssAttrEscape(selectedEntryId)}"]`
        );
        iframeRef.current = el ?? null;
    }, [selectedEntryId, selectedLayerPath]);

    const queryRect = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe || !selectedLayerPath) return;
        const requestId = ++requestIdRef.current;
        try {
            iframe.contentWindow?.postMessage(
                { type: 'vx-get-rect', path: selectedLayerPath, requestId },
                '*'
            );
        } catch {
            /* iframe gone */
        }
    }, [selectedLayerPath]);

    // Listen for `vx-rect` replies and `vx-iframe-ready` (so we re-query after
    // every iframe re-mount caused by an HTML commit).
    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            const data = e.data as
                | {
                      type?: string;
                      requestId?: number;
                      ok?: boolean;
                      rect?: {
                          left: number;
                          top: number;
                          width: number;
                          height: number;
                          leftPx?: number | null;
                          topPx?: number | null;
                      };
                      transform?: string;
                  }
                | undefined;
            if (!data) return;
            if (
                data.type === 'vx-rect' &&
                data.ok &&
                data.rect &&
                data.requestId === requestIdRef.current
            ) {
                setRect({
                    left: data.rect.left,
                    top: data.rect.top,
                    width: data.rect.width,
                    height: data.rect.height,
                    leftPx: data.rect.leftPx ?? null,
                    topPx: data.rect.topPx ?? null,
                    transform: data.transform ?? '',
                });
            } else if (
                data.type === 'vx-iframe-ready' &&
                e.source === iframeRef.current?.contentWindow
            ) {
                // Re-query one tick later so any post-mount layout has settled.
                requestAnimationFrame(queryRect);
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [queryRect]);

    // Initial / selection-change query.
    useEffect(() => {
        setRect(null);
        if (selectedLayerPath) {
            // Try once immediately; iframe may not be mounted yet, in which
            // case the `vx-iframe-ready` listener above will retry.
            queryRect();
        }
    }, [selectedEntryId, selectedLayerPath, queryRect]);

    // Re-query on canvas resize so handles stay aligned with the iframe content.
    useEffect(() => {
        const onResize = () => queryRect();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [queryRect]);

    // The rect we actually draw — preview during a gesture, otherwise committed.
    const drawRect = previewRect ?? rect;

    // ── Gesture handling ────────────────────────────────────────────────
    const startGesture = useCallback(
        (handle: Handle) => (e: React.PointerEvent) => {
            if (!rect || !selectedLayerPath || !iframeRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);

            const startScreenX = e.clientX;
            const startScreenY = e.clientY;
            const startRect: CanvasRect = { ...rect };
            const path = selectedLayerPath;
            const iframe = iframeRef.current;

            const sendStyle = (style: Record<string, string>) => {
                try {
                    iframe.contentWindow?.postMessage({ type: 'vx-set-style', path, style }, '*');
                } catch {
                    /* ignore */
                }
            };

            // Element center in canvas-space — used for rotate gesture.
            const cx = startRect.left + startRect.width / 2;
            const cy = startRect.top + startRect.height / 2;

            // Capture the original transform-component at gesture start so we
            // compose live updates against a stable baseline.
            const origTransform = startRect.transform.trim();
            const origRotateDeg = parseRotateDeg(origTransform);
            const origNoRotate = stripRotate(origTransform);

            const onMove = (ev: PointerEvent) => {
                const [dxCanvas, dyCanvas] = screenToCanvas(
                    ev.clientX - startScreenX,
                    ev.clientY - startScreenY,
                    scale
                );

                if (handle === 'move') {
                    // Use `left`/`top` rather than `transform` for moves —
                    // gsap/anime constantly re-apply transform on every seek
                    // (which fires after every iframe re-mount), so a
                    // transform-based move would revert on commit. left/top
                    // are layout properties they don't touch.
                    const baseLeft = startRect.leftPx ?? startRect.left;
                    const baseTop = startRect.topPx ?? startRect.top;
                    sendStyle({
                        position: 'absolute',
                        left: `${baseLeft + dxCanvas}px`,
                        top: `${baseTop + dyCanvas}px`,
                    });
                    setPreviewRect({
                        ...startRect,
                        left: startRect.left + dxCanvas,
                        top: startRect.top + dyCanvas,
                    });
                } else if (handle === 'rotate') {
                    // Angle is measured from element center to pointer position
                    // (in canvas-space). Subtract 90° because handle sits above
                    // the rect, so "pointing up" should mean 0°.
                    const [pxCanvas, pyCanvas] = screenToCanvasFromIframe(
                        ev.clientX,
                        ev.clientY,
                        iframe,
                        scale
                    );
                    const ang = Math.atan2(pyCanvas - cy, pxCanvas - cx) * (180 / Math.PI) + 90;
                    sendStyle({
                        transform: composeRotateTransform(origNoRotate, ang),
                    });
                    setPreviewRotate(ang);
                } else {
                    // Resize handle — recompute width/height from drag.
                    const next = computeResize(startRect, handle, dxCanvas, dyCanvas);
                    sendStyle({
                        width: `${Math.max(1, Math.round(next.width))}px`,
                        height: `${Math.max(1, Math.round(next.height))}px`,
                    });
                    setPreviewRect({
                        ...next,
                        transform: startRect.transform,
                        leftPx: startRect.leftPx,
                        topPx: startRect.topPx,
                    });
                }
            };

            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);

                // Commit the final values to the entry HTML so they survive a
                // reload and feed the iframe-srcDoc cache key correctly.
                if (!selectedEntryId) return;
                const state = useVideoEditorStore.getState();
                const entry = state.entries.find((x) => x.id === selectedEntryId);
                if (!entry) {
                    setPreviewRect(null);
                    setPreviewRotate(null);
                    return;
                }

                let finalPatch: Record<string, string | null> | null = null;
                if (handle === 'move') {
                    const r = previewRectRef.current ?? startRect;
                    const dx = r.left - startRect.left;
                    const dy = r.top - startRect.top;
                    const baseLeft = startRect.leftPx ?? startRect.left;
                    const baseTop = startRect.topPx ?? startRect.top;
                    finalPatch = {
                        position: 'absolute',
                        left: `${Math.round((baseLeft + dx) * 100) / 100}px`,
                        top: `${Math.round((baseTop + dy) * 100) / 100}px`,
                    };
                } else if (handle === 'rotate') {
                    finalPatch = {
                        transform: composeRotateTransform(
                            origNoRotate,
                            previewRotateRef.current ?? origRotateDeg
                        ),
                    };
                } else if (previewRectRef.current) {
                    finalPatch = {
                        width: `${Math.max(1, Math.round(previewRectRef.current.width))}px`,
                        height: `${Math.max(1, Math.round(previewRectRef.current.height))}px`,
                    };
                }

                if (finalPatch) {
                    updateEntryHtml(entry.id, patchNodeStyle(entry.html, path, finalPatch));
                }

                setPreviewRect(null);
                setPreviewRotate(null);
                // The HTML commit will re-mount the iframe, which will
                // re-handshake and trigger a fresh queryRect via the ready
                // listener above. No manual queryRect needed here.
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        },
        [rect, selectedEntryId, selectedLayerPath, scale, updateEntryHtml]
    );

    // Mirror preview state into refs so the gesture handler (which closes
    // over them at start time) can read the latest values on pointerup.
    const previewRectRef = useRef<CanvasRect | null>(null);
    const previewRotateRef = useRef<number | null>(null);
    useEffect(() => {
        previewRectRef.current = previewRect;
    }, [previewRect]);
    useEffect(() => {
        previewRotateRef.current = previewRotate;
    }, [previewRotate]);

    // Bail without rendering when no layer is selected.
    if (!drawRect || !selectedLayerPath) return null;

    // Clamp draw position inside canvas so handles stay reachable even if the
    // element overflows the viewport.
    const left = drawRect.left;
    const top = drawRect.top;
    const w = Math.max(1, drawRect.width);
    const h = Math.max(1, drawRect.height);

    // Counter-scale so handle visuals stay constant size at any canvas zoom.
    const handleScale = scale > 0 ? 1 / scale : 1;

    return (
        <div
            // Positioned in canvas-space; the parent transform: scale() shrinks
            // these along with the iframe so positioning stays consistent.
            style={{
                position: 'absolute',
                left,
                top,
                width: w,
                height: h,
                pointerEvents: 'none',
                zIndex: 20000,
                outline: '2px solid #6366f1',
                outlineOffset: -1,
            }}
        >
            {/* Move handle: covers the body of the box. */}
            <div
                onPointerDown={startGesture('move')}
                style={{
                    position: 'absolute',
                    inset: 0,
                    cursor: 'move',
                    pointerEvents: 'auto',
                    background: 'transparent',
                }}
            />

            {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => (
                <ResizeHandle key={h} pos={h} scale={handleScale} onPointerDown={startGesture(h)} />
            ))}

            <RotateHandle scale={handleScale} onPointerDown={startGesture('rotate')} />
        </div>
    );
}

function ResizeHandle({
    pos,
    scale,
    onPointerDown,
}: {
    pos: ResizeHandlePos;
    scale: number;
    onPointerDown: (e: React.PointerEvent) => void;
}) {
    const SIZE = 10; // screen-space px after counter-scale
    const half = SIZE / 2;

    const map: Record<typeof pos, { left: string; top: string; cursor: string }> = {
        nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
        n: { left: '50%', top: '0%', cursor: 'ns-resize' },
        ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
        e: { left: '100%', top: '50%', cursor: 'ew-resize' },
        se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
        s: { left: '50%', top: '100%', cursor: 'ns-resize' },
        sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
        w: { left: '0%', top: '50%', cursor: 'ew-resize' },
    };
    const { left, top, cursor } = map[pos];

    return (
        <div
            onPointerDown={onPointerDown}
            style={{
                position: 'absolute',
                left,
                top,
                width: SIZE * scale,
                height: SIZE * scale,
                marginLeft: -half * scale,
                marginTop: -half * scale,
                background: '#fff',
                border: `${1.5 * scale}px solid #6366f1`,
                borderRadius: 2 * scale,
                cursor,
                pointerEvents: 'auto',
                boxShadow: `0 ${1 * scale}px ${2 * scale}px rgba(0,0,0,0.2)`,
            }}
        />
    );
}

function RotateHandle({
    scale,
    onPointerDown,
}: {
    scale: number;
    onPointerDown: (e: React.PointerEvent) => void;
}) {
    const SIZE = 12;
    const OFFSET = 28; // distance above the rect's top edge
    const half = SIZE / 2;
    return (
        <div
            onPointerDown={onPointerDown}
            style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                width: SIZE * scale,
                height: SIZE * scale,
                marginLeft: -half * scale,
                marginTop: -(OFFSET + half) * scale,
                background: '#6366f1',
                borderRadius: '50%',
                cursor: 'crosshair',
                pointerEvents: 'auto',
                boxShadow: `0 ${1 * scale}px ${2 * scale}px rgba(0,0,0,0.25)`,
            }}
            title="Rotate"
        />
    );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cssAttrEscape(v: string): string {
    return v.replace(/(["\\])/g, '\\$1');
}

/** Convert a viewport pointer (clientX/Y) into canvas-space coords using the
 *  iframe's bounding rect as the canvas origin. The iframe itself sits inside
 *  a scaled wrapper so screen distances divide by `scale` to canvas units. */
function screenToCanvasFromIframe(
    clientX: number,
    clientY: number,
    iframe: HTMLIFrameElement,
    scale: number
): [number, number] {
    const r = iframe.getBoundingClientRect();
    return screenToCanvas(clientX - r.left, clientY - r.top, scale);
}

/** Replace the rotate component of `origNoRotate` (which already has rotate
 *  stripped) with a fresh rotate(deg). */
function composeRotateTransform(origNoRotate: string, deg: number): string {
    const r = `rotate(${Math.round(deg * 100) / 100}deg)`;
    return origNoRotate ? `${origNoRotate} ${r}` : r;
}

const ROTATE_RE = /\brotate\s*\(\s*([-+]?\d*\.?\d+)\s*deg\s*\)/i;

function parseRotateDeg(transform: string): number {
    const m = transform.match(ROTATE_RE);
    return m && m[1] ? parseFloat(m[1]) : 0;
}

function stripRotate(transform: string): string {
    return transform.replace(ROTATE_RE, '').replace(/\s+/g, ' ').trim();
}

interface ResizeResult {
    left: number;
    top: number;
    width: number;
    height: number;
}

function computeResize(
    start: CanvasRect,
    handle: ResizeHandlePos,
    dx: number,
    dy: number
): ResizeResult {
    let { left, top, width, height } = start;
    switch (handle) {
        case 'e':
            width = start.width + dx;
            break;
        case 'w':
            width = start.width - dx;
            left = start.left + dx;
            break;
        case 'n':
            height = start.height - dy;
            top = start.top + dy;
            break;
        case 's':
            height = start.height + dy;
            break;
        case 'ne':
            width = start.width + dx;
            height = start.height - dy;
            top = start.top + dy;
            break;
        case 'nw':
            width = start.width - dx;
            height = start.height - dy;
            left = start.left + dx;
            top = start.top + dy;
            break;
        case 'se':
            width = start.width + dx;
            height = start.height + dy;
            break;
        case 'sw':
            width = start.width - dx;
            height = start.height + dy;
            left = start.left + dx;
            break;
    }
    return { left, top, width: Math.max(4, width), height: Math.max(4, height) };
}
