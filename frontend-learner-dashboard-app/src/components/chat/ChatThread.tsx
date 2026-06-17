import { useEffect, useRef } from "react";
import { ArrowClockwise, Trash, X } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ChatConversationResponse,
  ChatMessageResponse,
} from "@/services/chat/chatApi";
import {
  dayKey,
  dayLabel,
  timeLabel,
  initialsOf,
  isImageAttachment,
} from "./chatUtils";

/** A message augmented with optimistic-send bookkeeping. */
export interface UiChatMessage extends ChatMessageResponse {
  clientDedupKey?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface ChatThreadProps {
  conversation: ChatConversationResponse;
  messages: UiChatMessage[];
  currentUserId: string;
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Re-send a failed optimistic message (reuses its clientDedupKey). */
  onRetry?: (message: UiChatMessage) => void;
  /** Remove an abandoned failed optimistic row from the thread. */
  onDismissFailed?: (message: UiChatMessage) => void;
  /** Soft-delete one of the user's own messages. */
  onDelete?: (message: UiChatMessage) => void;
}

/** Show sender names for multi-party threads (groups / community), not DMs. */
function showsSenderNames(type: ChatConversationResponse["type"]): boolean {
  return type === "BATCH_GROUP" || type === "COMMUNITY";
}

export function ChatThread({
  conversation,
  messages,
  currentUserId,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onRetry,
  onDismissFailed,
  onDelete,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastSeqRef = useRef<number | null>(null);

  // Auto-scroll to the newest message when a new one arrives at the tail.
  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastSeq = last?.seq ?? null;
    if (lastSeq !== lastSeqRef.current) {
      lastSeqRef.current = lastSeq;
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  const withNames = showsSenderNames(conversation.type);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 overflow-hidden p-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
          >
            <Skeleton className="h-12 w-48 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-caption text-muted-foreground">
          No messages yet. Say hello to get the conversation started.
        </p>
      </div>
    );
  }

  let lastDay = "";
  let lastSenderId: string | null = null;

  return (
    <div
      role="log"
      aria-live="polite"
      className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
    >
      {hasMore && (
        <div className="mb-3 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load earlier messages"}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          const key = dayKey(msg.createdAt);
          const showDay = key !== lastDay;
          if (showDay) lastDay = key;

          // Group consecutive bubbles from the same sender: only show the
          // sender name on the first of a run (and only in group threads).
          const showName =
            withNames && !isOwn && (showDay || msg.senderId !== lastSenderId);
          lastSenderId = msg.senderId;

          const hasImage = isImageAttachment(msg.attachmentMime, msg.attachmentUrl);
          const isTombstoned = msg.isDeleted === true;
          const canDelete =
            isOwn && !isTombstoned && !msg.pending && !msg.failed && !!onDelete;

          return (
            <div key={msg.id} className="flex flex-col">
              {showDay && (
                <div className="my-2 flex items-center justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-caption font-medium text-muted-foreground">
                    {dayLabel(msg.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "flex gap-2",
                    "max-w-[78%]", // design-lint-ignore: bubble width is a viewport-relative % with no token equivalent
                    isOwn && "flex-row-reverse",
                  )}
                >
                  {withNames && !isOwn && (
                    <span
                      aria-hidden
                      className={cn(
                        "mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-500",
                        !showName && "invisible",
                      )}
                    >
                      {initialsOf(msg.senderName)}
                    </span>
                  )}

                  <div className="group/msg min-w-0">
                    {showName && (
                      <span className="mb-0.5 block px-1 text-caption font-medium text-muted-foreground">
                        {msg.senderName || "Member"}
                      </span>
                    )}

                    {isTombstoned ? (
                      <div className="rounded-2xl border border-dashed border-border px-3 py-2 text-body italic text-muted-foreground">
                        This message was deleted
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "relative rounded-2xl px-3 py-2 text-body",
                          isOwn
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted text-foreground",
                          msg.failed && "opacity-70 ring-1 ring-destructive",
                        )}
                      >
                        {canDelete && (
                          <button
                            type="button"
                            aria-label="Delete message"
                            onClick={() => onDelete?.(msg)}
                            className={cn(
                              "absolute -left-8 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm transition-opacity hover:bg-muted",
                              "opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100",
                            )}
                          >
                            <Trash size={15} />
                          </button>
                        )}

                        {hasImage && msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-1 block"
                          >
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName || "attachment"}
                              className="max-h-64 w-full rounded-lg object-cover"
                            />
                          </a>
                        )}

                        {!hasImage && msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-1 block truncate underline"
                          >
                            {msg.attachmentName || "Attachment"}
                          </a>
                        )}

                        {msg.content && (
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}

                        {msg.failed ? (
                          <span
                            aria-label="Message failed to send"
                            className="mt-1 flex items-center justify-end gap-2 text-3xs leading-none"
                          >
                            <button
                              type="button"
                              onClick={() => onRetry?.(msg)}
                              className={cn(
                                "flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium underline-offset-2 hover:underline",
                                isOwn
                                  ? "text-primary-foreground"
                                  : "text-destructive",
                              )}
                            >
                              <ArrowClockwise size={12} />
                              Retry
                            </button>
                            {onDismissFailed && (
                              <button
                                type="button"
                                aria-label="Dismiss failed message"
                                onClick={() => onDismissFailed(msg)}
                                className={cn(
                                  "flex items-center rounded-md p-0.5 hover:opacity-80",
                                  isOwn
                                    ? "text-primary-foreground/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </span>
                        ) : (
                          <span
                            aria-label={msg.pending ? "Sending message" : undefined}
                            className={cn(
                              "mt-0.5 block text-right text-3xs leading-none",
                              isOwn
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {msg.pending ? "Sending…" : timeLabel(msg.createdAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
