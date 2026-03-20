import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { sanitizeMermaidCode } from '@/utils/mermaidSanitizer';
import { initializeMermaid } from '@/utils/initializeMermaid';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Maximize2, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const renderedCodeRef = useRef<string>('');
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [svgHtml, setSvgHtml] = useState<string>('');

    // Initialize mermaid once
    useEffect(() => {
        initializeMermaid();
    }, []);

    // Render diagram when code changes
    useEffect(() => {
        if (!code || code.trim() === '') {
            return;
        }

        // Skip if code hasn't changed (prevents double rendering in React Strict Mode)
        const trimmedCode = code.trim();
        if (renderedCodeRef.current === trimmedCode && svgHtml) {
            return;
        }

        const renderDiagram = async () => {
            try {
                // Clean and sanitize code
                let cleanCode = code.trim();

                if (cleanCode.toLowerCase().startsWith('mermaid ')) {
                    cleanCode = cleanCode.substring(8).trim();
                }
                cleanCode = sanitizeMermaidCode(cleanCode);

                // Generate unique render ID - keeping format from valid HTML ID safe
                const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Render diagram
                const result = await mermaid.render(renderId, cleanCode);

                if (result && result.svg) {
                    renderedCodeRef.current = trimmedCode;

                    // Modify SVG for responsiveness (string manipulation or DOM)
                    // We'll use a temp div to manipulate it safely like before
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

                        setSvgHtml(tempDiv.innerHTML);
                    } else {
                        setSvgHtml(result.svg);
                    }

                    setHasError(false);
                    setErrorMessage(''); // Clear any previous error message
                } else {
                    throw new Error('mermaid.render() did not return SVG');
                }
            } catch (error) {
                console.error('Error rendering mermaid diagram:', error);
                // The component will render null if hasError is true
                setSvgHtml(''); // Clear SVG on error
                setHasError(true);
                setErrorMessage(error instanceof Error ? error.message : 'Unknown error');

                // Clean up any orphaned mermaid error elements from the DOM
                document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => el.remove());
            }
        };

        renderDiagram();
    }, [code]);

    if (hasError) {
        return null;
    }

    if (!svgHtml) {
        // Optional: Loading skeleton could go here
        return null;
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div
                    className={cn(
                        "mermaid-diagram-container relative group cursor-pointer border rounded-lg bg-white overflow-hidden hover:shadow-md transition-all duration-200",
                        className
                    )}
                    style={{
                        margin: '20px 0',
                        backgroundColor: '#fff', // Changed to white for better readability
                    }}
                >
                    {/* Simplified View Container */}
                    <div
                        className="flex justify-center p-4 max-h-[300px] overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity"
                        dangerouslySetInnerHTML={{ __html: svgHtml }}
                    />

                    {/* Gradient Fade at bottom to indicate there's more */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />

                    {/* Pop-out / Zoom Overlay Options */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-primary-600">
                            <Maximize2 size={18} />
                        </div>
                    </div>

                    <div className="absolute inset-x-0 bottom-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-gray-200 text-xs font-medium text-gray-600">
                            <ZoomIn size={14} />
                            <span>Click to expand</span>
                        </div>
                    </div>
                </div>
            </DialogTrigger>

            <DialogContent className="max-w-[90vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50 border-none outline-none">
                <div className="flex-1 overflow-auto p-8 min-h-0">
                    <div className="min-h-full w-full flex flex-col items-center justify-center">
                        <div
                            className="w-full"
                            dangerouslySetInnerHTML={{ __html: svgHtml }}
                        />
                    </div>
                </div>
                <div className="p-3 border-t bg-white flex justify-end text-xs text-muted-foreground">
                    Scroll to pan • Use controls to interact
                </div>
            </DialogContent>
        </Dialog>
    );
};
