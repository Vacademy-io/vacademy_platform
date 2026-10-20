import React, { createContext } from "react";
import { ChatMessage, QuizSubmission } from "./types";
import {
  AIStatus,
  ChatSessionSummary,
  FeedbackRating,
  MessageIntent,
  SessionMode,
} from "@/services/chatbot-api";
import { ChatbotSettingsData } from "@/services/chatbot-settings";
import { QueuedMessage } from "@/services/offline-queue";

export interface ChatbotContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  aiStatus: AIStatus;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: (message: string, intent?: MessageIntent, attachments?: Array<{type: string; url: string; mime_type?: string; name?: string}>) => void;
  submitQuiz: (submission: QuizSubmission) => void;
  startNewChat: () => void;
  closeSession: () => void;
  shouldShowChatbot: () => boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatbotSettings: ChatbotSettingsData;
  instituteName: string;
  hasError: boolean;
  isCreditsExhausted: boolean;
  isSessionClosed: boolean;
  isInitializing: boolean;
  sessionId: string | null;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  isWaitingForResponse: boolean;
  activeToolCall: string | null;
  streamingContent: string;
  isStreaming: boolean;
  isOffline: boolean;
  pendingMessages: QueuedMessage[];
  voiceMode: SessionMode | null;
  /** Topic the current call is about, derived from the student's context. */
  voiceTopic: string;
  suggestedVoiceTopic: () => string;
  /** Starts a call, skipping the picker when only one voice mode is enabled. */
  startVoiceCall: () => void;
  /** Re-open the session's SSE stream (server resumes and answers any pending message). */
  reconnectStream: () => void;
  /** The learner's past chats, filled by loadSessions(). */
  sessions: ChatSessionSummary[];
  /** Fetch the past chats (rejects on failure; `sessions` keeps the last list). */
  loadSessions: () => Promise<ChatSessionSummary[]>;
  /** Switch to a past chat; false (current chat kept) if it cannot be opened. */
  openSession: (sessionId: string) => Promise<boolean>;
  /** Stop the reply being written; the partial text stays, marked stopped. */
  stopGeneration: () => void;
  /** Rate an assistant reply; "none" clears the rating. */
  setFeedback: (messageId: number, rating: FeedbackRating) => Promise<void>;
  showVoiceSelector: boolean;
  setShowVoiceSelector: (show: boolean) => void;
  enterVoiceMode: (mode: SessionMode, language?: string, topic?: string) => Promise<void>;
  exitVoiceMode: () => void;
  voiceLanguage: string;
}

export const ChatbotContext = createContext<ChatbotContextType | undefined>(
  undefined
);
