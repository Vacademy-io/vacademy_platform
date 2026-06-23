import React from 'react';
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';
import type {
    ToolbarSlot,
    ToolbarProps,
    TransformToolbarSlot,
} from '@react-pdf-viewer/toolbar';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/full-screen/lib/styles/index.css';

const PDF_WORKER_URL =
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface SimplePDFViewerProps {
    pdfUrl: string;
}

const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({ pdfUrl }) => {
    // Fit the page to width when entering/exiting fullscreen so it fills the
    // (much wider) fullscreen viewport instead of keeping its load-time scale
    // and leaving large empty side margins. defaultLayoutPlugin doesn't expose
    // its internal full-screen plugin, so we run our own (with the zoom
    // callback) and route the toolbar's fullscreen button to it below.
    const fullScreenPluginInstance = fullScreenPlugin({
        onEnterFullScreen: (zoom) => zoom(SpecialZoomLevel.PageWidth),
        onExitFullScreen: (zoom) => zoom(SpecialZoomLevel.PageWidth),
    });
    const { EnterFullScreenButton } = fullScreenPluginInstance;

    const transform: TransformToolbarSlot = (slot: ToolbarSlot) => ({
        ...slot,
        // Use our fullscreen button (configured to fit page width on
        // enter/exit) instead of the default-layout's internal one.
        EnterFullScreen: () => <EnterFullScreenButton />,
    });

    const renderToolbar = (
        Toolbar: (props: ToolbarProps) => React.ReactElement
    ) => <Toolbar>{renderDefaultToolbar(transform)}</Toolbar>;

    const defaultLayoutPluginInstance = defaultLayoutPlugin({ renderToolbar });
    const { renderDefaultToolbar } =
        defaultLayoutPluginInstance.toolbarPluginInstance;

    return (
        <Worker workerUrl={PDF_WORKER_URL}>
            <div className="size-full">
                <Viewer
                    fileUrl={pdfUrl}
                    plugins={[
                        defaultLayoutPluginInstance,
                        fullScreenPluginInstance,
                    ]}
                    defaultScale={SpecialZoomLevel.PageWidth}
                />
            </div>
        </Worker>
    );
};

export default SimplePDFViewer;
