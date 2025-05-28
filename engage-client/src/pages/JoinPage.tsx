// src/pages/JoinPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JoinSessionForm } from '@/components/JoinSessionForm';
import { getSessionDetails } from '@/services/engageApi';
import { toast } from "sonner";
import { Tv2 } from 'lucide-react';


export const JoinPage: React.FC = () => {
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinSession = async (inviteCode: string, username: string) => {
    setIsJoining(true);
    try {
      const sessionData = await getSessionDetails(inviteCode, { username, status: 'INIT' });
      toast.success("Successfully joined!", {
        description: `Welcome, ${username}! Waiting for session to start.`,
      });
      navigate(`/engage/${inviteCode}`, { state: { username, initialSessionData: sessionData } });
    } catch (error: any) {
      console.error("Join error:", error);
      toast.error("Join Failed", {
        description: error.message || "Could not join the session. Please check the code and try again.",
      });
      throw error; // rethrow to be caught by form
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-stone-200 p-4">
       <div className="mb-8 flex items-center text-slate-700">
         <Tv2 size={40} className="text-primary mr-3" />
         <h1 className="text-4xl font-bold tracking-tight">Engage Platform</h1>
       </div>
      <JoinSessionForm onJoin={handleJoinSession} isJoining={isJoining} />
       <footer className="mt-12 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Your Company Name. All rights reserved.</p>
          <p>Ready to engage and learn!</p>
        </footer>
    </div>
  );
};