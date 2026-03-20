/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button'; // Ensure path is correct
import { SlideEditor } from '../SlideEditor'; // Ensure path is correct
import { X, Save, Eraser, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import type {
    AppState,
    PartialAppState, // Use PartialAppState for internal state if not all fields are manage
    ExcalidrawSlideData, // To type the 'slide' prop for SlideEditor
} from '../utils/types'; // Assuming types.ts is in the same directory or adjust path

import type { BinaryFiles, Collaborator, SocketId } from '@excalidraw/excalidraw/types';

import isEqual from 'lodash.isequal'; // Import lodash.isEqual

const DEFAULT_APP_STATE: PartialAppState = {
    viewBackgroundColor: '#FFFFFF',
    collaborators: new Map<SocketId, Collaborator>(),
    theme: 'light',
    // Add other default appState properties for a fresh board
    // Ensure these match the structure of PartialAppState from your types.ts
};

interface SessionExcalidrawOverlayProps {
    sessionId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const SessionExcalidrawOverlay: React.FC<SessionExcalidrawOverlayProps> = ({
    sessionId,
    isOpen,
    onClose,
}) => {
    const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
    const [appState, setAppState] = useState<PartialAppState>(DEFAULT_APP_STATE);
    const [files, setFiles] = useState<BinaryFiles>({});
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start true to show loader initially on open
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const whiteboardStorageKey = useMemo(() => `whiteboard_${sessionId}`, [sessionId]);

    // Refs to store previous state for comparison in useCallback
    const elementsRef = useRef(elements);
    const appStateRef = useRef(appState);
    const filesRef = useRef(files);

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    useEffect(() => {
        appStateRef.current = appState;
    }, [appState]);

    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    const initializeFreshWhiteboard = useCallback(() => {
        setIsLoading(true); // Show loader during reset
        setElements([]);
        setAppState(DEFAULT_APP_STATE);
        setFiles({});
        // Update refs immediately
        elementsRef.current = [];
        appStateRef.current = DEFAULT_APP_STATE;
        filesRef.current = {};
        // Short delay for UI to catch up, then hide loader
        setTimeout(() => setIsLoading(false), 50);
    }, []); // No dependencies, it's a stable reset function

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            try {
                const savedDataString = localStorage.getItem(whiteboardStorageKey);
                if (savedDataString) {
                    const savedData = JSON.parse(savedDataString);

                    const collaboratorsMap = savedData.appState?.collaborators
                        ? new Map(savedData.appState.collaborators)
                        : new Map();

                    setElements(savedData.elements || []);
                    setAppState({
                        ...DEFAULT_APP_STATE,
                        ...(savedData.appState || {}),
                        collaborators: collaboratorsMap,
                    });
                    setFiles(savedData.files || {});
                    toast.info('Loaded saved whiteboard from your browser.');
                } else {
                    initializeFreshWhiteboard();
                }
            } catch (error) {
                console.error('Failed to load whiteboard from localStorage:', error);
                toast.error('Could not load saved whiteboard. Starting fresh.');
                initializeFreshWhiteboard();
            } finally {
                setTimeout(() => setIsLoading(false), 100);
            }
        } else {
            setIsLoading(true);
        }
    }, [isOpen, sessionId, initializeFreshWhiteboard, whiteboardStorageKey]);

    const handleSlideChange = useCallback(
        (
            newElementsFromExcalidraw: readonly ExcalidrawElement[],
            newAppStateFromExcalidraw: AppState,
            newFilesFromExcalidraw: BinaryFiles
        ) => {
            if (!isEqual(elementsRef.current, newElementsFromExcalidraw)) {
                setElements(newElementsFromExcalidraw);
            }

            if (!isEqual(filesRef.current, newFilesFromExcalidraw)) {
                setFiles(newFilesFromExcalidraw);
            }

            const collaboratorsMap =
                newAppStateFromExcalidraw.collaborators instanceof Map
                    ? newAppStateFromExcalidraw.collaborators
                    : new Map<SocketId, Collaborator>();

            // Construct the next potential appState based on DEFAULT_APP_STATE keys and incoming Excalidraw state
            const candidateNextAppState: PartialAppState = { ...DEFAULT_APP_STATE }; // Start with a clean default structure
            for (const key in candidateNextAppState) {
                const K = key as keyof PartialAppState;
                if (K === 'collaborators') {
                    candidateNextAppState.collaborators = collaboratorsMap;
                } else if (Object.prototype.hasOwnProperty.call(newAppStateFromExcalidraw, K)) {
                    (candidateNextAppState as any)[K] =
                        newAppStateFromExcalidraw[K as keyof AppState];
                }
            }
            // If there are other specific AppState fields from Excalidraw you want to track, add them here:
            // e.g., candidateNextAppState.activeTool = newAppStateFromExcalidraw.activeTool;
            // Ensure candidateNextAppState only contains keys relevant to your PartialAppState definition.

            let hasAppStateChanged = false;
            if (!isEqual(appStateRef.current, candidateNextAppState)) {
                setAppState(candidateNextAppState);
                hasAppStateChanged = true;
            }

            // if (hasElementsChanged) console.log("Overlay: Elements updated");
            // if (hasFilesChanged) console.log("Overlay: Files updated");
            // if (hasAppStateChanged) console.log("Overlay: AppState updated");
        },
        []
    ); // Empty dependency array as we use refs for current state and setters are stable

    const handleSave = async () => {
        if (!sessionId) return;
        setIsSaving(true);
        try {
            const collaboratorsArray =
                appStateRef.current.collaborators instanceof Map
                    ? Array.from(appStateRef.current.collaborators.entries())
                    : [];

            const dataToSave = {
                elements: elementsRef.current,
                appState: {
                    ...appStateRef.current,
                    collaborators: collaboratorsArray,
                },
                files: filesRef.current,
            };

            localStorage.setItem(whiteboardStorageKey, JSON.stringify(dataToSave));

            await new Promise((resolve) => setTimeout(resolve, 500));
            toast.success('Whiteboard saved!');
        } catch (error: any) {
            toast.error(error.message || 'Error saving whiteboard.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = () => {
        localStorage.removeItem(whiteboardStorageKey);
        setElements([]);
        setAppState(DEFAULT_APP_STATE);
        setFiles({});
        toast.info('Whiteboard cleared.');
    };

    const slideForEditor = useMemo((): ExcalidrawSlideData => {
        const currentCollaborators =
            appState.collaborators instanceof Map
                ? appState.collaborators
                : new Map<SocketId, Collaborator>();
        return {
            id: `session-whiteboard-${sessionId}`, // Stable ID for the session's whiteboard instance
            type: 'EXCALIDRAW' as any, // Match your SlideTypeEnum.Excalidraw if imported
            slide_order: 0,
            elements: elements,
            appState: {
                // Pass the current PartialAppState from this component's state
                ...appState,
                collaborators: currentCollaborators,
            },
            files: files,
        };
    }, [sessionId, elements, appState, files]); // This memoization is correct

    if (!isOpen) return null;

    return (
        <div className="animate-fadeIn fixed inset-0 z-[1500] flex items-center justify-center bg-slate-900/70 p-2 backdrop-blur-sm sm:p-4">
            <div className="scale-up-center flex size-full max-h-[calc(100vh-4rem)] max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 p-3.5">
                    <h3 className="text-lg font-semibold text-slate-800">Session Whiteboard</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={isSaving || isLoading}
                            className="border-slate-300 text-slate-700 hover:bg-slate-100"
                        >
                            <Eraser size={15} className="mr-1.5" /> Clear
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="bg-orange-500 px-4 text-white hover:bg-orange-600"
                        >
                            {isSaving ? (
                                <Loader2 size={15} className="mr-1.5 animate-spin" />
                            ) : (
                                <Save size={15} className="mr-1.5" />
                            )}
                            {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="ml-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        >
                            <X size={20} />
                        </Button>
                    </div>
                </div>

                <div className="relative size-full grow bg-white">
                    {isLoading ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                            <Loader2 size={36} className="animate-spin text-orange-500" />
                        </div>
                    ) : (
                        <SlideEditor
                            key={`whiteboard-editor-${sessionId}`}
                            editMode={true}
                            slide={slideForEditor}
                            onSlideChange={handleSlideChange}
                        />
                    )}
                </div>
            </div>
            {/* Minimal inline styles for animations - consider moving to a CSS file */}
            <style>{`
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
                .scale-up-center { animation: scaleUpCenter 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUpCenter { 
                    from { opacity: 0.5; transform: scale(0.95); } 
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};
