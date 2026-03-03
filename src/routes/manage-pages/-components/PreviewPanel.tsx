import { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../-stores/editor-store';
import { Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { CATALOGUE_EDITOR_CONFIG } from '@/constants/catalogue-editor';
import { fetchBothInstituteAPIs } from '@/services/student-list-section/getInstituteDetails';

interface PreviewPanelProps {
    tagName: string;
    onComponentSelected?: (componentId: string, pageId: string) => void;
    selectedComponentId?: string | null;
}

export const PreviewPanel = ({ tagName, onComponentSelected, selectedComponentId }: PreviewPanelProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedPageRoute, setSelectedPageRoute] = useState<string>('');

    const config = useEditorStore((state) => state.config);
    const viewport = useEditorStore((state) => state.previewViewport);
    const setViewport = useEditorStore((state) => state.setViewport);
    const { instituteDetails, setInstituteDetails } = useInstituteDetailsStore();

    // Set default page route when config loads
    useEffect(() => {
        if (config?.pages && config.pages.length > 0 && !selectedPageRoute) {
            // Default to first page or '/' for home
            const firstPage = config.pages[0];
            setSelectedPageRoute(firstPage?.route || '');
        }
    }, [config, selectedPageRoute]);

    useEffect(() => {
        if (!instituteDetails) {
            console.log('[PreviewPanel] Fetching institute details from API...');
            fetchBothInstituteAPIs()
                .then((data) => {
                    console.log('[PreviewPanel] Successfully fetched details');
                    setInstituteDetails(data);
                })
                .catch((err) => {
                    console.error('[PreviewPanel] Failed to fetch institute details:', err);
                });
        }
    }, [instituteDetails, setInstituteDetails]);

    let baseUrl =
        instituteDetails?.learner_portal_base_url || CATALOGUE_EDITOR_CONFIG.LEARNER_APP_URL;

    // Ensure protocol
    if (baseUrl && !baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
    }

    // Build preview URL with selected page route
    const pageRoute = selectedPageRoute || '';
    const fullRoute = pageRoute === '/' || pageRoute === ''
        ? tagName
        : `${tagName}/${pageRoute}`;
    const previewUrl = `${baseUrl}/${fullRoute}?preview=true`;

    console.log('[PreviewPanel] Selected page route:', selectedPageRoute);
    console.log('[PreviewPanel] Final previewUrl:', previewUrl);

    const sendConfigToPreview = useCallback(() => {
        iframeRef.current?.contentWindow?.postMessage(
            {
                type: 'CATALOGUE_CONFIG_UPDATE',
                payload: config,
            },
            '*' // Target origin - in production should be specific
        );
    }, [config]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PREVIEW_READY') {
                setIsReady(true);
                sendConfigToPreview();
            }
            if (event.data?.type === 'COMPONENT_SELECTED') {
                onComponentSelected?.(event.data.componentId, event.data.pageId);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sendConfigToPreview, onComponentSelected]);

    useEffect(() => {
        if (!isReady || !config) return;

        const timeout = setTimeout(() => {
            sendConfigToPreview();
        }, CATALOGUE_EDITOR_CONFIG.PREVIEW_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [config, isReady, sendConfigToPreview]);

    // Send highlight signal to iframe when selected component changes
    useEffect(() => {
        if (!isReady) return;
        iframeRef.current?.contentWindow?.postMessage(
            { type: 'HIGHLIGHT_COMPONENT', componentId: selectedComponentId || null },
            '*'
        );
    }, [selectedComponentId, isReady]);

    const viewportSizes = CATALOGUE_EDITOR_CONFIG.VIEWPORTS;
    const currentSize = viewportSizes[viewport];

    // Get pages for dropdown
    const pages = config?.pages || [];

    return (
        <div className="flex h-full flex-col border-x bg-gray-100">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b bg-white p-2">
                <div className="flex items-center gap-3">
                    {/* Viewport Selector */}
                    <div className="flex rounded-lg border bg-gray-100 p-1">
                        <Button
                            variant={viewport === 'desktop' ? 'default' : 'ghost'}
                            size="sm"
                            className="size-8 p-0"
                            onClick={() => setViewport('desktop')}
                        >
                            <Monitor className="size-4" />
                            <span className="sr-only">Desktop</span>
                        </Button>
                        <Button
                            variant={viewport === 'tablet' ? 'default' : 'ghost'}
                            size="sm"
                            className="size-8 p-0"
                            onClick={() => setViewport('tablet')}
                        >
                            <Tablet className="size-4" />
                            <span className="sr-only">Tablet</span>
                        </Button>
                        <Button
                            variant={viewport === 'mobile' ? 'default' : 'ghost'}
                            size="sm"
                            className="size-8 p-0"
                            onClick={() => setViewport('mobile')}
                        >
                            <Smartphone className="size-4" />
                            <span className="sr-only">Mobile</span>
                        </Button>
                    </div>

                    {/* Page Selector */}
                    {pages.length > 0 && (
                        <div className="flex items-center gap-2">
                            <FileText className="size-4 text-gray-500" />
                            <Select
                                value={selectedPageRoute}
                                onValueChange={(value) => setSelectedPageRoute(value)}
                            >
                                <SelectTrigger className="h-8 w-48">
                                    <SelectValue placeholder="Select page" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pages.map((page) => (
                                        <SelectItem key={page.id} value={page.route}>
                                            {page.title || page.route || 'Home'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (iframeRef.current) iframeRef.current.src = previewUrl;
                        }}
                    >
                        <RefreshCw className="mr-1 size-4" />
                        Refresh
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 size-4" />
                            Open
                        </a>
                    </Button>
                </div>
            </div>

            {/* Preview Frame */}
            <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-200 p-4">
                <div
                    className="overflow-hidden border border-gray-300 bg-white shadow-lg transition-all duration-300"
                    style={{
                        width: currentSize.width,
                        height: viewport === 'desktop' ? '100%' : currentSize.height,
                        maxWidth: '100%',
                        maxHeight: '100%',
                    }}
                >
                    <iframe
                        ref={iframeRef}
                        key={previewUrl}
                        src={previewUrl}
                        className="size-full border-0"
                        title="Catalogue Preview"
                        width="100%"
                        height="100%"
                        referrerPolicy="no-referrer"
                    />
                </div>
            </div>
        </div>
    );
};
