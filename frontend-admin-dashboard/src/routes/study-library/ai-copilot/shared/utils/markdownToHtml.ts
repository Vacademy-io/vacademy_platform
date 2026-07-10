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

    // Protect <pre> blocks first — a ```mermaid fence inside a code example
    // (e.g. a lesson teaching Mermaid syntax) must stay literal code.
    const preBlocks: string[] = [];
    let working = text.replace(/<pre[\s\S]*?<\/pre>/gi, (match) => {
        preBlocks.push(match);
        return `__PRE_BLOCK_PLACEHOLDER_${preBlocks.length - 1}__`;
    });

    // Replace mermaid code blocks with div.mermaid
    working = working.replace(/```mermaid\s*\n?([\s\S]*?)\n?```/g, (match, code) => {
        const trimmedCode = code.trim();
        return `<div class="mermaid">\n${trimmedCode}\n</div>`;
    });

    preBlocks.forEach((block, i) => {
        working = working.replace(`__PRE_BLOCK_PLACEHOLDER_${i}__`, () => block);
    });
    return working;
}

/**
 * Content that is already HTML (AI documents are generated as HTML) must NOT
 * go through the line-based markdown converter — it trims indentation inside
 * <pre> blocks, turns `#` code comments into headings, and splits sentences.
 * Detect it by a leading block-level tag; such content only needs its
 * ```mermaid fences (if any) converted to div.mermaid.
 */
function isHtmlContent(text: string): boolean {
    // Structural block tags only — void/inline-ish tags (img, hr, figure) can
    // legitimately lead an otherwise-markdown document and must not trigger
    // the passthrough.
    return /^\s*<(!doctype|html|body|h[1-6]|p|div|ul|ol|table|pre|blockquote|section|article)\b/i.test(
        text
    );
}

const b64encode = (text: string): string => {
    try {
        return btoa(unescape(encodeURIComponent(text)));
    } catch {
        return '';
    }
};

const escapeCodeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A real (unfenced) Mermaid header sits ALONE on its line — `graph TD`,
 * `sequenceDiagram`, `pie title X`. Requiring end-of-line keeps prose like
 * "pie charts are useful" or "graph TD creates a top-down flowchart while…"
 * from being swallowed into broken diagrams.
 */
function isMermaidHeaderLine(line: string): boolean {
    return /^(graph|flowchart)\s+(TD|TB|BT|RL|LR)\s*$|^(sequenceDiagram|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|gantt|journey|gitGraph|mindmap|requirementDiagram|c4Context)\s*$|^pie(\s+showData)?(\s+title\s+.+)?\s*$/.test(
        line.trim()
    );
}

export function markdownToHtml(markdown: string): string {
    if (!markdown) return '';

    // Already-HTML content: idempotent passthrough (fixes re-mangling when
    // callers pipe content through this converter multiple times).
    if (isHtmlContent(markdown)) {
        return convertMermaidCodeToDiv(markdown);
    }

    // Extract ALL fenced blocks FIRST — before table detection and before the
    // aggressive newline pre-processing — so no later transform can corrupt
    // their contents (e.g. `2 ** 3` used to be split by the list fixer, and
    // `# comments` lost indentation to the heading fixer).
    //
    // ONE sequential pass for mermaid and code fences: two separate passes let
    // a fence opener nested inside another fence get extracted independently,
    // leaking a literal placeholder token into the outer block's code.
    //
    // Code blocks are stashed so the line-based conversion cannot trim
    // indentation, split the code into paragraphs, or apply inline **bold**
    // formatting inside it. The emitted <pre> carries the base64 data-code
    // attribute the editor's code plugin prefers, so newlines/indentation
    // survive round-trips.
    const mermaidBlocks: Array<{ code: string; placeholder: string }> = [];
    const codeBlocks: Array<{ html: string; placeholder: string }> = [];
    const fenceExtracted = markdown.replace(
        /```(\w+)?\s*\n?([\s\S]*?)\n?```/g,
        (match, lang, code) => {
            if (lang === 'mermaid') {
                const placeholder = `__MERMAID_PLACEHOLDER_${mermaidBlocks.length}__`;
                mermaidBlocks.push({ code: code.trim(), placeholder });
                return `\n${placeholder}\n`;
            }
            const codeText = code.replace(/^\n+|\n+$/g, '');
            const langAttr = lang ? ` data-language="${lang}"` : '';
            const codeClass = lang ? ` class="language-${lang}"` : '';
            const html = `<pre data-code="${b64encode(codeText)}"${langAttr}><code${codeClass}>${escapeCodeHtml(codeText)}</code></pre>`;
            const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlocks.length}__`;
            codeBlocks.push({ html, placeholder });
            return `\n${placeholder}\n`;
        }
    );

    // Extract GFM pipe tables next (still before the aggressive newline
    // pre-processing — the list fixer splits on "dash + space", which would
    // mangle a `| --- | --- |` delimiter row). Each table is stashed as an
    // HTML block behind a placeholder and restored just before inline
    // formatting (so **bold**/links inside cells still convert).
    // The transcript notes viewer renders tables via remark-gfm; this keeps
    // the DOC-slide HTML consistent instead of leaking literal `| a | b |`.
    const tableBlocks: Array<{ placeholder: string; html: string }> = [];
    const splitTableRow = (line: string): string[] => {
        let s = line.trim();
        if (s.startsWith('|')) s = s.slice(1);
        if (s.endsWith('|')) s = s.slice(0, -1);
        return s.split('|').map((c) => c.trim());
    };
    const isTableSeparator = (line: string): boolean => {
        if (!line || !line.includes('|')) return false;
        const cells = splitTableRow(line);
        return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
    };
    const tableExtracted = (() => {
        const rawLines = fenceExtracted.split('\n');
        const out: string[] = [];
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i] ?? '';
            if (line.includes('|') && isTableSeparator((rawLines[i + 1] ?? '').trim())) {
                const headers = splitTableRow(line);
                const bodyRows: string[][] = [];
                let j = i + 2;
                while (j < rawLines.length) {
                    const rowLine = (rawLines[j] ?? '').trim();
                    if (!rowLine || !rowLine.includes('|')) break;
                    bodyRows.push(splitTableRow(rowLine));
                    j++;
                }
                const thead = `<thead><tr>${headers
                    .map((h) => `<th>${h}</th>`)
                    .join('')}</tr></thead>`;
                const tbody = `<tbody>${bodyRows
                    .map(
                        (row) =>
                            `<tr>${headers
                                .map((_, k) => `<td>${row[k] ?? ''}</td>`)
                                .join('')}</tr>`
                    )
                    .join('')}</tbody>`;
                const placeholder = `__TABLE_PLACEHOLDER_${tableBlocks.length}__`;
                tableBlocks.push({ placeholder, html: `<table>${thead}${tbody}</table>` });
                out.push(placeholder);
                i = j - 1;
            } else {
                out.push(line);
            }
        }
        return out.join('\n');
    })();

    // AGGRESSIVE PRE-PROCESSING: Ensure block elements are on their own lines
    // This fixes issues where AI output lacks newlines (e.g., "Text### Header" or "Text- List")
    // NOTE: never split on "graph"/"flowchart"/etc. keywords — those words
    // appear in normal prose ("Below is a flowchart illustrating…", "graph TD
    // creates a top-down flowchart") and the old splitters broke sentences
    // mid-paragraph. Unfenced mermaid is only recognized line-anchored below.
    let processedMarkdown = tableExtracted
        // Ensure headers have newlines before them
        .replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2')
        // Ensure lists have newlines before them (if not already at start of line).
        // A `*` right after another `*` is bold syntax (`**bold** text`), not a bullet.
        .replace(/([^\n])\s*((?<!\*)[\*\-\+]\s)/g, '$1\n$2')
        .replace(/([^\n])\s*(\d+\.\s)/g, '$1\n$2');

    // Check if content is markdown (has markdown syntax). Extracted tables
    // and fenced blocks count — otherwise table/code-only notes would take
    // the non-markdown early return and emit the raw placeholder.
    const hasMarkdownSyntax =
        tableBlocks.length > 0 ||
        mermaidBlocks.length > 0 ||
        codeBlocks.length > 0 ||
        /^#+\s|^\*\s|^-\s|^\d+\.\s|```|\[.*\]\(.*\)/m.test(processedMarkdown);

    // If it doesn't look like markdown, just check/convert mermaid blocks
    if (!hasMarkdownSyntax) {
        // Even if not standard markdown, we might have unfenced mermaid —
        // continue processing when any line is a Mermaid header on its own.
        const hasUnfencedMermaid = processedMarkdown
            .split('\n')
            .some((l) => isMermaidHeaderLine(l));
        if (!hasUnfencedMermaid) {
            return convertMermaidCodeToDiv(processedMarkdown);
        }
    }

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
            // This handles cases where AI generates mermaid code without '```mermaid' fences.
            const isMermaid = isMermaidHeaderLine(firstLine);

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

    // Helper to identify mermaid start (see isMermaidHeaderLine)
    const isMermaidStart = (line: string): boolean => isMermaidHeaderLine(line);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';

        // Check if this line is a mermaid or code-block placeholder
        if (
            (line.startsWith('__MERMAID_PLACEHOLDER_') || line.startsWith('__CODE_BLOCK_PLACEHOLDER_')) &&
            line.endsWith('__')
        ) {
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

        // GFM table placeholder (extracted up-front before pre-processing).
        if (line.startsWith('__TABLE_PLACEHOLDER_') && line.endsWith('__')) {
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

    // Restore extracted tables BEFORE inline formatting so **bold**/links and
    // inline code inside table cells are still converted.
    // NOTE: all placeholder restores use a function replacement — a plain
    // string replacement would interpret `$&`/`$1` inside the content as
    // special patterns and corrupt it (code blocks often contain `$`).
    tableBlocks.forEach(({ placeholder, html: tableHtml }) => {
        html = html.replace(placeholder, () => tableHtml);
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
        html = html.replace(placeholder, () => content);
    });

    // Replace mermaid placeholders with <div class="mermaid">...</div>
    mermaidBlocks.forEach(({ code, placeholder }) => {
        html = html.replace(placeholder, () => `<div class="mermaid">\n${code}\n</div>`);
    });

    // Restore fenced code blocks AFTER inline formatting so **, `, * inside
    // code (e.g. Python **kwargs, x ** 2) are never converted to HTML tags.
    codeBlocks.forEach(({ html: codeHtml, placeholder }) => {
        html = html.replace(placeholder, () => codeHtml);
    });

    return html;
}
