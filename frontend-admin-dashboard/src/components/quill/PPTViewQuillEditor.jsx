import katex from 'katex';
import 'katex/dist/katex.css';
import { useEffect, useRef } from 'react';

// Re-render KaTeX formulas inside the container after HTML is set.
// Handles both TipTap (data-latex attribute) and Quill (ql-formula) formats.
const renderMathInContainer = (container) => {
    if (!container) return;

    // 1. TipTap math spans with data-latex attribute (content is entity-encoded)
    container.querySelectorAll('[data-latex]').forEach((el) => {
        const latex = el.getAttribute('data-latex');
        if (!latex) return;
        const isDisplay = el.classList.contains('math-display');
        try {
            el.innerHTML = katex.renderToString(latex, {
                throwOnError: false,
                displayMode: isDisplay,
            });
        } catch {
            // leave as-is
        }
    });

    // 2. Quill formula spans that lost their rendered content
    container.querySelectorAll('.ql-formula[data-value]').forEach((el) => {
        const latex = el.getAttribute('data-value');
        if (!latex || el.querySelector('.katex')) return; // already rendered
        try {
            el.innerHTML = katex.renderToString(latex, {
                throwOnError: false,
                displayMode: false,
            });
        } catch {
            // leave as-is
        }
    });
};

// Lightweight HTML viewer for PPT mode (presentation rendering only)
export const PPTViewQuillEditor = ({ value, onChange, placeholder = '', className = '' }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        renderMathInContainer(containerRef.current);
    }, [value]);

    return (
        <div className={className}>
            {!value && placeholder ? (
                <div className="text-neutral-400">{placeholder}</div>
            ) : (
                <div
                    ref={containerRef}
                    className="prose max-w-none"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: value || '' }}
                    onInput={(e) => onChange?.(e.currentTarget.innerHTML)}
                    contentEditable
                    suppressContentEditableWarning
                />
            )}
        </div>
    );
};
