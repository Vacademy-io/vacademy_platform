import { getUserId } from "@/constants/getUserId";
import { Preferences } from "@capacitor/preferences";
import axios from "axios";
import { getUserBasicDetails } from "./getBasicUserDetails";
import { QuizSubmission } from "@/components/chatbot/types";
import { AI_SERVICE_URL } from "@/constants/urls";

export type ContextType = "slide" | "course_details" | "general";
export type MessageType =
  | "user"
  | "assistant"
  | "tool_call"
  | "tool_result"
  | "quiz"
  | "quiz_feedback"
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
}

export interface InitSessionRequest {
  user_id: string;
  institute_id: string;
  user_name?: string;
  context_type?: ContextType;
  context_meta?: ContextMeta;
  initial_message?: string;
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
  };
  created_at: string;
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
  ): Promise<InitSessionResponse> {
    const userId = await this.getUserId();
    const userDetails = await getUserBasicDetails([userId]);
    const name = userDetails?.[0]?.name || "";
    const instituteId = await this.getInstituteId();

    const request: InitSessionRequest = {
      user_id: userId,
      institute_id: instituteId,
      initial_message: initialMessage,
      user_name: name || "Learner",
      context_type: contextType,
      context_meta: contextMeta,
    };

    console.log("Initializing session with:", request);

    const response = await axios.post<InitSessionResponse>(
      `${this.baseUrl}/chat-agent/session/init`,
      request,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      },
    );

    console.log("Session initialized:", response.data);
    return response.data;
  }

  createEventSource(sessionId: string): EventSource {
    const url = `${this.baseUrl}/chat-agent/session/${sessionId}/stream`;
    console.log("Creating EventSource for URL:", url);

    const eventSource = new EventSource(url);

    // Log connection state
    eventSource.onopen = () => {
      console.log("EventSource connection opened");
    };

    return eventSource;
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

    const response = await axios.post<SendMessageResponse>(
      `${this.baseUrl}/chat-agent/session/${sessionId}/message`,
      request,
    );

    return response.data;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResponse> {
    const response = await axios.post<CloseSessionResponse>(
      `${this.baseUrl}/chat-agent/session/${sessionId}/close`,
    );

    return response.data;
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

    const response = await axios.put<UpdateContextResponse>(
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
