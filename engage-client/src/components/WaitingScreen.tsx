// src/components/WaitingScreen.tsx
import React from 'react';
import { Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WaitingScreenProps {
  sessionTitle?: string;
  message?: string;
}

export const WaitingScreen: React.FC<WaitingScreenProps> = ({
  sessionTitle,
  message = "The session will begin shortly. Please wait for the host to start."
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-6 pt-16 min-h-screen"> {/* pt-16 for header */}
      <Card className="w-full max-w-lg glassmorphism-container relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-900/20 to-orange-800/15 rounded-2xl pointer-events-none" />
        
        <CardHeader className="relative z-10">
          <div className="mx-auto mb-4">
            <div className="flex items-center justify-center w-16 h-16 bg-orange-400/20 border border-orange-300/30 rounded-full backdrop-blur-sm">
              <Users size={32} className="text-orange-400" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-white">
            {sessionTitle || "Waiting for Session to Start"}
          </CardTitle>
          <CardDescription className="text-base text-white/70 pt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center relative z-10">
          <div className="my-6 flex items-center justify-center w-16 h-16 bg-yellow-400/20 border border-yellow-300/30 rounded-full backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-yellow-400" />
          </div>
          <p className="text-sm text-white/60">
            You're all set! The content will appear here once the session begins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};