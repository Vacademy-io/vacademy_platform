// src/components/SessionController.tsx
import React from 'react';
import { type UserSession } from '@/types';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './errorMessage';
import { WaitingScreen } from './WaitingScreen';
import { SlideRenderer } from './SlideRenderer';
import { SessionEndedScreen } from './SessionEndedScreen';
import { SessionHeader } from './SessionHeader';

interface SessionControllerProps {
  sessionState: UserSession;
}

export const SessionController: React.FC<SessionControllerProps> = ({ sessionState }) => {
  if (sessionState.sseStatus === 'connecting' && !sessionState.sessionData?.session_status) {
    return <LoadingSpinner fullScreen text="Initializing session..." />;
  }

  if (sessionState.error && sessionState.sseStatus === 'error') {
     // If critical error, show full screen, otherwise header might still be useful
    return (
        <>
         {!sessionState.sessionData && <SessionHeader sessionState={sessionState} />}
         <div className="pt-14 flex items-center justify-center min-h-screen">
            <ErrorMessage title="Session Error" message={sessionState.error} className="max-w-lg" />
         </div>
        </>
    );
  }
  
  if (!sessionState.sessionData) {
     return <LoadingSpinner fullScreen text="Loading session data..." />;
  }

  // Render header for all active/waiting/ended states
  const MainContent = () => {
    switch (sessionState.sessionData!.session_status) {
      case 'INIT':
        return <WaitingScreen sessionTitle={sessionState.sessionData!.slides.title} />;
      
      case 'LIVE':
      case 'STARTED':
      case 'PAUSED': // Paused might need a specific screen, but for now shows current slide
        if (sessionState.currentSlide) {
          return <SlideRenderer currentSlide={sessionState.currentSlide} sessionState={sessionState} />;
        }
        return <LoadingSpinner text="Loading current slide..." className="pt-14" />; // pt-14 for header
        
      case 'ENDED':
      case 'CANCELLED':
        return <SessionEndedScreen sessionTitle={sessionState.sessionData!.slides.title} />;

      default:
        return (
          <div className="pt-14"> {/* pt-14 for header */}
            <ErrorMessage title="Unknown Session State" message={`The session is in an unrecognized state: ${sessionState.sessionData!.session_status}.`} />
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100">
        <SessionHeader sessionState={sessionState} />
        <main className="flex-grow pt-14"> {/* pt-14 to offset fixed header */}
            {sessionState.sseStatus === 'disconnected' && sessionState.error && (
                 <div className="p-2 fixed top-14 left-0 right-0 z-50">
                    <ErrorMessage message={sessionState.error} title="Connection Issue" />
                 </div>
            )}
            <MainContent />
        </main>
    </div>
  );
};