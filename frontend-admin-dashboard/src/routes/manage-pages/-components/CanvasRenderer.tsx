/**
 * CanvasRenderer — the editor's centre column: a toolbar over one of two views.
 *   • Website   — the real learner site with unsaved edits (LiveSiteFrame).
 *   • Structure — an outline of the page's blocks for ordering and picking
 *                 them (PageCanvas).
 * Both accept blocks dragged from the library ('canvas-drop-zone').
 */
import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Monitor, DeviceTablet, DeviceMobile, ArrowSquareOut, Globe, ListBullets } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '../-stores/editor-store';
import { activeEditingLocale, useLocalizedView } from '../-hooks/use-localized-editing';
import { LOCALE_PARAM } from '../-utils/catalogue-i18n';
import { LiveSiteFrame } from './LiveSiteFrame';
import { PageCanvas } from './PageCanvas';
import { CATALOGUE_EDITOR_CONFIG } from '@/constants/catalogue-editor';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchBothInstituteAPIs } from '@/services/student-list-section/getInstituteDetails';

// 'editor' is the Structure view: the stored value keeps its old name so a
// browser that chose it before the rename still opens on it.
type CanvasView = 'website' | 'editor';
const CANVAS_VIEW_KEY = 'catalogue-editor-canvas-view';
const readCanvasView = (): CanvasView => {
    try {
        return localStorage.getItem(CANVAS_VIEW_KEY) === 'editor' ? 'editor' : 'website';
    } catch {
        return 'website';
    }
};

export const CanvasRenderer = ({ tagName }: { tagName: string }) => {
    const { t } = useTranslation('managePagesPageCanvas');
    const { config: storeConfig, editingLocale, selectedPageId, previewViewport, setViewport } = useEditorStore();
    // Editing another language: the toolbar names the page as it reads in that
    // language (the store config itself is in the base language).
    const config = useLocalizedView(storeConfig, editingLocale);

    // "Website" = the real learner site with unsaved edits; "Structure" = the
    // outline. Remembered per browser.
    const [canvasView, setCanvasView] = useState<CanvasView>(readCanvasView);
    const changeCanvasView = (view: CanvasView) => {
        setCanvasView(view);
        try {
            localStorage.setItem(CANVAS_VIEW_KEY, view);
        } catch {
            /* storage blocked: the choice lasts for this visit only */
        }
    };

    const { instituteDetails, setInstituteDetails } = useInstituteDetailsStore();
    const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop-zone' });

    // Fetch institute details once (needed for learner portal base URL)
    useEffect(() => {
        if (!instituteDetails) {
            fetchBothInstituteAPIs()
                .then(setInstituteDetails)
                .catch(() => {/* fallback to CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL */});
        }
    }, [instituteDetails, setInstituteDetails]);

    // Build the published preview URL (for "Open in browser" button)
    const baseUrl = instituteDetails?.learner_portal_base_url || CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL;
    const page = config?.pages.find((p) => p.id === selectedPageId);
    const pageRoute = page?.route || '';
    const isHomePage = pageRoute === '/' || pageRoute === '' || pageRoute === 'homepage';
    const fullRoute = isHomePage
        ? encodeURIComponent(tagName)
        : `${encodeURIComponent(tagName)}/${encodeURIComponent(pageRoute)}`;
    // Editing another language: "View live" opens the page in that language.
    const liveLocale = activeEditingLocale(storeConfig?.globalSettings?.i18n, editingLocale);
    const siteOrigin = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    const localeQuery = liveLocale ? `?${LOCALE_PARAM}=${encodeURIComponent(liveLocale)}` : '';
    const previewUrl = `${siteOrigin}/${fullRoute}${localeQuery}`;
    // The Website view always loads the site root; the page shown is chosen by
    // the config it is sent (see LiveSiteFrame).
    const siteRootUrl = `${siteOrigin}/${encodeURIComponent(tagName)}${localeQuery}`;
    const isPageUnpublished = !!page && !page.published;

    return (
        <div className="flex h-full flex-col bg-catalogue-bg-muted">
            {/* Canvas Toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b bg-catalogue-bg-elevated px-3 py-2">
                <div className="flex items-center gap-3">
                    {/* Viewport switcher — sizes the Website view only */}
                    {canvasView === 'website' && (
                        <div className="flex rounded-lg border bg-catalogue-bg-muted p-1">
                            <Button
                                variant={previewViewport === 'desktop' ? 'default' : 'ghost'}
                                size="sm"
                                className="size-8 p-0"
                                onClick={() => setViewport('desktop')}
                                title="Desktop"
                            >
                                <Monitor className="size-4" />
                            </Button>
                            <Button
                                variant={previewViewport === 'tablet' ? 'default' : 'ghost'}
                                size="sm"
                                className="size-8 p-0"
                                onClick={() => setViewport('tablet')}
                                title="Tablet (768px)"
                            >
                                <DeviceTablet className="size-4" />
                            </Button>
                            <Button
                                variant={previewViewport === 'mobile' ? 'default' : 'ghost'}
                                size="sm"
                                className="size-8 p-0"
                                onClick={() => setViewport('mobile')}
                                title="Mobile (375px)"
                            >
                                <DeviceMobile className="size-4" />
                            </Button>
                        </div>
                    )}

                    {/* Website (real render) vs Structure (outline) */}
                    <div className="flex rounded-lg border bg-catalogue-bg-muted p-1">
                        <Button
                            variant={canvasView === 'website' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 gap-1 px-2"
                            onClick={() => changeCanvasView('website')}
                            title={t('view.websiteTitle')}
                        >
                            <Globe className="size-4" />
                            {t('view.website')}
                        </Button>
                        <Button
                            variant={canvasView === 'editor' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 gap-1 px-2"
                            onClick={() => changeCanvasView('editor')}
                            title={t('view.structureTitle')}
                        >
                            <ListBullets className="size-4" />
                            {t('view.structure')}
                        </Button>
                    </div>

                    {page && (
                        <span className="text-xs text-catalogue-text-muted">
                            {page.title || page.route || 'Untitled'} ·{' '}
                            {page.components.length} component{page.components.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Open published page */}
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    title={isPageUnpublished ? 'This page is unpublished — visitors won\'t see it yet' : 'View live page'}
                    className={isPageUnpublished ? 'text-yellow-600 hover:text-yellow-700' : ''}
                >
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                        <ArrowSquareOut className="mr-1 size-4" />
                        {isPageUnpublished ? 'View live (draft)' : 'View live'}
                    </a>
                </Button>
            </div>

            {canvasView === 'website' ? (
                <LiveSiteFrame
                    siteUrl={siteRootUrl}
                    nameInstitute={!instituteDetails?.learner_portal_base_url}
                    dropRef={setNodeRef}
                    isDropOver={isOver}
                />
            ) : (
                <PageCanvas dropRef={setNodeRef} isDropOver={isOver} />
            )}
        </div>
    );
};
