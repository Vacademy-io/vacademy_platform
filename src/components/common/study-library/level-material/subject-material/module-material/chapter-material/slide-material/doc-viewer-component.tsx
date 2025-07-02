import { forwardRef, useImperativeHandle, useRef, useEffect, useState, useMemo, useCallback } from "react";
import { renderAsync } from "docx-preview";
import TurndownService from "turndown";
import ReactMarkdown from "react-markdown";

export interface DocViewerComponentRef {
  jumpToPage: (pageIndex: number) => void;
}

export const DocViewerComponent = forwardRef<DocViewerComponentRef, {
  docUrl: string;
  handleDocumentLoad: () => void;
  handlePageChange: (page: number) => void;
  initialPage?: number;
  isHtml?: boolean;
}>((({
  docUrl,
  handleDocumentLoad,
  handlePageChange,
  //initialPage = 0,
  isHtml = false
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalPagesRef = useRef<number>(0);
  const [markdownContent, setMarkdownContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize the docUrl to prevent unnecessary re-renders
  const stableDocUrl = useMemo(() => docUrl, [docUrl]);

  // Initialize Turndown service for HTML to Markdown conversion
  const turndownService = useMemo(() => new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full'
  }), []);

  // Track scroll position and calculate current page
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;

    // Calculate current page based on scroll position
    const pageHeight = scrollHeight / totalPagesRef.current;
    const currentPage = Math.floor(scrollTop / pageHeight) + 1;

    handlePageChange(currentPage);
  }, [handlePageChange]);

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
  }, [handleScroll]);

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
  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (isHtml) {
        try {
          // Convert HTML to Markdown using Turndown
          const markdown = turndownService.turndown(stableDocUrl);
          setMarkdownContent(markdown);
        } catch (conversionError) {
          // Fallback to plain text if conversion fails
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = stableDocUrl;
          const fallbackContent = tempDiv.textContent || stableDocUrl;
          setMarkdownContent(fallbackContent);
        }
      } else {
        // For DOCX content, fetch and render using docx-preview
        const response = await fetch(stableDocUrl);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        // Wait for container to be available for DOCX rendering
        let attempts = 0;
        while (!containerRef.current && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (containerRef.current) {
          await renderAsync(arrayBuffer, containerRef.current, undefined, {
            className: "docx-viewer",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            useBase64URL: true,
          });
        } else {
          throw new Error('Container ref not available after waiting');
        }
      }

      // Calculate total pages after rendering
      if (containerRef.current) {
        const container = containerRef.current;
        const contentHeight = container.scrollHeight;
        const viewportHeight = container.clientHeight;
        totalPagesRef.current = Math.ceil(contentHeight / viewportHeight);
      }

      handleDocumentLoad();
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [stableDocUrl, isHtml, turndownService, handleDocumentLoad]);

  // Load document when component mounts - simplified approach
  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  if (error) {
    return (
      <div className="flex h-[600px] items-center justify-center bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200 shadow-lg">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Document Load Error</h3>
          <p className="text-red-700 text-sm leading-relaxed mb-4">Unable to load the document. Please try refreshing or contact support if the issue persists.</p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-600 font-mono break-words">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl border border-blue-200 shadow-lg">
        <div className="text-center p-8">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
            <div className="absolute inset-2 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-blue-900 mb-2">Processing Document</h3>
          <p className="text-blue-700">Converting content for optimal viewing...</p>
          <div className="mt-4 w-32 h-1 bg-blue-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-[600px] max-h-[800px] overflow-auto bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
      {isHtml ? (
        <div className="p-8 lg:p-12 markdown-content">
          {markdownContent ? (
            <div className="prose prose-lg prose-gray max-w-none">
              <ReactMarkdown 
                components={{
                  // Enhanced heading styles with better typography
                  h1: ({children}) => (
                    <h1 className="text-4xl font-bold mb-8 text-gray-900 border-b-2 border-gradient-to-r from-blue-500 to-indigo-600 pb-4 leading-tight">
                      {children}
                    </h1>
                  ),
                  h2: ({children}) => (
                    <h2 className="text-3xl font-semibold mb-6 text-gray-900 mt-12 first:mt-0 leading-tight">
                      {children}
                    </h2>
                  ),
                  h3: ({children}) => (
                    <h3 className="text-2xl font-semibold mb-4 text-gray-900 mt-10 first:mt-0 leading-tight">
                      {children}
                    </h3>
                  ),
                  h4: ({children}) => (
                    <h4 className="text-xl font-semibold mb-3 text-gray-900 mt-8 first:mt-0 leading-tight">
                      {children}
                    </h4>
                  ),
                  h5: ({children}) => (
                    <h5 className="text-lg font-semibold mb-2 text-gray-900 mt-6 first:mt-0 leading-tight">
                      {children}
                    </h5>
                  ),
                  h6: ({children}) => (
                    <h6 className="text-base font-semibold mb-2 text-gray-900 mt-4 first:mt-0 leading-tight">
                      {children}
                    </h6>
                  ),
                  
                  // Enhanced paragraph styling
                  p: ({children}) => (
                    <p className="mb-6 text-gray-700 leading-relaxed text-lg">
                      {children}
                    </p>
                  ),
                  
                  // Better emphasis styling
                  strong: ({children}) => (
                    <strong className="font-semibold text-gray-900 bg-yellow-50 px-1 rounded">
                      {children}
                    </strong>
                  ),
                  em: ({children}) => (
                    <em className="italic text-gray-800 bg-blue-50 px-1 rounded">
                      {children}
                    </em>
                  ),
                  
                  // Enhanced list styling
                  ul: ({children}) => (
                    <ul className="list-none pl-0 mb-6 space-y-3">
                      {children}
                    </ul>
                  ),
                  ol: ({children}) => (
                    <ol className="list-none pl-0 mb-6 space-y-3 counter-reset-list">
                      {children}
                    </ol>
                  ),
                  li: ({children, ...props}) => {
                    const isOrdered = (props as any).ordered;
                    return (
                      <li className={`relative pl-8 text-gray-700 text-lg leading-relaxed ${
                        isOrdered ? 'counter-increment-list' : ''
                      }`}>
                        <span className={`absolute left-0 top-0 flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                          isOrdered 
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' 
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {isOrdered ? (
                            <span className="counter-content"></span>
                          ) : (
                            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                          )}
                        </span>
                        {children}
                      </li>
                    );
                  },
                  
                  // Enhanced blockquote styling
                  blockquote: ({children}) => (
                    <blockquote className="relative border-l-4 border-blue-400 pl-6 py-4 my-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-r-lg shadow-sm">
                      <div className="absolute top-2 left-2 text-blue-300 opacity-50">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                        </svg>
                      </div>
                      <div className="text-gray-800 font-medium italic">
                        {children}
                      </div>
                    </blockquote>
                  ),
                  
                  // Enhanced code styling
                  code: ({children, className}) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-gray-100 text-purple-700 px-2 py-1 rounded-md text-sm font-mono border border-gray-200 shadow-sm">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div className="relative my-6">
                        <div className="absolute top-0 left-0 right-0 h-8 bg-gray-800 rounded-t-lg flex items-center px-4">
                          <div className="flex space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                        </div>
                        <code className="block bg-gray-900 text-gray-100 p-6 pt-12 rounded-lg overflow-x-auto font-mono text-sm leading-relaxed shadow-lg">
                          {children}
                        </code>
                      </div>
                    );
                  },
                  pre: ({children}) => <div className="mb-6">{children}</div>,
                  
                  // Enhanced link styling
                  a: ({href, children}) => (
                    <a 
                      href={href} 
                      className="text-blue-600 hover:text-blue-700 underline decoration-blue-300 hover:decoration-blue-500 transition-colors duration-200 font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                      <svg className="inline w-3 h-3 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ),
                  
                  // Enhanced table styling
                  table: ({children}) => (
                    <div className="overflow-x-auto mb-8 rounded-lg shadow-lg border border-gray-200">
                      <table className="min-w-full bg-white">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({children}) => (
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      {children}
                    </thead>
                  ),
                  tbody: ({children}) => (
                    <tbody className="divide-y divide-gray-200">
                      {children}
                    </tbody>
                  ),
                  tr: ({children}) => (
                    <tr className="hover:bg-gray-50 transition-colors duration-150">
                      {children}
                    </tr>
                  ),
                  th: ({children}) => (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider border-b-2 border-gray-200">
                      {children}
                    </th>
                  ),
                  td: ({children}) => (
                    <td className="px-6 py-4 text-sm text-gray-700 border-b border-gray-100">
                      {children}
                    </td>
                  ),
                  
                  // Enhanced horizontal rule
                  hr: () => (
                    <hr className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                  ),
                  
                  // Enhanced image styling
                  img: ({src, alt}) => (
                    <div className="my-8 text-center">
                      <img 
                        src={src} 
                        alt={alt} 
                        className="max-w-full h-auto rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300 mx-auto" 
                      />
                      {alt && (
                        <p className="mt-3 text-sm text-gray-500 italic">{alt}</p>
                      )}
                    </div>
                  )
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-16">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Content Available</h3>
              <p className="text-gray-500">The document appears to be empty or could not be processed.</p>
            </div>
          )}
          
          <style>{`
            .markdown-content {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              line-height: 1.7;
              color: #374151;
              max-width: none;
            }
            
            .counter-reset-list {
              counter-reset: list-counter;
            }
            
            .counter-increment-list {
              counter-increment: list-counter;
            }
            
            .counter-content::before {
              content: counter(list-counter);
              font-size: 0.75rem;
              font-weight: 600;
            }
            
            /* Custom scrollbar for better UX */
            .markdown-content *::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            
            .markdown-content *::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 3px;
            }
            
            .markdown-content *::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 3px;
            }
            
            .markdown-content *::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
        </div>
      ) : (
        // For DOCX files, the content is rendered directly into the container
        <div className="docx-content">
          <style>{`
            .docx-content .docx-viewer {
              padding: 2rem;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              color: #374151;
            }
            
            .docx-content .docx-viewer h1,
            .docx-content .docx-viewer h2,
            .docx-content .docx-viewer h3,
            .docx-content .docx-viewer h4,
            .docx-content .docx-viewer h5,
            .docx-content .docx-viewer h6 {
              color: #1f2937;
              font-weight: 600;
              margin-top: 1.5rem;
              margin-bottom: 1rem;
            }
            
            .docx-content .docx-viewer p {
              margin-bottom: 1rem;
              line-height: 1.7;
            }
          `}</style>
        </div>
      )}
    </div>
  );
})); 