/**
 * LiveSiteFrame — the canvas's "Website" view.
 *
 * Embeds the REAL learner site (`<learner>/<tag>?preview=true`) and streams
 * the editor's unsaved config into it over postMessage, so every edit shows
 * exactly as visitors will see it — same components, same style engine, same
 * breakpoints. The frame is laid out at a real device width (desktop 1440 or
 * 1280, tablet 768, phone 375) and scaled down to fit the canvas, so the
 * desktop view is the desktop site, not whatever width the canvas has left.
 *
 * Protocol (learner `CourseCataloguePage` preview mode, -utils/preview-bridge.ts):
 *   learner → editor  PREVIEW_READY, COMPONENT_SELECTED {componentId, pageId, parentId?},
 *                     PREVIEW_NAVIGATE {route}
 *   editor → learner  CATALOGUE_CONFIG_UPDATE {payload, previewPath},
 *                     HIGHLIGHT_COMPONENT {componentId}, PREVIEW_INTERACT {on}
 * A learner build without the newer messages simply ignores them.
 *
 * The learner only renders the root page from posted config, so the selected
 * page is posted AS the root page (same trick as ai_service page_preview.py) —
 * switching pages re-posts instead of reloading the frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { CircleNotch, Cursor, HandPointing } from '@phosphor-icons/react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useEditorStore } from '../-stores/editor-store';
import { activeEditingLocale } from '../-hooks/use-localized-editing';
import type { CatalogueConfig, Component, Page } from '../-types/editor-types';

/** How quickly an edit reaches the frame. Low enough to feel instant while
 *  typing, high enough not to re-render the whole site on every keystroke. */
const CONFIG_PUSH_DEBOUNCE_MS = 150;

/** No READY by then = the site cannot answer here (blocked from framing,
 *  older learner build, no page) — say so instead of spinning forever. */
const READY_TIMEOUT_MS = 15_000;

/** Real layout widths, in CSS px. Desktop offers a common laptop width too. */
const DESKTOP_WIDTHS = [1440, 1280] as const;
const DEVICE_WIDTHS = { tablet: 768, mobile: 375 } as const;

const HOME_ROUTES = ['', '/', 'homepage', 'home'];
const trimSlashes = (route: string) => route.replace(/^\/+|\/+$/g, '');

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

/** The page the frame shows: the selected one, else the first (asRootPage). */
export const shownPageOf = (config: CatalogueConfig | null, pageId: string | null): Page | undefined => {
    const pages = Array.isArray(config?.pages) ? config.pages : [];
    return pages.find((p) => p.id === pageId) ?? pages[0];
};

/** The shown page's real route ("" = home), so the site's header marks the
 *  right nav item although every page is previewed at the site root. */
export const previewPathOf = (page: Page | undefined): string => {
    const route = trimSlashes(page?.route ?? '');
    return HOME_ROUTES.includes(route.toLowerCase()) ? '' : route;
};

/**
 * What the frame is sent. Editing in another language loads the frame with
 * ?lang=; the site honours that only when languages are switched on, so the
 * preview switches them on (an admin may translate before going live).
 */
export const framePayload = (
    config: CatalogueConfig,
    pageId: string | null,
    locale: string | null
): CatalogueConfig => {
    const root = asRootPage(config, pageId);
    const i18n = root.globalSettings?.i18n;
    if (!locale || !i18n || i18n.enabled) return root;
    return { ...root, globalSettings: { ...root.globalSettings, i18n: { ...i18n, enabled: true } } };
};

/** The page a link inside the site points at (PREVIEW_NAVIGATE), by route;
 *  a deeper route ("blog/first-post") opens its page ("blog"). */
export const pageForRoute = (pages: Page[], route: string): Page | undefined => {
    const wanted = trimSlashes(route).toLowerCase();
    const byRoute = (r: string) => pages.find((p) => trimSlashes(p.route ?? '').toLowerCase() === r);
    if (HOME_ROUTES.includes(wanted)) {
        return pages.find((p) => HOME_ROUTES.includes(trimSlashes(p.route ?? '').toLowerCase())) ??
            pages.find((p) => p.id === 'home');
    }
    return byRoute(wanted) ?? byRoute(wanted.split('/')[0] ?? '');
};

const containsComponent = (components: Component[], id: string): boolean =>
    components.some(
        (c) =>
            c.id === id ||
            (Array.isArray(c.props?.slots) &&
                (c.props.slots as unknown[]).some(
                    (slot) => Array.isArray(slot) && containsComponent(slot as Component[], id)
                ))
    );

/** The block to open for a click in the frame: the block itself when the
 *  editor reaches it (top level, or inside a column), else the block holding
 *  it (a block inside a tab is edited through its tabs block). */
export const selectableId = (
    components: Component[],
    componentId: string,
    parentId?: string
): string =>
    !parentId || containsComponent(components, componentId) || !containsComponent(components, parentId)
        ? componentId
        : parentId;

/** Scale that fits `logicalWidth` into `containerWidth` (Fit), never above
 *  real size; 100% shows the page at real size and scrolls sideways. */
export const frameScale = (containerWidth: number, logicalWidth: number, fit: boolean): number =>
    fit && containerWidth > 0 && containerWidth < logicalWidth ? containerWidth / logicalWidth : 1;

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
    const { t } = useTranslation('managePagesLiveSiteFrame');
    const {
        config,
        editingLocale,
        selectedPageId,
        selectedComponentId,
        selectedGlobalLayout,
        selectPage,
        selectComponent,
        selectGlobalLayout,
        previewViewport,
    } = useEditorStore();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [timedOut, setTimedOut] = useState(false);
    // Browse: the site is clickable (menus, filters, tabs) instead of
    // click-to-select. Select stays the default.
    const [browse, setBrowse] = useState(false);
    const [fit, setFit] = useState(true);
    const [desktopWidth, setDesktopWidth] = useState<number>(DESKTOP_WIDTHS[0]);

    // Library drags still land on the page: the iframe swallows pointer events,
    // so while a drag is active a transparent overlay takes them instead.
    const { active: activeDrag } = useDndContext();

    // The canvas area the frame is fitted into.
    const [area, setArea] = useState({ width: 0, height: 0 });
    const areaRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = areaRef.current;
        if (!node || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    const logicalWidth = previewViewport === 'desktop' ? desktopWidth : DEVICE_WIDTHS[previewViewport];
    const scale = frameScale(area.width, logicalWidth, fit);

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

    const locale = activeEditingLocale(config?.globalSettings?.i18n, editingLocale);
    const shownPage = shownPageOf(config, selectedPageId);
    const pushConfig = useCallback(() => {
        if (!config) return;
        post({
            type: 'CATALOGUE_CONFIG_UPDATE',
            payload: framePayload(config, selectedPageId, locale),
            previewPath: previewPathOf(shownPage),
        });
    }, [config, selectedPageId, locale, shownPage, post]);

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
                parentId?: string;
                pageId?: string;
                route?: string;
            } | null;
            if (data?.type === 'PREVIEW_READY') {
                frameOrigin.current = event.origin;
                setIsReady(true);
                pushConfig();
            } else if (data?.type === 'COMPONENT_SELECTED' && data.componentId) {
                if (data.pageId === 'header' || data.pageId === 'footer') {
                    selectGlobalLayout(data.pageId);
                    return;
                }
                // The block is on the shown page; with Global Settings open no
                // page is selected, so select that page first (it clears the
                // block selection, hence before selectComponent).
                if (shownPage && shownPage.id !== selectedPageId) selectPage(shownPage.id);
                selectComponent(selectableId(shownPage?.components ?? [], data.componentId, data.parentId));
            } else if (data?.type === 'PREVIEW_NAVIGATE' && typeof data.route === 'string') {
                // Browse mode: a link to another page opens that page's tab.
                const page = pageForRoute(config?.pages ?? [], data.route);
                if (page && page.id !== selectedPageId) selectPage(page.id);
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [pushConfig, config, shownPage, selectedPageId, selectPage, selectComponent, selectGlobalLayout]);

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

    // Re-sent on every READY: a reloaded frame starts in Select.
    useEffect(() => {
        if (isReady) post({ type: 'PREVIEW_INTERACT', on: browse });
    }, [isReady, browse, post]);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pt-3">
                <div className="flex rounded-lg border bg-catalogue-bg-elevated p-0.5">
                    <Button
                        variant={browse ? 'ghost' : 'default'}
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setBrowse(false)}
                        title={t('toolbar.selectHint')}
                        aria-pressed={!browse}
                    >
                        <Cursor className="size-3.5" />
                        {t('toolbar.select')}
                    </Button>
                    <Button
                        variant={browse ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => setBrowse(true)}
                        title={t('toolbar.browseHint')}
                        aria-pressed={browse}
                    >
                        <HandPointing className="size-3.5" />
                        {t('toolbar.browse')}
                    </Button>
                </div>
                {previewViewport === 'desktop' && (
                    <div className="flex rounded-lg border bg-catalogue-bg-elevated p-0.5" title={t('toolbar.desktopWidthHint')}>
                        {DESKTOP_WIDTHS.map((width) => (
                            <Button
                                key={width}
                                variant={desktopWidth === width ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setDesktopWidth(width)}
                                aria-pressed={desktopWidth === width}
                            >
                                {t('toolbar.widthPx', { width })}
                            </Button>
                        ))}
                    </div>
                )}
                <div className="flex rounded-lg border bg-catalogue-bg-elevated p-0.5">
                    <Button
                        variant={fit ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFit(true)}
                        title={t('toolbar.fitHint')}
                        aria-pressed={fit}
                    >
                        {t('toolbar.fit')}
                    </Button>
                    <Button
                        variant={fit ? 'ghost' : 'default'}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setFit(false)}
                        title={t('toolbar.actualSizeHint')}
                        aria-pressed={!fit}
                    >
                        {t('toolbar.actualSize')}
                    </Button>
                </div>
                {scale < 1 && (
                    <span className="text-xs text-catalogue-text-muted">
                        {t('toolbar.scaledTo', { percent: Math.round(scale * 100) })}
                    </span>
                )}
            </div>
            <div
                ref={areaRef}
                data-testid="live-site-area"
                className={`flex-1 p-4 ${fit ? 'overflow-hidden' : 'overflow-auto'}`}
            >
                <div
                    ref={dropRef}
                    className={`relative mx-auto overflow-hidden bg-white shadow-lg ${
                        isDropOver ? 'ring-2 ring-blue-400' : ''
                    }`}
                    // Measured layout: the frame's box is its real width
                    // shrunk by the fit scale, as tall as the canvas.
                    style={{ width: logicalWidth * scale, height: area.height || '100%' }}
                >
                    {frameUrl && (
                        <iframe
                            ref={iframeRef}
                            key={frameUrl}
                            src={frameUrl}
                            title={t('frameTitle')}
                            className="block border-0"
                            // Laid out at the device width, then scaled to the box.
                            style={{
                                width: logicalWidth,
                                height: area.height ? area.height / scale : '100%',
                                transform: scale === 1 ? undefined : `scale(${scale})`,
                                transformOrigin: 'top left',
                            }}
                        />
                    )}
                    {!isReady && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90 px-6 text-center text-sm text-catalogue-text-muted">
                            {timedOut || !frameUrl ? (
                                <>
                                    <span>{t('failed.title')}</span>
                                    <span>
                                        <Trans t={t} i18nKey="failed.hint" components={{ b: <b /> }} />
                                    </span>
                                </>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <CircleNotch className="size-4 animate-spin" />
                                    {t('loading')}
                                </span>
                            )}
                        </div>
                    )}
                    {activeDrag && <div className="absolute inset-0 z-10" />}
                </div>
            </div>
        </div>
    );
};
