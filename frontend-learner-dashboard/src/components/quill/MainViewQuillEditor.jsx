import katex from "katex";
window.katex = katex;
import "katex/dist/katex.css";

import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./jquery";

import "@edtr-io/mathquill/build/mathquill.js";
import "@edtr-io/mathquill/build/mathquill.css";

import mathquill4quill from "mathquill4quill";
import "mathquill4quill/mathquill4quill.css";
import "./index.css";
import { useEffect, useRef } from "react";
import { ALL_OPERATORS } from "./Operators";

export const MainViewQuillEditor = ({ value, onChange }) => {
    const reactQuillRef = useRef(null);
    const mathQuillInitialized = useRef(false); // Flag to prevent multiple initializations

    useEffect(() => {
        // Initialize MathQuill formula authoring only once
        if (!mathQuillInitialized.current) {
            const enableMathQuillFormulaAuthoring = mathquill4quill({ Quill, katex });
            const quill = reactQuillRef.current?.getEditor();
            if (quill) {
                enableMathQuillFormulaAuthoring(quill, { operators: ALL_OPERATORS });
                mathQuillInitialized.current = true; // Mark as initialized
            }
        }
    }, []); // Only run on mount

    useEffect(() => {
        const styleElement = document.createElement("style");
        styleElement.innerHTML = `
            .ql-action::after {
                content: 'Insert' !important;
                color: white !important;
            }
        `;
        document.head.appendChild(styleElement);

        return () => {
            // Clean up: Remove the style tag when the component unmounts
            document.head.removeChild(styleElement);
        };
    }, []);

    const rightBarmodules = {
        toolbar: {
            container: [
                ["bold", "italic", "underline"],
                [{ align: [] }],
                [{ list: "ordered" }, { list: "bullet" }],
                ["formula"], // Formula button
            ],
        },
        formula: true, // Temporary Disabling formula functionality
    };

    return (
        <ReactQuill
            ref={reactQuillRef}
            modules={rightBarmodules}
            theme="snow"
            value={value}
            onChange={onChange}
            preserveWhitespace={true}
        />
    );
};
