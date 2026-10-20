import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { WifiSlash } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChatbotContext } from "./useChatbotContext";
import { AssistantAvatar, ChatMarkdown, MessageBubble } from "./MessageBubble";
import { QuizComponent } from "./QuizComponent";
import { QuizFeedbackComponent } from "./QuizFeedbackComponent";
import { ToolIndicator } from "./ToolIndicator";
import { ChatSuggestions } from "./ChatSuggestions";
import { ChatCard } from "./cards/ChatCard";
import type { ChatMessage } from "./types";

/** Follow new content only while the learner is this close to the bottom. */
const NEAR_BOTTOM_PX = 120;
const ANNOUNCE_MAX_CHARS = 600;

/** Plain text for the screen-reader announcement of a reply. */
const toSpeech = (msg: ChatMessage): string => {
  const raw = msg.content || msg.metadata?.quiz_data?.title || "";
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>$~|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ANNOUNCE_MAX_CHARS);
};

/** Avatar + full-width content: quizzes and their feedback. */
const AssistantBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex w-full me-auto max-w-pct-95 gap-1.5">
    <AssistantAvatar className="mt-0.5" />
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const MessageRow: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const { submitQuiz, isSessionClosed } = useChatbotContext();

  if (msg.role === "quiz" && msg.metadata?.quiz_data) {
    return (
      <AssistantBlock>
        {msg.content && (
          <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm mb-2 w-fit max-w-full">
            <ChatMarkdown>{msg.content}</ChatMarkdown>
          </div>
        )}
        <QuizComponent quizData={msg.metadata.quiz_data} onSubmit={submitQuiz} disabled={isSessionClosed} />
      </AssistantBlock>
    );
  }

  if (msg.role === "quiz_feedback" && msg.metadata?.feedback) {
    return (
      <AssistantBlock>
        <QuizFeedbackComponent feedback={msg.metadata.feedback} content={msg.content} />
      </AssistantBlock>
    );
  }

  if (msg.role === "card") return <ChatCard message={msg} />;

  if (msg.role === "user") {
    return (
      <MessageBubble role="user" content={msg.content} attachments={msg.attachments} status={msg.status} />
    );
  }

  // Assistant replies, plus any role this UI does not know yet (as markdown).
  if (!msg.content) return null;
  return <MessageBubble role="assistant" content={msg.content} showAvatar={msg.role === "assistant"} />;
};

const ThinkingIndicator: React.FC<{ generatingQuiz: boolean }> = ({ generatingQuiz }) => {
  const { t } = useTranslation("chatFeatureB");
  return (
    <div className="me-auto flex max-w-pct-90 items-end gap-1.5">
      <AssistantAvatar />
      <div className="rounded-xl rounded-es-sm bg-card text-card-foreground px-3 py-2 shadow-sm ring-1 ring-border/30">
        {generatingQuiz ? (
          <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            {t("panel.generatingQuiz")}
          </span>
        ) : (
          <span className="flex h-4 items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" aria-hidden="true" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce delay-150" aria-hidden="true" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce delay-300" aria-hidden="true" />
            <span className="sr-only">{t("messageList.thinking")}</span>
          </span>
        )}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => {
  const { t } = useTranslation("chatFeatureB");
  const { chatbotSettings } = useChatbotContext();
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <AssistantAvatar className="h-10 w-10" />
      <p className="text-sm font-semibold text-foreground">
        {t("messageList.emptyTitle", { assistantName: chatbotSettings.assistant_name })}
      </p>
      <p className="text-caption text-muted-foreground">{t("messageList.emptySubtitle")}</p>
      <div className="mt-2 w-full">
        <ChatSuggestions centered />
      </div>
    </div>
  );
};

/**
 * The conversation, shared by the desktop side panel and the mobile panel:
 * messages (text, quiz, quiz feedback, cards), the live streamed reply, the
 * thinking/tool indicators, and offline / error / ended notices.
 */
export const ChatMessageList: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation("chatFeatureB");
  const {
    messages,
    isLoading,
    aiStatus,
    isInitializing,
    isOffline,
    isStreaming,
    streamingContent,
    activeToolCall,
    hasError,
    isCreditsExhausted,
    isSessionClosed,
    reconnectStream,
    startNewChat,
    chatbotSettings,
  } = useChatbotContext();

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const nearBottomRef = useRef(true);
  const frameRef = useRef<number | null>(null);
  const lastSeenIdRef = useRef<number | undefined>(undefined);

  // The scroll container is Radix's viewport inside ScrollArea.
  useEffect(() => {
    const viewport = rootRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? null;
    viewportRef.current = viewport;
    if (!viewport) return;
    const onScroll = () => {
      nearBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= NEAR_BOTTOM_PX;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.scrollTop = viewport.scrollHeight;
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // One instant jump per frame at most: streaming re-renders on every token,
  // and a smooth scroll per token fights itself and the learner.
  const scrollToBottom = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
  }, []);

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    !isStreaming && (isLoading || aiStatus === "thinking" || aiStatus === "generating_quiz");

  useEffect(() => {
    if (lastMessage && lastMessage.id !== lastSeenIdRef.current) {
      lastSeenIdRef.current = lastMessage.id;
      // The learner's own message always brings the view back down.
      if (lastMessage.role === "user") nearBottomRef.current = true;
    }
    if (nearBottomRef.current) scrollToBottom();
  }, [
    lastMessage,
    messages.length,
    streamingContent,
    activeToolCall,
    showThinking,
    hasError,
    isSessionClosed,
    isCreditsExhausted,
    scrollToBottom,
  ]);

  // Screen readers hear each finished reply once (not every streamed token,
  // and not the history that was on screen when the panel opened).
  const [announcement, setAnnouncement] = useState("");
  const announcedIdRef = useRef<number | undefined>(lastMessage?.id);
  useEffect(() => {
    if (!lastMessage || lastMessage.role === "user" || lastMessage.id === announcedIdRef.current) return;
    announcedIdRef.current = lastMessage.id;
    const text = toSpeech(lastMessage);
    if (text) setAnnouncement(`${chatbotSettings.assistant_name}: ${text}`);
  }, [lastMessage, chatbotSettings.assistant_name]);

  const isEmpty = messages.length === 0 && !isInitializing && !isStreaming && !hasError && !isCreditsExhausted;

  return (
    <div ref={rootRef} className={cn("flex-1 min-h-0 overflow-hidden", className)}>
      <ScrollArea className="h-full px-2 py-2 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0">
        <div className="flex flex-col gap-2.5" role="region" aria-label={t("messageList.ariaLabel")}>
          {isOffline && (
            <div className="flex items-center gap-2 rounded-md bg-warning-50 px-3 py-1.5 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">
              <WifiSlash className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t("panel.offlineNotice")}</span>
            </div>
          )}

          {isInitializing && messages.length === 0 && (
            <div className="w-full rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span>{t("panel.initializing")}</span>
              </div>
            </div>
          )}

          {isEmpty && <EmptyState />}

          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} />
          ))}

          {isStreaming && streamingContent && (
            <MessageBubble role="assistant" content={streamingContent} streaming />
          )}

          <AnimatePresence>{activeToolCall && <ToolIndicator toolName={activeToolCall} />}</AnimatePresence>

          {showThinking && <ThinkingIndicator generatingQuiz={aiStatus === "generating_quiz"} />}

          {isCreditsExhausted && (
            <div className="w-full rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-center text-xs text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300">
              {t("common.creditsExhausted")}
            </div>
          )}

          {hasError && !isCreditsExhausted && (
            <div role="alert" className="w-full space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center">
              <p className="text-xs text-destructive">{t("panel.errorTitle")}</p>
              <div className="flex justify-center gap-3">
                <button type="button" onClick={reconnectStream} className="text-xs text-primary underline hover:text-primary/80">
                  {t("common.retry")}
                </button>
                <button type="button" onClick={startNewChat} className="text-xs text-muted-foreground underline hover:text-foreground">
                  {t("common.newChat")}
                </button>
              </div>
            </div>
          )}

          {isSessionClosed && (
            <div className="w-full rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-center">
              <p className="text-xs text-muted-foreground">{t("sidePanel.sessionEnded")}</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
