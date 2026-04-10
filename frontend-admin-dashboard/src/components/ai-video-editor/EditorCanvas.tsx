import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { processHtmlContent } from '@/components/ai-video-player/html-processor';
import { useVideoEditorStore } from './stores/video-editor-store';

interface EditorCanvasProps {
    /** Called whenever the scale factor changes (used by overlay renderers) */
    onScaleChange?: (scale: number) => void;
}

/**
 * Scaled, scrollable canvas that mirrors the AIContentPlayer rendering pipeline.
 * Renders the entries active at the current scrub time as iframes.
 * Each entry is wrapped in a CSS-transform div driven by entryTransforms.
 */
export function EditorCanvas({ onScaleChange }: EditorCanvasProps) {
    const {
        entries,
        meta,
        currentTime,
        selectedEntryId,
        selectEntry,
        isPreviewMode,
        seek,
        entryTransforms,
        deleteEntry,
    } = useVideoEditorStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const canvasW = meta.dimensions?.width ?? 1920;
    const canvasH = meta.dimensions?.height ?? 1080;
    const isPortrait = canvasH > canvasW;
    const navigationMode = meta.navigation;

    // ── Scale calculation ──────────────────────────────────────────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const compute = () => {
            const { clientWidth: cw, clientHeight: ch } = el;
            if (cw === 0 || ch === 0) return;
            const newScale = Math.min(cw / canvasW, ch / canvasH);
            setScale(newScale);
            onScaleChange?.(newScale);
        };

        const ro = new ResizeObserver(compute);
        ro.observe(el);
        compute();
        return () => ro.disconnect();
    }, [canvasW, canvasH, onScaleChange]);

    // ── Pre-process HTML per entry (stable — only recomputes when html/meta changes, NOT on scrub) ──
    const processedHtmlMap = useMemo(() => {
        const contentEntries = entries.filter((e) => !e.id?.startsWith('branding-'));
        return new Map(
            entries.map((entry) => {
                if (entry.id?.startsWith('branding-')) {
                    return [entry.id, entry.html];
                }
                const contentIdx = contentEntries.indexOf(entry);
                return [
                    entry.id,
                    processHtmlContent(entry.html, meta.content_type, contentIdx > 0, meta.palette),
                ];
            })
        );
    }, [entries, meta.content_type, meta.palette]);

    // ── Active entries at current scrub time ───────────────────────────────
    const activeEntries = useMemo(() => {
        if (entries.length === 0) return [];

        if (navigationMode === 'time_driven') {
            const active = entries
                .filter((e) => {
                    const start = e.inTime ?? e.start ?? 0;
                    const end = e.exitTime ?? e.end ?? Infinity;
                    return currentTime >= start && currentTime < end;
                })
                .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

            return active.map((entry) => ({
                ...entry,
                processedHtml: processedHtmlMap.get(entry.id) ?? entry.html,
            }));
        }

        // user_driven / self_contained: treat currentTime as integer index
        const idx = Math.max(0, Math.min(Math.floor(currentTime), entries.length - 1));
        const entry = entries[idx];
        if (!entry) return [];
        return [{ ...entry, processedHtml: processedHtmlMap.get(entry.id) ?? entry.html }];
    }, [entries, currentTime, navigationMode, processedHtmlMap]);

    // ── Click on canvas → select topmost active entry ─────────────────────
    const handleCanvasClick = useCallback(() => {
        if (isPreviewMode || activeEntries.length === 0) return;
        const topEntry = activeEntries[activeEntries.length - 1];
        if (topEntry) {
            selectEntry(topEntry.id === selectedEntryId ? null : topEntry.id);
        }
    }, [activeEntries, selectedEntryId, selectEntry, isPreviewMode]);

    // ── Keyboard shortcuts ─────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
                return;
            // Delete / Backspace → remove selected entry
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntryId) {
                deleteEntry(selectedEntryId);
                return;
            }
            // Arrow scrubbing
            if (navigationMode === 'time_driven') {
                const step = e.shiftKey ? 5 : 1;
                if (e.key === 'ArrowRight')
                    seek(Math.min(currentTime + step, meta.total_duration ?? 999));
                if (e.key === 'ArrowLeft') seek(Math.max(0, currentTime - step));
            } else {
                if (e.key === 'ArrowRight') seek(Math.min(currentTime + 1, entries.length - 1));
                if (e.key === 'ArrowLeft') seek(Math.max(0, currentTime - 1));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [
        currentTime,
        navigationMode,
        meta.total_duration,
        entries.length,
        seek,
        selectedEntryId,
        deleteEntry,
    ]);

    const scaledW = canvasW * scale;
    const scaledH = canvasH * scale;

    return (
        <div
            ref={containerRef}
            className="relative flex size-full items-center justify-center overflow-hidden bg-gray-200"
            style={{ minHeight: isPortrait ? 300 : 200 }}
        >
            {/* Aspect-ratio canvas */}
            <div
                style={{
                    width: scaledW,
                    height: scaledH,
                    position: 'relative',
                    flexShrink: 0,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.12), 0 4px 24px rgba(0,0,0,0.15)',
                    cursor: isPreviewMode ? 'default' : 'pointer',
                }}
                onClick={handleCanvasClick}
            >
                {/* Actual 1:1 canvas scaled down */}
                <div
                    style={{
                        width: canvasW,
                        height: canvasH,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        background: meta.palette?.background ?? '#ffffff',
                        overflow: 'hidden',
                    }}
                >
                    {activeEntries.length > 0 ? (
                        activeEntries.map((entry, i) => {
                            const t = entryTransforms[entry.id];
                            const cssTransform = t
                                ? `translate(${t.x}px, ${t.y}px) scale(${t.scale}) rotate(${t.rotation}deg)`
                                : undefined;
                            const isSelected = entry.id === selectedEntryId;

                            return (
                                <div
                                    key={`editor-${entry.id}`}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        transform: cssTransform,
                                        transformOrigin: 'center center',
                                        zIndex: entry.z ?? i,
                                    }}
                                >
                                    <iframe
                                        srcDoc={entry.processedHtml}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            border: 'none',
                                            background:
                                                i === 0
                                                    ? meta.palette?.background ?? '#ffffff'
                                                    : 'transparent',
                                            pointerEvents: 'none',
                                        }}
                                        title={`Editor Layer ${entry.id}`}
                                        sandbox="allow-scripts allow-same-origin"
                                    />
                                    {/* Selection ring — transformed with the entry */}
                                    {!isPreviewMode && isSelected && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                inset: 0,
                                                border: '2px solid #6366f1',
                                                borderRadius: 2,
                                                pointerEvents: 'none',
                                                zIndex: 10000,
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: meta.palette?.background ?? '#ffffff',
                                color: '#9ca3af',
                                fontSize: 18,
                                fontFamily: 'system-ui, sans-serif',
                            }}
                        >
                            No content at this time
                        </div>
                    )}
                </div>

                {/* Scale label */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 6,
                        right: 8,
                        background: 'rgba(0,0,0,0.4)',
                        color: '#fff',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        padding: '1px 5px',
                        borderRadius: 3,
                        pointerEvents: 'none',
                        zIndex: 10001,
                    }}
                >
                    {Math.round(scale * 100)}%
                </div>
            </div>
        </div>
    );
}
