import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { sanitizeMermaidCode } from '@/utils/mermaidSanitizer';
import { initializeMermaid } from '@/utils/initializeMermaid';

interface MermaidDiagramProps {
    code: string;
    className?: string;
    id?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ 
    code, 
    className = '', 
    id 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const renderedCodeRef = useRef<string>('');
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Initialize mermaid once
    useEffect(() => {
        initializeMermaid();
    }, []);

    // Render diagram when code changes
    useEffect(() => {
        if (!containerRef.current || !code || code.trim() === '') {
            return;
        }

        // Skip if code hasn't changed (prevents double rendering in React Strict Mode)
        const trimmedCode = code.trim();
        if (renderedCodeRef.current === trimmedCode) {
            console.log('[MermaidDiagram] Skipping render - code unchanged');
            return;
        }

        const renderDiagram = async () => {
            try {
                // Clear container
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }

                // Clean and sanitize code
                let cleanCode = code.trim();
                
                // Optional: Log for debugging
                // console.log('[MermaidDiagram] Rendering diagram, code length:', cleanCode.length);
                
                if (cleanCode.toLowerCase().startsWith('mermaid ')) {
                    cleanCode = cleanCode.substring(8).trim();
                }
                cleanCode = sanitizeMermaidCode(cleanCode);

                // Generate unique render ID
                const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // Render diagram
                const result = await mermaid.render(renderId, cleanCode);
                
                if (result && result.svg) {
                    if (containerRef.current) {
                        // Mark that we're rendering this code
                        renderedCodeRef.current = cleanCode;
                        
                        // Create wrapper for responsive SVG
                        const svgWrapper = document.createElement('div');
                        svgWrapper.style.cssText = 'width: 100%; max-width: 100%; overflow: auto; display: flex; justify-content: center;';
                        
                        // Parse and modify SVG
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = result.svg;
                        const svgElement = tempDiv.querySelector('svg');
                        
                        if (svgElement) {
                            // Remove fixed width/height attributes
                            svgElement.removeAttribute('height');
                            svgElement.removeAttribute('width');
                            
                            // Set responsive styles
                            svgElement.style.width = '100%';
                            svgElement.style.height = 'auto';
                            svgElement.style.maxWidth = '100%';
                            svgWrapper.appendChild(svgElement);
                        } else {
                            svgWrapper.innerHTML = result.svg;
                        }
                        
                        containerRef.current.appendChild(svgWrapper);
                        setHasError(false);
                    }
                } else {
                    throw new Error('mermaid.render() did not return SVG');
                }
            } catch (error) {
                console.error('Error rendering mermaid diagram:', error);
                
                // Show error fallback
                if (containerRef.current) {
                    containerRef.current.innerHTML = `
                        <div style="padding: 15px; border: 1px solid #ff9800; border-radius: 4px; background: #fff3e0;">
                            <div style="font-size: 12px; color: #e65100; margin-bottom: 8px;">
                                <strong>⚠️ Diagram rendering failed</strong>
                            </div>
                            <pre style="margin: 0; font-size: 11px; overflow-x: auto; white-space: pre-wrap;">${code}</pre>
                        </div>
                    `;
                }
                setHasError(true);
                setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
            }
        };

        renderDiagram();
    }, [code]);

    return (
        <div
            ref={containerRef}
            className={`mermaid-diagram-container ${className}`}
            style={{
                margin: '20px 0',
                padding: '10px',
                backgroundColor: '#f9f9f9',
                border: '1px solid #ccc',
                borderRadius: '4px',
                textAlign: 'center',
                maxWidth: '100%',
                width: '100%',
                overflow: 'hidden',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
                .mermaid-diagram-container svg {
                    max-width: 100% !important;
                    width: 100% !important;
                    height: auto !important;
                }
            `}</style>
        </div>
    );
};
