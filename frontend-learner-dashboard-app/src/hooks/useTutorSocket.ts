import { useCallback, useEffect, useRef, useState } from "react";
import { AI_SERVICE_URL } from "@/constants/urls";
import { getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

export type TutorBoardOp = Record<string, unknown> & { op: string; id?: string; target?: string };

export interface TutorStateEvent {
  slide_id: string;
  topic_id: string | null;
  topic_title: string | null;
  concept_id: string | null;
  concept_title: string | null;
  phase: string;
  progress: { done: number; total: number; percent: number; topic_index: number; topic_count: number };
  language: "en" | "hi";
  remediations: number;
}

export interface TutorCheckEvent {
  concept_id: string | null;
  check_type: string | null;
  prompt: string | null;
  options: string[];
  remediation: number;
}

interface Callbacks {
  onReady?: (ev: Record<string, unknown>) => void;
  onState?: (ev: TutorStateEvent) => void;
  onBoard?: (ops: TutorBoardOp[], clear: boolean, live: boolean, topicId?: string | null) => void;
  onAiText?: (text: string) => void;
  onAudioChunk?: (base64: string) => void;
  onAudioSegmentEnd?: () => void;
  onAudioEnd?: (reason: string, detail?: string) => void;
  onCheck?: (ev: TutorCheckEvent) => void;
  onAwait?: (what: "continue" | "answer" | "done") => void;
  onTranscriptFinal?: (text: string) => void;
  onSlideDone?: (ev: { slide_id: string; weak_concepts: string[]; skipped_concepts: string[]; done: number; total: number }) => void;
  onSummary?: (data: unknown) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

function wsUrl(socketPath: string): string {
  let base = AI_SERVICE_URL;
  if (base.startsWith("https://")) base = "wss://" + base.slice("https://".length);
  else if (base.startsWith("http://")) base = "ws://" + base.slice("http://".length);
  return `${base}${socketPath}`;
}

function readToken(): string {
  try {
    return getTokenFromCookie(TokenKey.accessToken) || localStorage.getItem(TokenKey.accessToken) || "";
  } catch {
    return "";
  }
}

/**
 * Tutor socket client (design §6.2). The server requires an `auth` frame
 * first; everything else is a small JSON message. Callbacks are read through a
 * ref so the socket never holds a stale closure.
 */
export function useTutorSocket(callbacks: Callbacks) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    }
    wsRef.current = null;
  }, []);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  const connect = useCallback(
    (socketPath: string) => {
      cleanup();
      intentionalRef.current = false;
      setConnectionState("connecting");
      const ws = new WebSocket(wsUrl(socketPath));
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token: readToken() }));
        setConnectionState("connected");
        pingRef.current = setInterval(() => send({ type: "ping" }), 25000);
      };
      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        const cb = cbRef.current;
        switch (msg.type) {
          case "ready":
            cb.onReady?.(msg);
            break;
          case "state":
            cb.onState?.(msg as unknown as TutorStateEvent);
            break;
          case "board":
            cb.onBoard?.((msg.ops as TutorBoardOp[]) || [], !!msg.clear, !!msg.live, msg.topic_id as string | null);
            break;
          case "ai_text":
            cb.onAiText?.(String(msg.text ?? ""));
            break;
          case "audio_chunk":
            cb.onAudioChunk?.(String(msg.data ?? ""));
            break;
          case "audio_segment_end":
            cb.onAudioSegmentEnd?.();
            break;
          case "audio_end":
            cb.onAudioEnd?.(String(msg.reason ?? "complete"), msg.detail as string | undefined);
            break;
          case "check":
            cb.onCheck?.(msg as unknown as TutorCheckEvent);
            break;
          case "await":
            cb.onAwait?.(msg.what as "continue" | "answer" | "done");
            break;
          case "transcript_final":
            cb.onTranscriptFinal?.(String(msg.text ?? ""));
            break;
          case "slide_done":
            cb.onSlideDone?.(msg as unknown as Parameters<NonNullable<Callbacks["onSlideDone"]>>[0]);
            break;
          case "summary":
            cb.onSummary?.(msg.data);
            break;
          case "error":
            cb.onError?.(String(msg.message ?? "Error"));
            break;
          default:
            break;
        }
      };
      ws.onerror = () => setConnectionState("error");
      ws.onclose = () => {
        setConnectionState("disconnected");
        if (pingRef.current) {
          clearInterval(pingRef.current);
          pingRef.current = null;
        }
        if (!intentionalRef.current) cbRef.current.onClose?.();
      };
    },
    [cleanup, send],
  );

  const disconnect = useCallback(() => {
    intentionalRef.current = true;
    cleanup();
    setConnectionState("disconnected");
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    connectionState,
    connect,
    disconnect,
    sendContinue: () => send({ type: "continue" }),
    sendAnswer: (text: string) => send({ type: "answer", text }),
    sendAsk: (text: string) => send({ type: "ask", text }),
    sendControl: (intent: "repeat" | "skip" | "slower" | "faster" | "doubt" | "pause" | "resume" | "done") =>
      send({ type: "control", intent }),
    sendConfig: (cfg: { language?: "en" | "hi"; speak?: boolean }) => send({ type: "config", ...cfg }),
    sendNextSlide: (slideId: string) => send({ type: "next_slide", slide_id: slideId }),
    sendAudioChunk: (base64: string) => send({ type: "audio_chunk", data: base64 }),
    sendAudioEnd: (mime?: string) => send({ type: "audio_end", mime: mime || "audio/webm" }),
    sendAudioDiscard: () => send({ type: "audio_discard" }),
    sendInterrupt: () => send({ type: "interrupt" }),
    sendEndSession: () => send({ type: "end_session" }),
  };
}
