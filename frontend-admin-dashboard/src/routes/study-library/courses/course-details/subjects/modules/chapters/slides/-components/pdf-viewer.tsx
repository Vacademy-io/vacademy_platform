import { useEffect } from 'react';
import { Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import type { ToolbarProps, ToolbarSlot, TransformToolbarSlot } from '@react-pdf-viewer/toolbar';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { useMediaNavigationStore } from '../-stores/media-navigation-store';
import { toast } from 'sonner';
import { useSlideDownloadAccess } from '@/hooks/useSlideDownloadAccess';

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

    // Per-role enforcement: hide Download/Print for roles an admin has blocked
    // (admins keep them by default). We must wait for `isResolved` before
    // mounting the Viewer — its toolbar is built once at mount and won't rebuild
    // when the transform changes, so mounting before the setting loads would
    // bake in the default-allow value and never hide the buttons for a blocked
    // role (e.g. a teacher).
    const { canDownload, canPrintPdf, isResolved } = useSlideDownloadAccess();
    const allowDownload = canDownload('DOCUMENT_PDF');
    // Print inherits the download permission unless explicitly configured.
    const allowPrint = canPrintPdf();

    const transform: TransformToolbarSlot = (slot: ToolbarSlot) => ({
        ...slot,
        Open: () => <></>,
        ...(allowDownload ? {} : { Download: () => <></>, DownloadMenuItem: () => <></> }),
        ...(allowPrint ? {} : { Print: () => <></>, PrintMenuItem: () => <></> }),
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
                {isResolved ? (
                    <Viewer
                        fileUrl={pdfUrl}
                        defaultScale={SpecialZoomLevel.PageWidth}
                        plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-sm text-neutral-400">
                        Loading…
                    </div>
                )}
            </div>
        </Worker>
    );
};

export default PDFViewer;
