/* eslint-disable */
// @ts-nocheck
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawAPIRefValue, ExcalidrawProps } from '@excalidraw/excalidraw/types';
import type {
    ExcalidrawWrapperInitialData, // Use the new specific type for initialData prop
    AppState, // Full AppState from Excalidraw
    PartialAppState, // Partial AppState for initial setup
} from '././utils/types'; // Assuming types.ts is in the same directory or path is adjusted
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// Global state to track centered slides across component remounts
const centeredSlides = new Set<string>();

import type {
    AppState as ExcalidrawAppStateOriginal,
    BinaryFiles,
    Collaborator,
    SocketId,
    LibraryItems,
} from '@excalidraw/excalidraw/types';
import { LocateFixed, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExcalidrawWrapperProps {
    initialData: ExcalidrawWrapperInitialData; // Renamed from initialSlide and typed
    onChange: (
        elements: readonly ExcalidrawElement[],
        appState: AppState, // Excalidraw's onChange provides the full AppState
        files: ExcalidrawBinaryFiles
    ) => void;
    editMode: boolean;
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
    initialData,
    onChange,
    editMode,
}) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawAPIRefValue | null>(null);
    const [isLaserActive, setIsLaserActive] = useState(false);

    // Track the current slide ID to only center when switching slides
    const currentSlideIdRef = useRef<string | null>(null);
    const hasInitialCenteringHappenedRef = useRef<boolean>(false);

    // Cleanup: remove this slide from the centered set when the component unmounts
    // so it will auto-center correctly if the slide is revisited after content changes.
    useEffect(() => {
        const slideId = initialData.id;
        return () => {
            centeredSlides.delete(slideId);
        };
    }, [initialData.id]);

    // Separate effect for slide ID changes (without API dependency)
    useEffect(() => {
        const isNewSlide = currentSlideIdRef.current !== initialData.id;
        const hasBeenCentered = centeredSlides.has(initialData.id);
        
        console.log(`[ExcalidrawWrapper] Slide ID effect:`, {
            slideId: initialData.id,
            isNewSlide,
            hasBeenCentered,
            currentSlideIdRef: currentSlideIdRef.current,
            hasInitialCenteringHappened: hasInitialCenteringHappenedRef.current
        });
        
        if (isNewSlide) {
            currentSlideIdRef.current = initialData.id;
            hasInitialCenteringHappenedRef.current = false; // Reset for new slide
        }
    }, [initialData.id]);

    // Separate effect for API availability (only centers if needed)
    useEffect(() => {
        if (excalidrawAPI && !hasInitialCenteringHappenedRef.current) {
            const hasBeenCentered = centeredSlides.has(initialData.id);
            
            console.log(`[ExcalidrawWrapper] API ready effect:`, {
                slideId: initialData.id,
                hasBeenCentered,
                hasInitialCenteringHappened: hasInitialCenteringHappenedRef.current
            });
            
            if (!hasBeenCentered) {
                console.log(`[ExcalidrawWrapper] CENTERING: First time for slide ${initialData.id}`);
                setTimeout(() => {
            excalidrawAPI.scrollToContent();
                    centeredSlides.add(initialData.id);
                    hasInitialCenteringHappenedRef.current = true;
                }, 100);
        } else {
                console.log(`[ExcalidrawWrapper] SKIPPING: Slide ${initialData.id} already centered globally`);
                hasInitialCenteringHappenedRef.current = true;
            }
        }
    }, [excalidrawAPI]); // Only depend on API, not slide ID

    const handleCenterView = () => {
        console.log('[ExcalidrawWrapper] Center view button clicked.');
        if (excalidrawAPI) {
            excalidrawAPI.scrollToContent();
            centeredSlides.add(initialData.id); // Mark as centered when manually centered
            hasInitialCenteringHappenedRef.current = true; // Update local ref too
            console.log('[ExcalidrawWrapper] Manually centered content via API from state.');
        } else {
            console.error('[ExcalidrawWrapper] Excalidraw API is not available in state.');
        }
    };

    const handleToggleLaserPointer = () => {
        console.log('[ExcalidrawWrapper] Laser Pointer button clicked.');
        if (excalidrawAPI) {
            const nextTool = isLaserActive ? 'selection' : 'laser';
            excalidrawAPI.updateScene({
                appState: { activeTool: { type: nextTool } },
            });
            console.log(`[ExcalidrawWrapper] Toggled laser. Set tool to: ${nextTool}`);
        } else {
            console.error('[ExcalidrawWrapper] Excalidraw API is not available to toggle laser.');
        }
    };

    const handleExcalidrawChange = useCallback(
        (
            elements: readonly ExcalidrawElement[],
            appStateFromExcalidraw: AppState, // This is the full AppState from Excalidraw
            files: ExcalidrawBinaryFiles
        ) => {
            // Ensure collaborators is a Map when passing up.
            // Excalidraw's AppState type should already have collaborators as a Map or undefined.
            // This check might be redundant if AppState type is correctly imported from @excalidraw/excalidraw/types.
            const collaborators =
                appStateFromExcalidraw.collaborators instanceof Map
                    ? appStateFromExcalidraw.collaborators
                    : new Map<ExcalidrawSocketId, ExcalidrawCollaborator>();

            // Sync laser pointer state from Excalidraw's internal state
            setIsLaserActive(appStateFromExcalidraw.activeTool.type === 'laser');

            onChange(elements, { ...appStateFromExcalidraw, collaborators }, files);
        },
        [onChange]
    );

    const uiOptionsConfig: Partial<ExcalidrawProps['UIOptions']> = {
        canvasActions: {
            changeViewBackgroundColor: editMode,
            clearCanvas: editMode,
            export: editMode ? { saveAsImage: true, exportToBackend: false } : false,
            loadScene: editMode,
            saveToActiveFile: false,
            toggleTheme: true,
            toggleScrollBehavior: true,
        },
        // tools: editMode ? undefined : { hand: true } // Simpler way to disable tools
    };

    // Prepare initialAppState for the Excalidraw instance.
    const initialAppStateForExcalidraw: PartialAppState = {
        viewBackgroundColor: '#FFFFFF', // Default background
        ...(initialData.appState || {}),
        // Ensure collaborators is a Map for Excalidraw's initialData.
        // The scrollToContent is now handled by the useEffect hook.
        collaborators:
            initialData.appState?.collaborators instanceof Map
                ? initialData.appState.collaborators
                : new Map<ExcalidrawSocketId, ExcalidrawCollaborator>(),
    };
    // Excalidraw internally handles if collaborators is not a Map, but being explicit is fine.
    if (!(initialAppStateForExcalidraw.collaborators instanceof Map)) {
        initialAppStateForExcalidraw.collaborators = new Map<
            ExcalidrawSocketId,
            ExcalidrawCollaborator
        >();
    }

    return (
        <div className="relative h-full w-full bg-white">
            {' '}
            {/* Added relative positioning and bg-white for explicitness */}
            <Excalidraw
                key={initialData.id} // CRITICAL: Uses the ID from the initialData prop
                excalidrawAPI={(api) => {
                    console.log(`[ExcalidrawWrapper] API object received for slide ${initialData.id}.`);
                    setExcalidrawAPI(api);
                }}
                initialData={{
                    // This is Excalidraw's own initialData prop
                    elements: initialData.elements || [],
                    appState: initialAppStateForExcalidraw, // Uses the derived partial appState
                    files: initialData.files || undefined, // Can be undefined
                    libraryItems: initialData.libraryItems || undefined, // Can be undefined
                }}
                onChange={handleExcalidrawChange}
                viewModeEnabled={!editMode}
                UIOptions={uiOptionsConfig}
            />
            <div className="absolute top-4 right-4 z-20 flex gap-2">
                <Button
                    onClick={handleCenterView}
                    className="h-auto rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-sm hover:bg-white"
                    variant="ghost"
                    size="icon"
                    title="Center on content"
                >
                    <LocateFixed className="h-5 w-5 text-gray-700" />
                </Button>
                <Button
                    onClick={handleToggleLaserPointer}
                    className="h-auto rounded-full bg-white/80 p-2 shadow-lg backdrop-blur-sm hover:bg-white data-[active=true]:bg-blue-100"
                    variant="ghost"
                    size="icon"
                    title="Toggle Laser Pointer"
                    data-active={isLaserActive}
                >
                    <Sparkles className="h-5 w-5 text-gray-700" />
                </Button>
            </div>
        </div>
    );
};

export default ExcalidrawWrapper;
