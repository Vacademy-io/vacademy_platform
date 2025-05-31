// src/components/SlideRenderer.tsx
import React from 'react';
import { type Slide, SlideSourceType, type UserSession } from '../types';
import { ExcalidrawViewer } from './ExcalidrawViewer';
import { QuizInteraction } from './QuizInteraction';
// import { FeedbackInteraction } from './FeedbackInteraction'; // If distinct
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileQuestion } from 'lucide-react';

interface SlideRendererProps {
  currentSlide: Slide;
  sessionState: UserSession; // Pass the whole session state for context
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({ currentSlide, sessionState }) => {
  console.log('[SlideRenderer] Rendering slide:', currentSlide.id, 'Source:', currentSlide.source);
  if (currentSlide.source === SlideSourceType.Question) {
    console.log('[SlideRenderer] Question slide data (added_question):', JSON.parse(JSON.stringify(currentSlide.added_question)));
  }

  if (!sessionState.sessionData) {
    // Should not happen if a slide is being rendered, but good for safety
    return <div className="p-4 text-center text-red-500">Session data unavailable.</div>;
  }
  
  const slideContainerStyle = "w-full h-[calc(100vh-3.5rem-1rem)] sm:h-[calc(100vh-3.5rem-2rem)] flex items-center justify-center p-2 sm:p-4"; // 3.5rem header

  switch (currentSlide.source) {
    case SlideSourceType.Excalidraw:
      return (
        <div className={slideContainerStyle + " bg-slate-200"}>
          <div className="w-full h-full max-w-6xl">
            <ExcalidrawViewer
              key={currentSlide.id}
              fileId={currentSlide.source_id}
              slideTitle={currentSlide.title}
            />
          </div>
        </div>
      );

    case SlideSourceType.Question:
      if (currentSlide.added_question) {
        // Assuming Feedback might also use 'question' source and have added_question
        // Differentiate by slide title, or a specific field if backend provides it.
        // For now, using QuizInteraction for any 'question' type.
        // if (currentSlide.title.toLowerCase().includes("feedback")) {
        //   return <FeedbackInteraction questionData={currentSlide.added_question} ... />;
        // }
        return (
            <div className={slideContainerStyle + " bg-slate-100 overflow-y-auto"}>
                 <QuizInteraction
                    key={currentSlide.id}
                    questionData={currentSlide.added_question}
                    sessionId={sessionState.sessionId}
                    slideId={currentSlide.id}
                    username={sessionState.username}
                    studentAttemptsAllowed={sessionState.sessionData.student_attempts || 1}
                />
            </div>
        );
      } else {
        // This block is executed if source is "question" but added_question is missing
        console.error("[SlideRenderer] Error: Slide source is 'question' but added_question is missing.", currentSlide);
        return (
            <div className={slideContainerStyle}>
                <Card className="max-w-md text-center">
                    <CardHeader>
                        <FileQuestion className="mx-auto size-12 text-amber-500 mb-2"/>
                        <CardTitle>Question Data Missing</CardTitle> {/* More specific title */}
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600">This slide is a question, but its specific data (e.g., options, text) is not available.</p>
                        <p className="text-sm text-muted-foreground mt-1">Slide ID: {currentSlide.id}, Title: {currentSlide.title}</p>
                    </CardContent>
                </Card>
            </div>
        );
      }

    default:
      return (
        <div className={slideContainerStyle}>
            <Card className="max-w-md text-center">
                <CardHeader>
                    <CardTitle>Unsupported Slide</CardTitle>
                </CardHeader>
                <CardContent>
                     <p className="text-slate-600">This slide type ({currentSlide.source}) is not yet supported for display.</p>
                     <p className="text-sm text-muted-foreground mt-1">Slide: {currentSlide.title}</p>
                </CardContent>
            </Card>
        </div>
      );
  }
};