import { getUserId } from "@/constants/getUserId";
import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getTokenFromStorage, isTokenExpired } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { getUserBasicDetails } from "./getBasicUserDetails";
import { QuizSubmission } from "@/components/chatbot/types";
import { AI_SERVICE_URL } from "@/constants/urls";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { RoleTerms, SystemTerms } from "@/types/naming-settings";

export type ContextType = "slide" | "course_details" | "general";
export type SessionMode = "text" | "voice_interview" | "voice_doubt" | "voice_oral_test";
export type MessageType =
  | "user"
  | "assistant"
  | "tool_call"
  | "tool_result"
  | "quiz"
  | "quiz_feedback"
  | "card"
  | "token";
export type AIStatus = "idle" | "thinking" | "generating_quiz";
export type SessionStatus = "ACTIVE" | "CLOSED";
export type MessageIntent = "doubt" | "practice" | "general";

export interface ContextMeta {
  // Slide context
  name?: string;
  type?: string;
  content?: string;
  questions?: string[];
  options?: string[] | string[][];
  level?: string;
  order?: number;
  chapter?: string;
  module?: string;
  subject?: string;
  course?: string;
  progress?: string;

  // Course context
  watch_time?: string;
  total_length_in_minutes?: number | null;
  about?: string;
  why_learn?: string;
  who_should_learn?: string;
  session?: string;

  // General context
  courses_path?: string;

  // Voice call: what the interview / oral test / doubt call is about
  voice_topic?: string;
}

export interface InitSessionRequest {
  user_id: string;
  institute_id: string;
  user_name?: string;
  context_type?: ContextType;
  context_meta?: ContextMeta;
  initial_message?: string;
  session_mode?: SessionMode;
}

export interface InitSessionResponse {
  session_id: string;
  status: AIStatus;
}

export interface MessageEvent {
  id: number;
  type: MessageType;
  content: string;
  metadata?: {
    tool_name?: string;
    tool_arguments?: object;
    tool_call_id?: string;
    quiz_data?: object;
    feedback?: object;
    card?: object;
  };
  created_at: string;
}

/** Callbacks for {@link ChatbotAPIService.openStream}. */
export interface ChatStreamHandlers {
  onOpen?: () => void;
  /** One server-sent event: its `event:` name and raw `data:` payload. */
  onEvent: (event: string, data: string) => void;
  /**
   * The stream ended or could not be opened. `status` is set when the server
   * answered with an HTTP error (401/403/404/5xx) instead of a stream.
   */
  onDisconnect: (info: { status?: number; error?: unknown }) => void;
}

export interface ChatStream {
  close: () => void;
}

export interface StatusEvent {
  ai_status: AIStatus;
  session_status: SessionStatus;
}

export interface SendMessageRequest {
  message: string;
  intent?: MessageIntent;
  quiz_submission?: QuizSubmission;
  idempotency_key?: string;
  attachments?: Array<{type: string; url: string; mime_type?: string; name?: string}>;
}

export interface SendMessageResponse {
  message_id: number;
  status: AIStatus;
}

export interface CloseSessionResponse {
  session_id: string;
  status: "CLOSED";
  message_count: number;
}

export interface UpdateContextRequest {
  context_type: ContextType;
  context_meta: ContextMeta;
}

export interface UpdateContextResponse {
  session_id: string;
  context_type: ContextType;
  status: "success" | "error";
}

class ChatbotAPIService {
  private baseUrl: string;
  private instituteId: string | null = null;
  private userId: string | null = null;

  constructor() {
    this.baseUrl = AI_SERVICE_URL;
  }

  private async getInstituteId(): Promise<string> {
    if (this.instituteId) return this.instituteId;

    const { value } = await Preferences.get({ key: "InstituteDetails" });
    if (value) {
      try {
        const parsed = JSON.parse(value);
        this.instituteId = parsed?.id || "";
      } catch (e) {
        console.error("Error parsing institute details", e);
        this.instituteId = "";
      }
    } else {
      this.instituteId = "";
    }
    return this.instituteId || "";
  }

  private async getUserId(): Promise<string> {
    if (this.userId) return this.userId;
    const id = await getUserId();
    this.userId = id || "";
    return this.userId;
  }

  async initSession(
    initialMessage?: string,
    contextType?: ContextType,
    contextMeta?: ContextMeta,
    sessionMode?: SessionMode,
  ): Promise<InitSessionResponse> {
    const userId = await this.getUserId();
    const userDetails = await getUserBasicDetails([userId]);
    const name = userDetails?.[0]?.name || "";
    const instituteId = await this.getInstituteId();

    const request: InitSessionRequest = {
      user_id: userId,
      institute_id: instituteId,
      initial_message: initialMessage,
      user_name:
        name || getTerminology(RoleTerms.Learner, SystemTerms.Learner),
      context_type: contextType,
      context_meta: contextMeta,
      session_mode: sessionMode || "text",
    };

    const response = await authenticatedAxiosInstance.post<InitSessionResponse>(
      `${this.baseUrl}/chat-agent/session/init`,
      request,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      },
    );

    return response.data;
  }

  /**
   * Headers for the stream request. The token is refreshed through the shared
   * HTTP client (a cheap /whoami call) rather than here: that client is the one
   * place that rotates refresh tokens, and two refreshes racing would log the
   * learner out.
   */
  private async streamHeaders(): Promise<Record<string, string>> {
    let token = await getTokenFromStorage(TokenKey.accessToken);
    if (isTokenExpired(token)) {
      try {
        await authenticatedAxiosInstance.get(`${this.baseUrl}/chat-agent/whoami`);
      } catch {
        // Offline or refresh failed — open the stream without a token; the
        // server serves it until auth is enforced, then answers 401.
      }
      token = await getTokenFromStorage(TokenKey.accessToken);
    }
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (token && !isTokenExpired(token)) headers.Authorization = `Bearer ${token}`;
    const instituteId = await this.getInstituteId();
    if (instituteId) headers.clientId = instituteId;
    return headers;
  }

  /**
   * Open the session's server-sent-event stream with fetch. EventSource cannot
   * send an Authorization header, so the stream is read and parsed here.
   */
  openStream(sessionId: string, handlers: ChatStreamHandlers): ChatStream {
    const controller = new AbortController();
    let closed = false;
    const url = `${this.baseUrl}/chat-agent/session/${sessionId}/stream`;

    const dispatch = (block: string) => {
      let event = "message";
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length && !closed) handlers.onEvent(event, data.join("\n"));
    };

    void (async () => {
      try {
        const response = await fetch(url, {
          headers: await this.streamHeaders(),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || !response.body) {
          if (!closed) handlers.onDisconnect({ status: response.status });
          return;
        }
        if (closed) return;
        handlers.onOpen?.();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.search(/\r?\n\r?\n/);
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
            dispatch(block);
            boundary = buffer.search(/\r?\n\r?\n/);
          }
        }
        if (!closed) handlers.onDisconnect({});
      } catch (error) {
        if (!closed) handlers.onDisconnect({ error });
      }
    })();

    return {
      close: () => {
        closed = true;
        controller.abort();
      },
    };
  }

  async sendMessage(
    sessionId: string,
    message: string,
    intent?: MessageIntent,
    quizSubmission?: QuizSubmission,
    attachments?: Array<{type: string; url: string; mime_type?: string; name?: string}>,
  ): Promise<SendMessageResponse> {
    const request: SendMessageRequest = {
      message,
      idempotency_key: crypto.randomUUID(),
      ...(intent && { intent }),
      ...(quizSubmission && { quiz_submission: quizSubmission }),
      ...(attachments?.length && { attachments }),
    };

    const response = await authenticatedAxiosInstance.post<SendMessageResponse>(
      `${this.baseUrl}/chat-agent/session/${sessionId}/message`,
      request,
    );

    return response.data;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResponse> {
    const response = await authenticatedAxiosInstance.post<CloseSessionResponse>(
      `${this.baseUrl}/chat-agent/session/${sessionId}/close`,
    );

    return response.data;
  }

  async sendAudioMessage(
    sessionId: string,
    audioBlob: Blob,
    language: string = "en-IN",
  ): Promise<{ transcript: string; message_id: number }> {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("language", language);
    const response = await authenticatedAxiosInstance.post(
      `${this.baseUrl}/chat-agent/session/${sessionId}/audio-message`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 30000 }
    );
    return response.data;
  }

  getVoiceWebSocketUrl(sessionId: string): string {
    const wsBase = this.baseUrl.replace("https://", "wss://").replace("http://", "ws://");
    return `${wsBase}/chat-agent/session/${sessionId}/voice`;
  }

  async updateContext(
    sessionId: string,
    contextType: ContextType,
    contextMeta: ContextMeta,
  ): Promise<UpdateContextResponse> {
    const request: UpdateContextRequest = {
      context_type: contextType,
      context_meta: contextMeta,
    };

    const response = await authenticatedAxiosInstance.put<UpdateContextResponse>(
      `${this.baseUrl}/chat-agent/session/${sessionId}/context`,
      request,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  }
}

export const chatbotAPI = new ChatbotAPIService();
