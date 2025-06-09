import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css'; // New clean white theme
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ExcalidrawViewer } from '@/components/ExcalidrawViewer';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'; // Import the API type

// Updated interfaces based on API response
interface RichText {
  id: string;
  type: string;
  content: string;
}

interface QuestionOption {
  id: string;
  question_id: string;
  text: RichText;
  media_id: string | null;
  option_order: number | null;
  // other fields if necessary
}

interface AddedQuestion {
  id: string;
  text: RichText;
  question_type: string; // e.g., "LONG_ANSWER", "MCQM", "MCQS"
  options: QuestionOption[];
  // other fields from added_question object if needed
}

interface Slide {
  id: string;
  title: string; // Can be HTML string
  source_id: string | null; // For Excalidraw, etc.
  source: string; // e.g., "excalidraw", "question"
  slide_order: number;
  added_question: AddedQuestion | null;
  // other slide fields if necessary
}

interface Presentation {
  id: string;
  title: string;
  added_slides: Slide[];
  // other presentation fields if necessary
}

const API_BASE_URL = 'https://backend-stage.vacademy.io'; // Using the domain from your curl

export const PublicPresentationViewerPage: React.FC = () => {
  const { presentationId } = useParams<{ presentationId: string }>();
  const revealRef = useRef<Reveal.Api | null>(null);
  const revealElementRef = useRef<HTMLDivElement>(null);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [sortedSlides, setSortedSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excalidrawApis, setExcalidrawApis] = useState<Record<string, ExcalidrawImperativeAPI | null>>({}); // Store Excalidraw APIs

  useEffect(() => {
    const fetchPresentation = async () => {
      if (!presentationId) {
        setError('Presentation ID is missing.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/community-service/presentation/get-presentation?presentationId=${presentationId}`);
        // Removed Authorization header for public access assumption
        
        if (!response.ok) {
          let errorBody = 'Unknown error';
          try {
            errorBody = await response.text();
          } catch {}
          throw new Error(`Failed to fetch presentation: ${response.status} ${response.statusText}. Body: ${errorBody}`);
        }
        const data: Presentation = await response.json();
        setPresentation(data);
        if (data.added_slides) {
          const slides = [...data.added_slides].sort((a, b) => a.slide_order - b.slide_order);
          setSortedSlides(slides);
        }
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred while fetching presentation data.');
      } finally {
        setLoading(false);
      }
    };

    fetchPresentation();
  }, [presentationId]);

  useEffect(() => {
    if (sortedSlides.length > 0 && revealElementRef.current && !revealRef.current) {
      const deck = new Reveal(revealElementRef.current, {
        embedded: true,
        keyboard: true,
        overview: true,
        loop: false,
        controls: true,
        progress: true,
        history: false, 
        slideNumber: true,
        plugins: [],
      });

      const handleSlideChange = (event: any) => {
        // event.currentSlide is the DOM element of the slide
        const currentSlideElement = event.currentSlide as HTMLElement | undefined;
        const slideId = currentSlideElement?.dataset?.slideId;

        if (slideId && excalidrawApis[slideId]) {
          const api = excalidrawApis[slideId];
          if (api && typeof api.refresh === 'function') {
            console.log(`[Reveal Event] Refreshing Excalidraw for slide ID: ${slideId}`);
            api.refresh();
            // Optional: if refresh alone isn't enough, re-trigger scrollToContent
            // This might be needed if the content dimensions are not immediately available after refresh
            setTimeout(() => {
              if (typeof api.getSceneElements === 'function' && typeof api.scrollToContent === 'function') {
                const sceneElements = api.getSceneElements();
                if (sceneElements && sceneElements.length > 0) {
                   api.scrollToContent(sceneElements, { fitToContent: true, animate: false, duration: 0 });
                   console.log(`[Reveal Event] scrollToContent re-triggered for slide ID: ${slideId}`);
                }
              }
            }, 50); // Small delay to allow Excalidraw to process refresh
          }
        }
      };

      deck.initialize().then(() => {
        revealRef.current = deck;
        deck.sync();
        deck.layout();
        deck.on('slidechanged', handleSlideChange); // Add event listener
      });

      return () => {
        if (revealRef.current) {
          deck.off('slidechanged', handleSlideChange); // Remove event listener
          try {
            if (typeof (revealRef.current as any).destroy === 'function') {
              (revealRef.current as any).destroy();
            }
          } catch (e) {
            console.error("Error destroying Reveal instance:", e);
          }
          revealRef.current = null;
        }
      };
    }
  }, [sortedSlides, excalidrawApis]); // Add excalidrawApis to dependencies


  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-50"><LoadingSpinner text="Loading Presentation..." /></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen bg-gray-50 text-red-600 p-6 text-center"><p className="text-lg">Error: {error}</p></div>;
  }

  if (!presentation || sortedSlides.length === 0) {
    return <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-700"><p className="text-lg">No presentation data or slides found.</p></div>;
  }
  
  const createMarkup = (htmlContent: string | undefined | null) => {
    return { __html: htmlContent || '' };
  };

  return (
    <div className="reveal-container w-screen h-screen bg-gray-100">
      <div ref={revealElementRef} className="reveal w-full h-full">
        <div className="slides">
          <section className="text-center">
            <h1 className="text-4xl font-semibold mb-4" dangerouslySetInnerHTML={createMarkup(presentation.title)} />
            <p className="text-gray-600">Number of slides: {sortedSlides.length}</p>
            {presentationId && <p className="text-sm text-gray-500 mt-2">ID: {presentationId}</p>}
          </section>

          {sortedSlides.map((slide) => (
            <section key={slide.id} data-slide-id={slide.id} data-slide-order={slide.slide_order} className="text-left">
              {slide.title && slide.source.toLowerCase() !== 'question' && 
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-gray-100 bg-opacity-80 rounded text-gray-700 z-10 shadow-sm">
                  <h2 className="text-xs font-medium" dangerouslySetInnerHTML={createMarkup(slide.title)} />
                </div>
              }

              {!slide.title && slide.source.toLowerCase() !== 'question' && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-gray-100 bg-opacity-80 rounded text-gray-700 z-10 shadow-sm">
                  <h2 className="text-xs font-medium">Slide {slide.slide_order + 1}</h2>
                </div>
              )}

              {slide.source.toLowerCase() === 'excalidraw' && slide.source_id && (
                <div className="r-stretch flex items-center justify-center">
                  <ExcalidrawViewer 
                    fileId={slide.source_id} 
                    slideTitle={slide.title} 
                    onApiReady={(api) => { // Pass the callback
                      setExcalidrawApis(prev => ({ ...prev, [slide.id]: api }));
                    }}
                  />
                </div>
              )}

              {slide.source.toLowerCase() === 'question' && slide.added_question && (
                <div className="p-6 h-full flex flex-col justify-center">
                  <h3 className="text-2xl font-semibold mb-3" dangerouslySetInnerHTML={createMarkup(slide.added_question.text?.content)} />
                  {slide.added_question.options && slide.added_question.options.length > 0 && (
                    <ul className="list-none pl-0 space-y-2 text-lg mb-4">
                      {slide.added_question.options.map(option => (
                        <li key={option.id} className="p-2 border border-gray-300 rounded bg-gray-50 text-gray-800" dangerouslySetInnerHTML={createMarkup(option.text?.content)} />
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-gray-500 mt-auto">Question Type: {slide.added_question.question_type}</p>
                </div>
              )}
              
              {slide.source.toLowerCase() !== 'excalidraw' && slide.source.toLowerCase() !== 'question' && (
                 <div className="p-6 h-full flex flex-col justify-center items-center">
                    <p className="text-gray-700 mb-2">Unsupported or generic slide type: <span className="font-semibold">{slide.source}</span></p>
                    <details className="w-full max-w-md bg-gray-50 p-2 border rounded">
                        <summary className="cursor-pointer text-sm text-gray-600">View slide data</summary>
                        <pre className="text-xs text-left mt-2 p-2 bg-white border rounded overflow-auto max-h-60"><code data-trim data-noescape>
                          {JSON.stringify(slide, null, 2)}
                        </code></pre>
                    </details>
                 </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}; 