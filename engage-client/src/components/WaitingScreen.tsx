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
    <div className="flex flex-col items-center justify-center text-center p-6 pt-14"> {/* pt-14 for header */}
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <div className="mx-auto mb-4">
            <Users size={48} className="text-primary opacity-80" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-slate-700">
            {sessionTitle || "Waiting for Session to Start"}
          </CardTitle>
          <CardDescription className="text-base text-slate-500 pt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Loader2 className="size-12 animate-spin text-primary my-6" />
          <p className="text-sm text-slate-400">
            You're all set! The content will appear here once the session begins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};