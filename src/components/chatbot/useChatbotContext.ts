import { useContext } from "react";
import { ChatbotContext } from "./ChatbotContextType";

export const useChatbotContext = () => {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error(
      "useChatbotContext must be used within a ChatbotProvider"
    );
  }
  return context;
};
