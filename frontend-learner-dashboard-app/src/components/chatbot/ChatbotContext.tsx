import React, { useEffect } from "react";
import { useChatbot } from "./useChatbot";
import { ChatbotContext } from "./ChatbotContextType";
import { getChatbotSettings } from "@/services/chatbot-settings";

export const ChatbotProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const chatbotState = useChatbot();
  useEffect(() => {
    console.log("ChatbotProvider initialized");
    getChatbotSettings(true);
  }, []);
  return (
    <ChatbotContext.Provider value={chatbotState}>
      {children}
    </ChatbotContext.Provider>
  );
};
