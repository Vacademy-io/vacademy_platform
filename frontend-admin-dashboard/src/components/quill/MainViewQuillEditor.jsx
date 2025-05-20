import katex from 'katex';
window.katex = katex;
import 'katex/dist/katex.css';

import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './jquery';

import '@edtr-io/mathquill/build/mathquill.js';
import '@edtr-io/mathquill/build/mathquill.css';

import mathquill4quill from 'mathquill4quill';
import 'mathquill4quill/mathquill4quill.css';
import './index.css';
import { useEffect, useRef } from 'react';
import { ALL_OPERATORS } from './Operators';

// Function to resize an image to 300x300 px
const resizeImage = (file, callback) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set the canvas size to 300x300
            canvas.width = 200;
            canvas.height = 200;

            // Draw the image onto the canvas
            ctx.drawImage(img, 0, 0, 200, 200);

            // Convert canvas back to base64
            const resizedImage = canvas.toDataURL('image/png');
            callback(resizedImage);
        };
    };
};

// Custom Image Handler for Quill Editor
const imageHandler = function () {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (file) {
            resizeImage(file, (resizedImage) => {
                const quill = this.quill;
                const range = quill.getSelection();
                quill.insertEmbed(range.index, 'image', resizedImage);
            });
        }
    };
};

export const MainViewQuillEditor = ({ value, onChange }) => {
    const reactQuillRef = useRef(null);
    const mathQuillInitialized = useRef(false);

    useEffect(() => {
        if (!mathQuillInitialized.current) {
            const enableMathQuillFormulaAuthoring = mathquill4quill({ Quill, katex });
            const quill = reactQuillRef.current?.getEditor();
            if (quill) {
                enableMathQuillFormulaAuthoring(quill, { operators: ALL_OPERATORS });
                mathQuillInitialized.current = true;
            }
        }
    }, []);

    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = `
            .ql-action::after {
                content: 'Insert' !important;
                color: white !important;
            }
        `;
        document.head.appendChild(styleElement);

        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    const rightBarmodules = {
        toolbar: {
            container: [
                ['bold', 'italic', 'underline'],
                [{ align: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['formula'], // Formula button
                ['image'], // Image button
            ],
            handlers: {
                image: imageHandler, // Custom image handler
            },
        },
        formula: true,
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
