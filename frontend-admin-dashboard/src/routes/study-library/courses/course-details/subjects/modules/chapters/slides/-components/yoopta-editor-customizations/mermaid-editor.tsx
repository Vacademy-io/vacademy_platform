import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { YooptaPlugin } from '@yoopta/editor';
import mermaid from 'mermaid';
import { sanitizeMermaidCode } from '@/routes/study-library/ai-copilot/shared/utils/mermaidSanitizer';

// Use a window flag so we coordinate with TipTapEditor's initialization
// Always re-initialize if suppressErrorRendering wasn't applied yet
const initializeMermaid = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.__mermaidSuppressErrorsApplied) return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mermaid.initialize as any)({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            suppressErrorRendering: true,
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis',
            },
        });
        w.__mermaidSuppressErrorsApplied = true;
        w.__mermaidInitialized = true;
    } catch (error) {
        console.warn('[MermaidPlugin] Error initializing mermaid:', error);
    }
};

// Apply immediately at module load so it's set before any render() call
try { initializeMermaid(); } catch (_) { /* silent */ }

interface MermaidBlockProps {
    element: any;
    attributes: any;
    children: React.ReactNode;
    updateElementProps?: (props: any) => void;
}

/** Portal-based zoom modal — renders at document.body so it's never clipped */
function MermaidZoomModal({ svg, onClose }: { svg: string; onClose: () => void }) {
    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        // Prevent body scroll while modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                background: 'rgba(0, 0, 0, 0.82)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-out',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '24px',
                    background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: '20px',
                    lineHeight: 1,
                    backdropFilter: 'blur(4px)',
                    zIndex: 100000,
                }}
                title="Close (Esc)"
            >
                ✕
            </button>

            {/* Diagram card */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '40px',
                    minWidth: '60vw',
                    maxWidth: '92vw',
                    maxHeight: '88vh',
                    overflow: 'auto',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
                    cursor: 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div
                    dangerouslySetInnerHTML={{ __html: svg }}
                    style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                    }}
                />
                <style>{`
                    .mermaid-zoom-svg svg {
                        width: 100% !important;
                        height: auto !important;
                        max-width: 100% !important;
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
}

export function MermaidBlock({
    element,
    attributes,
    children,
    updateElementProps,
}: MermaidBlockProps) {
    const initialCode = element?.props?.code || '';
    const [code] = useState(initialCode);
    const [svg, setSvg] = useState<string>('');
    const [isRendering, setIsRendering] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);
    const renderedCodeRef = useRef<string>('');

    // Render mermaid diagram
    useEffect(() => {
        if (!code || code.trim() === '') {
            setSvg('');
            return;
        }

        // Skip if we already rendered this exact code
        if (renderedCodeRef.current === code.trim()) {
            return;
        }

        const renderMermaid = async () => {
            try {
                setIsRendering(true);

                if (!mermaid || typeof mermaid.render !== 'function') {
                    setSvg('');
                    return;
                }

                // Ensure suppressErrorRendering is applied before any render call
                initializeMermaid();

                let cleanCode = code.trim();
                if (cleanCode.toLowerCase().startsWith('mermaid ')) {
                    cleanCode = cleanCode.substring(8).trim();
                }
                if (!cleanCode) {
                    setSvg('');
                    return;
                }

                cleanCode = sanitizeMermaidCode(cleanCode);

                const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                try {
                    const result = await mermaid.render(renderId, cleanCode);
                    if (result && result.svg) {
                        setSvg(result.svg);
                        // Store the original (pre-sanitize) trimmed code so the comparison works
                        renderedCodeRef.current = code.trim();
                    } else {
                        setSvg('');
                    }
                } catch (_renderError) {
                    // Silently swallow — show nothing on syntax error
                    console.warn('[MermaidBlock] Render failed (hidden from UI):', _renderError);
                    setSvg('');
                }
            } catch (_) {
                setSvg('');
            } finally {
                setIsRendering(false);
            }
        };

        renderMermaid();
    }, [code]);

    return (
        <div
            {...attributes}
            className="yoopta-mermaid-block"
            contentEditable={false}
        >
            {children}

            {isRendering && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '13px' }}>
                    Rendering diagram...
                </div>
            )}

            {svg && !isRendering && (
                <>
                    {/* Inline diagram — click to zoom */}
                    <div
                        onClick={() => setIsZoomed(true)}
                        title="Click to zoom"
                        style={{
                            margin: '16px 0',
                            padding: '16px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'zoom-in',
                            position: 'relative',
                            overflow: 'hidden',
                            maxWidth: '100%',
                        }}
                    >
                        {/* Zoom hint badge */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: 'rgba(0,0,0,0.4)',
                                color: '#fff',
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                pointerEvents: 'none',
                                opacity: 0.85,
                                letterSpacing: '0.02em',
                            }}
                        >
                            🔍 Click to zoom
                        </div>
                        <div
                            dangerouslySetInnerHTML={{ __html: svg }}
                            style={{ maxWidth: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}
                        />
                    </div>

                    {/* Portal-based zoom modal */}
                    {isZoomed && (
                        <MermaidZoomModal svg={svg} onClose={() => setIsZoomed(false)} />
                    )}
                </>
            )}

            {!code && !isRendering && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>
                    <em>Click to add mermaid diagram code</em>
                </div>
            )}

            <style>{`
                .yoopta-mermaid-block svg {
                    max-width: 100% !important;
                    height: auto !important;
                    display: block;
                }
            `}</style>
        </div>
    );
}

// Yoopta Plugin Definition
export const MermaidPlugin = new YooptaPlugin<{ mermaid: any }>({
    type: 'mermaid',
    elements: {
        mermaid: {
            render: MermaidBlock,
        },
    },
    options: {
        display: {
            title: 'Mermaid Diagram',
            description: 'Add a mermaid diagram',
            icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ),
        },
        shortcuts: ['mermaid', 'diagram', 'graph'],
    },
    parsers: {
        html: {
            deserialize: {
                nodeNames: ['DIV'],
                parse: (element) => {
                    try {
                        const className = element.getAttribute?.('class') || element.className || '';
                        const isMermaidDiv =
                            element.classList?.contains('mermaid') ||
                            (typeof className === 'string' && className.split(/\s+/).includes('mermaid'));

                        if (!isMermaidDiv) {
                            return undefined;
                        }

                        const code = element.textContent?.trim() || element.innerText?.trim() || '';

                        return {
                            id: `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            type: 'mermaid',
                            props: {
                                code: code,
                            },
                            children: [{ text: '' }],
                        };
                    } catch (error) {
                        console.error('[MermaidPlugin] ❌ Error during deserialization:', error);
                        return undefined;
                    }
                },
            },
            serialize: (element, _children) => {
                const code = element.props?.code || '';
                if (!code) {
                    return '<div class="mermaid"></div>';
                }
                return `<div class="mermaid">${code}</div>`;
            },
        },
    },
});
