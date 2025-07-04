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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Floating background orbs */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
        <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
        
        {sessionState.sessionData && <SessionHeader sessionState={sessionState} />}
        <div className="pt-16 flex items-center justify-center min-h-screen relative z-10 p-4">
          <ErrorMessage title="Session Error" message={sessionState.error} className="max-w-lg" />
        </div>
      </div>
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
        return <LoadingSpinner text="Loading current slide..." className="pt-16" />; // pt-16 for header
        
      case 'ENDED':
      case 'CANCELLED':
        return <SessionEndedScreen sessionTitle={sessionState.sessionData!.slides.title} />;

      default:
        return (
          <div className="pt-16 flex items-center justify-center min-h-screen relative z-10 p-4"> {/* pt-16 for header */}
            <ErrorMessage title="Unknown Session State" message={`The session is in an unrecognized state: ${sessionState.sessionData!.session_status}.`} />
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Floating background orbs */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
      <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
      
      <SessionHeader sessionState={sessionState} />
      <main className="flex-grow pt-16 relative z-10"> {/* pt-16 to offset fixed header */}
        {sessionState.sseStatus === 'disconnected' && sessionState.error && (
          <div className="p-2 fixed top-16 left-0 right-0 z-50">
            <div className="max-w-4xl mx-auto">
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-4 py-2 backdrop-blur-sm">
                <p className="text-red-300 text-sm font-medium text-center">{sessionState.error}</p>
              </div>
            </div>
          </div>
        )}
        <MainContent />
      </main>
    </div>
  );
};