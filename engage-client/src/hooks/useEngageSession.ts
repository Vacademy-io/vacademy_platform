// src/hooks/useEngageSession.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { type SessionDetailsResponse, type SseEventData, type UserSession } from '@/types';

const SSE_BASE_URL = 'http://localhost:8073/community-service/engage/learner';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const CLIENT_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

interface UseEngageSessionProps {
  inviteCode: string;
  username: string;
  initialSessionData: SessionDetailsResponse;
}

export const useEngageSession = ({ inviteCode, username, initialSessionData }: UseEngageSessionProps) => {
  console.log('[INITIAL DATA CHECK] Full initialSessionData:', JSON.parse(JSON.stringify(initialSessionData)));
  // Log the specific slide we are having trouble with if it exists in initial data
  const problemSlideInitial = initialSessionData.slides.added_slides.find(s => s.id === '2ac8eb51-8533-439c-bbe3-82e1c78b85b7');
  if (problemSlideInitial) {
    console.log('[INITIAL DATA CHECK] Problem slide (ID: 2ac8eb51...) in initialData:', JSON.parse(JSON.stringify(problemSlideInitial)));
  }

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

  const updateSessionState = useCallback((updates: Partial<UserSession>) => {
    setSessionState(prev => ({ ...prev, ...updates }));
  }, []);

  const sendClientHeartbeat = useCallback(async () => {
    if (!sessionState.sessionId || !username) return;
    const heartbeatUrl = `${SSE_BASE_URL}/${sessionState.sessionId}/heartbeat?username=${encodeURIComponent(username)}`;
    try {
      // console.log('[SSE] Sending client heartbeat...');
      await fetch(heartbeatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty body as per curl example
      });
      // console.log('[SSE] Client heartbeat sent successfully.');
    } catch (error) {
      console.error('[SSE] Error sending client heartbeat:', error);
    }
  }, [sessionState.sessionId, username]);


  const connectSse = useCallback(() => {
    if (!username || !sessionState.sessionId) {
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

    const sseUrl = `${SSE_BASE_URL}/${sessionState.sessionId}?username=${encodeURIComponent(username)}`;
    console.log(`[SSE] Attempting to connect (attempt ${reconnectAttemptsRef.current + 1}): ${sseUrl}`);
    const newEventSource = new EventSource(sseUrl, { withCredentials: false });
    eventSourceRef.current = newEventSource;
    updateSessionState({ sseStatus: 'connecting' });

    newEventSource.onopen = () => {
      console.log("[SSE] Connection established.");
      reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      updateSessionState({ sseStatus: 'connected', error: null });
      toast.info("Live Connection Active", { description: "Receiving real-time updates.", duration: 2000 });
      // Start client-side heartbeat
      sendClientHeartbeat(); // Send one immediately
      clientHeartbeatTimerRef.current = setInterval(sendClientHeartbeat, CLIENT_HEARTBEAT_INTERVAL_MS);
    };

    newEventSource.onerror = (errorEvent) => {
      console.error("[SSE] Error occurred with EventSource:", errorEvent);
      if (eventSourceRef.current) eventSourceRef.current.close(); // Close the failed EventSource

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff, max 30s
        console.log(`[SSE] Attempting to reconnect in ${delay / 1000} seconds (attempt ${reconnectAttemptsRef.current})...`);
        updateSessionState({ sseStatus: 'reconnecting', error: `Connection lost. Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...` });
        setTimeout(connectSse, delay);
      } else {
        console.error("[SSE] Max reconnection attempts reached. Giving up.");
        updateSessionState({ sseStatus: 'error', error: "Max reconnection attempts reached. Please check your connection or try rejoining." });
        toast.error("Connection Failed", { description: "Could not reconnect to the session after multiple attempts."});
        if (clientHeartbeatTimerRef.current) {
          clearInterval(clientHeartbeatTimerRef.current);
        }
      }
    };

    // Generic message handler first
    newEventSource.onmessage = (event) => {
        console.log("[SSE] Generic message received:", event);
        // Potentially useful if backend sends unnamed events or for debugging.
    };
    
    // Specific event listener for 'session_event_learner'
    const sessionEventListener = (event: MessageEvent) => {
      try {
        const eventData = JSON.parse(event.data) as SseEventData;
        console.log("[SSE] Received 'session_event_learner':", eventData);

        let newSessionData = sessionState.sessionData;
        let newCurrentSlide = sessionState.currentSlide;

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
             if (eventSourceRef.current) eventSourceRef.current.close(); // Close SSE on session end
             if (clientHeartbeatTimerRef.current) clearInterval(clientHeartbeatTimerRef.current); // Stop heartbeats
          } else if (eventData.status === 'STARTED' && sessionState.sessionData?.session_status === 'INIT' && eventData.type !== "CURRENT_SLIDE") {
            // Avoid double toast if CURRENT_SLIDE already triggered it
            toast.success("Session Started!", { description: "The presentation is now live." });
          }
        }

        // Enhanced diagnostic logging
        console.log('[DIAGNOSTIC] Processing event:', JSON.parse(JSON.stringify(eventData)));
        console.log('[DIAGNOSTIC] sessionState.sessionData (start of listener):', JSON.parse(JSON.stringify(sessionState.sessionData)));
        console.log('[DIAGNOSTIC] newSessionData (before slide logic):', JSON.parse(JSON.stringify(newSessionData)));
        if (newSessionData && newSessionData.slides) {
            console.log('[DIAGNOSTIC] newSessionData.slides.added_slides (length):', newSessionData.slides.added_slides ? newSessionData.slides.added_slides.length : 'undefined/null');
            console.log('[DIAGNOSTIC] newSessionData.slides.added_slides IS ARRAY?: ', Array.isArray(newSessionData.slides.added_slides));
        } else {
            console.log('[DIAGNOSTIC] newSessionData or newSessionData.slides is null/undefined.');
        }

        // Use eventData.currentSlideIndex (camelCase) as received in the SSE event
        const conditionForSlideUpdate = eventData.currentSlideIndex !== undefined && 
                                      newSessionData && 
                                      newSessionData.slides && 
                                      Array.isArray(newSessionData.slides.added_slides);

        console.log('[DIAGNOSTIC] Condition for slide update block MET? (using eventData.currentSlideIndex):', conditionForSlideUpdate, 'eventData.currentSlideIndex value:', eventData.currentSlideIndex);

        if (conditionForSlideUpdate) {
          // Within this block, due to conditionForSlideUpdate:
          // - eventData.currentSlideIndex is a number
          // - newSessionData is not null
          // - newSessionData.slides is not null
          // - newSessionData.slides.added_slides is an array

          newSessionData = { ...newSessionData!, current_slide_index: eventData.currentSlideIndex as number };
          
          const targetSlide = newSessionData.slides!.added_slides.find(s => s.slide_order === eventData.currentSlideIndex as number);
          if (targetSlide) {
            newCurrentSlide = targetSlide;
            console.log('[DIAGNOSTIC] Found targetSlide:', JSON.parse(JSON.stringify(targetSlide)));
          } else {
            newCurrentSlide = null;
            console.warn(`[SSE] Slide with slide_order ${eventData.currentSlideIndex as number} not found in added_slides array. Current added_slides:`, JSON.parse(JSON.stringify(newSessionData.slides!.added_slides)));
          }
          
          console.log('[DEBUG] Attempting to set newCurrentSlide:', JSON.parse(JSON.stringify(newCurrentSlide)), 'for eventData.currentSlideIndex:', eventData.currentSlideIndex as number);

          if (newCurrentSlide) {
            // Optional: toast for slide change if desired
            // toast.info("Slide Changed", { description: `Moved to: ${newCurrentSlide.title || `Slide ${newCurrentSlide.slide_order + 1}`}`, duration: 1500 });
          }
        } else {
            let errCSlideIndex: string | number = 'undefined';
            // Check eventData.currentSlideIndex (camelCase) for logging
            if (eventData.currentSlideIndex !== undefined) {
                errCSlideIndex = eventData.currentSlideIndex;
            }
            const errNewSessDataExists = !!newSessionData;
            const errNewSessDataSlidesExists = !!(newSessionData && newSessionData.slides);
            const errNewSessDataSlidesAddedSlidesIsArray = !!(newSessionData && newSessionData.slides && Array.isArray(newSessionData.slides.added_slides));
            let errActualAddedSlides: any = 'N/A';
            if (newSessionData && newSessionData.slides && newSessionData.slides.added_slides) {
                errActualAddedSlides = JSON.parse(JSON.stringify(newSessionData.slides.added_slides));
            } else if (newSessionData && newSessionData.slides) {
                errActualAddedSlides = 'added_slides is null/undefined';
            } else if (newSessionData) {
                errActualAddedSlides = 'newSessionData.slides is null/undefined';
            }

            console.error(
                '[DIAGNOSTIC ERROR] Condition for slide update logic was NOT MET. Values:\n',
                'eventData.current_slide_index (expected snake_case from type, but check camelCase from event):', errCSlideIndex,
                'newSessionData present:', errNewSessDataExists,
                'newSessionData.slides present:', errNewSessDataSlidesExists,
                'newSessionData.slides.added_slides is_array:', errNewSessDataSlidesAddedSlidesIsArray,
                'Actual newSessionData.slides.added_slides:', errActualAddedSlides
            );
            // If condition fails, newCurrentSlide remains sessionState.currentSlide from the top of the function
            console.log('[DIAGNOSTIC] newCurrentSlide will remain UNCHANGED from initial sessionState.currentSlide in this event cycle.');
        }
        
        // If the event contains full slide data (less likely for just an index change but possible)
        if (eventData.slide_data) {
            newCurrentSlide = eventData.slide_data;
            if (newSessionData && newSessionData.slides.added_slides) {
                const slideIdx = newSessionData.slides.added_slides.findIndex(s => s.id === eventData.slide_data!.id);
                if (slideIdx !== -1) {
                    newSessionData.slides.added_slides[slideIdx] = eventData.slide_data;
                }
            }
        }

        updateSessionState({
          sessionData: newSessionData,
          currentSlide: newCurrentSlide,
          error: eventData.type === 'ERROR' ? eventData.message || "An error occurred in the session." : sessionState.error,
        });

      } catch (e) {
        console.error("[SSE] Error parsing 'session_event_learner' data:", e, event.data);
      }
    };
    newEventSource.addEventListener('session_event_learner', sessionEventListener);

    const heartbeatListener = (_event: MessageEvent) => {
        // console.log("[SSE] (Server) Heartbeat received:", event.data);
        // Can update a "last seen" timestamp if needed
    };
    newEventSource.addEventListener('learner_heartbeat', heartbeatListener);

    // Return a cleanup function for the event source listeners
    return () => {
        console.log("[SSE] Cleaning up EventSource listeners for this connection instance.");
        newEventSource.removeEventListener('session_event_learner', sessionEventListener);
        newEventSource.removeEventListener('learner_heartbeat', heartbeatListener);
        newEventSource.close(); // Ensure this specific instance is closed
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, sessionState.sessionId, updateSessionState, sendClientHeartbeat, sessionState.sessionData?.session_status]); // Added dependencies


  useEffect(() => {
    // Initial connection
    connectSse();

    // Overall cleanup when the component unmounts or critical dependencies change
    return () => {
      console.log("[SSE] Component unmounting or critical deps changed. Closing connection and removing listeners.");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (clientHeartbeatTimerRef.current) {
        clearInterval(clientHeartbeatTimerRef.current);
      }
      reconnectAttemptsRef.current = 0; // Reset for potential future remounts
      updateSessionState({ sseStatus: 'disconnected' });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectSse]); // connectSse is memoized

  return sessionState;
};