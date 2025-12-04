import { useEffect, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import katex from "katex";
import "katex/dist/katex.css";
import { cn } from "@/lib/utils";

window.katex = katex;

interface ReadOnlyQuillViewerProps {
  value: string;
  className?: string;
  minHeight?: number;
}

export const ReadOnlyQuillViewer = ({
  value,
  className = "",
  minHeight = 300,
}: ReadOnlyQuillViewerProps) => {
  const reactQuillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    // Disable editing after component mounts
    const quill = reactQuillRef.current?.getEditor();
    if (quill) {
      quill.enable(false);
    }
  }, []);

  const modules = {
    toolbar: false, // Disable toolbar
    formula: true, // Enable formula rendering
  };

  return (
    <div
      className={cn(
        "readonly-quill-viewer rounded-lg border bg-white",
        className
      )}
      style={{ minHeight: `${minHeight}px` }}
    >
      <ReactQuill
        ref={reactQuillRef}
        modules={modules}
        theme="snow"
        value={value}
        readOnly={true}
        preserveWhitespace={true}
        className="border-0"
      />
      <style>{`
        .readonly-quill-viewer .ql-container {
          border: none !important;
          font-size: 14px;
        }
        .readonly-quill-viewer .ql-editor {
          padding: 1rem;
          min-height: ${minHeight}px;
        }
        .readonly-quill-viewer .ql-toolbar {
          display: none !important;
        }
        /* Ensure tables render properly */
        .readonly-quill-viewer .ql-editor table {
          border-collapse: collapse;
          width: 100%;
        }
        .readonly-quill-viewer .ql-editor table td,
        .readonly-quill-viewer .ql-editor table th {
          border: 1px solid #e5e7eb;
          padding: 8px;
        }
        .readonly-quill-viewer .ql-editor table th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        /* Ensure images are responsive */
        .readonly-quill-viewer .ql-editor img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
};

export default ReadOnlyQuillViewer;
