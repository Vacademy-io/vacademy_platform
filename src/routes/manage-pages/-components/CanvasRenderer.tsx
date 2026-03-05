/**
 * CanvasRenderer — the direct-DOM editing canvas.
 * Replaces the iframe+postMessage approach.
 * Components render directly in the admin window, enabling:
 *   • True DnD (drag from sidebar, drop here)
 *   • Instant live preview with no postMessage round-trip
 *   • Reliable click-to-select
 */
import React, { useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Monitor, Tablet, Smartphone, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '../-stores/editor-store';
import { renderComponentPreview } from './ComponentPreviews';
import { CATALOGUE_EDITOR_CONFIG } from '@/constants/catalogue-editor';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchBothInstituteAPIs } from '@/services/student-list-section/getInstituteDetails';

export const CanvasRenderer = ({ tagName }: { tagName: string }) => {
    const {
        config,
        selectedPageId,
        selectedComponentId,
        selectComponent,
        selectGlobalLayout,
        selectedGlobalLayout,
        previewViewport,
        setViewport,
    } = useEditorStore();

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

    const viewportSizes = CATALOGUE_EDITOR_CONFIG.VIEWPORTS;
    const currentSize = viewportSizes[previewViewport];

    // Build the published preview URL (for "Open in browser" button)
    const baseUrl = instituteDetails?.learner_portal_base_url || CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL;
    const page = config?.pages.find((p) => p.id === selectedPageId);
    const pageRoute = page?.route || '';
    const isHomePage = pageRoute === '/' || pageRoute === '' || pageRoute === 'homepage';
    const fullRoute = isHomePage
        ? encodeURIComponent(tagName)
        : `${encodeURIComponent(tagName)}/${encodeURIComponent(pageRoute)}`;
    const previewUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/${fullRoute}`;
    const isPageUnpublished = !!page && !page.published;

    const canvasWidth = previewViewport === 'desktop' ? '100%' : currentSize.width;

    return (
        <div className="flex h-full flex-col bg-gray-100">
            {/* Canvas Toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b bg-white px-3 py-2">
                <div className="flex items-center gap-3">
                    {/* Viewport switcher */}
                    <div className="flex rounded-lg border bg-gray-100 p-1">
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
                            <Tablet className="size-4" />
                        </Button>
                        <Button
                            variant={previewViewport === 'mobile' ? 'default' : 'ghost'}
                            size="sm"
                            className="size-8 p-0"
                            onClick={() => setViewport('mobile')}
                            title="Mobile (375px)"
                        >
                            <Smartphone className="size-4" />
                        </Button>
                    </div>

                    {page && (
                        <span className="text-xs text-gray-400">
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
                        <ExternalLink className="mr-1 size-4" />
                        {isPageUnpublished ? 'View live (draft)' : 'View live'}
                    </a>
                </Button>
            </div>

            {/* Drop zone + scrollable canvas */}
            <div
                ref={setNodeRef}
                className={`flex flex-1 justify-center overflow-auto p-6 transition-colors ${
                    isOver ? 'bg-blue-50' : ''
                }`}
                onClick={() => selectComponent(null)}
            >
                {/* Width-constrained canvas */}
                <div
                    className={`relative bg-white shadow-lg transition-all duration-300 ${
                        isOver ? 'ring-2 ring-blue-400' : ''
                    }`}
                    style={{
                        width: canvasWidth,
                        maxWidth: '100%',
                        minHeight: '100%',
                    }}
                >
                    {/* Global Header — appears on every page */}
                    {config?.globalSettings?.layout?.header && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                selectGlobalLayout('header');
                            }}
                            className={`relative cursor-pointer border-b-2 border-dashed border-purple-200 transition-all ${
                                selectedGlobalLayout === 'header'
                                    ? 'outline outline-2 outline-purple-500 outline-offset-[-2px]'
                                    : 'hover:outline hover:outline-1 hover:outline-purple-300 hover:outline-offset-[-1px]'
                            }`}
                            title="Global Header (appears on all pages)"
                        >
                            <div className="absolute left-0 top-0 z-50 select-none rounded-br bg-purple-500 px-2 py-0.5 text-[10px] font-medium text-white">
                                Global Header
                            </div>
                            <div style={{ pointerEvents: 'none' }}>
                                {renderComponentPreview(config.globalSettings.layout.header)}
                            </div>
                        </div>
                    )}

                    {/* Page components */}
                    {!config || !selectedPageId ? (
                        <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-gray-400">
                            Select a page from the bottom bar to start editing
                        </div>
                    ) : !page ? null : page.components.length === 0 ? (
                        <div className="flex h-full min-h-[400px] flex-col items-center justify-center">
                            <div className="rounded-xl border-2 border-dashed border-gray-200 px-12 py-16 text-center">
                                <div className="mb-2 text-base font-medium text-gray-400">
                                    This page is empty
                                </div>
                                <p className="text-sm text-gray-300">
                                    Drag components from the left sidebar, or click one to add it
                                </p>
                            </div>
                        </div>
                    ) : (
                        page.components.map((component) => {
                            const isSelected = component.id === selectedComponentId;
                            const isDisabled = component.enabled === false;
                            return (
                                <div
                                    key={component.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectComponent(component.id);
                                    }}
                                    className={`relative cursor-pointer transition-all ${
                                        isDisabled ? 'opacity-40' : ''
                                    } ${
                                        isSelected
                                            ? 'outline outline-2 outline-blue-500 outline-offset-[-2px]'
                                            : 'hover:outline hover:outline-1 hover:outline-blue-300 hover:outline-offset-[-1px]'
                                    }`}
                                    title={isDisabled ? `${component.type} (hidden)` : component.type}
                                >
                                    {/* Selection label */}
                                    {isSelected && (
                                        <div className="absolute left-0 top-0 z-50 select-none rounded-br-md bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
                                            {component.type}
                                        </div>
                                    )}
                                    {/* Disabled overlay badge */}
                                    {isDisabled && (
                                        <div className="absolute right-2 top-2 z-40 rounded bg-gray-400 px-1.5 py-0.5 text-[10px] text-white">
                                            hidden
                                        </div>
                                    )}
                                    {/* Disable pointer events so child links/buttons don't interfere */}
                                    <div style={{ pointerEvents: 'none' }}>
                                        {renderComponentPreview(component)}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Global Footer — appears on every page */}
                    {config?.globalSettings?.layout?.footer && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                selectGlobalLayout('footer');
                            }}
                            className={`relative cursor-pointer border-t-2 border-dashed border-purple-200 transition-all ${
                                selectedGlobalLayout === 'footer'
                                    ? 'outline outline-2 outline-purple-500 outline-offset-[-2px]'
                                    : 'hover:outline hover:outline-1 hover:outline-purple-300 hover:outline-offset-[-1px]'
                            }`}
                            title="Global Footer (appears on all pages)"
                        >
                            <div className="absolute left-0 top-0 z-50 select-none rounded-br bg-purple-500 px-2 py-0.5 text-[10px] font-medium text-white">
                                Global Footer
                            </div>
                            <div style={{ pointerEvents: 'none' }}>
                                {renderComponentPreview(config.globalSettings.layout.footer)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
