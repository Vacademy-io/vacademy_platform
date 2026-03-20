/* eslint-disable */
// @ts-nocheck
import React, { memo } from 'react';
import ExcalidrawWrapper from './wrapper'; // Adjusted path if necessary
import type {
    ExcalidrawSlideData, // Use the specific type for Excalidraw slides
    AppState, // Expect full AppState from Excalidraw/Wrapper
} from '././utils/types'; // Assuming types.ts
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';

export interface Props {
    slide: ExcalidrawSlideData; // Expects data specific to an Excalidraw slide
    editMode: boolean;
    onSlideChange: (
        // CRITICAL FIX: Expect full AppState and files
        elements: readonly ExcalidrawElement[],
        appState: AppState, // Changed from Partial<AppState>
        files: ExcalidrawBinaryFiles
    ) => void;
    onRegenerate?: (slideId: string) => void;
}

const SlideEditorComponent = ({ slide, editMode, onSlideChange, onRegenerate }: Props) => {
    const handleExcalidrawChange = (
        elements: readonly ExcalidrawElement[],
        appState: AppState, // Received full AppState from ExcalidrawWrapper
        files: ExcalidrawBinaryFiles
    ) => {
        // Pass the full AppState and files up to the parent component
        onSlideChange(elements, appState, files);
    };

    return (
        <div
            className="ExcalidrawSlideEditor_Container" // Keep if CSS relies on it
            style={{
                display: 'flex',
                position: 'relative',
                width: '100%',
                height: '100%',
                transform: 'translateZ(0)',
            }}
        >
            <ExcalidrawWrapper
                // Keying ExcalidrawWrapper ensures it re-mounts if the slide ID changes,
                // effectively resetting Excalidraw with new initial data.
                key={slide.id}
                initialData={{
                    // Pass data to ExcalidrawWrapper's initialData prop
                    id: slide.id, // Pass the slide's ID for ExcalidrawWrapper's internal keying
                    elements: slide.elements || [],
                    appState: slide.appState || {}, // Pass stored partial AppState
                    files: slide.files || undefined, // Pass stored files
                }}
                onChange={handleExcalidrawChange}
                editMode={editMode}
            />
            {editMode && onRegenerate && (
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 10 }}>
                    <Button
                        onClick={() => onRegenerate(slide.id)}
                        className="bg-purple-600 text-white hover:bg-purple-700 shadow-lg"
                        size="sm"
                    >
                        <Wand2 className="mr-2 h-4 w-4" />
                        Regenerate with AI
                    </Button>
                </div>
            )}
        </div>
    );
};

// Memoize with custom comparison for better performance
export const SlideEditor = memo(SlideEditorComponent, (prevProps, nextProps) => {
    return (
        prevProps.slide.id === nextProps.slide.id &&
        prevProps.editMode === nextProps.editMode &&
        prevProps.onSlideChange === nextProps.onSlideChange &&
        prevProps.onRegenerate === nextProps.onRegenerate &&
        // Only re-render if slide content actually changed
        prevProps.slide.elements?.length === nextProps.slide.elements?.length
    );
});

SlideEditor.displayName = 'SlideEditor';
