import { useEffect, useRef, useState } from "react";
import { BASE_URL } from "@/constants/urls";
import { getChatUser } from "@/services/chat/getChatUser";
import type {
  ChatAnnouncementEvent,
  ChatMessagePayload,
} from "@/services/chat/chatApi";

export type ChatStreamStatus = "connecting" | "open" | "closed";

export interface UseChatStreamOptions {
  /** Fired for each CHAT_MESSAGE event. */
  onMessage?: (payload: ChatMessagePayload) => void;
  /** Fired for each CHAT_READ event. */
  onRead?: (payload: ChatMessagePayload) => void;
  /** Fired whenever the stream (re)connects — use to catch up missed messages. */
  onReconnect?: () => void;
  /** Disable the stream entirely (e.g. while the user context is unresolved). */
  enabled?: boolean;
}

/**
 * Opens an EventSource to the notification-service SSE stream and dispatches
 * CHAT_MESSAGE / CHAT_READ events to the supplied callbacks. Heartbeats and
 * the initial `connection` event are ignored. Reconnects with capped
 * exponential backoff on error.
 *
 * Callbacks are read through a ref so the EventSource is not torn down every
 * render when the parent passes fresh closures.
 */
export function useChatStream(
  options: UseChatStreamOptions = {},
): ChatStreamStatus {
  const { enabled = true } = options;
  const [status, setStatus] = useState<ChatStreamStatus>("closed");

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled) {
      setStatus("closed");
      return;
    }

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;
    let hadConnected = false;

    const parse = (raw: string): ChatAnnouncementEvent | null => {
      try {
        return JSON.parse(raw) as ChatAnnouncementEvent;
      } catch {
        return null;
      }
    };

    const handleMessage = (e: MessageEvent) => {
      const event = parse(e.data);
      if (event?.data) optionsRef.current.onMessage?.(event.data);
    };

    const handleRead = (e: MessageEvent) => {
      const event = parse(e.data);
      if (event?.data) optionsRef.current.onRead?.(event.data);
    };

    const connect = async () => {
      if (cancelled) return;
      setStatus("connecting");

      const { userId, instituteId, token } = await getChatUser();
      if (cancelled || !userId) return;

      const url =
        `${BASE_URL}/notification-service/v1/sse/stream/${userId}` +
        `?instituteId=${encodeURIComponent(instituteId)}` +
        `&token=${encodeURIComponent(token)}`;

      es = new EventSource(url);

      es.addEventListener("open", () => {
        if (cancelled) return;
        attempt = 0;
        setStatus("open");
        // Only resync on a genuine RE-connect, not the first successful connect.
        if (hadConnected) optionsRef.current.onReconnect?.();
        hadConnected = true;
      });

      es.addEventListener("CHAT_MESSAGE", handleMessage as EventListener);
      es.addEventListener("CHAT_READ", handleRead as EventListener);
      // HEARTBEAT + the initial `connection` event are intentionally ignored.

      es.addEventListener("error", () => {
        if (cancelled) return;
        setStatus("connecting");
        es?.close();
        es = null;
        // Capped exponential backoff: 1s, 2s, 4s … max 30s.
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      });
    };

    // Pause the stream while the app/tab is backgrounded so the server promptly marks the user
    // offline and routes new messages to an FCM push instead of a stream they can't see. On
    // foreground we reconnect, and the reconnect handler catches up anything missed via sinceCursor.
    const handleVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        es?.close();
        es = null;
        setStatus("closed");
      } else if (!es) {
        attempt = 0;
        void connect();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    // Don't open a stream we'd immediately have to tear down if we start backgrounded.
    if (typeof document === "undefined" || !document.hidden) {
      void connect();
    }

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      setStatus("closed");
    };
  }, [enabled]);

  return status;
}
