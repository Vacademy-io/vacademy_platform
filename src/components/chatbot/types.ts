export type MessageRole = "user" | "assistant" | "tool_call" | "tool_result";

export interface ChatbotContext {
  route: string;
  courseId?: string;
  packageSessionId?: string;
  subjectId?: string;
  moduleId?: string;
  chapterId?: string;
  slideId?: string;
  sessionId?: string;
}

export interface ChatMessage {
  id: number;
  role: MessageRole;
  content: string;
  timestamp: number;
  context?: ChatbotContext;
  metadata?: {
    tool_name?: string;
    tool_arguments?: object;
    tool_call_id?: string;
  };
}

export interface ChatResponse {
  message: string;
}
