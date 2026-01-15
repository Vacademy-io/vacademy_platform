import React, { useEffect, useRef } from 'react';

// Initialize mermaid once globally
let mermaidInitialized = false;

const initializeMermaid = async () => {
    if (!mermaidInitialized) {
        try {
            const mermaidModule = await import('mermaid');
            const mermaid = mermaidModule.default;
            
            mermaid.initialize({ 
                startOnLoad: false,  // Important: set to false
                theme: 'default',
                securityLevel: 'loose',
                fontFamily: 'inherit',
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'basis',
                },
            });
            mermaidInitialized = true;
        } catch (error) {
            console.error('Error initializing mermaid:', error);
        }
    }
};

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
    const diagramIdRef = useRef<string>(id || `mermaid-${Math.random().toString(36).substr(2, 9)}`);
    const renderedCodeRef = useRef<string>('');

    // Initialize mermaid on mount
    useEffect(() => {
        initializeMermaid();
    }, []);

    // Render diagram when code changes
    useEffect(() => {
        if (!containerRef.current || !code || code.trim() === '') {
            return;
        }

        // Skip if already rendered with same code
        const cleanCode = code.trim();
        if (renderedCodeRef.current === cleanCode) {
            return;
        }

        const renderDiagram = async () => {
            try {
                // Clear previous content
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }

                let processedCode = cleanCode;
                
                // Remove "mermaid " prefix if present
                if (processedCode.toLowerCase().startsWith('mermaid ')) {
                    processedCode = processedCode.substring(8).trim();
                }
                
                if (!processedCode) {
                    return;
                }

                // Ensure mermaid is initialized
                await initializeMermaid();
                
                // Import mermaid
                const mermaidModule = await import('mermaid');
                const mermaid = mermaidModule.default;

                // Generate unique render ID (required for mermaid.render())
                const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // ⚠️ CRITICAL: Call mermaid.render() to actually render the diagram
                const result = await mermaid.render(renderId, processedCode);
                
                if (result && result.svg) {
                    // Successfully rendered - insert SVG
                    if (containerRef.current) {
                        const svgWrapper = document.createElement('div');
                        svgWrapper.style.cssText = 'width: 100%; max-width: 100%; overflow: auto; display: flex; justify-content: center;';
                        
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = result.svg;
                        const svgElement = tempDiv.querySelector('svg');
                        
                        if (svgElement) {
                            svgElement.setAttribute('width', '100%');
                            svgElement.setAttribute('height', 'auto');
                            svgElement.style.maxWidth = '100%';
                            svgElement.style.height = 'auto';
                            svgWrapper.appendChild(svgElement);
                        } else {
                            svgWrapper.innerHTML = result.svg;
                        }
                        
                        containerRef.current.innerHTML = '';
                        containerRef.current.appendChild(svgWrapper);
                        renderedCodeRef.current = cleanCode;
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
                                <strong>⚠️ Diagram rendering failed. Showing code:</strong>
                            </div>
                            <pre style="margin: 0; font-size: 11px; overflow-x: auto; white-space: pre-wrap;">${code}</pre>
                        </div>
                    `;
                }
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
            }}
        />
    );
};

