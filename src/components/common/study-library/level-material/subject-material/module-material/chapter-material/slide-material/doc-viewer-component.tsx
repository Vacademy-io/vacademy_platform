import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { renderAsync } from "docx-preview";

export interface DocViewerComponentRef {
  jumpToPage: (pageIndex: number) => void;
}

export const DocViewerComponent = forwardRef<DocViewerComponentRef, {
  docUrl: string;
  handleDocumentLoad: () => void;
  handlePageChange: (page: number) => void;
  initialPage?: number;
  isHtml?: boolean;
}>(({
  docUrl,
  handleDocumentLoad,
  handlePageChange,
  //initialPage = 0,
  isHtml = false
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPagesRef = useRef<number>(0);

  // Track scroll position and calculate current page
  const handleScroll = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
   // const clientHeight = container.clientHeight;

    // Calculate current page based on scroll position
    const pageHeight = scrollHeight / totalPagesRef.current;
    const currentPage = Math.floor(scrollTop / pageHeight) + 1;

    handlePageChange(currentPage);
  };

  // Add scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Expose jumpToPage function through ref
  useImperativeHandle(ref, () => ({
    jumpToPage: (pageIndex: number) => {
      if (containerRef.current) {
        const container = containerRef.current;
        const pageHeight = container.scrollHeight / totalPagesRef.current;
        container.scrollTo({
          top: (pageIndex - 1) * pageHeight,
          behavior: 'smooth'
        });
      }
    },
  }), []);

  // Render DOCX or HTML
  const loadDocument = async () => {
    if (!containerRef.current) return;
    try {
      console.log('Loading document with isHtml:', isHtml);
      console.log('Document URL/content:', docUrl);
      console.log('Content type:', typeof docUrl);
      console.log('Content length:', docUrl.length);

      if (isHtml) {
        // For HTML content, create a safe container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = docUrl;
        
        // Extract the content from the body or use the entire content if no body tag
        const bodyContent = tempDiv.querySelector('body')?.innerHTML || docUrl;
        console.log('Extracted body content:', bodyContent);
        console.log('Body content length:', bodyContent.length);
        console.log('Body content type:', typeof bodyContent);
        
        // Create a new container for the content
        const contentContainer = document.createElement('div');
        contentContainer.className = 'html-content';
        
        // Sanitize and set the content
        try {
          contentContainer.innerHTML = bodyContent;
          console.log('Content container innerHTML set successfully');
          console.log('Content container child nodes:', contentContainer.childNodes.length);
        } catch (error) {
          console.error('Error setting innerHTML:', error);
          contentContainer.textContent = bodyContent;
          console.log('Fallback to textContent successful');
        }
        
        // Clear the container and append the new content
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(contentContainer);
        console.log('HTML content rendered');
        console.log('Container child nodes after append:', containerRef.current.childNodes.length);
      } else {
        // For DOCX content, fetch and render
        console.log('Fetching DOCX content');
        const response = await fetch(docUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        console.log('Rendering DOCX content');
        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: "docx-viewer",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          useBase64URL: true,
        });
        console.log('DOCX content rendered');
      }

      // Calculate total pages after rendering
      if (containerRef.current) {
        const container = containerRef.current;
        const contentHeight = container.scrollHeight;
        const viewportHeight = container.clientHeight;
        totalPagesRef.current = Math.ceil(contentHeight / viewportHeight);
        console.log('Total pages calculated:', totalPagesRef.current);
        console.log('Content height:', contentHeight);
        console.log('Viewport height:', viewportHeight);
      }

      handleDocumentLoad();
    } catch (error) {
      console.error('Error loading document:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex h-[500px] items-center justify-center">
            <p class="text-red-500">Failed to load document: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        `;
      }
    }
  };

  // Load document on mount
  useEffect(() => {
    console.log('Component mounted, loading document');
    loadDocument();
  }, [docUrl, isHtml]);

  return (
    <div ref={containerRef} className="min-h-[500px] overflow-auto bg-white p-8">
      <style>
        {`
          .html-content {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            padding: 20px;
            max-width: 100%;
            overflow-x: auto;
          }
          .html-content table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
            max-width: 100%;
            overflow-x: auto;
          }
          .html-content td, .html-content th {
            border: 1px solid #ddd;
            padding: 8px;
            word-break: break-word;
          }
          .html-content p {
            margin: 0.5rem 0;
            word-wrap: break-word;
          }
          .html-content strong {
            font-weight: bold;
          }
          .html-content div {
            margin: 10px 0;
            word-wrap: break-word;
          }
          .html-content img {
            max-width: 100%;
            height: auto;
          }
          .html-content pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background-color: #f5f5f5;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
          }
          .html-content code {
            font-family: monospace;
            background-color: #f5f5f5;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
          }
        `}
      </style>
      <div className="flex h-[500px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    </div>
  );
}); 