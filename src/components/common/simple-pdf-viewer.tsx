import React from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { PDF_WORKER_URL } from '@/constants/urls';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface SimplePDFViewerProps {
    pdfUrl: string;
}

/**
 * Simple PDF Viewer component without route dependencies
 * Can be used anywhere in the application
 */
const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({ pdfUrl }) => {
    // Create plugin instance outside of render to avoid hooks issues
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    return (
        <Worker workerUrl={PDF_WORKER_URL}>
            <div className="size-full">
                <Viewer fileUrl={pdfUrl} plugins={[defaultLayoutPluginInstance]} />
            </div>
        </Worker>
    );
};

export default SimplePDFViewer;
