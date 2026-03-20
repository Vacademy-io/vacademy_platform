import React, { useEffect, useState } from 'react';
import ExcalidrawWrapper from './wrapper';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { SlideData } from './types';

interface ExcalidrawSlideProps {
    slideData: SlideData;
    onSave: (
        elements: readonly ExcalidrawElement[],
        appState: AppState,
        files: BinaryFiles
    ) => void;
    editable?: boolean;
}

const ExcalidrawSlide: React.FC<ExcalidrawSlideProps> = ({
    slideData,
    onSave,
    editable = true,
}) => {
    const [excalidrawData, setExcalidrawData] = useState<SlideData | null>(null);

    useEffect(() => {
        if (slideData) {
            // Try to load from localStorage first
            const savedData = localStorage.getItem(`excalidraw_${slideData.id}`);
            if (savedData) {
                try {
                    const parsedData = JSON.parse(savedData);
                    setExcalidrawData({
                        ...slideData,
                        elements: parsedData.elements || [],
                        appState: parsedData.appState || {},
                        files: parsedData.files || {},
                    });
                    return;
                } catch (error) {
                    console.error('Error parsing saved data:', error);
                }
            }
            // If no saved data or error parsing, use the provided slideData
            setExcalidrawData(slideData);
        }
    }, [slideData]);

    const handleSave = (
        elements: readonly ExcalidrawElement[],
        appState: AppState,
        files: BinaryFiles
    ) => {
        if (editable && excalidrawData) {
            // Save to localStorage for persistence
            localStorage.setItem(
                `excalidraw_${excalidrawData.id}`,
                JSON.stringify({
                    elements,
                    appState,
                    files,
                    lastModified: Date.now(),
                })
            );
            // Call the parent's onSave
            onSave(elements, appState, files);
        }
    };

    if (!excalidrawData) {
        return (
            <div className="flex size-full items-center justify-center">
                <div className="text-gray-500">Loading Excalidraw...</div>
            </div>
        );
    }

    return (
        <div className="size-full">
            <ExcalidrawWrapper
                initialData={{
                    id: excalidrawData.id,
                    elements: excalidrawData.elements,
                    appState: excalidrawData.appState,
                    files: excalidrawData.files,
                }}
                onChange={handleSave}
                editMode={editable}
            />
        </div>
    );
};

export default ExcalidrawSlide;
