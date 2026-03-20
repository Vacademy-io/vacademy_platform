/**
 * Convert markdown to HTML, handling mermaid code blocks specially
 * Extracts mermaid code blocks and converts them to <div class="mermaid">...</div>
 * Converts the rest of the markdown to HTML
 */

/**
 * Converts ONLY mermaid code blocks to <div class="mermaid">...</div>
 * Useful when content is already HTML but contains mermaid code blocks
 */
export function convertMermaidCodeToDiv(text: string): string {
    if (!text) return '';

    // Check if there are any mermaid blocks
    if (!/```mermaid[\s\S]*?```/m.test(text)) {
        return text;
    }

    // Replace mermaid code blocks with div.mermaid
    return text.replace(/```mermaid\s*\n?([\s\S]*?)\n?```/g, (match, code) => {
        const trimmedCode = code.trim();
        return `<div class="mermaid">\n${trimmedCode}\n</div>`;
    });
}

export function markdownToHtml(markdown: string): string {
    if (!markdown) return '';

    // AGGRESSIVE PRE-PROCESSING: Ensure block elements are on their own lines
    // This fixes issues where AI output lacks newlines (e.g., "Text### Header" or "Text- List")
    let processedMarkdown = markdown
        // Ensure headers have newlines before them
        .replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2')
        // Ensure lists have newlines before them (if not already at start of line)
        .replace(/([^\n])\s*([\*\-\+]\s)/g, '$1\n$2')
        .replace(/([^\n])\s*(\d+\.\s)/g, '$1\n$2')
        // Ensure mermaid diagrams have newlines before them
        .replace(/([^\n])\s*(```mermaid)/g, '$1\n\n$2')
        .replace(/([^\n])\s*(\bgraph\s+\w+)/g, '$1\n\n$2')
        .replace(/([^\n])\s*(\bflowchart\s+\w+)/g, '$1\n\n$2')
        .replace(/([^\n])\s*(\bsequenceDiagram\b)/g, '$1\n\n$2')
        .replace(/([^\n])\s*(\bclassDiagram\b)/g, '$1\n\n$2');

    // Check if content is markdown (has markdown syntax)
    const hasMarkdownSyntax = /^#+\s|^\*\s|^-\s|^\d+\.\s|```|\[.*\]\(.*\)/m.test(processedMarkdown);

    // If it doesn't look like markdown, just check/convert mermaid blocks
    if (!hasMarkdownSyntax) {
        // Even if not standard markdown, we might have unfenced mermaid
        // So we should try to process it anyway if we see mermaid keywords
        if (/graph\s+\w+|flowchart\s+\w+|sequenceDiagram|classDiagram/.test(processedMarkdown)) {
            // Continue processing
        } else {
            return convertMermaidCodeToDiv(processedMarkdown);
        }
    }

    // Extract fenced mermaid code blocks first
    const mermaidBlocks: Array<{ code: string; placeholder: string }> = [];
    let mermaidIndex = 0;

    // Replace mermaid code blocks with placeholders
    processedMarkdown = processedMarkdown.replace(/```mermaid\s*\n?([\s\S]*?)\n?```/g, (match, code) => {
        const placeholder = `__MERMAID_PLACEHOLDER_${mermaidIndex}__`;
        mermaidBlocks.push({
            code: code.trim(),
            placeholder
        });
        mermaidIndex++;
        return `\n${placeholder}\n`;
    });

    // Also handle non-mermaid code blocks
    processedMarkdown = processedMarkdown.replace(/```(\w+)?\s*\n?([\s\S]*?)\n?```/g, (match, lang, code) => {
        if (lang === 'mermaid') return match; // Should have been replaced already
        // Preserve code formatting
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Convert markdown to HTML line by line
    const lines = processedMarkdown.split('\n');
    const htmlLines: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            const firstLine = (currentParagraph[0] || '').trim();

            // Check for potential mermaid diagram (unfenced)
            // This handles cases where AI generates mermaid code without '```mermaid' fences
            const isMermaid = /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)|^graph\s+[A-Za-z]+|^(sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|journey|gitGraph|mindmap|requirementDiagram|c4Context)/.test(firstLine);

            if (isMermaid) {
                htmlLines.push(`<div class="mermaid">\n${currentParagraph.join('\n')}\n</div>`);
                currentParagraph = [];
                return;
            }

            const paraText = currentParagraph.join(' ').trim();
            if (paraText) {
                // Check if the paragraph is actually an HTML block (starts with <)
                // If so, don't wrap in <p>
                if (paraText.startsWith('<') && !paraText.startsWith('<a') && !paraText.startsWith('<span') && !paraText.startsWith('<strong') && !paraText.startsWith('<em') && !paraText.startsWith('<code')) {
                    htmlLines.push(paraText);
                } else {
                    htmlLines.push(`<p>${paraText}</p>`);
                }
            }
            currentParagraph = [];
        }
    };

    const flushList = () => {
        if (inList && listType) {
            htmlLines.push(`</${listType}>`);
            inList = false;
            listType = null;
        }
    };

    // Helper to check if a line is an HTML block tag
    const isHtmlBlock = (line: string): boolean => {
        const trimmed = line.trim();
        return /^\s*<(div|p|h[1-6]|ul|ol|li|blockquote|section|article|header|footer|nav|table|form|hr|br|pre|iframe)/i.test(trimmed);
    };

    // Helper to identify mermaid start
    const isMermaidStart = (line: string): boolean => {
        return /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)|^graph\s+[A-Za-z]+|^(sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|journey|gitGraph|mindmap|requirementDiagram|c4Context)/.test(line);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';

        // Check if this line is a mermaid placeholder
        if (line.startsWith('__MERMAID_PLACEHOLDER_') && line.endsWith('__')) {
            flushParagraph();
            flushList();
            htmlLines.push(line); // Keep placeholder as-is, will replace later
            continue;
        }

        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        // Check if the lines starts a mermaid block (Unfenced)
        if (isMermaidStart(line)) {
            flushParagraph(); // Flush any previous text
            flushList();

            // Start collecting mermaid lines
            // We assume the rest of the paragraph (until next blank line) is part of the mermaid diagram
            currentParagraph.push(line);

            // Continue to next lines, but treating them differently? 
            // Actually, if we just push to currentParagraph and then flushParagraph() checks isMermaidStart(currentParagraph[0]),
            // then it will work perfectly!
            // The KEY is that we flushed the PREVIOUS text above.
            // So now 'line' becomes the first element of 'currentParagraph'.
            continue;
        }

        // If line is already HTML block, preserve it
        if (isHtmlBlock(line)) {
            flushParagraph();
            flushList();
            htmlLines.push(line);
            continue;
        }

        // Headers
        if (line.startsWith('### ')) {
            flushParagraph();
            flushList();
            htmlLines.push(`<h3>${line.substring(4)}</h3>`);
            continue;
        }
        if (line.startsWith('## ')) {
            flushParagraph();
            flushList();
            htmlLines.push(`<h2>${line.substring(3)}</h2>`);
            continue;
        }
        if (line.startsWith('# ')) {
            flushParagraph();
            flushList();
            htmlLines.push(`<h1>${line.substring(2)}</h1>`);
            continue;
        }

        // Unordered lists
        if (/^[\*\-\+]\s+/.test(line)) {
            flushParagraph();
            const listItem = line.replace(/^[\*\-\+]\s+/, '');
            if (!inList || listType !== 'ul') {
                flushList();
                htmlLines.push('<ul>');
                inList = true;
                listType = 'ul';
            }
            htmlLines.push(`<li>${listItem}</li>`);
            continue;
        }

        // Ordered lists
        if (/^\d+\.\s+/.test(line)) {
            flushParagraph();
            const listItem = line.replace(/^\d+\.\s+/, '');
            if (!inList || listType !== 'ol') {
                flushList();
                htmlLines.push('<ol>');
                inList = true;
                listType = 'ol';
            }
            htmlLines.push(`<li>${listItem}</li>`);
            continue;
        }

        // Regular paragraph text
        flushList();
        currentParagraph.push(line);
    }

    flushParagraph();
    flushList();

    let html = htmlLines.join('\n');

    // Extract mermaid divs BEFORE applying inline markdown formatting
    // to prevent corrupting diagram code with <strong>, <em>, etc.
    const mermaidDivPlaceholders: Array<{ placeholder: string; content: string }> = [];
    let mermaidDivIndex = 0;
    html = html.replace(/<div class="mermaid">([\s\S]*?)<\/div>/g, (match) => {
        const placeholder = `__MERMAID_DIV_${mermaidDivIndex}__`;
        mermaidDivPlaceholders.push({ placeholder, content: match });
        mermaidDivIndex++;
        return placeholder;
    });

    // Process inline markdown in the HTML
    // Be careful not to replace things inside attributes or existing HTML tags
    // This is a naive implementation, but should work for basic content

    // We only apply inline formatting if there are no HTML tags in the text
    // or if we are careful. For safety, let's keep it simple for now. 
    // Ideally we should tokenize, but regex is what we have.

    html = html
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic (but not if it's part of bold)
        .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
        // Inline code (avoid converting inside existing HTML)
        .replace(/`([^`]+)`/g, (match, code) => {
            return `<code>${code}</code>`;
        })
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Restore mermaid div placeholders (must happen before mermaid block placeholders)
    mermaidDivPlaceholders.forEach(({ placeholder, content }) => {
        html = html.replace(placeholder, content);
    });

    // Replace mermaid placeholders with <div class="mermaid">...</div>
    mermaidBlocks.forEach(({ code, placeholder }) => {
        html = html.replace(placeholder, `<div class="mermaid">\n${code}\n</div>`);
    });

    return html;
}
