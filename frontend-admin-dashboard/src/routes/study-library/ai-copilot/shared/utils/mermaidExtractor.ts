/**
 * Utility functions for extracting and processing mermaid diagrams from HTML content
 */

export interface MermaidDiagramInfo {
    id: string;
    code: string;
    originalElement: string; // The original HTML element that contained the mermaid code
}

/**
 * Extract mermaid diagrams from HTML content
 * Returns both the cleaned HTML (with mermaid placeholders) and the diagram data
 */
export function extractMermaidDiagrams(htmlContent: string): {
    cleanedHtml: string;
    diagrams: MermaidDiagramInfo[];
} {
    if (!htmlContent) {
        return { cleanedHtml: '', diagrams: [] };
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    const diagrams: MermaidDiagramInfo[] = [];
    let diagramIndex = 0;

    // Find all divs with class "mermaid" (from backend HTML)
    const mermaidDivs = tempDiv.querySelectorAll('div.mermaid');
    mermaidDivs.forEach((div) => {
        const code = div.textContent?.trim() || '';
        if (code) {
            const diagramId = `mermaid-diagram-${diagramIndex++}`;
            diagrams.push({
                id: diagramId,
                code,
                originalElement: div.outerHTML,
            });

            // Replace with a placeholder that we can identify later
            const placeholder = document.createElement('div');
            placeholder.className = 'mermaid-placeholder';
            placeholder.setAttribute('data-mermaid-id', diagramId);
            placeholder.setAttribute('data-mermaid-code', encodeURIComponent(code));
            div.parentNode?.replaceChild(placeholder, div);
        }
    });

    // Also check for code blocks that contain mermaid syntax
    const codeBlocks = tempDiv.querySelectorAll('pre code, pre');
    codeBlocks.forEach((block) => {
        const codeText = block.textContent || '';
        const isMermaid =
            codeText.includes('graph') ||
            codeText.includes('flowchart') ||
            codeText.includes('sequenceDiagram') ||
            codeText.includes('classDiagram') ||
            codeText.includes('gantt') ||
            codeText.includes('pie') ||
            codeText.includes('erDiagram') ||
            codeText.includes('journey') ||
            block.classList.contains('language-mermaid') ||
            block.classList.contains('mermaid');

        if (isMermaid && codeText.trim()) {
            const diagramId = `mermaid-diagram-${diagramIndex++}`;
            // Remove "mermaid" prefix if present
            let cleanCode = codeText.trim();
            if (cleanCode.toLowerCase().startsWith('mermaid ')) {
                cleanCode = cleanCode.substring(8).trim();
            }
            diagrams.push({
                id: diagramId,
                code: cleanCode,
                originalElement: block.outerHTML,
            });

            // Replace with placeholder
            const preElement = block.tagName === 'PRE' ? block : block.closest('pre');
            if (preElement) {
                const placeholder = document.createElement('div');
                placeholder.className = 'mermaid-placeholder';
                placeholder.setAttribute('data-mermaid-id', diagramId);
                placeholder.setAttribute('data-mermaid-code', encodeURIComponent(cleanCode));
                preElement.parentNode?.replaceChild(placeholder, preElement);
            }
        }
    });

    // Check for plain text mermaid code in paragraphs/text nodes
    // Only extract if the ENTIRE content is mermaid (not mixed with other text)
    const textNodes = tempDiv.querySelectorAll('p, div, span');
    textNodes.forEach((node) => {
        const text = node.textContent || '';
        const html = node.innerHTML || '';

        // Only process if the node contains ONLY mermaid code (no other meaningful text)
        // Check if text starts with "mermaid" followed by mermaid syntax
        // Check if text starts with "mermaid" followed by mermaid syntax OR just mermaid syntax
        const lowerText = text.trim().toLowerCase();
        const hasMermaidPrefix = lowerText.startsWith('mermaid ');

        // List of mermaid diagram types
        const isMermaidType = (
            lowerText.startsWith('graph ') ||
            lowerText.startsWith('flowchart ') ||
            lowerText.startsWith('sequencediagram') ||
            lowerText.startsWith('classdiagram') ||
            lowerText.startsWith('statediagram') ||
            lowerText.startsWith('erdiagram') ||
            lowerText.startsWith('gantt') ||
            lowerText.startsWith('pie') ||
            lowerText.startsWith('journey') ||
            lowerText.startsWith('gitgraph') ||
            lowerText.startsWith('mindmap') ||
            lowerText.startsWith('requirementdiagram') ||
            lowerText.startsWith('c4context')
        );

        if (hasMermaidPrefix || isMermaidType) {

            // Check if this is ONLY mermaid code (no other HTML elements like h1, h2, etc.)
            const hasOtherElements = node.querySelectorAll('h1, h2, h3, h4, h5, h6, ul, ol, li, strong, em, a').length > 0;

            // Only extract if it's pure mermaid code without other content
            if (!hasOtherElements) {
                // Extract mermaid code (remove "mermaid" prefix)
                let mermaidCode = text.trim();
                if (hasMermaidPrefix) {
                    mermaidCode = mermaidCode.substring(8).trim();
                }

                // Only process if it looks like valid mermaid syntax (double check)
                if (mermaidCode) {
                    const diagramId = `mermaid-diagram-${diagramIndex++}`;
                    diagrams.push({
                        id: diagramId,
                        code: mermaidCode,
                        originalElement: node.outerHTML,
                    });

                    // Replace with placeholder
                    const placeholder = document.createElement('div');
                    placeholder.className = 'mermaid-placeholder';
                    placeholder.setAttribute('data-mermaid-id', diagramId);
                    placeholder.setAttribute('data-mermaid-code', encodeURIComponent(mermaidCode));
                    node.parentNode?.replaceChild(placeholder, node);
                }
            }
        }
    });

    return {
        cleanedHtml: tempDiv.innerHTML,
        diagrams,
    };
}

/**
 * Render mermaid diagrams in a container element
 * This function finds mermaid placeholders and replaces them with rendered diagrams
 */
export async function renderMermaidDiagrams(
    container: HTMLElement,
    diagrams: MermaidDiagramInfo[]
): Promise<void> {
    if (!container || diagrams.length === 0) {
        return;
    }

    const placeholders = container.querySelectorAll('.mermaid-placeholder');

    placeholders.forEach((placeholder) => {
        const diagramId = placeholder.getAttribute('data-mermaid-id');
        const encodedCode = placeholder.getAttribute('data-mermaid-code');

        if (diagramId && encodedCode) {
            const code = decodeURIComponent(encodedCode);
            const diagram = diagrams.find((d) => d.id === diagramId);

            if (diagram) {
                // Create a container for the mermaid diagram
                const mermaidContainer = document.createElement('div');
                mermaidContainer.className = 'mermaid-diagram-wrapper';
                mermaidContainer.setAttribute('data-mermaid-id', diagramId);

                // The actual rendering will be done by the MermaidDiagram React component
                // For now, we'll just mark it so React can find and render it
                placeholder.parentNode?.replaceChild(mermaidContainer, placeholder);
            }
        }
    });
}
