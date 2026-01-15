import React, { useEffect, useState } from 'react';
import { MermaidDiagram } from './MermaidDiagram';

interface DocumentWithMermaidProps {
    htmlContent: string;
    className?: string;
}

export const DocumentWithMermaid: React.FC<DocumentWithMermaidProps> = ({
    htmlContent,
    className = '',
}) => {
    const [sections, setSections] = useState<Array<{ type: 'html' | 'mermaid'; content: string }>>([]);

    useEffect(() => {
        if (!htmlContent) {
            setSections([]);
            return;
        }

        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            
            // Find all code blocks - check multiple patterns
            // Try: pre code, pre, code (if inside pre), and also check for escaped HTML
            const codeBlocks = tempDiv.querySelectorAll('pre code, pre, code');
            
            // Also check raw HTML string for mermaid patterns
            const hasMermaidInHtml = /graph\s+TD|flowchart|sequenceDiagram|classDiagram|gantt|pie|erDiagram|journey/i.test(htmlContent);
            
            const newSections: Array<{ type: 'html' | 'mermaid'; content: string }> = [];
            
            // Mark mermaid blocks in DOM
            const mermaidBlocks: Array<{ element: Element; code: string }> = [];
            
            codeBlocks.forEach((block) => {
                // Get text content - try multiple methods
                let codeText = '';
                if (block.tagName === 'CODE' && block.parentElement?.tagName === 'PRE') {
                    // If it's a code inside pre, get the code text
                    codeText = block.textContent || block.innerText || '';
                } else if (block.tagName === 'PRE') {
                    // If it's just a pre, get text from it or from code inside
                    const codeElement = block.querySelector('code');
                    codeText = codeElement ? (codeElement.textContent || codeElement.innerText || '') : (block.textContent || block.innerText || '');
                } else {
                    codeText = block.textContent || block.innerText || '';
                }
                
                const trimmedCode = codeText.trim().toLowerCase();
                
                const isMermaid = 
                    trimmedCode.includes('graph') ||
                    trimmedCode.includes('flowchart') ||
                    trimmedCode.includes('sequencediagram') ||
                    trimmedCode.includes('classdiagram') ||
                    trimmedCode.includes('gantt') ||
                    trimmedCode.includes('pie') ||
                    trimmedCode.includes('erdiagram') ||
                    trimmedCode.includes('journey');
                
                if (isMermaid) {
                    // Mark this element for replacement
                    block.setAttribute('data-mermaid-block', 'true');
                    mermaidBlocks.push({
                        element: block,
                        code: codeText.trim()
                    });
                }
            });
            
            // Build sections by splitting HTML around mermaid blocks
            if (mermaidBlocks.length > 0) {
                // Replace mermaid blocks with unique markers in the HTML
                let processedHtml = htmlContent;
                const markers: Array<{ marker: string; code: string; position: number }> = [];
                
                mermaidBlocks.forEach((mermaidBlock, idx) => {
                    // Try to find the block in the original HTML
                    // Use the element's outerHTML, but also try innerHTML for code elements
                    let blockHtml = mermaidBlock.element.outerHTML;
                    
                    // If outerHTML doesn't match, try to construct it
                    if (!processedHtml.includes(blockHtml)) {
                        // Try with just the code content wrapped
                        const codeContent = mermaidBlock.code;
                        // Try different patterns
                        const patterns = [
                            `<pre><code>${codeContent}</code></pre>`,
                            `<pre>${codeContent}</pre>`,
                            `<code>${codeContent}</code>`,
                        ];
                        
                        for (const pattern of patterns) {
                            if (processedHtml.includes(pattern)) {
                                blockHtml = pattern;
                                break;
                            }
                        }
                    }
                    
                    const marker = `__MERMAID_MARKER_${idx}__`;
                    const position = processedHtml.indexOf(blockHtml);
                    
                    if (position !== -1) {
                        processedHtml = processedHtml.substring(0, position) + 
                                      marker + 
                                      processedHtml.substring(position + blockHtml.length);
                        markers.push({ marker, code: mermaidBlock.code, position });
                    }
                });
                
                // Sort markers by position
                markers.sort((a, b) => {
                    const posA = processedHtml.indexOf(a.marker);
                    const posB = processedHtml.indexOf(b.marker);
                    return posA - posB;
                });
                
                // Build sections
                let lastPos = 0;
                markers.forEach((markerInfo) => {
                    const markerPos = processedHtml.indexOf(markerInfo.marker, lastPos);
                    
                    if (markerPos > lastPos) {
                        const htmlBefore = processedHtml.substring(lastPos, markerPos);
                        if (htmlBefore.trim()) {
                            newSections.push({ type: 'html', content: htmlBefore });
                        }
                    }
                    
                    // Add mermaid section
                    newSections.push({ type: 'mermaid', content: markerInfo.code });
                    
                    lastPos = markerPos + markerInfo.marker.length;
                });
                
                // Add remaining HTML
                if (lastPos < processedHtml.length) {
                    const remainingHtml = processedHtml.substring(lastPos);
                    // Remove any remaining markers (shouldn't happen, but just in case)
                    const cleanedHtml = remainingHtml.replace(/__MERMAID_MARKER_\d+__/g, '');
                    if (cleanedHtml.trim()) {
                        newSections.push({ type: 'html', content: cleanedHtml });
                    }
                }
            } else if (hasMermaidInHtml) {
                // Mermaid pattern found but not in code blocks - try to extract directly
                
                // Try to find mermaid code in the HTML using regex
                const mermaidPatterns = [
                    /(graph\s+TD[\s\S]*?)(?=<|$)/i,
                    /(flowchart[\s\S]*?)(?=<|$)/i,
                    /(sequenceDiagram[\s\S]*?)(?=<|$)/i,
                    /(classDiagram[\s\S]*?)(?=<|$)/i,
                ];
                
                let foundMermaid = false;
                let processedHtml = htmlContent;
                
                mermaidPatterns.forEach((pattern, idx) => {
                    const match = processedHtml.match(pattern);
                    if (match && match.index !== undefined) {
                        foundMermaid = true;
                        const mermaidCode = match[1].trim();
                        const beforeHtml = processedHtml.substring(0, match.index);
                        const afterHtml = processedHtml.substring(match.index + match[0].length);
                        
                        if (beforeHtml.trim()) {
                            newSections.push({ type: 'html', content: beforeHtml });
                        }
                        newSections.push({ type: 'mermaid', content: mermaidCode });
                        processedHtml = afterHtml;
                    }
                });
                
                if (foundMermaid && processedHtml.trim()) {
                    newSections.push({ type: 'html', content: processedHtml });
                } else if (!foundMermaid) {
                    // Still no mermaid found, just show HTML
                    newSections.push({ type: 'html', content: htmlContent });
                }
            } else {
                // No mermaid found, just show HTML
                newSections.push({ type: 'html', content: htmlContent });
            }
            setSections(newSections);
        } catch (error) {
            console.error('[DocumentWithMermaid] Error processing content:', error);
            setSections([{ type: 'html', content: htmlContent }]);
        }
    }, [htmlContent]);

    return (
        <div className={`document-with-mermaid ${className}`}>
            {sections.map((section, index) => {
                if (section.type === 'mermaid') {
                    return (
                        <MermaidDiagram
                            key={`mermaid-${index}-${section.content.substring(0, 20)}`}
                            code={section.content}
                            className="my-4"
                        />
                    );
                } else {
                    return (
                        <div
                            key={`html-${index}`}
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                    );
                }
            })}
        </div>
    );
};

