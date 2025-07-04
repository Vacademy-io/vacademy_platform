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
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Floating background orbs */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
        <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10">
          <LoadingSpinner text="Loading Presentation..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-6">
        {/* Floating background orbs */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
        <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10 glassmorphism-card p-6 max-w-lg">
          <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 to-red-800/15 rounded-xl pointer-events-none" />
          <div className="relative z-10 text-center">
            <p className="text-lg text-white/80">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!presentation || sortedSlides.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Floating background orbs */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
        <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10 glassmorphism-card p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 to-orange-800/15 rounded-xl pointer-events-none" />
          <div className="relative z-10 text-center">
            <p className="text-lg text-white/80">No presentation data or slides found.</p>
          </div>
        </div>
      </div>
    );
  }
  
  const createMarkup = (htmlContent: string | undefined | null) => {
    return { __html: htmlContent || '' };
  };

  return (
    <div className="reveal-container w-screen h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Floating background orbs */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
      <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
      
      <div ref={revealElementRef} className="reveal w-full h-full relative z-10">
        <div className="slides">
          <section className="text-center">
            <h1 className="text-3xl font-semibold mb-4 text-white" dangerouslySetInnerHTML={createMarkup(presentation.title)} />
            <p className="text-white/70">Number of slides: {sortedSlides.length}</p>
            {presentationId && <p className="text-sm text-white/60 mt-2">ID: {presentationId}</p>}
          </section>

          {sortedSlides.map((slide) => (
            <section key={slide.id} data-slide-id={slide.id} data-slide-order={slide.slide_order} className="text-left">
              {slide.title && slide.source.toLowerCase() !== 'question' && 
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white z-10 shadow-lg">
                  <h5 className="text-xs font-medium" dangerouslySetInnerHTML={createMarkup(slide.title)} />
                </div>
              }

              {!slide.title && slide.source.toLowerCase() !== 'question' && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white z-10 shadow-lg">
                  <div className="text-base font-medium">Slide {slide.slide_order + 1}</div>
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
                <div className="p-6 h-full flex flex-col">
                  <div className="flex-grow overflow-y-auto pr-2">
                                         <div className="text-lg font-semibold mb-6 text-white" dangerouslySetInnerHTML={createMarkup(slide.added_question.text?.content)} />
                    {slide.added_question.options && slide.added_question.options.length > 0 && (
                      <ul className="list-none pl-0 space-y-3 text-base mb-6">
                        {slide.added_question.options.map(option => (
                          <li key={option.id} className="p-3 bg-white/10 border border-white/20 rounded-xl text-white backdrop-blur-sm hover:bg-white/15 transition-all duration-300 ease-out" dangerouslySetInnerHTML={createMarkup(option.text?.content)} />
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="text-xs text-white/60 pt-3 flex-shrink-0 border-t border-white/20">Question Type: {slide.added_question.question_type}</p>
                </div>
              )}
              
              {slide.source.toLowerCase() !== 'excalidraw' && slide.source.toLowerCase() !== 'question' && (
                 <div className="p-6 h-full flex flex-col justify-center items-center">
                    <p className="text-white/80 mb-4">Unsupported or generic slide type: <span className="font-semibold accent-text">{slide.source}</span></p>
                    <details className="w-full max-w-md glassmorphism-card p-3">
                        <summary className="cursor-pointer text-sm text-white/70 hover:text-white transition-colors duration-200">View slide data</summary>
                        <pre className="text-xs text-left mt-3 p-3 bg-black/20 border border-white/10 rounded-lg overflow-auto max-h-60 text-white/90 backdrop-blur-sm"><code data-trim data-noescape>
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