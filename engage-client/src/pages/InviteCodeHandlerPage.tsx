import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const InviteCodeHandlerPage: React.FC = () => {
  // The parameter is now definitely an inviteCode due to route ordering in App.tsx
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteCode) {
      // Redirect to the Join page with the invite code in state
      navigate('/', { state: { inviteCode }, replace: true });
    } else {
      // If no invite code, just go to the home page
      navigate('/', { replace: true });
    }
  }, [inviteCode, navigate]);

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Floating background orbs */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
      <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
      
      <div className="relative z-10 glassmorphism-card p-6">
        <p className="text-white/80">Redirecting...</p>
      </div>
    </div>
  );
}; 