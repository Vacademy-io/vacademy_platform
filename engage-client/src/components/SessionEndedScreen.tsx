// src/components/SessionEndedScreen.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface SessionEndedScreenProps {
  sessionTitle?: string;
  message?: string;
}

export const SessionEndedScreen: React.FC<SessionEndedScreenProps> = ({
  sessionTitle,
  message = "Thank you for participating!"
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center text-center p-6 pt-16 min-h-screen"> {/* pt-16 for header */}
      <Card className="w-full max-w-lg glassmorphism-container relative overflow-hidden">
        {/* Green accent gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 to-emerald-900/15 rounded-2xl pointer-events-none" />
        
        <CardHeader className="relative z-10">
          <div className="mx-auto mb-4">
            <div className="flex items-center justify-center w-20 h-20 bg-green-500/20 border border-green-400/30 rounded-full backdrop-blur-sm">
              <CheckCircle2 size={40} className="text-green-400" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-white">
            Session Ended
          </CardTitle>
          {sessionTitle && (
            <CardDescription className="text-lg text-white/70 pt-1">
              {sessionTitle}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6 relative z-10">
          <p className="text-base text-white/80">{message}</p>
          {/* Optionally, display results summary here if available */}
          <Button 
            onClick={() => navigate('/')} 
            className="w-full sm:w-auto h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 shadow-lg px-3 lg:px-4"
          >
            <LogOut className="mr-2 size-4" /> Back to Join Page
          </Button>
        </CardContent>
        <CardFooter className="relative z-10">
          <p className="text-xs text-white/60 mx-auto">
            You can now safely close this window.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};