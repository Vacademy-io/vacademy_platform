// src/components/ExcalidrawViewer.tsx
import React, { useEffect, useState, lazy, Suspense, type ComponentType } from 'react';
import { fetchExcalidrawContent } from '@/lib/excalidrawUtils';
import { LoadingSpinner } from './LoadingSpinner';
import { AlertTriangle } from 'lucide-react';

// Use the main export for types, ExcalidrawElement is usually part of this
import type {
   ExcalidrawInitialDataState, BinaryFiles, AppState, ExcalidrawProps
} from '@excalidraw/excalidraw/types'; // Reverted to /types sub-path

// Explicitly type the lazy loaded component
const Excalidraw = lazy(() => 
  import('@excalidraw/excalidraw').then(module => 
    ({ default: module.Excalidraw as ComponentType<ExcalidrawProps> })
  )
);

interface ExcalidrawViewerProps {
  fileId: string;
  slideTitle?: string;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = ({ fileId, slideTitle }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The state should hold the structure that initialData prop expects
  const [currentInitialData, setCurrentInitialData] = useState<ExcalidrawInitialDataState | null>(null);

  useEffect(() => {
    let _isMounted = true;
    const loadContent = async () => {
      setIsLoading(true);
      setError(null);
      setCurrentInitialData(null); 
      try {
        const fetchedData = await fetchExcalidrawContent(fileId);
        console.log('fetchedData', fetchedData);
        if (_isMounted) {
          if (fetchedData && fetchedData.elements) {
            // Explicitly construct appState to ensure collaborators is a Map
            const baseAppState = fetchedData.appState || {};
            const newAppState = {
              ...baseAppState,
              viewBackgroundColor: baseAppState.viewBackgroundColor || '#FFFFFF',
              currentItemFontFamily: baseAppState.currentItemFontFamily || 1,
              // Ensure collaborators is a Map, even if baseAppState.collaborators is null or undefined
              collaborators: baseAppState.collaborators instanceof Map ? baseAppState.collaborators : new Map(),
            };

            console.log('newAppState', newAppState);

            setCurrentInitialData({
              elements: fetchedData.elements as any as ExcalidrawInitialDataState['elements'],
              appState: newAppState,
              files: fetchedData.files || undefined,
              scrollToContent: true,
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
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 bg-red-50">
        <AlertTriangle size={48} className="mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Loading Drawing</h3>
        <p className="text-center">{error}</p>
        {slideTitle && <p className="mt-1 text-sm text-muted-foreground">Slide: {slideTitle}</p>}
        <p className="mt-1 text-xs text-muted-foreground">File ID: {fileId}</p>
      </div>
    );
  }

  if (currentInitialData && currentInitialData.elements) {
    return (
      <div className="w-full h-full excalidraw-wrapper border-2 border-red-500">
        <Suspense fallback={<LoadingSpinner text="Initializing Excalidraw..." className="h-full" />}>
          <Excalidraw
            key={fileId}
            initialData={currentInitialData} // Pass the correctly structured object here
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
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
      <p>No Excalidraw content to display or content is invalid.</p>
      {slideTitle && <p className="mt-1 text-sm">Slide: {slideTitle}</p>}
       <p className="mt-1 text-xs text-muted-foreground">File ID: {fileId}</p>
    </div>
  );
};