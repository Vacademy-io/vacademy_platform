// src/hooks/useEngageSession.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { type SessionDetailsResponse, type SseEventData, type UserSession, type Slide } from '@/types';

const SSE_BASE_URL = 'https://backend-stage.vacademy.io/community-service/engage/learner';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const CLIENT_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

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
  const clientHeartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Use a ref for sessionId so connectSse never needs it as a reactive dep
  const sessionIdRef = useRef(initialSessionData.session_id);

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

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[SSE] Attempting to reconnect in ${delay / 1000} seconds (attempt ${reconnectAttemptsRef.current})...`);
        updateSessionState({ sseStatus: 'reconnecting', error: `Connection lost. Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...` });
        setTimeout(connectSse, delay);
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
            newSessionData = { ...newSessionData!, current_slide_index: eventData.currentSlideIndex as number };
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

    const heartbeatListener = (_event: MessageEvent) => {
      // Server heartbeat acknowledgement — no action needed
    };
    newEventSource.addEventListener('learner_heartbeat', heartbeatListener);

    const updateSlidesListener = async (_event: MessageEvent) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, updateSessionState, sendClientHeartbeat]);


  useEffect(() => {
    const cleanup = connectSse();

    return () => {
      console.log("[SSE] Component unmounting. Closing connection.");
      if (cleanup) cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (clientHeartbeatTimerRef.current) {
        clearInterval(clientHeartbeatTimerRef.current);
      }
      reconnectAttemptsRef.current = 0;
      updateSessionState({ sseStatus: 'disconnected' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectSse]);

  return sessionState;
};
