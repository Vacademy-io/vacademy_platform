import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChatCircle, ClockCounterClockwise, Plus, SpinnerGap } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatSessionSummary } from "@/services/chatbot-api";
import { useChatbotContext } from "./useChatbotContext";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The server sends UTC timestamps, sometimes without the trailing "Z". */
const parseUtc = (iso: string | null): number | null => {
  if (!iso) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const ms = new Date(hasZone ? iso : `${iso}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/** "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", then a short date. */
const relativeTime = (iso: string | null, t: TFunction, language: string): string => {
  const ms = parseUtc(iso);
  if (ms === null) return "";
  const diff = Math.max(0, Date.now() - ms);
  if (diff < MINUTE) return t("history.justNow");
  if (diff < HOUR) return t("history.minutesAgo", { n: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t("history.hoursAgo", { n: Math.floor(diff / HOUR) });
  if (diff < 2 * DAY) return t("history.yesterday");
  if (diff < 7 * DAY) return t("history.daysAgo", { n: Math.floor(diff / DAY) });
  return new Date(ms).toLocaleDateString(language, { day: "numeric", month: "short" });
};

type LoadState = "loading" | "ready" | "error";

interface ChatHistoryPanelProps {
  /** Return to the conversation (after opening a chat, starting one, or Back). */
  onDone: () => void;
  className?: string;
}

/**
 * The learner's past chats, shown in place of the message list by both chat
 * panels: "New chat" on top, then each chat (title, when, how many questions),
 * the open one highlighted. Choosing one reopens it.
 */
export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ onDone, className }) => {
  const { t, i18n } = useTranslation("chatFeatureB");
  const { sessions, loadSessions, openSession, startNewChat, sessionId } = useChatbotContext();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const newChatRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    setLoadState("loading");
    loadSessions()
      .then(() => mountedRef.current && setLoadState("ready"))
      .catch((error) => {
        console.error("[chatbot] could not load past chats:", error);
        if (mountedRef.current) setLoadState("error");
      });
  }, [loadSessions]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    // Keyboard users land on the first action of the view they just opened.
    newChatRef.current?.focus();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const handleOpen = async (id: string) => {
    if (openingId) return;
    setOpenFailed(false);
    setOpeningId(id);
    const opened = await openSession(id);
    if (!mountedRef.current) return;
    setOpeningId(null);
    if (opened) onDone();
    else setOpenFailed(true);
  };

  const handleNewChat = () => {
    onDone();
    startNewChat();
  };

  // Keep showing the last list while it refreshes.
  const showSpinner = loadState === "loading" && sessions.length === 0;
  const showError = loadState === "error" && sessions.length === 0;
  const showEmpty = loadState === "ready" && sessions.length === 0;

  return (
    <div className={cn("flex flex-1 min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border/40 px-2.5 py-2 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDone}
          aria-label={t("history.back")}
          title={t("history.back")}
          className="h-8 w-8 shrink-0 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <h2 className="flex-1 truncate text-sm font-semibold text-foreground">{t("history.title")}</h2>
        <Button
          ref={newChatRef}
          type="button"
          size="sm"
          onClick={handleNewChat}
          className="h-8 shrink-0 gap-1 rounded-lg px-2.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common.newChat")}
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 [&>[data-radix-scroll-area-viewport]>div]:!block">
        <div className="flex flex-col gap-1 p-2">
          {openFailed && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t("history.openError")}
            </p>
          )}

          {showSpinner && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground" role="status">
              <SpinnerGap className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("history.loading")}
            </div>
          )}

          {showError && (
            <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-xs text-destructive">{t("history.loadError")}</p>
              <button
                type="button"
                onClick={refresh}
                className="text-xs text-primary underline hover:text-primary/80"
              >
                {t("common.retry")}
              </button>
            </div>
          )}

          {showEmpty && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClockCounterClockwise className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{t("history.empty")}</p>
              <p className="text-caption text-muted-foreground">{t("history.emptyHint")}</p>
            </div>
          )}

          {sessions.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label={t("history.listLabel")}>
              {sessions.map((chat: ChatSessionSummary) => {
                const isCurrent = chat.session_id === sessionId;
                const isOpening = openingId === chat.session_id;
                const when = relativeTime(chat.last_active, t, i18n.language);
                return (
                  <li key={chat.session_id}>
                    <button
                      type="button"
                      onClick={() => handleOpen(chat.session_id)}
                      disabled={!!openingId && !isOpening}
                      aria-current={isCurrent ? "true" : undefined}
                      aria-busy={isOpening || undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                        isCurrent && "bg-primary/10 ring-1 ring-primary/30 hover:bg-primary/15",
                      )}
                    >
                      {isOpening ? (
                        <SpinnerGap className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
                      ) : (
                        <ChatCircle
                          className={cn("mt-0.5 h-4 w-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground")}
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-foreground">
                            {chat.title?.trim() || t("history.untitled")}
                          </span>
                          {isCurrent && (
                            <span className="shrink-0 rounded-full bg-primary px-1.5 text-caption font-medium text-primary-foreground">
                              {t("history.current")}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                          {when && `${when} · `}
                          {t("history.questions", { count: chat.question_count })}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

/** Header button that switches a chat panel between the conversation and past chats. */
export const ChatHistoryToggle: React.FC<{
  active: boolean;
  onToggle: () => void;
  className?: string;
  iconClassName?: string;
}> = ({ active, onToggle, className, iconClassName }) => {
  const { t } = useTranslation("chatFeatureB");
  const label = t("history.open");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(className, active && "bg-primary-foreground/20")}
      onClick={(e) => {
        // The mobile panel's header is a drag handle.
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <ClockCounterClockwise className={iconClassName} aria-hidden="true" />
    </Button>
  );
};
