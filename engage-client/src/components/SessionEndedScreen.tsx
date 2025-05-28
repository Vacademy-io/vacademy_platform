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
    <div className="flex flex-col items-center justify-center text-center p-6 pt-14"> {/* pt-14 for header */}
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <div className="mx-auto mb-4">
            <CheckCircle2 size={60} className="text-green-500" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-slate-700">
            Session Ended
          </CardTitle>
          {sessionTitle && (
            <CardDescription className="text-lg text-slate-500 pt-1">
              {sessionTitle}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-base text-slate-600">{message}</p>
          {/* Optionally, display results summary here if available */}
          <Button onClick={() => navigate('/')} className="w-full sm:w-auto" variant="outline">
            <LogOut className="mr-2 size-4" /> Back to Join Page
          </Button>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-slate-400 mx-auto">
                You can now safely close this window.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
};