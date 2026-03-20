// src/pages/EngageStreamPage.tsx
import React, { useMemo } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { useEngageSession } from '@/hooks/useEngageSession';
import { SessionController } from '@/components/SessionController';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/errorMessage';
import { type SessionDetailsResponse } from '@/types';

const SESSION_STORAGE_KEY = 'engage_session_data';

interface PersistedSessionData {
  username: string;
  inviteCode: string;
  initialSessionData: SessionDetailsResponse;
  savedAt: number;
}

/**
 * Persist critical session data to sessionStorage so it survives
 * page reloads caused by mobile browsers suspending and resuming tabs.
 */
function persistSessionData(data: PersistedSessionData) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[EngageStreamPage] Failed to persist session data:', e);
  }
}

/**
 * Recover session data from sessionStorage.
 * Returns null if no data, data is expired (>3 hours), or inviteCode doesn't match.
 */
function recoverSessionData(inviteCode: string): PersistedSessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: PersistedSessionData = JSON.parse(raw);
    // Validate the data matches the current session
    if (parsed.inviteCode !== inviteCode) return null;
    // Expire after 3 hours
    if (Date.now() - parsed.savedAt > 3 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[EngageStreamPage] Failed to recover session data:', e);
    return null;
  }
}

// Minimal fallback session data used only to satisfy the hook call
// when no real data is available (before redirecting).
const EMPTY_SESSION: SessionDetailsResponse = {
  session_id: '',
  invite_code: '',
  session_status: 'INIT',
  current_slide_index: 0,
  slides: { id: '', title: '', description: '', cover_file_id: '', added_slides: [], added_slides_count: 0 },
  can_join_in_between: false,
  allow_learner_hand_raise: false,
  allow_after_start: false,
  default_seconds_for_question: 0,
  show_results_at_last_slide: false,
  student_attempts: 1,
  points_per_correct_answer: 0,
  negative_marking_enabled: false,
  negative_marks_per_wrong_answer: 0,
  slide_start_timestamp: null,
  excalidraw_data: null,
  creation_time: '',
  start_time: null,
  end_time: null,
};

export const EngageStreamPage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const location = useLocation();
  
  // Type assertion for location.state
  const navState = location.state as { username?: string; initialSessionData?: SessionDetailsResponse } | null;

  // Try to get data from location.state first, then fall back to sessionStorage
  const resolvedData = useMemo(() => {
    // Primary source: navigation state (from JoinPage)
    if (navState?.username && navState?.initialSessionData && inviteCode) {
      const data: PersistedSessionData = {
        username: navState.username,
        inviteCode,
        initialSessionData: navState.initialSessionData,
        savedAt: Date.now(),
      };
      // Persist for recovery on mobile browser reload
      persistSessionData(data);
      return data;
    }

    // Fallback: recover from sessionStorage
    if (inviteCode) {
      const recovered = recoverSessionData(inviteCode);
      if (recovered) {
        console.log('[EngageStreamPage] Recovered session from sessionStorage for user:', recovered.username);
        return recovered;
      }
    }

    return null;
  }, [inviteCode, navState]);

  // Determine if we have valid data to work with
  const hasValidData = !!(resolvedData && inviteCode && resolvedData.initialSessionData.invite_code === inviteCode);

  // Always call the hook (React rules of hooks), but use fallback data when invalid
  const sessionState = useEngageSession({
    inviteCode: inviteCode || '',
    username: resolvedData?.username || '',
    initialSessionData: resolvedData?.initialSessionData || EMPTY_SESSION,
  });

  // Now handle redirects AFTER the hook call
  if (!inviteCode || !resolvedData) {
    console.warn("EngageStreamPage: Missing inviteCode or session data. Redirecting.");
    return <Navigate to="/" replace />;
  }

  if (!hasValidData) {
    console.warn("EngageStreamPage: Invite code mismatch. Redirecting.");
    return <Navigate to={`/?error=session_mismatch&code=${inviteCode}`} replace />;
  }

  if (sessionState.sseStatus === 'connecting' && !sessionState.sessionData?.session_id) {
    return <LoadingSpinner fullScreen text="Preparing your session..." />;
  }
  
  if (sessionState.sseStatus === 'error' && !sessionState.sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-4">
        {/* Floating background orbs */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none" />
        <div className="floating-orb top-1/4 left-1/4 w-96 h-96 bg-blue-500/5" />
        <div className="floating-orb bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5" style={{ animationDelay: '2s' }} />
        
        <div className="relative z-10">
          <ErrorMessage title="Initialization Error" message={sessionState.error || "Could not initialize the session."} className="max-w-lg"/>
        </div>
      </div>
    );
  }

  return <SessionController sessionState={sessionState} />;
};