// src/components/LoadingSpinner.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  text?: string;
  size?: number;
  fullScreen?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = "Loading...",
  size = 24,
  fullScreen = false,
  className = ""
}) => {
  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-4">
        {/* Floating background orbs */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
        <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10 flex flex-col items-center glassmorphism-card p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 to-orange-800/15 rounded-xl pointer-events-none" />
          <Loader2 size={size} className="animate-spin text-orange-400 relative z-10" />
          <p className="mt-4 text-white/80 font-medium relative z-10">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 size={size} className="animate-spin text-orange-400" />
      {text && <p className="mt-2 text-white/80 text-sm">{text}</p>}
    </div>
  );
};