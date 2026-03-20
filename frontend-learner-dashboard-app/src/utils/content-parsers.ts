/**
 * Utility functions for processing document content
 * Supports Mermaid diagram rendering
 */

/**
 * Detects if a code block contains Mermaid diagram syntax
 */
const isMermaidDiagram = (codeText: string): boolean => {
  const trimmedCode = codeText.trim().toLowerCase();
  return (
    trimmedCode.includes('graph') ||
    trimmedCode.includes('flowchart') ||
    trimmedCode.includes('sequencediagram') ||
    trimmedCode.includes('classdiagram') ||
    trimmedCode.includes('gantt') ||
    trimmedCode.includes('pie') ||
    trimmedCode.includes('erdiagram') ||
    trimmedCode.includes('journey') ||
    trimmedCode.includes('gitgraph') ||
    trimmedCode.includes('mindmap') ||
    trimmedCode.includes('timeline') ||
    trimmedCode.includes('c4context') ||
    trimmedCode.includes('quadrantchart')
  );
};

/**
 * Process document content to render Mermaid diagrams
 * Uses mermaid.js library for client-side rendering
 * 
 * @param content - HTML content string
 * @returns Processed HTML with Mermaid diagrams rendered
 */
export const processDocumentContent = (content: string): string => {
  if (!content) return '';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;

  const codeBlocks = tempDiv.querySelectorAll('pre code, pre');

  codeBlocks.forEach((block) => {
    const codeText = block.textContent || '';
    
    // Detect mermaid diagrams
    if (isMermaidDiagram(codeText)) {
      // Create mermaid div for client-side rendering
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = codeText.trim();
      mermaidDiv.setAttribute('data-mermaid', 'true');
      
      // Replace code block with mermaid div
      const parent = block.parentElement;
      if (parent && parent.tagName === 'PRE') {
        parent.replaceWith(mermaidDiv);
      } else {
        block.replaceWith(mermaidDiv);
      }
    }
  });

  return tempDiv.innerHTML;
};

// Global flag to track if mermaid is initialized
let mermaidInitialized = false;

/**
 * Initialize Mermaid rendering for all mermaid diagrams in the document
 * Uses mermaid.run() to automatically render all .mermaid elements
 * @param container - Optional container element to scope the search
 */
export const initializeMermaid = async (container?: HTMLElement | null): Promise<void> => {
  try {
    // Dynamically import mermaid to avoid SSR issues
    const mermaidModule = await import('mermaid');
    const mermaid = mermaidModule.default;
    
    // Initialize mermaid only once
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false, // We'll manually trigger rendering
        theme: 'default',
        securityLevel: 'loose',
        suppressErrorRendering: true,
        fontFamily: 'inherit',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
      });
      mermaidInitialized = true;
    }

    // Find mermaid elements in the container or document
    const searchRoot = container || document;
    const mermaidElements = searchRoot.querySelectorAll('.mermaid[data-mermaid="true"]:not([data-processed="true"])');
    
    if (mermaidElements.length > 0) {
      // Mark elements as being processed to avoid double processing
      mermaidElements.forEach((el) => {
        el.setAttribute('data-processing', 'true');
      });

      // Use mermaid.run() to render all mermaid diagrams
      // This is the recommended way in mermaid v11
      await mermaid.run({
        nodes: Array.from(mermaidElements),
      });

      // Mark as processed after successful rendering
      mermaidElements.forEach((el) => {
        el.removeAttribute('data-processing');
        el.setAttribute('data-processed', 'true');
      });
    }
  } catch (error) {
    console.error('Error initializing Mermaid:', error);
    // Mark elements as processed even on error to prevent infinite retries
    if (container) {
      const errorElements = container.querySelectorAll('.mermaid[data-processing="true"]');
      errorElements.forEach((el) => {
        el.removeAttribute('data-processing');
        el.setAttribute('data-processed', 'true');
        (el as HTMLElement).style.display = 'none';
      });
    }
  }
};

