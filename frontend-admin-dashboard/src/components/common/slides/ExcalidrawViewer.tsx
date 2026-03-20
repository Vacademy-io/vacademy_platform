// ExcalidrawViewer.tsx
/* eslint-disable */
// @ts-nocheck
'use client';

import React, { memo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '../excalidraw/packages/excalidraw/element/types';

interface ExcalidrawViewerProps {
    elements: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = memo(
    ({ elements, appState, files }) => {
        console.log('[ExcalidrawViewer] Props received:');
        console.log(elements);

        console.log(
            '  [ExcalidrawViewer] Received files keys:',
            files ? Object.keys(files) : 'files prop is null/undefined'
        );
        if (files && Object.keys(files).length > 0) {
            const firstFileId = Object.keys(files)[0];
            const firstFile = files[firstFileId];
            console.log(
                `  [ExcalidrawViewer] Data for first received file ('${firstFileId}'): mimeType=${firstFile?.mimeType}, dataURL exists?=${!!firstFile?.dataURL}, dataURL length=${firstFile?.dataURL?.length}`
            );
        }

        // Crucial check: Do referenced fileIds exist in the files prop with a dataURL?
        elements?.forEach((element) => {
            if (element.type === 'image' && (element as any).fileId) {
                const fileId = (element as any).fileId;
                if (!files || !files[fileId]) {
                    console.warn(
                        `  [ExcalidrawViewer] DIAGNOSTIC: Image element (id: ${element.id}) references fileId '${fileId}', but this fileId is NOT FOUND in the 'files' prop.`
                    );
                } else if (!files[fileId].dataURL) {
                    console.warn(
                        `  [ExcalidrawViewer] DIAGNOSTIC: Image element (id: ${element.id}) references fileId '${fileId}', found in 'files' prop, but its dataURL is MISSING or empty.`
                    );
                } else if (files[fileId].dataURL.length < 100) {
                    // Arbitrary short length check
                    console.warn(
                        `  [ExcalidrawViewer] DIAGNOSTIC: Image element (id: ${element.id}) references fileId '${fileId}', its dataURL seems very short: ${files[fileId].dataURL.substring(0, 30)}...`
                    );
                }
            }
        });
        return (
            <div style={{ height: '100vh', width: '100vw' }}>
                <Excalidraw
                    initialData={{
                        elements: elements,
                        appState: {
                            viewBackgroundColor: '#ffffff',

                            theme: 'light',
                            ...appState,
                        },
                        files: files,
                        scrollToContent: true,
                    }}
                    viewModeEnabled={true}
                    zenModeEnabled={true}
                    UIOptions={{
                        canvasActions: {
                            changeViewBackgroundColor: false,
                            clearCanvas: false,
                            export: false,
                            loadScene: false,
                            saveAsImage: false,
                            saveToActiveFile: false,
                            toggleTheme: false,
                        },
                        tools: {
                            image: false,
                        },
                        dockedSidebarBreakpoint: 0, // Hide sidebar trigger
                    }}
                />
            </div>
        );
    }
);

ExcalidrawViewer.displayName = 'ExcalidrawViewer';
