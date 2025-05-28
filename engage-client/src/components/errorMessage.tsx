// src/components/ErrorMessage.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  message: string | null;
  title?: string;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = "An Error Occurred",
  className
}) => {
  if (!message) return null;

  // Fallback rendering (original had Card components here)
  return (
    <div className={cn("border border-red-500 bg-red-50 p-4 rounded-md text-red-700", className)}>
      <div className="flex items-center space-x-2 mb-1">
        <AlertTriangle className="size-5 text-red-500" />
        <h4 className="text-lg font-semibold text-red-700">{title}</h4>
      </div>
      <div className="text-sm">
        {message}
      </div>
    </div>
  );
};