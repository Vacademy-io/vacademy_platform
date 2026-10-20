import React from "react";
import { Microphone } from "@phosphor-icons/react";
import { useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { MessageIntent } from "@/services/chatbot-api";
import { useChatbotContext } from "./useChatbotContext";
import { QuickActions } from "./QuickActions";

/**
 * Route-aware quick actions plus the voice-call chip. A prompt ending in a
 * space only prefills the input (the learner finishes the sentence); any
 * other prompt is sent straight away.
 */
export const ChatSuggestions: React.FC<{ compact?: boolean; centered?: boolean }> = ({
  compact = false,
  centered = false,
}) => {
  const { t } = useTranslation("chatFeatureB");
  const location = useLocation();
  const { isLoading, sessionId, sendMessage, setInputValue, chatbotSettings, startVoiceCall } =
    useChatbotContext();
  const disabled = isLoading || !sessionId;

  return (
    <div className={cn("w-full flex flex-wrap", compact ? "gap-1" : "gap-1.5", centered && "justify-center")}>
      <QuickActions
        pathname={location.pathname}
        onAction={(prompt: string, intent?: MessageIntent) => {
          if (prompt.endsWith(" ")) {
            setInputValue(prompt);
          } else {
            sendMessage(prompt, intent);
          }
        }}
        disabled={disabled}
        compact={compact}
        className={cn(centered && "justify-center")}
      />
      {chatbotSettings.enabled_modes?.some((m) => m.startsWith("voice_")) && (
        <button
          type="button"
          onClick={startVoiceCall}
          disabled={disabled}
          title={t("common.startVoiceConversation")}
          // text-caption stays outside cn() — see QuickActions.
          className={`${cn(
            "inline-flex items-center rounded-full border border-warning-200 bg-warning-50 font-medium text-warning-700 transition-colors hover:bg-warning-100 disabled:opacity-50 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300",
            compact ? "h-5 px-2" : "h-6 px-2.5",
          )} text-caption`}
        >
          <Microphone className={cn("me-1", compact ? "h-2.5 w-2.5" : "h-3 w-3")} aria-hidden="true" />
          {t("common.voiceChatLabel")}
        </button>
      )}
    </div>
  );
};
