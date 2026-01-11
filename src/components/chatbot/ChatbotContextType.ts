import React, { createContext } from "react";
import { ChatMessage } from "./types";
import { AIStatus } from "@/services/chatbot-api";
import { ChatbotSettingsData } from "@/services/chatbot-settings";

export interface ChatbotContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  aiStatus: AIStatus;
  inputValue: string;
  setInputValue: (value: string) => void;
  sendMessage: (message: string) => void;
  startNewChat: () => void;
  closeSession: () => void;
  shouldShowChatbot: () => boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatbotSettings: ChatbotSettingsData;
  instituteName: string;
  hasError: boolean;
  isSessionClosed: boolean;
  isInitializing: boolean;
  sessionId: string | null;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  isWaitingForResponse: boolean;
}

export const ChatbotContext = createContext<ChatbotContextType | undefined>(
  undefined
);
