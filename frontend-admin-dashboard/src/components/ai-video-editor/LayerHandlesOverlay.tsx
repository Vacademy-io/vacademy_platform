import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './stores/video-editor-store';
import { screenToCanvas } from './utils/coord-convert';
import { patchNodeStyle } from './utils/html-tree';

interface LayerHandlesOverlayProps {
    /** Scale factor: canvas-space (1920×1080) → screen pixels. */
    scale: number;
    /** Canvas width in canvas coordinates (e.g. 1920). Used by align tools. */
    canvasW: number;
    /** Canvas height in canvas coordinates (e.g. 1080). */
    canvasH: number;
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
    /** Inline standalone `rotate` value (e.g. "45deg"). Preferred over the
     *  rotate component of `transform` because anime/gsap don't touch it. */
    rotate: string;
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
export function LayerHandlesOverlay({ scale, canvasW, canvasH }: LayerHandlesOverlayProps) {
    const { selectedEntryId, selectedLayerPath, updateEntryHtml, selectedEntryHtml } =
        useVideoEditorStore(
            useShallow((s) => ({
                selectedEntryId: s.selectedEntryId,
                selectedLayerPath: s.selectedLayerPath,
                updateEntryHtml: s.updateEntryHtml,
                // Subscribe to the selected entry's html so we re-resolve
                // iframeRef whenever the iframe re-mounts (HTML commit changes
                // srcDoc, which causes a full iframe reload — the previous
                // element node is detached and iframeRef.current goes stale).
                selectedEntryHtml: s.entries.find((e) => e.id === s.selectedEntryId)?.html ?? null,
            }))
        );

    const [rect, setRect] = useState<CanvasRect | null>(null);
    /** Live preview overlay during a drag — rect in canvas-space. */
    const [previewRect, setPreviewRect] = useState<CanvasRect | null>(null);

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const requestIdRef = useRef(0);
    const resizeRequestIdRef = useRef(0);
    /** Latest values echoed back by `vx-resize-applied`. The commit handler
     *  reads these on pointerup so the HTML matches what the agent actually
     *  wrote (which compensates for any centering-translate). */
    const latestResizeAppliedRef = useRef<{
        leftPx: number;
        topPx: number;
        width: number;
        height: number;
    } | null>(null);

    // Resolve which iframe to talk to whenever the selection changes OR the
    // selected entry's html changes (which re-mounts its iframe — the previous
    // element is detached and iframeRef would point to a dead node). Without
    // re-resolving here, every drag after the first one would post to a torn-
    // down contentWindow and silently no-op.
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
    }, [selectedEntryId, selectedLayerPath, selectedEntryHtml]);

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
                      rotate?: string;
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
                    rotate: data.rotate ?? '',
                });
            } else if (data.type === 'vx-iframe-ready') {
                // The selected entry's iframe just (re-)mounted. Re-resolve
                // iframeRef from the DOM by data-vx-entry-id so a fresh
                // post-commit re-mount doesn't leave us pointing at a dead
                // element. Match the source window against the resolved
                // element to ignore ready signals from other entries' iframes.
                if (!selectedEntryId) return;
                const el = document.querySelector<HTMLIFrameElement>(
                    `iframe[data-vx-entry-id="${cssAttrEscape(selectedEntryId)}"]`
                );
                if (el && e.source === el.contentWindow) {
                    iframeRef.current = el;
                    // Re-query one tick later so any post-mount layout has settled.
                    requestAnimationFrame(queryRect);
                }
            } else if ((data as { type?: string; ok?: boolean }).type === 'vx-resize-applied') {
                const r = data as unknown as {
                    requestId?: number;
                    ok?: boolean;
                    leftPx?: number;
                    topPx?: number;
                    width?: number;
                    height?: number;
                };
                // Latest-write-wins: only the most recent resize request
                // matters for commit purposes.
                if (
                    r.ok &&
                    r.requestId === resizeRequestIdRef.current &&
                    typeof r.leftPx === 'number' &&
                    typeof r.topPx === 'number' &&
                    typeof r.width === 'number' &&
                    typeof r.height === 'number'
                ) {
                    latestResizeAppliedRef.current = {
                        leftPx: r.leftPx,
                        topPx: r.topPx,
                        width: r.width,
                        height: r.height,
                    };
                }
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [queryRect, selectedEntryId]);

    // Initial / selection-change query. Also re-queries whenever the
    // selected entry's html changes — style-only edits no longer re-mount
    // the iframe (EditorCanvas keeps srcDoc stable for those), so the
    // vx-iframe-ready re-query path doesn't fire. Reading the rect again
    // here is what keeps the handles aligned after a drag commit.
    useEffect(() => {
        if (selectedLayerPath) {
            // Wait one frame so the iframe agent has had a chance to apply
            // any vx-sync-styles from the same render tick.
            const id = requestAnimationFrame(() => queryRect());
            return () => cancelAnimationFrame(id);
        }
        setRect(null);
        return undefined;
    }, [selectedEntryId, selectedLayerPath, selectedEntryHtml, queryRect]);

    // Re-query on canvas resize so handles stay aligned with the iframe content.
    useEffect(() => {
        const onResize = () => queryRect();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [queryRect]);

    // Arrow-key nudge: 1px / 10px (Shift) move the selected layer in canvas
    // coords. Skipped when focus is in an input so the inspector keeps its
    // own arrow-key behavior.
    useEffect(() => {
        if (!rect || !selectedLayerPath || !selectedEntryId) return;
        const onKey = (e: KeyboardEvent) => {
            if (
                e.key !== 'ArrowUp' &&
                e.key !== 'ArrowDown' &&
                e.key !== 'ArrowLeft' &&
                e.key !== 'ArrowRight'
            )
                return;
            const t = e.target as HTMLElement | null;
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.tagName === 'SELECT' ||
                    t.isContentEditable)
            )
                return;
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            let dx = 0;
            let dy = 0;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;
            const baseLeft = rect.leftPx ?? rect.left;
            const baseTop = rect.topPx ?? rect.top;
            const newLeft = baseLeft + dx;
            const newTop = baseTop + dy;
            const iframe = iframeRef.current;
            const path = selectedLayerPath;
            // Imperative live update for smoothness — same channel as drag.
            try {
                iframe?.contentWindow?.postMessage(
                    {
                        type: 'vx-set-style',
                        path,
                        style: {
                            position: 'absolute',
                            left: `${newLeft}px`,
                            top: `${newTop}px`,
                        },
                    },
                    '*'
                );
            } catch {
                /* ignore */
            }
            // Commit through the store so undo + save pick it up. The iframe
            // will re-mount with the new HTML and re-handshake the rect.
            const state = useVideoEditorStore.getState();
            const entry = state.entries.find((x) => x.id === selectedEntryId);
            if (entry) {
                updateEntryHtml(
                    entry.id,
                    patchNodeStyle(entry.html, path, {
                        position: 'absolute',
                        left: `${Math.round(newLeft * 100) / 100}px`,
                        top: `${Math.round(newTop * 100) / 100}px`,
                    })
                );
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [rect, selectedLayerPath, selectedEntryId, updateEntryHtml]);

    // The rect we actually draw — preview during a gesture, otherwise committed.
    const drawRect = previewRect ?? rect;

    // ── Gesture handling ────────────────────────────────────────────────
    const startGesture = useCallback(
        (handle: Handle) => (e: React.PointerEvent) => {
            if (!rect || !selectedLayerPath || !selectedEntryId) return;
            // Re-resolve the iframe from the DOM at gesture-start so a stale
            // ref (e.g. iframe re-mounted but effect hasn't caught up) can't
            // cause a no-op drag.
            const iframe =
                document.querySelector<HTMLIFrameElement>(
                    `iframe[data-vx-entry-id="${cssAttrEscape(selectedEntryId)}"]`
                ) ?? iframeRef.current;
            if (!iframe) return;
            iframeRef.current = iframe;
            e.preventDefault();
            e.stopPropagation();
            (e.target as Element).setPointerCapture(e.pointerId);

            const startScreenX = e.clientX;
            const startScreenY = e.clientY;
            const startRect: CanvasRect = { ...rect };
            const path = selectedLayerPath;
            // Reset the resize echo cache for this gesture.
            latestResizeAppliedRef.current = null;

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

            // Capture the rotation baseline at gesture start. Prefer the
            // standalone `rotate` property (which we use for our commits and
            // anime/gsap don't touch) over a rotate() inside `transform`.
            const origRotateDeg = (() => {
                const fromStandalone = parseStandaloneRotateDeg(startRect.rotate);
                if (fromStandalone !== null) return fromStandalone;
                return parseRotateDeg(startRect.transform);
            })();

            // Closure-local trackers for the latest values produced by the
            // gesture. Reading these on pointerup avoids the one-event lag we
            // would hit with state→ref mirrors (a tiny single-pointermove drag
            // would otherwise commit as dx=dy=0 because the useEffect that
            // mirrored preview state into a ref had not run yet).
            let lastDx = 0;
            let lastDy = 0;
            let lastRotateDeg: number | null = null;
            let lastResize: ResizeResult | null = null;
            let didMove = false;

            const onMove = (ev: PointerEvent) => {
                const [dxCanvas, dyCanvas] = screenToCanvas(
                    ev.clientX - startScreenX,
                    ev.clientY - startScreenY,
                    scale
                );
                didMove = true;

                if (handle === 'move') {
                    // Use `left`/`top` rather than `transform` for moves —
                    // gsap/anime constantly re-apply transform on every seek
                    // (which fires after every iframe re-mount), so a
                    // transform-based move would revert on commit. left/top
                    // are layout properties they typically don't touch.
                    //
                    // Mark our writes !important: some shots animate `left`
                    // directly (or override it via CSS classes inside the
                    // shot's <style> block), and without !important the
                    // animation's next tick clobbers our value, making the
                    // image silently snap back to where it was.
                    const baseLeft = startRect.leftPx ?? startRect.left;
                    const baseTop = startRect.topPx ?? startRect.top;
                    lastDx = dxCanvas;
                    lastDy = dyCanvas;
                    sendStyle({
                        position: 'absolute !important',
                        left: `${baseLeft + dxCanvas}px !important`,
                        top: `${baseTop + dyCanvas}px !important`,
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
                    lastRotateDeg = ang;
                    // Write the standalone CSS `rotate` property — anime/gsap
                    // animate `transform`, which is a separate property, so
                    // our rotation isn't clobbered on every iframe re-mount.
                    // The visual is driven by the imperative style write above;
                    // no React state is needed for rotation preview.
                    sendStyle({ rotate: `${Math.round(ang * 100) / 100}deg` });
                } else {
                    // Resize handle — compute the target rect for the gesture
                    // and let the agent absorb any centering-translate drift
                    // by writing left/top after width/height. See `vx-resize-
                    // to-rect` in editor-iframe-agent.ts.
                    const next = computeResize(startRect, handle, dxCanvas, dyCanvas);
                    lastResize = next;
                    const requestId = ++resizeRequestIdRef.current;
                    try {
                        iframe.contentWindow?.postMessage(
                            {
                                type: 'vx-resize-to-rect',
                                path,
                                requestId,
                                left: next.left,
                                top: next.top,
                                width: Math.max(1, next.width),
                                height: Math.max(1, next.height),
                            },
                            '*'
                        );
                    } catch {
                        /* iframe gone */
                    }
                    setPreviewRect({
                        ...next,
                        transform: startRect.transform,
                        leftPx: startRect.leftPx,
                        topPx: startRect.topPx,
                        rotate: startRect.rotate,
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
                    return;
                }

                // Pure click on the move handle (no actual pointermove) — bail
                // without committing so we don't pollute undo with a no-op or
                // force a static element into absolute positioning by mistake.
                if (!didMove) {
                    setPreviewRect(null);
                    return;
                }

                let finalPatch: Record<string, string | null> | null = null;
                if (handle === 'move') {
                    // !important mirrors the live-preview writes — without it
                    // a shot whose script animates `left` directly would
                    // immediately undo the move on the very first vx-seek
                    // after the iframe re-mounts with our new HTML.
                    const baseLeft = startRect.leftPx ?? startRect.left;
                    const baseTop = startRect.topPx ?? startRect.top;
                    finalPatch = {
                        position: 'absolute !important',
                        left: `${Math.round((baseLeft + lastDx) * 100) / 100}px !important`,
                        top: `${Math.round((baseTop + lastDy) * 100) / 100}px !important`,
                    };
                } else if (handle === 'rotate') {
                    const ang = lastRotateDeg ?? origRotateDeg;
                    finalPatch = {
                        rotate: `${Math.round(ang * 100) / 100}deg`,
                    };
                } else if (latestResizeAppliedRef.current) {
                    // Commit the actual values the agent wrote (which already
                    // compensated for any centering-translate). Falls back to
                    // the raw computeResize values if the agent never echoed
                    // (e.g. the gesture was too short to dispatch a message).
                    // Same !important rationale as the move path.
                    const r = latestResizeAppliedRef.current;
                    finalPatch = {
                        position: 'absolute !important',
                        left: `${Math.round(r.leftPx * 100) / 100}px !important`,
                        top: `${Math.round(r.topPx * 100) / 100}px !important`,
                        width: `${Math.max(1, Math.round(r.width))}px !important`,
                        height: `${Math.max(1, Math.round(r.height))}px !important`,
                    };
                } else if (lastResize) {
                    finalPatch = {
                        width: `${Math.max(1, Math.round(lastResize.width))}px`,
                        height: `${Math.max(1, Math.round(lastResize.height))}px`,
                    };
                }

                if (finalPatch) {
                    updateEntryHtml(entry.id, patchNodeStyle(entry.html, path, finalPatch));
                }

                setPreviewRect(null);
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

    /**
     * Align the selected layer to a canvas edge / center. Sends the same
     * `vx-resize-to-rect` message as our resize handles — width/height stay
     * the same, only left/top change. The agent absorbs any centering-
     * translate drift, and the parent commits the echoed values to HTML.
     */
    const alignToCanvas = useCallback(
        (h: 'left' | 'center' | 'right' | null, v: 'top' | 'middle' | 'bottom' | null) => {
            if (!rect || !selectedLayerPath || !iframeRef.current || !selectedEntryId) return;
            let targetLeft = rect.left;
            let targetTop = rect.top;
            if (h === 'left') targetLeft = 0;
            else if (h === 'center') targetLeft = (canvasW - rect.width) / 2;
            else if (h === 'right') targetLeft = canvasW - rect.width;
            if (v === 'top') targetTop = 0;
            else if (v === 'middle') targetTop = (canvasH - rect.height) / 2;
            else if (v === 'bottom') targetTop = canvasH - rect.height;

            // Reset echo cache and bump request id so the listener captures
            // this commit and not an in-flight resize from earlier.
            latestResizeAppliedRef.current = null;
            const requestId = ++resizeRequestIdRef.current;
            try {
                iframeRef.current.contentWindow?.postMessage(
                    {
                        type: 'vx-resize-to-rect',
                        path: selectedLayerPath,
                        requestId,
                        left: targetLeft,
                        top: targetTop,
                        width: rect.width,
                        height: rect.height,
                    },
                    '*'
                );
            } catch {
                /* iframe gone */
            }

            // Echo arrives async; commit on the next animation frame so the
            // agent has had a chance to write the imperative style and reply.
            requestAnimationFrame(() => {
                const r = latestResizeAppliedRef.current;
                const state = useVideoEditorStore.getState();
                const entry = state.entries.find((x) => x.id === selectedEntryId);
                if (!entry) return;
                const patch = r
                    ? {
                          position: 'absolute',
                          left: `${Math.round(r.leftPx * 100) / 100}px`,
                          top: `${Math.round(r.topPx * 100) / 100}px`,
                      }
                    : {
                          position: 'absolute',
                          left: `${Math.round(targetLeft * 100) / 100}px`,
                          top: `${Math.round(targetTop * 100) / 100}px`,
                      };
                updateEntryHtml(entry.id, patchNodeStyle(entry.html, selectedLayerPath, patch));
            });
        },
        [rect, selectedLayerPath, selectedEntryId, canvasW, canvasH, updateEntryHtml]
    );

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

    // Stop click + dblclick from bubbling up to the canvas — without this, the
    // mouseup at the end of a drag fires `click` on the handle, which bubbles
    // to EditorCanvas's `handleCanvasClick` and toggles the entry selection
    // off (which in turn clears the layer selection via `selectEntry`).
    const stop = (e: React.MouseEvent) => e.stopPropagation();

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
            onClick={stop}
            onDoubleClick={stop}
        >
            {/* Move handle: covers the body of the box. */}
            <div
                onPointerDown={startGesture('move')}
                onClick={stop}
                onDoubleClick={stop}
                style={{
                    position: 'absolute',
                    inset: 0,
                    cursor: 'move',
                    pointerEvents: 'auto',
                    background: 'transparent',
                }}
            />

            {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => (
                <ResizeHandle
                    key={h}
                    pos={h}
                    scale={handleScale}
                    onPointerDown={startGesture(h)}
                    onClick={stop}
                />
            ))}

            <RotateHandle
                scale={handleScale}
                onPointerDown={startGesture('rotate')}
                onClick={stop}
            />

            <AlignToolbar scale={handleScale} onAlign={alignToCanvas} />
        </div>
    );
}

function AlignToolbar({
    scale,
    onAlign,
}: {
    scale: number;
    onAlign: (h: 'left' | 'center' | 'right' | null, v: 'top' | 'middle' | 'bottom' | null) => void;
}) {
    // Positioned below the selection box. Counter-scaled so the toolbar stays
    // legible at any canvas zoom.
    return (
        <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                position: 'absolute',
                left: '50%',
                top: '100%',
                transform: `translate(-50%, ${10 * scale}px) scale(${scale})`,
                transformOrigin: 'top center',
                pointerEvents: 'auto',
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                padding: '3px 4px',
                display: 'flex',
                gap: 1,
                whiteSpace: 'nowrap',
            }}
        >
            <AlignBtn title="Align left" onClick={() => onAlign('left', null)}>
                <AlignH x="0" />
            </AlignBtn>
            <AlignBtn title="Center horizontally" onClick={() => onAlign('center', null)}>
                <AlignH x="50%" />
            </AlignBtn>
            <AlignBtn title="Align right" onClick={() => onAlign('right', null)}>
                <AlignH x="100%" />
            </AlignBtn>
            <span style={{ width: 1, background: '#e5e7eb', margin: '2px 3px' }} />
            <AlignBtn title="Align top" onClick={() => onAlign(null, 'top')}>
                <AlignV y="0" />
            </AlignBtn>
            <AlignBtn title="Center vertically" onClick={() => onAlign(null, 'middle')}>
                <AlignV y="50%" />
            </AlignBtn>
            <AlignBtn title="Align bottom" onClick={() => onAlign(null, 'bottom')}>
                <AlignV y="100%" />
            </AlignBtn>
        </div>
    );
}

function AlignBtn({
    title,
    onClick,
    children,
}: {
    title: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            style={{
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#4b5563',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eef2ff';
                e.currentTarget.style.color = '#4338ca';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#4b5563';
            }}
        >
            {children}
        </button>
    );
}

function AlignH({ x }: { x: string }) {
    // Vertical guide line + a small filled rect attached to it.
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1={x} y1="1" x2={x} y2="13" stroke="currentColor" strokeWidth="1.2" />
            <rect
                x={x === '0' ? 1.5 : x === '100%' ? 5.5 : 3.5}
                y="3.5"
                width="7"
                height="7"
                rx="0.5"
                fill="currentColor"
                opacity="0.55"
            />
        </svg>
    );
}

function AlignV({ y }: { y: string }) {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="1" y1={y} x2="13" y2={y} stroke="currentColor" strokeWidth="1.2" />
            <rect
                x="3.5"
                y={y === '0' ? 1.5 : y === '100%' ? 5.5 : 3.5}
                width="7"
                height="7"
                rx="0.5"
                fill="currentColor"
                opacity="0.55"
            />
        </svg>
    );
}

function ResizeHandle({
    pos,
    scale,
    onPointerDown,
    onClick,
}: {
    pos: ResizeHandlePos;
    scale: number;
    onPointerDown: (e: React.PointerEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
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
            onClick={onClick}
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
    onClick,
}: {
    scale: number;
    onPointerDown: (e: React.PointerEvent) => void;
    onClick?: (e: React.MouseEvent) => void;
}) {
    const SIZE = 12;
    const OFFSET = 28; // distance above the rect's top edge
    const half = SIZE / 2;
    return (
        <div
            onPointerDown={onPointerDown}
            onClick={onClick}
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

const ROTATE_RE = /\brotate\s*\(\s*([-+]?\d*\.?\d+)\s*deg\s*\)/i;
const STANDALONE_ROTATE_RE = /^\s*([-+]?\d*\.?\d+)\s*deg\s*$/i;

function parseRotateDeg(transform: string): number {
    const m = transform.match(ROTATE_RE);
    return m && m[1] ? parseFloat(m[1]) : 0;
}

/** Returns null if the standalone `rotate` value is empty / not in degrees,
 *  so the caller can fall back to parsing the transform string. */
function parseStandaloneRotateDeg(rotate: string): number | null {
    const m = rotate.match(STANDALONE_ROTATE_RE);
    return m && m[1] ? parseFloat(m[1]) : null;
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
