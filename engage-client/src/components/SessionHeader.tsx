// src/components/SessionHeader.tsx
import React from 'react';
import { type UserSession } from '@/types';
import { Wifi, WifiOff, Loader2, ShieldCheck, Tv2 } from 'lucide-react';

interface SessionHeaderProps {
  sessionState: UserSession;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({ sessionState }) => {
  const SseIndicator = () => {
    if (sessionState.sseStatus === 'connected') {
      return <span title="Live connection active"><Wifi size={16} className="text-green-500" /></span>;
    }
    if (sessionState.sseStatus === 'connecting') {
      return <span title="Connecting..."><Loader2 size={16} className="animate-spin text-yellow-500" /></span>;
    }
    return <span title="Connection lost"><WifiOff size={16} className="text-red-500" /></span>;
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-between border-b bg-slate-50 px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Tv2 size={24} className="text-primary" />
        <span className="text-lg font-semibold text-slate-700 truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={sessionState.sessionData?.slides.title}>
          {sessionState.sessionData?.slides.title || 'Live Session'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-slate-600">
            <SseIndicator />
            <span className="hidden sm:inline">
                {sessionState.sseStatus === 'connected' ? 'Connected' : sessionState.sseStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
            </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500" title="Session ID">
            <ShieldCheck size={14} className="text-green-600" />
            <span className="font-mono text-xs tracking-wider">{sessionState.inviteCode}</span>
        </div>
        <span className="font-medium text-slate-800 hidden sm:inline">Hi, {sessionState.username}!</span>
      </div>
    </header>
  );
};