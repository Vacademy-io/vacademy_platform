import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
    content: string;
    className?: string;
}

/**
 * LatexRenderer component
 * Renders markdown text with LaTeX math expressions using KaTeX
 * Supports both inline math ($...$) and display math ($$...$$)
 */
export const LatexRenderer: React.FC<LatexRendererProps> = ({ content, className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!content || !containerRef.current) {
            return;
        }

        // Split content by LaTeX delimiters while preserving them
        const parseContent = (text: string) => {
            const parts: Array<{ type: 'text' | 'inline-math' | 'display-math'; content: string }> =
                [];
            let currentIndex = 0;

            // Regex to find math expressions
            // Match display math ($$...$$) first, then inline math ($...$)
            const mathRegex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
            let match;

            while ((match = mathRegex.exec(text)) !== null) {
                // Add text before the math
                if (match.index > currentIndex) {
                    parts.push({
                        type: 'text',
                        content: text.substring(currentIndex, match.index),
                    });
                }

                // Add the math expression
                if (match[1]) {
                    // Display math ($$...$$)
                    parts.push({
                        type: 'display-math',
                        content: match[1],
                    });
                } else if (match[2]) {
                    // Inline math ($...$)
                    parts.push({
                        type: 'inline-math',
                        content: match[2],
                    });
                }

                currentIndex = match.index + match[0].length;
            }

            // Add remaining text
            if (currentIndex < text.length) {
                parts.push({
                    type: 'text',
                    content: text.substring(currentIndex),
                });
            }

            return parts;
        };

        const parts = parseContent(content);
        const container = containerRef.current;

        // Clear previous content
        container.innerHTML = '';

        // Render each part
        parts.forEach((part) => {
            if (part.type === 'text') {
                // Render plain text, preserving line breaks
                const lines = part.content.split('\n');
                lines.forEach((line, index) => {
                    const textNode = document.createTextNode(line);
                    container.appendChild(textNode);
                    if (index < lines.length - 1) {
                        container.appendChild(document.createElement('br'));
                    }
                });
            } else if (part.type === 'inline-math') {
                // Render inline math
                const span = document.createElement('span');
                try {
                    katex.render(part.content, span, {
                        displayMode: false,
                        throwOnError: false,
                    });
                } catch (error) {
                    span.textContent = `$${part.content}$`;
                    console.error('KaTeX rendering error:', error);
                }
                container.appendChild(span);
            } else if (part.type === 'display-math') {
                // Render display math (block)
                const div = document.createElement('div');
                try {
                    katex.render(part.content, div, {
                        displayMode: true,
                        throwOnError: false,
                    });
                } catch (error) {
                    div.textContent = `$$${part.content}$$`;
                    console.error('KaTeX rendering error:', error);
                }
                container.appendChild(div);
            }
        });
    }, [content]);

    if (!content) {
        return null;
    }

    return <div ref={containerRef} className={`latex-renderer ${className}`} />;
};

export default LatexRenderer;
