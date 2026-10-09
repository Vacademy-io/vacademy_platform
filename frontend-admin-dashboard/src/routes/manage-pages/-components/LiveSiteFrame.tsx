/**
 * LiveSiteFrame — the canvas's "Website" view.
 *
 * Embeds the REAL learner site (`<learner>/<tag>?preview=true`) and streams
 * the editor's unsaved config into it over postMessage, so every edit shows
 * exactly as visitors will see it — same components, same style engine, same
 * breakpoints (the iframe is really 768/375px wide on tablet/mobile).
 *
 * Protocol (learner `CourseCataloguePage` preview mode):
 *   learner → editor  PREVIEW_READY, COMPONENT_SELECTED {componentId, pageId}
 *   editor → learner  CATALOGUE_CONFIG_UPDATE {payload}, HIGHLIGHT_COMPONENT {componentId}
 *
 * The learner only renders the root page from posted config, so the selected
 * page is posted AS the root page (same trick as ai_service page_preview.py) —
 * switching pages re-posts instead of reloading the frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { CircleNotch } from '@phosphor-icons/react';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useEditorStore } from '../-stores/editor-store';
import type { CatalogueConfig } from '../-types/editor-types';

/** How quickly an edit reaches the frame. Low enough to feel instant while
 *  typing, high enough not to re-render the whole site on every keystroke. */
const CONFIG_PUSH_DEBOUNCE_MS = 150;

/** No READY by then = the site cannot answer here (blocked from framing,
 *  older learner build, no page) — say so instead of spinning forever. */
const READY_TIMEOUT_MS = 15_000;

const VIEWPORT_WIDTHS = { desktop: '100%', tablet: '768px', mobile: '375px' } as const;

/** Present `pageId` as the learner's root page; rename any page already
 *  claiming the root id/route so it cannot win the match instead. */
export const asRootPage = (config: CatalogueConfig, pageId: string | null): CatalogueConfig => {
    const pages = Array.isArray(config.pages) ? config.pages : [];
    const target = pages.find((p) => p.id === pageId) ?? pages[0];
    if (!target) return config;
    const others = pages
        .filter((p) => p !== target)
        .map((p) => ({
            ...p,
            id: p.id === 'home' ? `${p.id}-x` : p.id,
            route: ['homepage', '/', ''].includes(p.route ?? '')
                ? `${p.route || 'root'}-x`
                : p.route,
        }));
    return { ...config, pages: [{ ...target, id: 'home', route: 'homepage' }, ...others] };
};

interface LiveSiteFrameProps {
    siteUrl: string;
    /** True when the institute has no learner domain of its own: the site
     *  host then cannot tell which institute this is, so the URL names it. */
    nameInstitute: boolean;
    /** The canvas's own 'canvas-drop-zone' droppable — one id, one owner. */
    dropRef: (node: HTMLElement | null) => void;
    isDropOver: boolean;
}

export const LiveSiteFrame = ({
    siteUrl,
    nameInstitute,
    dropRef,
    isDropOver,
}: LiveSiteFrameProps) => {
    const {
        config,
        selectedPageId,
        selectedComponentId,
        selectedGlobalLayout,
        selectComponent,
        selectGlobalLayout,
        previewViewport,
    } = useEditorStore();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [timedOut, setTimedOut] = useState(false);

    // Library drags still land on the page: the iframe swallows pointer events,
    // so while a drag is active a transparent overlay takes them instead.
    const { active: activeDrag } = useDndContext();

    // null = the saved portal URL is not a valid URL; show a note, never crash
    // the editor over it.
    const frameUrl = useMemo(() => {
        try {
            const url = new URL(siteUrl);
            url.searchParams.set('preview', 'true');
            // Institutes without their own domain resolve to the host's institute;
            // the learner honours this only in a framed preview.
            const instituteId = nameInstitute ? getCurrentInstituteId() : null;
            if (instituteId) url.searchParams.set('instituteId', instituteId);
            return url.toString();
        } catch {
            return null;
        }
    }, [siteUrl, nameInstitute]);
    // The origin that answered READY (a custom domain may redirect), so the
    // unsaved draft is only ever posted to the document we actually loaded.
    const frameOrigin = useRef<string | null>(null);

    const post = useCallback((message: Record<string, unknown>) => {
        if (frameOrigin.current)
            iframeRef.current?.contentWindow?.postMessage(message, frameOrigin.current);
    }, []);

    const pushConfig = useCallback(() => {
        if (!config) return;
        post({ type: 'CATALOGUE_CONFIG_UPDATE', payload: asRootPage(config, selectedPageId) });
    }, [config, selectedPageId, post]);

    // A new URL (language switch) is a new document: wait for its READY again.
    useEffect(() => {
        setIsReady(false);
        setTimedOut(false);
        frameOrigin.current = null;
        const timer = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [frameUrl]);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
            const data = event.data as {
                type?: string;
                componentId?: string;
                pageId?: string;
            } | null;
            if (data?.type === 'PREVIEW_READY') {
                frameOrigin.current = event.origin;
                setIsReady(true);
                pushConfig();
            } else if (data?.type === 'COMPONENT_SELECTED' && data.componentId) {
                if (data.pageId === 'header' || data.pageId === 'footer')
                    selectGlobalLayout(data.pageId);
                else selectComponent(data.componentId);
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [pushConfig, selectComponent, selectGlobalLayout]);

    useEffect(() => {
        if (!isReady) return;
        const timer = setTimeout(pushConfig, CONFIG_PUSH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [isReady, pushConfig]);

    const highlightId = selectedGlobalLayout
        ? config?.globalSettings?.layout?.[selectedGlobalLayout]?.id ?? null
        : selectedComponentId;
    useEffect(() => {
        if (isReady) post({ type: 'HIGHLIGHT_COMPONENT', componentId: highlightId });
    }, [isReady, highlightId, post]);

    return (
        <div className="flex flex-1 justify-center overflow-hidden p-4">
            <div
                ref={dropRef}
                className={`relative h-full max-w-full bg-white shadow-lg transition-all duration-300 ${
                    isDropOver ? 'ring-2 ring-blue-400' : ''
                }`}
                style={{ width: VIEWPORT_WIDTHS[previewViewport] }}
            >
                {frameUrl && (
                    <iframe
                        ref={iframeRef}
                        key={frameUrl}
                        src={frameUrl}
                        title="Website preview"
                        className="size-full border-0"
                    />
                )}
                {!isReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90 px-6 text-center text-sm text-catalogue-text-muted">
                        {timedOut || !frameUrl ? (
                            <>
                                <span>The website preview did not load here.</span>
                                <span>
                                    Switch to <b>Editor</b> above to keep editing, or use{' '}
                                    <b>View live</b>.
                                </span>
                            </>
                        ) : (
                            <span className="flex items-center gap-2">
                                <CircleNotch className="size-4 animate-spin" />
                                Loading the website…
                            </span>
                        )}
                    </div>
                )}
                {activeDrag && <div className="absolute inset-0 z-10" />}
            </div>
        </div>
    );
};
