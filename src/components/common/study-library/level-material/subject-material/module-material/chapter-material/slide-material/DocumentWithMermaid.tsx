import React, { useEffect, useState } from 'react';
import { MermaidDiagram } from './MermaidDiagram';
import { EnhancedCodeBlock } from './EnhancedCodeBlock';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Interactive quiz component for learner side */
function InlineQuiz({ quizJson }: { quizJson: string }) {
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

    let quizData: { question: string; options: { text: string; isCorrect: boolean }[]; explanation?: string } = {
        question: '', options: [], explanation: '',
    };
    try {
        quizData = JSON.parse(quizJson);
    } catch { /* use empty */ }

    if (!quizData.question) return null;

    return (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', margin: '8px 0', background: '#fafafa' }}>
            <div style={{ padding: '4px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '4px', display: 'inline-block', fontSize: '12px', fontWeight: 600, color: '#4338ca', marginBottom: '12px' }}>
                QUIZ
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                {quizData.question}
            </div>
            {quizData.options.map((opt, i) => {
                let bgColor = '#fff';
                let borderColor = '#ddd';
                let textColor = '#333';
                if (selectedAnswer === i) { borderColor = '#4338ca'; bgColor = '#eef2ff'; }
                if (showResult) {
                    if (opt.isCorrect) { bgColor = '#d4edda'; borderColor = '#28a745'; textColor = '#155724'; }
                    else if (selectedAnswer === i) { bgColor = '#f8d7da'; borderColor = '#dc3545'; textColor = '#721c24'; }
                }
                return (
                    <div key={i} onClick={() => { if (!showResult) setSelectedAnswer(i); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: `2px solid ${borderColor}`, borderRadius: '6px', marginBottom: '6px', cursor: showResult ? 'default' : 'pointer', backgroundColor: bgColor, color: textColor, transition: 'all 0.2s' }}>
                        <span style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0, backgroundColor: selectedAnswer === i ? borderColor : 'transparent', color: selectedAnswer === i ? 'white' : textColor }}>
                            {showResult && opt.isCorrect ? '\u2713' : optionLabels[i]}
                        </span>
                        <span style={{ fontSize: '14px' }}>{opt.text}</span>
                    </div>
                );
            })}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {!showResult ? (
                    <button onClick={() => setShowResult(true)} disabled={selectedAnswer === null}
                        style={{ padding: '6px 16px', fontSize: '13px', border: 'none', borderRadius: '4px', backgroundColor: selectedAnswer !== null ? '#4338ca' : '#ccc', color: 'white', cursor: selectedAnswer !== null ? 'pointer' : 'default' }}>
                        Check Answer
                    </button>
                ) : (
                    <button onClick={() => { setSelectedAnswer(null); setShowResult(false); }}
                        style={{ padding: '6px 16px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff', color: '#666', cursor: 'pointer' }}>
                        Try Again
                    </button>
                )}
            </div>
            {showResult && quizData.explanation && (
                <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '13px', color: '#856404' }}>
                    <strong>Explanation:</strong> {quizData.explanation}
                </div>
            )}
        </div>
    );
}

interface DocumentWithMermaidProps {
    htmlContent: string;
    className?: string;
}

export const DocumentWithMermaid: React.FC<DocumentWithMermaidProps> = ({
    htmlContent,
    className = '',
}) => {
    const [sections, setSections] = useState<Array<{ type: 'html' | 'mermaid' | 'code' | 'math' | 'quiz'; content: string; meta?: Record<string, string> }>>([]);

    useEffect(() => {
        if (!htmlContent) {
            setSections([]);
            return;
        }

        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;

            // First, check for div.mermaid elements (most common pattern for mermaid)
            const mermaidDivs = tempDiv.querySelectorAll('div.mermaid');

            // Also check for code blocks
            const codeBlocks = tempDiv.querySelectorAll('pre code, pre, code');

            // Also check raw HTML string for mermaid patterns
            const hasMermaidInHtml = /graph\s+TD|flowchart|sequenceDiagram|classDiagram|gantt|pie|erDiagram|journey/i.test(htmlContent);

            type SectionType = 'html' | 'mermaid' | 'code' | 'math' | 'quiz';
            const newSections: Array<{ type: SectionType; content: string; meta?: Record<string, string> }> = [];

            // Mark special blocks in DOM
            const specialBlocks: Array<{ element: Element; code: string; type: SectionType; meta?: Record<string, string> }> = [];

            // Process audio blocks — mark them so they're not broken apart
            const audioDivs = tempDiv.querySelectorAll('div[data-yoopta-type="audioPlayer"]');
            audioDivs.forEach((div) => {
                specialBlocks.push({
                    element: div,
                    code: div.outerHTML,
                    type: 'html', // render as raw HTML — <audio> tag works natively
                });
            });

            // Process quiz blocks — interactive on learner side
            const quizDivs = tempDiv.querySelectorAll('div[data-yoopta-type="quizBlock"]');
            quizDivs.forEach((div) => {
                const quizJson = div.getAttribute('data-quiz') || '';
                specialBlocks.push({
                    element: div,
                    code: quizJson,
                    type: 'quiz',
                });
            });

            // Process timeline blocks — render as HTML (visual fallback is sufficient)
            const timelineDivs = tempDiv.querySelectorAll('div[data-yoopta-type="timeline"]');
            timelineDivs.forEach((div) => {
                specialBlocks.push({
                    element: div,
                    code: div.outerHTML,
                    type: 'html',
                });
            });

            // Process math blocks (div[data-yoopta-type="mathBlock"])
            const mathDivs = tempDiv.querySelectorAll('div[data-yoopta-type="mathBlock"]');
            mathDivs.forEach((div) => {
                const htmlDiv = div as HTMLElement;
                let latex = htmlDiv.textContent?.trim() || '';
                // Strip $$ or $ delimiters
                if (latex.startsWith('$$') && latex.endsWith('$$')) {
                    latex = latex.slice(2, -2).trim();
                } else if (latex.startsWith('$') && latex.endsWith('$')) {
                    latex = latex.slice(1, -1).trim();
                }
                const displayMode = div.getAttribute('data-display-mode') !== 'false';
                specialBlocks.push({
                    element: div,
                    code: latex,
                    type: 'math',
                    meta: { displayMode: String(displayMode) },
                });
            });

            // Process div.mermaid elements first (highest priority)
            mermaidDivs.forEach((div) => {
                const htmlDiv = div as HTMLElement;
                const codeText = htmlDiv.innerText || htmlDiv.textContent || '';
                specialBlocks.push({
                    element: div,
                    code: codeText.trim(),
                    type: 'mermaid'
                });
            });

            // Process code blocks
            codeBlocks.forEach((block) => {
                const htmlBlock = block as HTMLElement;
                // Skip if this block is already part of a detected mermaid div
                if (block.closest('div.mermaid')) return;

                // Get text content - prefer innerText to preserve line breaks from block elements
                let codeText = '';
                if (block.tagName === 'CODE' && block.parentElement?.tagName === 'PRE') {
                    // If it's a code inside pre, get the code text
                    const parent = block.parentElement as HTMLElement;
                    codeText = htmlBlock.innerText || htmlBlock.textContent || '';
                    // If code element has strange formatting, maybe fallback to parent text?
                    // But usually code element contains the text.
                } else if (block.tagName === 'PRE') {
                    // If it's just a pre, get text from it or from code inside
                    const codeElement = block.querySelector('code') as HTMLElement | null;
                    if (codeElement) {
                        codeText = codeElement.innerText || codeElement.textContent || '';
                    } else {
                        codeText = htmlBlock.innerText || htmlBlock.textContent || '';
                    }
                } else {
                    // Inline code or other
                    // check if it is part of pre
                    if (block.closest('pre')) return; // handled by parent pre
                    codeText = htmlBlock.innerText || htmlBlock.textContent || '';
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

                // Only treat as block if it's a PRE tag or inside PRE tag
                // content inside simple <code> tags inline should be left as HTML
                const isBlock = block.tagName === 'PRE' || block.parentElement?.tagName === 'PRE';

                if (isMermaid) {
                    // Avoid duplicates if we already caught this via div.mermaid
                    // But here we are processing code blocks
                    specialBlocks.push({
                        element: block.tagName === 'CODE' && block.parentElement?.tagName === 'PRE' ? block.parentElement : block,
                        code: codeText, // Keep original casing
                        type: 'mermaid'
                    });
                } else if (isBlock) {
                    // It's a code block but not mermaid
                    // We want to render this with EnhancedCodeBlock
                    specialBlocks.push({
                        element: block.tagName === 'CODE' && block.parentElement?.tagName === 'PRE' ? block.parentElement : block,
                        code: codeText,
                        type: 'code'
                    });
                }
            });

            // Deduplicate blocks (in case pre and code both got picked up)
            const uniqueBlocks: typeof specialBlocks = [];
            const processedElements = new Set<Element>();

            specialBlocks.forEach(block => {
                if (!processedElements.has(block.element)) {
                    processedElements.add(block.element);
                    uniqueBlocks.push(block);
                }
            });

            // If no special blocks found but text pattern exists
            if (uniqueBlocks.length === 0 && hasMermaidInHtml) {
                // Try to find mermaid code in the HTML using regex (fallback loops)
                // ... (same regex logic as before) ...
                // Re-implementing simplified regex fallback if needed, but existing block logic is usually sufficient for 'pre code'
            }

            if (uniqueBlocks.length > 0) {
                // Use tempDiv.innerHTML instead of htmlContent to ensure outerHTML matches occur
                let processedHtml = tempDiv.innerHTML;
                const markers: Array<{ marker: string; code: string; type: SectionType; position: number; meta?: Record<string, string> }> = [];

                uniqueBlocks.forEach((block, idx) => {
                    const marker = `__SPECIAL_BLOCK_${idx}__`;

                    // Helper to find block in HTML
                    let blockHtml = block.element.outerHTML;

                    // Naive approach: find outerHTML
                    let position = processedHtml.indexOf(blockHtml);

                    // If not found, try to construct likely HTML patterns
                    if (position === -1) {
                        const codeContent = block.code;
                        // Try identifying by unique content if possible, or patterns
                        // This is tricky.
                        // Fallback: if we can't find the exact HTML, we might skip replacement or try looser match
                        // For now, let's try strict match.
                    }

                    if (position !== -1) {
                        processedHtml = processedHtml.substring(0, position) +
                            marker +
                            processedHtml.substring(position + blockHtml.length);
                        markers.push({ marker, code: block.code, type: block.type, position, meta: block.meta });
                    } else {
                        // Fallback for when outerHTML doesn't match exactly (e.g. attributes order)
                        // Try finding by text content if it's unique? Risky.
                        // Let's try finding the Pre block by partial match?
                        // For now, let's proceed with what we found.
                    }
                });

                markers.sort((a, b) => {
                    const posA = processedHtml.indexOf(a.marker);
                    const posB = processedHtml.indexOf(b.marker);
                    return posA - posB;
                });

                let lastPos = 0;
                markers.forEach((markerInfo) => {
                    const markerPos = processedHtml.indexOf(markerInfo.marker, lastPos);

                    if (markerPos > lastPos) {
                        const htmlBefore = processedHtml.substring(lastPos, markerPos);
                        if (htmlBefore.trim()) {
                            newSections.push({ type: 'html', content: htmlBefore });
                        }
                    }

                    newSections.push({ type: markerInfo.type, content: markerInfo.code, meta: markerInfo.meta });

                    lastPos = markerPos + markerInfo.marker.length;
                });

                if (lastPos < processedHtml.length) {
                    const remainingHtml = processedHtml.substring(lastPos);
                    if (remainingHtml.trim()) {
                        newSections.push({ type: 'html', content: remainingHtml });
                    }
                }
                setSections(newSections);

            } else {
                // Fallback to regex detection for mermaid if strictly no blocks found
                // (Reuse previous regex logic or just render HTML)
                // Copy of regex logic from previous implementation
                const mermaidPatterns = [
                    /(graph\s+TD[\s\S]*?)(?=<|$)/i,
                    /(flowchart[\s\S]*?)(?=<|$)/i,
                    /(sequenceDiagram[\s\S]*?)(?=<|$)/i,
                    /(classDiagram[\s\S]*?)(?=<|$)/i,
                ];

                let foundMermaid = false;
                let processedHtml = htmlContent;
                const regexSections: typeof newSections = [];

                mermaidPatterns.forEach((pattern) => {
                    const match = processedHtml.match(pattern);
                    if (match && match.index !== undefined) {
                        foundMermaid = true;
                        const mermaidCode = match[1].trim();
                        const beforeHtml = processedHtml.substring(0, match.index);
                        const afterHtml = processedHtml.substring(match.index + match[0].length);

                        if (beforeHtml.trim()) {
                            regexSections.push({ type: 'html', content: beforeHtml });
                        }
                        regexSections.push({ type: 'mermaid', content: mermaidCode });
                        processedHtml = afterHtml;
                    }
                });

                if (foundMermaid) {
                    if (processedHtml.trim()) regexSections.push({ type: 'html', content: processedHtml });
                    setSections(regexSections);
                } else {
                    setSections([{ type: 'html', content: htmlContent }]);
                }
            }
        } catch (error) {
            console.error('[DocumentWithMermaid] Error processing content:', error);
            setSections([{ type: 'html', content: htmlContent }]);
        }
    }, [htmlContent]);

    return (
        <div className={`document-with-mermaid ${className}`}>
            <style>{`
                .document-with-mermaid {
                    font-family: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                    color: #374151;
                    line-height: 1.7;
                }
                
                .document-with-mermaid h1 {
                    font-size: 1.875rem;
                    line-height: 1.25;
                    font-weight: 700;
                    margin-bottom: 1.5rem;
                    color: #111827;
                    border-bottom: 2px solid transparent;
                    border-image: linear-gradient(to right, #3b82f6, #4f46e5) 1;
                    padding-bottom: 0.75rem;
                }
                
                .document-with-mermaid h2 {
                    font-size: 1.5rem;
                    line-height: 1.3;
                    font-weight: 600;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                    color: #111827;
                }
                
                .document-with-mermaid h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    color: #111827;
                }
                
                .document-with-mermaid p {
                    margin-bottom: 1.5rem;
                    font-size: 1.125rem;
                    color: #374151;
                    line-height: 1.8;
                }
                
                .document-with-mermaid ul, .document-with-mermaid ol {
                    margin-bottom: 1.5rem;
                    padding-left: 0;
                    list-style: none;
                }
                
                .document-with-mermaid ul > li, .document-with-mermaid ol > li {
                    position: relative;
                    padding-left: 2rem;
                    margin-bottom: 0.75rem;
                    font-size: 1.125rem;
                    color: #374151;
                }
                
                .document-with-mermaid ul > li::before {
                    content: '';
                    position: absolute;
                    left: 0.5rem;
                    top: 0.75rem;
                    width: 0.5rem;
                    height: 0.5rem;
                    background-color: #4f46e5;
                    border-radius: 50%;
                }
                
                .document-with-mermaid ol {
                    counter-reset: item;
                }
                
                .document-with-mermaid ol > li {
                    counter-increment: item;
                }
                
                .document-with-mermaid ol > li::before {
                    content: counter(item);
                    position: absolute;
                    left: 0;
                    top: 0.15rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 1.5rem;
                    height: 1.5rem;
                    background-color: #e0e7ff;
                    color: #4338ca;
                    font-size: 0.875rem;
                    font-weight: 600;
                    border-radius: 50%;
                }
                
                .document-with-mermaid blockquote {
                    position: relative;
                    padding: 1rem 1.5rem;
                    margin: 2rem 0;
                    border-left: 4px solid #60a5fa;
                    background: linear-gradient(to right, #eff6ff, #eef2ff);
                    border-radius: 0 0.5rem 0.5rem 0;
                    font-style: italic;
                    color: #1f2937;
                }

                /* Mobile responsiveness */
                @media (min-width: 640px) {
                    .document-with-mermaid h1 { font-size: 2.25rem; padding-bottom: 1rem; }
                    .document-with-mermaid h2 { font-size: 1.875rem; }
                    .document-with-mermaid h3 { font-size: 1.5rem; }
                }
            `}</style>

            {sections.map((section, index) => {
                if (section.type === 'mermaid') {
                    return (
                        <MermaidDiagram
                            key={`mermaid-${index}-${section.content.substring(0, 20)}`}
                            code={section.content}
                            className="my-4"
                        />
                    );
                } else if (section.type === 'math') {
                    const displayMode = section.meta?.displayMode !== 'false';
                    let mathHtml = '';
                    try {
                        mathHtml = katex.renderToString(section.content, {
                            displayMode,
                            throwOnError: false,
                            output: 'html',
                        });
                    } catch {
                        mathHtml = section.content;
                    }
                    return (
                        <div
                            key={`math-${index}`}
                            className="my-4"
                            style={{ textAlign: displayMode ? 'center' : 'left', padding: '16px 0' }}
                            dangerouslySetInnerHTML={{ __html: mathHtml }}
                        />
                    );
                } else if (section.type === 'quiz') {
                    return (
                        <InlineQuiz
                            key={`quiz-${index}`}
                            quizJson={section.content}
                        />
                    );
                } else if (section.type === 'code') {
                    return (
                        <EnhancedCodeBlock
                            key={`code-${index}`}
                            code={section.content}
                            className="my-4"
                        />
                    );
                } else {
                    return (
                        <div
                            key={`html-${index}`}
                            className="html-section"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                    );
                }
            })}
        </div>
    );
};

