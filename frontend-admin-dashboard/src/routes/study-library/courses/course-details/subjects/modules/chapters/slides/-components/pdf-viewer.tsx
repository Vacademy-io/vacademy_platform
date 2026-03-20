import { useEffect } from 'react';
import { Viewer } from '@react-pdf-viewer/core';
import { Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import type { ToolbarProps, ToolbarSlot, TransformToolbarSlot } from '@react-pdf-viewer/toolbar';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { useMediaNavigationStore } from '../-stores/media-navigation-store';
import { toast } from 'sonner';

// Style imports
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { PDF_WORKER_URL } from '@/constants/urls';
import { Route } from '..';

interface PDFViewerProps {
    pdfUrl: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl }) => {
    const searchParams = Route.useSearch();
    const { pdfPageNumber, clearPdfPageNumber } = useMediaNavigationStore();

    const pageNavigationPluginInstance = pageNavigationPlugin();
    const { jumpToPage } = pageNavigationPluginInstance;

    const transform: TransformToolbarSlot = (slot: ToolbarSlot) => ({
        ...slot,
        Open: () => <></>,
    });

    const renderToolbar = (Toolbar: (props: ToolbarProps) => React.ReactElement) => (
        <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>
    );

    const defaultLayoutPluginInstance = defaultLayoutPlugin({
        renderToolbar,
    });
    const { renderDefaultToolbar } = defaultLayoutPluginInstance.toolbarPluginInstance;

    // Handle initial page navigation from URL params
    useEffect(() => {
        if (searchParams.currentPage) {
            try {
                // Convert 1-based page number to 0-based index
                const pageIndex = Number(searchParams.currentPage) - 1;
                jumpToPage(pageIndex);
            } catch (error) {
                console.error('Error jumping to initial page:', error);
                toast.error('Failed to navigate to initial page');
            }
        }
    }, [searchParams.currentPage, jumpToPage]);

    // Handle page navigation when pdfPageNumber changes
    useEffect(() => {
        if (pdfPageNumber !== null) {
            try {
                // Convert 1-based page number to 0-based index
                const pageIndex = pdfPageNumber - 1;
                jumpToPage(pageIndex);
                clearPdfPageNumber();
                toast.success(`Navigated to page ${pdfPageNumber}`);
            } catch (error) {
                console.error('Error jumping to page:', error);
                toast.error('Failed to navigate to page');
                clearPdfPageNumber();
            }
        }
    }, [pdfPageNumber, clearPdfPageNumber, jumpToPage]);

    return (
        <Worker workerUrl={PDF_WORKER_URL}>
            <div className="size-full">
                <Viewer
                    fileUrl={pdfUrl}
                    plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
                />
            </div>
        </Worker>
    );
};

export default PDFViewer;
