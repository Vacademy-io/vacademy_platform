import React, { createContext } from "react";
import { ChatMessage, QuizSubmission } from "./types";
import { AIStatus, MessageIntent, SessionMode } from "@/services/chatbot-api";
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
  showVoiceSelector: boolean;
  setShowVoiceSelector: (show: boolean) => void;
  enterVoiceMode: (mode: SessionMode, language?: string) => Promise<void>;
  exitVoiceMode: () => void;
  voiceLanguage: string;
}

export const ChatbotContext = createContext<ChatbotContextType | undefined>(
  undefined
);
