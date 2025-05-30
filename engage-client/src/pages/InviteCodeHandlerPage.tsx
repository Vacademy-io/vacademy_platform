import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const InviteCodeHandlerPage: React.FC = () => {
  // The parameter is now definitely an inviteCode due to route ordering in App.tsx
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteCode) {
      // Navigate to JoinPage and pass the invite code in state
      // JoinPage will need to be updated to receive and use this.
      navigate('/', { replace: true, state: { inviteCode: inviteCode } });
    } else {
      // Should not happen if route is /:inviteCode and param is present
      // but as a fallback, navigate to the default JoinPage.
      navigate('/', { replace: true });
    }
  }, [inviteCode, navigate]);

  // This component redirects, so it doesn't render anything itself.
  // Optionally, show a loading spinner or a brief message while redirecting.
  return null; 
}; 