// src/components/ExcalidrawViewer.tsx
import React, { useEffect, useState, lazy, Suspense, type ComponentType } from 'react';
import { fetchExcalidrawContent } from '@/lib/excalidrawUtils';
import { LoadingSpinner } from './LoadingSpinner';
import type {
   ExcalidrawInitialDataState, ExcalidrawProps, ExcalidrawImperativeAPI
} from '@excalidraw/excalidraw/types';

// Explicitly type the lazy loaded component
const Excalidraw = lazy(() => 
  import('@excalidraw/excalidraw').then(module => 
    ({ default: module.Excalidraw as ComponentType<ExcalidrawProps> })
  )
);

interface ExcalidrawViewerProps {
  fileId: string;
  slideTitle?: string;
  onApiReady?: (api: ExcalidrawImperativeAPI | null) => void;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = ({ fileId, slideTitle, onApiReady }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentInitialData, setCurrentInitialData] = useState<ExcalidrawInitialDataState | null>(null);

  useEffect(() => {
    let _isMounted = true;
    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      setCurrentInitialData(null); 
      try {
        const fetchedData = await fetchExcalidrawContent(fileId);
        if (_isMounted) {
          if (fetchedData && fetchedData.elements) {
            const baseAppState = fetchedData.appState || {};
            const newAppState = {
              ...baseAppState,
              viewBackgroundColor: baseAppState.viewBackgroundColor || '#FFFFFF',
              currentItemFontFamily: baseAppState.currentItemFontFamily || 1,
              collaborators: baseAppState.collaborators instanceof Map ? baseAppState.collaborators : new Map(),
              scrollToContent: true, // Enable initial auto-scroll via appState
            };
            console.log(`[ExcalidrawViewer] For fileId: ${fileId}, newAppState being set in initialData:`, JSON.parse(JSON.stringify(newAppState)));

            setCurrentInitialData({
              elements: fetchedData.elements as any, 
              appState: newAppState,
              files: fetchedData.files || undefined,
            });
          } else {
            setError(`Could not load or parse Excalidraw content for ID: ${fileId}. Data: ${JSON.stringify(fetchedData)}`);
          }
        }
      } catch (err: any) {
        if (_isMounted) {
          setError(err.message || "Failed to load Excalidraw data.");
        }
      } finally {
        if (_isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (fileId) {
      loadContent();
    } else {
      setError("No File ID provided for Excalidraw content.");
      setIsLoading(false);
    }

    return () => {
      _isMounted = false;
    };
  }, [fileId]);

  if (isLoading) {
    return <LoadingSpinner text="Loading drawing..." className="h-full" />;
  }

  if (error) {
    console.error(`ExcalidrawViewer Error: ${error}, File ID: ${fileId}, Slide Title: ${slideTitle}`);
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-4 border border-slate-200 rounded-lg">
        <p className="text-slate-500 text-sm">
          Drawing content could not be loaded.
        </p>
        {slideTitle && <p className="mt-1 text-xs text-slate-400">Slide: {slideTitle}</p>}
      </div>
    );
  }

  if (currentInitialData && currentInitialData.elements) {
    return (
      <div className="w-full h-full excalidraw-wrapper bg-slate-50 rounded-lg overflow-hidden shadow-sm">
        <Suspense fallback={<LoadingSpinner text="Initializing Excalidraw..." className="h-full" />}>
          <Excalidraw
            key={fileId}
            excalidrawAPI={(api) => {
              if (onApiReady) {
                onApiReady(api);
              }
            }}
            initialData={currentInitialData}
            viewModeEnabled={true}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
                saveAsImage: true,
              },
              tools: {
                image: false,
              }
            }}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-4 border border-slate-200 rounded-lg">
        <p className="text-slate-500 text-sm">
          No drawing content to display.
        </p>
        {slideTitle && <p className="mt-1 text-xs text-slate-400">Slide: {slideTitle}</p>}
    </div>
  );
};