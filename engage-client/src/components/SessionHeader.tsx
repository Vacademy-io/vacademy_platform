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
      return (
        <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 rounded-lg px-2 py-1 backdrop-blur-sm">
          <Wifi size={14} className="text-green-400" />
          <span className="text-xs font-medium text-green-300 hidden lg:inline">Connected</span>
        </div>
      );
    }
    if (sessionState.sseStatus === 'connecting') {
      return (
        <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400/30 rounded-lg px-2 py-1 backdrop-blur-sm">
          <Loader2 size={14} className="animate-spin text-yellow-400" />
          <span className="text-xs font-medium text-yellow-300 hidden lg:inline">Connecting</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 rounded-lg px-2 py-1 backdrop-blur-sm">
        <WifiOff size={14} className="text-red-400" />
        <span className="text-xs font-medium text-red-300 hidden lg:inline">Disconnected</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[1001] flex h-16 items-center justify-between bg-black/30 backdrop-blur-xl border-b border-white/10 px-4 text-white shadow-2xl transition-all duration-300 ease-in-out lg:px-6">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      
      <div className="flex items-center gap-3 relative z-10">
        <Tv2 size={24} className="text-orange-400" />
        <span className="text-lg font-semibold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={sessionState.sessionData?.slides.title}>
          {sessionState.sessionData?.slides.title || 'Live Session'}
        </span>
      </div>
      
      <div className="flex items-center gap-3 text-sm relative z-10">
        <SseIndicator />
        
        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-2 py-1" title="Session ID">
          <ShieldCheck size={14} className="text-green-400" />
          <span className="accent-text text-xs">{sessionState.inviteCode}</span>
        </div>
        
        <span className="text-white/60 text-xs font-medium hidden sm:block">
          Hi, {sessionState.username}!
        </span>
      </div>
    </div>
  );
};