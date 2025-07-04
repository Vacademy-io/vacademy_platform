// src/pages/JoinPage.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { JoinSessionForm } from '@/components/JoinSessionForm';
import { getSessionDetails } from '@/services/engageApi';
import { toast } from "sonner";
import { Tv2 } from 'lucide-react';


export const JoinPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isJoining, setIsJoining] = useState(false);

  const initialInviteCode = location.state?.inviteCode as string | undefined;

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-4">
      {/* Floating background orbs */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
      <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 flex items-center">
          <Tv2 size={40} className="text-orange-400 mr-3" />
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Engage Platform
          </h1>
        </div>
        
        <JoinSessionForm onJoin={handleJoinSession} isJoining={isJoining} initialInviteCode={initialInviteCode} />
        
        <footer className="mt-12 text-center">
          <p className="text-white/60 text-xs font-medium">&copy; {new Date().getFullYear()} Your Company Name. All rights reserved.</p>
          <p className="text-orange-300 font-medium mt-1">Ready to engage and learn!</p>
        </footer>
      </div>
    </div>
  );
};