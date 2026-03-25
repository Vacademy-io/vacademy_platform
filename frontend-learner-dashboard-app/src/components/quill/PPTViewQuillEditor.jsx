import katex from "katex";
window.katex = katex;
import "katex/dist/katex.css";

import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./jquery";

import "@edtr-io/mathquill/build/mathquill.js";
import "@edtr-io/mathquill/build/mathquill.css";
import "mathquill4quill/mathquill4quill.css";
import "./index.css";
import { useRef } from "react";

export const PPTViewQuillEditor = ({ value, onChange }) => {
    const reactQuillRef = useRef(null);

    const leftbarModules = {
        toolbar: false,
    };

    return (
        <ReactQuill
            ref={reactQuillRef}
            modules={leftbarModules}
            theme="snow"
            value={value}
            onChange={onChange}
            preserveWhitespace={true}
        />
    );
};
