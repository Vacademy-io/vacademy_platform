
/* eslint-disable */
// @ts-nocheck
import { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { Excalidraw } from "../excalidraw/packages/excalidraw";
import { useEffect, useRef } from "react";

interface ExcalidrawWrapperProps {
    initialSlide: any;
    onChange: (elements: any[], appState: AppState, files: BinaryFiles) => void;
    editMode: boolean;
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
    initialSlide,
    onChange,

}) => {
    const excalidrawRef = useRef<any>(null);

    const handleWheelCapture = (e: React.WheelEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };
    return (
        <div
            className="w-full aspect-[4/3] border"
            style={{ height: '85vh' }}
            onWheelCapture={handleWheelCapture}
        >
            <Excalidraw
                ref={excalidrawRef}
                initialData={{
                    elements: initialSlide.elements,
                    files: initialSlide.files,
                    appState: {
                        scrollX: 0,
                        scrollY: 0,
                    },
                }}
                onChange={(elements, appState, files) => onChange(elements, appState,
                    files)}
                UIOptions={{
                    canvasActions: {
                        changeViewBackgroundColor: false,
                        toggleScrollBehavior: true,
                        toggleTheme: false,
                        saveToActiveFile: false,
                        clearCanvas: false,
                        export: false,
                        loadScene: false,

                    },
                }}
            />
        </div>
    );
};

export default ExcalidrawWrapper;