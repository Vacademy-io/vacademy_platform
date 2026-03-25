// src/hooks/useEngageSession.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { type SessionDetailsResponse, type SseEventData, type UserSession, type Slide } from '@/types';
import { BASE_URL } from '@/config/baseUrl';

const SSE_BASE_URL = `${BASE_URL}/community-service/engage/learner`;
const MAX_RECONNECT_ATTEMPTS = 15;
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const CLIENT_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
// Minimum time the tab must have been hidden before we force-reconnect on visibility change
const MIN_HIDDEN_DURATION_FOR_RECONNECT_MS = 3000; // 3 seconds

interface UseEngageSessionProps {
  inviteCode: string;
  username: string;
  initialSessionData: SessionDetailsResponse;
}

export const useEngageSession = ({ inviteCode, username, initialSessionData }: UseEngageSessionProps) => {
  const [sessionState, setSessionState] = useState<UserSession>({
    username,
    inviteCode,
    sessionId: initialSessionData.session_id,
    sessionData: initialSessionData,
    currentSlide: initialSessionData.slides.added_slides.find(s => s.slide_order === initialSessionData.current_slide_index) || null,
    sseStatus: 'connecting',
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clientHeartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Use a ref for sessionId so connectSse never needs it as a reactive dep
  const sessionIdRef = useRef(initialSessionData.session_id);
  // Track when the tab was last hidden to determine if reconnect is needed
  const tabHiddenAtRef = useRef<number | null>(null);
  // Track whether a visibility-triggered reconnect is already in progress
  const isReconnectingFromVisibilityRef = useRef(false);

  const updateSessionState = useCallback((updates: Partial<UserSession>) => {
    setSessionState(prev => ({ ...prev, ...updates }));
  }, []);

  const sendClientHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current || !username) return;
    const heartbeatUrl = `${SSE_BASE_URL}/${sessionIdRef.current}/heartbeat?username=${encodeURIComponent(username)}`;
    try {
      await fetch(heartbeatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.error('[SSE] Error sending client heartbeat:', error);
    }
  }, [username]);


  const connectSse = useCallback(() => {
    if (!username || !sessionIdRef.current) {
      updateSessionState({ error: "Missing username or session ID for SSE connection.", sseStatus: 'error' });
      return;
    }

    // Clear any existing client heartbeat timer
    if (clientHeartbeatTimerRef.current) {
      clearInterval(clientHeartbeatTimerRef.current);
      clientHeartbeatTimerRef.current = null;
    }

    // Close existing EventSource if any
    if (eventSourceRef.current) {
      console.log("[SSE] Closing existing EventSource before reconnecting.");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const sseUrl = `${SSE_BASE_URL}/${sessionIdRef.current}?username=${encodeURIComponent(username)}`;
    console.log(`[SSE] Attempting to connect (attempt ${reconnectAttemptsRef.current + 1}): ${sseUrl}`);
    const newEventSource = new EventSource(sseUrl, { withCredentials: false });
    eventSourceRef.current = newEventSource;
    updateSessionState({ sseStatus: 'connecting' });

    newEventSource.onopen = () => {
      console.log("[SSE] Connection established.");
      reconnectAttemptsRef.current = 0;
      updateSessionState({ sseStatus: 'connected', error: null });
      toast.info("Live Connection Active", { description: "Receiving real-time updates.", duration: 2000 });
      sendClientHeartbeat();
      clientHeartbeatTimerRef.current = setInterval(sendClientHeartbeat, CLIENT_HEARTBEAT_INTERVAL_MS);
    };

    newEventSource.onerror = (errorEvent) => {
      console.error("[SSE] Error occurred with EventSource:", errorEvent);
      if (eventSourceRef.current) eventSourceRef.current.close();

      // If the tab is currently hidden (backgrounded), don't burn through
      // reconnection attempts — just mark as reconnecting and wait for the
      // visibility-change handler to reconnect when the user returns.
      if (document.hidden) {
        console.log('[SSE] Tab is hidden; deferring reconnection until tab is visible.');
        updateSessionState({ sseStatus: 'reconnecting', error: 'Connection paused while tab is in background.' });
        return;
      }

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[SSE] Attempting to reconnect in ${delay / 1000} seconds (attempt ${reconnectAttemptsRef.current})...`);
        updateSessionState({ sseStatus: 'reconnecting', error: `Connection lost. Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...` });
        // Clear any pending reconnect timer first
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connectSse, delay);
      } else {
        console.error("[SSE] Max reconnection attempts reached. Giving up.");
        updateSessionState({ sseStatus: 'error', error: "Max reconnection attempts reached. Please check your connection or try rejoining." });
        toast.error("Connection Failed", { description: "Could not reconnect to the session after multiple attempts." });
        if (clientHeartbeatTimerRef.current) {
          clearInterval(clientHeartbeatTimerRef.current);
        }
      }
    };

    // Generic message handler for unnamed events
    newEventSource.onmessage = (event) => {
      console.log("[SSE] Generic message received:", event);
    };

    // Specific event listener for 'session_event_learner'
    const sessionEventListener = (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data) as SseEventData;
        console.log("[SSE] Received 'session_event_learner':", eventData);

        setSessionState((prev: UserSession) => {
          let newSessionData = prev.sessionData;
          let newCurrentSlide = prev.currentSlide;
          let error = prev.error;

          // If this is a CURRENT_SLIDE event and the session is still in INIT,
          // implicitly move it to STARTED state to show the slide.
          if (eventData.type === "CURRENT_SLIDE" && newSessionData?.session_status === "INIT") {
            newSessionData = { ...newSessionData, session_status: "STARTED" };
            toast.success("Session Started!", { description: "The presentation is now live." });
          }

          if (eventData.status) {
            newSessionData = newSessionData ? { ...newSessionData, session_status: eventData.status } : null;
            if (eventData.status === 'ENDED' || eventData.status === 'CANCELLED') {
              toast.info("Session Ended", { description: eventData.message || "The session has concluded." });
              if (eventSourceRef.current) eventSourceRef.current.close();
              if (clientHeartbeatTimerRef.current) clearInterval(clientHeartbeatTimerRef.current);
            } else if (eventData.status === 'STARTED' && prev.sessionData?.session_status === 'INIT' && eventData.type !== "CURRENT_SLIDE") {
              toast.success("Session Started!", { description: "The presentation is now live." });
            }
          }

          const conditionForSlideUpdate = eventData.currentSlideIndex !== undefined &&
            newSessionData &&
            newSessionData.slides &&
            Array.isArray(newSessionData.slides.added_slides);

          if (conditionForSlideUpdate) {
            // Clear all toasts from the previous slide (e.g., "No more attempts", "Time's up")
            toast.dismiss();
            newSessionData = { ...newSessionData!, current_slide_index: eventData.currentSlideIndex as number };
            // Capture slide start timestamp and timer duration from SSE
            if (eventData.slideStartTimestamp !== undefined && eventData.slideStartTimestamp !== null && eventData.slideStartTimestamp > 0) {
              newSessionData = { 
                ...newSessionData, 
                slide_start_timestamp: eventData.slideStartTimestamp,
                default_seconds_for_question: eventData.defaultSecondsForQuestion || newSessionData.default_seconds_for_question
              };
            } else if (eventData.defaultSecondsForQuestion !== undefined) {
              newSessionData = {
                ...newSessionData,
                default_seconds_for_question: eventData.defaultSecondsForQuestion
              };
            }
            const targetSlide = newSessionData.slides.added_slides.find((s: Slide) => s.slide_order === eventData.currentSlideIndex);

            if (targetSlide) {
              newCurrentSlide = targetSlide;
            } else {
              newCurrentSlide = null;
              console.warn(`[SSE] Slide with slide_order ${eventData.currentSlideIndex} not found in added_slides array.`);
            }
          }

          if (eventData.slide_data) {
            newCurrentSlide = eventData.slide_data;
            if (newSessionData && newSessionData.slides.added_slides) {
              const slideIdx = newSessionData.slides.added_slides.findIndex((s: Slide) => s.id === eventData.slide_data!.id);
              if (slideIdx !== -1) {
                // Create a new array to avoid direct state mutation
                const updatedSlides = [...newSessionData.slides.added_slides];
                updatedSlides[slideIdx] = eventData.slide_data;
                newSessionData = {
                  ...newSessionData,
                  slides: { ...newSessionData.slides, added_slides: updatedSlides },
                };
              }
            }
          }

          if (eventData.type === 'ERROR') {
            error = eventData.message || "An error occurred in the session.";
          }

          return { ...prev, sessionData: newSessionData, currentSlide: newCurrentSlide, error };
        });

      } catch (e) {
        console.error("[SSE] Error parsing 'session_event_learner' data:", e, event.data);
      }
    };
    newEventSource.addEventListener('session_event_learner', sessionEventListener);

    const sessionEndListener = () => {
      console.log('[SSE] Session Ended.');
      setSessionState(prev => {
        let newSessionData = prev.sessionData;
        if (newSessionData) {
          newSessionData = { ...newSessionData, session_status: 'ENDED' };
        }
        return { ...prev, sessionData: newSessionData, sseStatus: 'disconnected' };
      });
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (clientHeartbeatTimerRef.current) clearInterval(clientHeartbeatTimerRef.current);
      toast.info("Session Ended", { description: "The session has concluded." });
    };
    newEventSource.addEventListener('session_end', sessionEndListener);

    const errorListener = (_event: MessageEvent) => {
      console.error('[SSE] Received explicit error event.', _event);
      // Optional: handle specific error events from server
    };
    newEventSource.addEventListener('error_event', errorListener);

    const heartbeatListener = () => {
      // Server heartbeat acknowledgement — no action needed
    };
    newEventSource.addEventListener('learner_heartbeat', heartbeatListener);

    const updateSlidesListener = async () => {
      try {
        toast.info("Checking for presentation updates...");

        const response = await fetch(`${SSE_BASE_URL}/get-updated-details/${sessionIdRef.current}`);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to fetch updated session details: ${response.status} ${errorBody}`);
        }

        const updatedDetails: SessionDetailsResponse = await response.json();
        console.log("[SSE] Successfully fetched updated session details:", updatedDetails);

        const newCurrentSlide = updatedDetails.slides.added_slides.find(
          s => s.slide_order === updatedDetails.current_slide_index
        ) || null;

        updateSessionState({
          sessionData: updatedDetails,
          currentSlide: newCurrentSlide,
        });

        toast.success("Presentation Updated", { description: "New slides have been loaded." });

      } catch (e) {
        console.error("[SSE] Error processing 'update_slides' event:", e);
        toast.error("Update Failed", { description: "Could not retrieve the latest presentation changes." });
      }
    };
    newEventSource.addEventListener('update_slides', updateSlidesListener);

    return () => {
      console.log("[SSE] Cleaning up EventSource connection.");
      newEventSource.removeEventListener('session_event_learner', sessionEventListener);
      newEventSource.removeEventListener('learner_heartbeat', heartbeatListener);
      newEventSource.removeEventListener('update_slides', updateSlidesListener);
      newEventSource.close();
    };
  // session_status intentionally excluded — it caused a reconnection loop on every status change.
  // sessionIdRef is used instead of sessionState.sessionId to avoid that dep as well.
  }, [username, updateSessionState, sendClientHeartbeat]);

  /**
   * Fetch the latest session state from the backend and update local state.
   * Called after reconnecting from a background/suspended state to catch up
   * on any slides or status changes that were missed.
   */
  const syncSessionState = useCallback(async () => {
    if (!sessionIdRef.current) return;
    try {
      const response = await fetch(`${SSE_BASE_URL}/get-updated-details/${sessionIdRef.current}`);
      if (!response.ok) {
        console.error('[SSE] Failed to sync session state:', response.status);
        return;
      }
      const updatedDetails: SessionDetailsResponse = await response.json();
      console.log('[SSE] Session state synced after visibility change:', updatedDetails.session_status);

      const newCurrentSlide = updatedDetails.slides.added_slides.find(
        (s: Slide) => s.slide_order === updatedDetails.current_slide_index
      ) || null;

      updateSessionState({
        sessionData: updatedDetails,
        currentSlide: newCurrentSlide,
      });
    } catch (error) {
      console.error('[SSE] Error syncing session state:', error);
    }
  }, [updateSessionState]);


  useEffect(() => {
    const cleanup = connectSse();

    // ----- Visibility Change Handler -----
    // When the user returns to the tab after a phone call, app switch, or
    // screen lock, force-reconnect the SSE stream and sync state.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab just went to background — record the timestamp
        tabHiddenAtRef.current = Date.now();
        console.log('[SSE] Tab hidden at', new Date().toISOString());
        return;
      }

      // Tab just became visible again
      const hiddenDuration = tabHiddenAtRef.current ? Date.now() - tabHiddenAtRef.current : 0;
      tabHiddenAtRef.current = null;
      console.log(`[SSE] Tab visible again after ${(hiddenDuration / 1000).toFixed(1)}s`);

      // Only reconnect if hidden long enough for the connection to have died
      if (hiddenDuration < MIN_HIDDEN_DURATION_FOR_RECONNECT_MS) {
        return;
      }

      // Check if the EventSource is still alive
      const es = eventSourceRef.current;
      const isConnectionDead = !es || es.readyState === EventSource.CLOSED;

      if (isConnectionDead && !isReconnectingFromVisibilityRef.current) {
        console.log('[SSE] Connection is dead after tab resume; force-reconnecting...');
        isReconnectingFromVisibilityRef.current = true;

        // Reset the reconnect counter — this is a fresh user-initiated return
        reconnectAttemptsRef.current = 0;
        // Clear any pending reconnect timer from the onerror handler
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        toast.info('Reconnecting...', { description: 'Restoring your live session.', duration: 2000 });
        connectSse();
        // Sync the latest session state in parallel
        syncSessionState().finally(() => {
          isReconnectingFromVisibilityRef.current = false;
        });
      } else if (!isConnectionDead) {
        // Connection is still open — just send a heartbeat to keep it alive
        // and sync state in case we missed events
        sendClientHeartbeat();
        syncSessionState();
      }
    };

    // Also handle network reconnection (e.g., WiFi/cellular switches)
    const handleOnline = () => {
      console.log('[SSE] Network back online, checking connection...');
      const es = eventSourceRef.current;
      if (!es || es.readyState === EventSource.CLOSED) {
        reconnectAttemptsRef.current = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        toast.info('Network restored', { description: 'Reconnecting to session...', duration: 2000 });
        connectSse();
        syncSessionState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      console.log("[SSE] Component unmounting. Closing connection.");
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (cleanup) cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (clientHeartbeatTimerRef.current) {
        clearInterval(clientHeartbeatTimerRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectAttemptsRef.current = 0;
      updateSessionState({ sseStatus: 'disconnected' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectSse]);

  return sessionState;
};
