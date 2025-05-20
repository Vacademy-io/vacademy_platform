/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import { Slide } from "./types";
import "./styles.css";
import ExcalidrawWrapper from "./wrapper";

export interface Props {
    slide: Slide;
    editMode: boolean;
    onSlideChange: (elements: any[]) => void;
}

const sameElement = (el1: any, el2: any) => {
    const {
        version: el1Version,
        versionNonce: el1VersionNonce,
        seed: el1Seed,
        ...el1Attributes
    } = el1;
    const {
        version: el2Version,
        versionNonce: el2VersionNonce,
        seed: el2Seed,
        ...el2Attributes
    } = el2;
    return JSON.stringify(el1Attributes) === JSON.stringify(el2Attributes);
};

const sameElements = (elements1: any[], elements2: any[]) =>
    elements1.length === elements2.length &&
    elements1.every((el, index) => sameElement(el, elements2[index]));

export const SlideEditor = ({ slide, editMode, onSlideChange }: Props) => {
    const [initialSlide, setInitialSlide] = useState(slide);

    const onChange = (elements: any[], appState: any, files: any) => {
        if (!sameElements(elements, initialSlide)) {
            onSlideChange(elements ,  appState, files); // Notify parent component of changes
            setInitialSlide(JSON.parse(JSON.stringify(elements))); // Update local state
        }
    };


 
    return (
        <div
            className="App"
            style={{
                display: "flex",
                position: "relative",
                width: "100%",
                height: "100%",
            }}
        >
            {!editMode && (
                <style>{`
                    .excalidraw .App-menu,
                    footer.layer-ui__wrapper__footer {
                        display: none
                    }
                `}</style>
            )}
            <style>
                {`
                    .excalidraw .App-menu_top > *:first-child > *:first-child {
                        display: none
                    }
                `}
            </style>
            <ExcalidrawWrapper
                initialSlide={initialSlide}
                onChange={onChange}
                editMode={editMode}
            />
        </div>
    );
};