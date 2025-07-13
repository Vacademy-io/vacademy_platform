import katex from "katex";
window.katex = katex;
import "katex/dist/katex.css";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "./jquery";

import "@edtr-io/mathquill/build/mathquill.js";
import "@edtr-io/mathquill/build/mathquill.css";

import mathquill4quill from "mathquill4quill";
import "mathquill4quill/mathquill4quill.css";
import "./index.css";
import { useEffect, useRef, useState } from "react";
import { ALL_OPERATORS } from "./Operators";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/use-file-upload";
import { getUserId } from "@/constants/getUserId";

export const MainViewQuillEditor = ({ value, onChange, className="", isDoubtResolution = false }) => {
    const reactQuillRef = useRef(null);
    const mathQuillInitialized = useRef(false); // Flag to prevent multiple initializations
    const [isUploading, setIsUploading] = useState(false);
    const { uploadFile, getPublicUrl } = useFileUpload();
    const userId = getUserId();

    useEffect(() => {
        // Initialize MathQuill formula authoring only once
        if (!mathQuillInitialized.current) {
            const enableMathQuillFormulaAuthoring = mathquill4quill({
                Quill,
                katex,
            });
            const quill = reactQuillRef.current?.getEditor();
            if (quill) {
                enableMathQuillFormulaAuthoring(quill, {
                    operators: ALL_OPERATORS,
                });
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

    // Custom image handler
    const handleImageUpload = async () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            try {
                setIsUploading(true);
                const fileId = await uploadFile({
                    file,
                    setIsUploading,
                    userId: "1234",
                    source: "DOUBT_RESOLUTION",
                    sourceId: "IMAGES",
                    publicUrl: true,
                });

                if (fileId) {
                    const imageUrl = await getPublicUrl(fileId);
                    
                    // Insert image into editor at current cursor position
                    const quill = reactQuillRef.current?.getEditor();
                    if (quill) {
                        const range = quill.getSelection();
                        const index = range ? range.index : quill.getLength();
                        quill.insertEmbed(index, 'image', imageUrl);
                        quill.setSelection(index + 1);
                    }
                }
            } catch (error) {
                console.error('Error uploading image:', error);
            } finally {
                setIsUploading(false);
            }
        });
    };

    const rightBarmodules = {
        toolbar: {
            container: [
                ["bold", "italic", "underline"],
                [{ align: [] }],
                [{ list: "ordered" }, { list: "bullet" }],
                ["image"], // Add image button
                ["formula"], // Formula button
            ],
            handlers: {
                image: handleImageUpload, // Custom image handler
            },
        },
        formula: true, // Temporary Disabling formula functionality
    };

    return (
        <div className={cn("relative", className, isDoubtResolution && "doubt-resolution-editor")}>
            <ReactQuill
                ref={reactQuillRef}
                modules={rightBarmodules}
                theme="snow"
                value={value}
                onChange={onChange}
                preserveWhitespace={true}
                className={cn("", isUploading && "opacity-50")}
            />
            {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                        Uploading image...
                    </div>
                </div>
            )}
        </div>
    );
};
