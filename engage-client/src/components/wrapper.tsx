/* eslint-disable */
// @ts-nocheck
import React, { useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawAPIRefValue, ExcalidrawProps } from './excalidraw/packages/excalidraw/types';
import type {
    ExcalidrawWrapperInitialData, // Use the new specific type for initialData prop
    AppState, // Full AppState from Excalidraw
    PartialAppState, // Partial AppState for initial setup
} from '././utils/types'; // Assuming types.ts is in the same directory or path is adjusted
import type { ExcalidrawElement } from './excalidraw/packages/excalidraw/element/types';

import type {
    AppState as ExcalidrawAppStateOriginal,
    BinaryFiles,
    Collaborator,
    SocketId,
    LibraryItems,
} from '@excalidraw/excalidraw/types';
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
    const excalidrawRef = useRef<ExcalidrawAPIRefValue>(null);

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
        <div className="h-full w-full bg-white">
            {' '}
            {/* Added bg-white for explicitness */}
            <Excalidraw
                key={initialData.id} // CRITICAL: Uses the ID from the initialData prop
                ref={excalidrawRef}
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
        </div>
    );
};

export default ExcalidrawWrapper;
