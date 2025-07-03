import React, { useEffect, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { fetchExcalidrawContent, ExcalidrawSceneData } from './excalidrawUtils';

interface ExcalidrawViewerProps {
    fileId: string | null | undefined;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = ({ fileId }) => {
    const [scene, setScene] = useState<ExcalidrawSceneData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

    useEffect(() => {
        const loadContent = async () => {
            if (!fileId) {
                setIsLoading(false);
                setError('No file ID provided');
                return;
            }

            setIsLoading(true);
            setError(null);
            
            try {
                const content = await fetchExcalidrawContent(fileId);
                if (content) {
                    setScene(content);
                } else {
                    setError('Failed to load diagram content');
                }
            } catch (err) {
                console.error('[ExcalidrawViewer] Error loading content:', err);
                setError('Error loading diagram content');
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [fileId]);

    const centerContent = () => {
        console.log('[ExcalidrawViewer] Center button clicked');
        console.log('[ExcalidrawViewer] excalidrawAPI:', excalidrawAPI);
        console.log('[ExcalidrawViewer] scene?.elements:', scene?.elements);

        if (!excalidrawAPI) {
            console.log('[ExcalidrawViewer] No excalidrawAPI available');
            return;
        }

        if (!scene?.elements || scene.elements.length === 0) {
            console.log('[ExcalidrawViewer] No elements to center');
            return;
        }

        console.log('[ExcalidrawViewer] Available API methods:', Object.keys(excalidrawAPI));

        try {
            // Try different methods to center content
            if (typeof excalidrawAPI.scrollToContent === 'function') {
                console.log('[ExcalidrawViewer] Using scrollToContent method');
                excalidrawAPI.scrollToContent(scene.elements, {
                    fitToContent: true,
                    animate: true,
                });
            } else if (typeof excalidrawAPI.updateScene === 'function') {
                console.log('[ExcalidrawViewer] Using updateScene method with manual calculation');
                
                // Manual calculation as fallback
                const elements = scene.elements;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                
                elements.forEach(element => {
                    if (element.x < minX) minX = element.x;
                    if (element.y < minY) minY = element.y;
                    if (element.x + (element.width || 0) > maxX) maxX = element.x + (element.width || 0);
                    if (element.y + (element.height || 0) > maxY) maxY = element.y + (element.height || 0);
                });

                if (minX !== Infinity) {
                    const contentCenterX = (minX + maxX) / 2;
                    const contentCenterY = (minY + maxY) / 2;
                    const viewportWidth = 600;
                    const viewportHeight = window.innerHeight * 0.80; // 75% of screen height
                    
                    const scrollX = -(contentCenterX - viewportWidth / 2);
                    const scrollY = -(contentCenterY - viewportHeight / 2);

                    excalidrawAPI.updateScene({
                        appState: {
                            scrollX,
                            scrollY,
                            zoom: { value: 1 as any }
                        }
                    });
                }
            } else {
                console.log('[ExcalidrawViewer] No suitable centering method found');
            }
        } catch (error) {
            console.error('[ExcalidrawViewer] Error centering content:', error);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center w-full h-[80vh] bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-600 font-medium">Loading diagram...</p>
                </div>
            </div>
        );
    }
    
    // Error state
    if (error || !scene) {
        return (
            <div className="flex items-center justify-center w-full h-[80vh] bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-col items-center space-y-3 text-center max-w-md">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-900">Unable to load diagram</h3>
                        <p className="text-xs text-gray-500 mt-1">{error || 'The diagram content could not be loaded'}</p>
                    </div>
                </div>
            </div>
        );
    }

    // Prepare the initial data for Excalidraw
    const initialData = {
        elements: scene.elements || [],
        appState: {
            viewBackgroundColor: "#FFFFFF",
            collaborators: new Map(),
            currentItemFontFamily: 1,
            scrollX: 0,
            scrollY: 0,
            zenModeEnabled: false,
            gridSize: null,
            ...scene.appState
        }
    };

    return (
        <div className="w-full h-[80vh] bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden relative">
            {/* Center Content Button */}
            <button
                onClick={centerContent}
                className="absolute top-3 right-3 z-20 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 flex items-center space-x-2"
                title="Center diagram content"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Center</span>
            </button>

            <div className="w-full h-full">
                <Excalidraw
                    excalidrawAPI={(api) => {
                        console.log('[ExcalidrawViewer] Excalidraw API received:', api);
                        setExcalidrawAPI(api);
                    }}
                    initialData={initialData as any}
                    viewModeEnabled={true}
                    zenModeEnabled={false}
                    UIOptions={{
                        canvasActions: {
                            export: false,
                            loadScene: false,
                            saveToActiveFile: false,
                            toggleTheme: false,
                            clearCanvas: false,
                        },
                        tools: {
                            image: false,
                        },
                    }}
                />
            </div>
        </div>
    );
};