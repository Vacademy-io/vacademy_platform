// src/components/ErrorMessage.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  title?: string;
  message: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = "Error",
  message,
  className = ""
}) => {
  return (
    <div className={cn("glassmorphism-card relative overflow-hidden p-6", className)}>
      {/* Red accent gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 to-red-800/15 rounded-xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center justify-center w-12 h-12 bg-red-500/20 border border-red-400/30 rounded-full mb-4 backdrop-blur-sm">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-white/80 leading-relaxed">{message}</p>
      </div>
    </div>
  );
};