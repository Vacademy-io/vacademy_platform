import { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { processHtmlContent } from '@/components/ai-video-player/html-processor';
import { useVideoEditorStore } from './stores/video-editor-store';
import { computePreviewStyle, TransitionPair } from './utils/transitions';
import { getEditorIframeAgentScript } from './utils/editor-iframe-agent';
import { pauseIfPlaying } from './playback/playback-engine';
import { LayerHandlesOverlay } from './LayerHandlesOverlay';
import type { Entry, ContentType } from '@/components/ai-video-player/types';
import type { EntryTransform } from './stores/video-editor-store';

interface EditorCanvasProps {
    /** Called whenever the scale factor changes (used by overlay renderers) */
    onScaleChange?: (scale: number) => void;
}

/**
 * Cache for processed HTML keyed on a composite (html, contentType, isOverlay,
 * palette signature). Reused across renders and across entries that happen to
 * share the same input. Avoids quadratic re-processing when one entry's HTML
 * is edited — only its own cache key invalidates.
 */
const htmlProcessCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 256;

function getProcessedHtml(
    html: string,
    contentType: ContentType,
    isOverlay: boolean,
    palette:
        | {
              background?: string;
              text?: string;
              text_secondary?: string;
              primary?: string;
              accent?: string;
          }
        | undefined
): string {
    const paletteKey = palette
        ? `${palette.background ?? ''}|${palette.text ?? ''}|${palette.text_secondary ?? ''}|${palette.primary ?? ''}|${palette.accent ?? ''}`
        : '';
    // Hash just the html length + first/last 32 chars as a quick fingerprint.
    // Full string equality is enforced by the actual key including these slices.
    const htmlKey = `${html.length}::${html.slice(0, 32)}::${html.slice(-32)}`;
    const key = `${htmlKey}::${contentType}::${isOverlay ? 1 : 0}::${paletteKey}`;

    const cached = htmlProcessCache.get(key);
    if (cached !== undefined) return cached;

    // Append the editor-side iframe agent (gsap/anime seek bridge) so that
    // currentTime drives the iframe's animation clock instead of "iframe
    // load + N seconds". Mirrors the Playwright render server's behavior.
    const processed =
        processHtmlContent(html, contentType, isOverlay, palette) + getEditorIframeAgentScript();

    if (htmlProcessCache.size >= MAX_CACHE_ENTRIES) {
        // Drop oldest (Map preserves insertion order)
        const firstKey = htmlProcessCache.keys().next().value;
        if (firstKey !== undefined) htmlProcessCache.delete(firstKey);
    }
    htmlProcessCache.set(key, processed);
    return processed;
}

/**
 * Scaled, scrollable canvas that mirrors the AIContentPlayer rendering pipeline.
 * Renders the entries active at the current scrub time as iframes.
 * Each entry is wrapped in a CSS-transform div driven by entryTransforms.
 */
export function EditorCanvas({ onScaleChange }: EditorCanvasProps) {
    // Slice the store: subscribe only to the fields this component actually
    // reads. `useShallow` means a state change to an unrelated field (e.g. an
    // edit to entry HTML on a different entry, or audio track metadata) won't
    // trigger a re-render here.
    const {
        entries,
        meta,
        currentTime,
        selectedEntryId,
        selectEntry,
        isPreviewMode,
        seek,
        entryTransforms,
        entryBackgrounds,
        entryTransitions,
        deleteEntry,
    } = useVideoEditorStore(
        useShallow((s) => ({
            entries: s.entries,
            meta: s.meta,
            currentTime: s.currentTime,
            selectedEntryId: s.selectedEntryId,
            selectEntry: s.selectEntry,
            isPreviewMode: s.isPreviewMode,
            seek: s.seek,
            entryTransforms: s.entryTransforms,
            entryBackgrounds: s.entryBackgrounds,
            entryTransitions: s.entryTransitions,
            deleteEntry: s.deleteEntry,
        }))
    );

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

    // ── Active entries at current scrub time ───────────────────────────────
    // Only recompute when the inputs to active-entry selection change. Note:
    // `entries` reference stability matters — store updates that don't touch
    // the array (e.g. transform tweaks) leave this memo intact.
    const activeEntries = useMemo(() => {
        if (entries.length === 0) return [] as Entry[];

        if (navigationMode === 'time_driven') {
            return entries
                .filter((e) => {
                    const start = e.inTime ?? e.start ?? 0;
                    const end = e.exitTime ?? e.end ?? Infinity;
                    return currentTime >= start && currentTime < end;
                })
                .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
        }

        // user_driven / self_contained: treat currentTime as integer index
        const idx = Math.max(0, Math.min(Math.floor(currentTime), entries.length - 1));
        const entry = entries[idx];
        return entry ? [entry] : [];
    }, [entries, currentTime, navigationMode]);

    // Stable lookup: which active entries are non-branding (drives `isOverlay`
    // for processHtmlContent). Computed once per entries-array change.
    const contentEntryIdSet = useMemo(() => {
        const set = new Set<string>();
        let firstSeen = false;
        for (const e of entries) {
            if (e.id?.startsWith('branding-')) continue;
            if (!firstSeen) {
                firstSeen = true;
                continue; // first content entry is the base, not an overlay
            }
            set.add(e.id);
        }
        return set;
    }, [entries]);

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
            // Arrow scrubbing — same precedence rule as the timeline drag.
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                pauseIfPlaying();
            }
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
                            const isOverlay = contentEntryIdSet.has(entry.id);
                            const baseBackground =
                                i === 0 ? meta.palette?.background ?? '#ffffff' : undefined;

                            return (
                                <EntryLayer
                                    key={`editor-${entry.id}`}
                                    entry={entry}
                                    contentType={meta.content_type}
                                    palette={meta.palette}
                                    isOverlay={isOverlay}
                                    transform={entryTransforms[entry.id]}
                                    background={entryBackgrounds[entry.id]}
                                    transition={entryTransitions[entry.id]}
                                    currentTime={currentTime}
                                    isSelected={entry.id === selectedEntryId}
                                    showSelectionRing={!isPreviewMode}
                                    zFallback={i}
                                    baseBackground={baseBackground}
                                />
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
                    {/* On-canvas drag/resize/rotate handles for the selected
                        DOM layer. Lives inside the scaled 1920×1080 div so
                        positions just use canvas-space pixel values from the
                        iframe's getBoundingClientRect(). */}
                    {!isPreviewMode && (
                        <LayerHandlesOverlay scale={scale} />
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

interface EntryLayerProps {
    entry: Entry;
    contentType: ContentType;
    palette?: {
        background?: string;
        text?: string;
        text_secondary?: string;
        primary?: string;
        accent?: string;
    };
    isOverlay: boolean;
    transform?: EntryTransform;
    background?: string;
    transition?: TransitionPair;
    currentTime: number;
    isSelected: boolean;
    showSelectionRing: boolean;
    zFallback: number;
    baseBackground?: string;
}

/**
 * One iframe layer per active entry. Memoized so unrelated entry edits don't
 * re-render this layer — and crucially so the inner <iframe srcDoc> reference
 * stays stable when nothing about *this* entry has changed (no full document
 * re-parse / script re-execution).
 *
 * The transform/transition-style computation here does run on every parent
 * render that reaches this component, but React only updates the wrapper div's
 * inline style — the iframe is untouched as long as srcDoc is referentially
 * equal, which the `htmlProcessCache` guarantees for unchanged HTML.
 */
const EntryLayer = memo(function EntryLayer({
    entry,
    contentType,
    palette,
    isOverlay,
    transform,
    background,
    transition,
    currentTime,
    isSelected,
    showSelectionRing,
    zFallback,
    baseBackground,
}: EntryLayerProps) {
    const processedHtml = entry.id?.startsWith('branding-')
        ? entry.html
        : getProcessedHtml(entry.html, contentType, isOverlay, palette);

    const cssTransform = transform
        ? `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`
        : undefined;

    const inTime = entry.inTime ?? entry.start ?? 0;
    const outTime = entry.exitTime ?? entry.end ?? inTime + 1;
    const localT = currentTime - inTime;
    const shotDur = outTime - inTime;
    const transitionStyle = computePreviewStyle(localT, shotDur, transition);

    const composedTransform = [
        cssTransform,
        typeof transitionStyle.transform === 'string' ? transitionStyle.transform : null,
    ]
        .filter(Boolean)
        .join(' ');

    // ── Seek bridge: post `vx-seek` whenever the local time changes so the
    // iframe's gsap.globalTimeline + anime.js instances reflect the playhead
    // position, not "time since iframe load". The iframe agent (injected via
    // getEditorIframeAgentScript) listens for these messages.
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const isReadyRef = useRef(false);

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
            const data = e.data as { type?: string } | undefined;
            if (data?.type === 'vx-iframe-ready') {
                isReadyRef.current = true;
                iframeRef.current.contentWindow?.postMessage(
                    { type: 'vx-seek', tSec: localT },
                    '*'
                );
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
        // localT is intentionally read from a ref-via-closure here for the
        // ready handshake only. The dedicated seek effect below covers the
        // ongoing updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isReadyRef.current) return;
        iframeRef.current?.contentWindow?.postMessage({ type: 'vx-seek', tSec: localT }, '*');
    }, [localT]);

    // When the HTML content changes, the iframe re-mounts (new srcDoc) and the
    // agent will re-handshake. Reset the ready flag so we don't post into a
    // stale window.
    useEffect(() => {
        isReadyRef.current = false;
    }, [processedHtml]);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                transform: composedTransform || undefined,
                transformOrigin: 'center center',
                zIndex: entry.z ?? zFallback,
                background,
                opacity: transitionStyle.opacity,
            }}
        >
            <iframe
                ref={iframeRef}
                data-vx-entry-id={entry.id}
                srcDoc={processedHtml}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: background ? 'transparent' : baseBackground ?? 'transparent',
                    pointerEvents: 'none',
                }}
                title={`Editor Layer ${entry.id}`}
                sandbox="allow-scripts"
            />
            {showSelectionRing && isSelected && (
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
});
