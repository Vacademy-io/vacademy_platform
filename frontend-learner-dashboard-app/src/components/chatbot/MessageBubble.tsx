import React from "react";
import { Copy, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "@/styles/katex-dark.css";
import type { ChatMessage } from "./types";

export interface MessageBubbleProps {
  /** The chat message to render (user or assistant role). */
  message: ChatMessage;
  /** Chatbot settings — used for assistant name / initials. */
  chatbotSettings: { assistant_name: string };
  /** Callback to copy assistant message content. */
  onCopy: (content: string, id: number) => void;
  /** The id of the message whose "copied" indicator is currently showing. */
  copiedId: number | null;
  /** Optional avatar URL for the assistant. */
  avatarUrl?: string;
}

/**
 * Shared markdown component overrides used for assistant messages.
 * Kept as a stable reference to avoid unnecessary re-renders.
 */
const markdownComponents = {
  h1: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-2xl font-bold mt-4 mb-3" {...props} />
  ),
  h2: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-xl font-bold mt-3 mb-2" {...props} />
  ),
  h3: ({ ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-lg font-semibold mt-3 mb-2" {...props} />
  ),
  p: ({ ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-sm leading-6 mb-3" {...props} />
  ),
  a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-primary underline hover:text-primary/80"
      {...props}
    />
  ),
  ul: ({ ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="list-disc list-inside mb-3 space-y-1 text-sm"
      {...props}
    />
  ),
  ol: ({ ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="list-decimal list-inside mb-3 space-y-1 text-sm"
      {...props}
    />
  ),
  li: ({ ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="ml-2" {...props} />
  ),
  code: ({
    children,
    className,
    ...rest
  }: React.HTMLAttributes<HTMLElement>) => {
    const isInline = !className?.includes("language-");
    return isInline ? (
      <code
        className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
        {...rest}
      >
        {children}
      </code>
    ) : (
      <code
        className="block bg-muted p-2 rounded-lg text-xs font-mono mb-3 overflow-x-auto"
        {...rest}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ ...props }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-primary pl-3 py-1 my-3 italic text-muted-foreground text-sm"
      {...props}
    />
  ),
};

/**
 * Renders a single chat message bubble.
 *
 * Handles:
 * - User messages (primary color, right-aligned) with optional image attachments
 * - Assistant messages (card color, left-aligned with avatar) with full Markdown + LaTeX
 * - Copy button on hover for assistant messages
 *
 * NOTE / TODO: Quiz messages (role === "quiz") and quiz feedback (role === "quiz_feedback")
 * are NOT handled here because they require the `submitQuiz` callback from the chat context.
 * Those should continue to be rendered inline in ChatbotPanel / ChatbotSidePanel until
 * a shared quiz-message wrapper is created.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message: msg,
  chatbotSettings,
  onCopy,
  copiedId,
  avatarUrl,
}) => {
  const isUser = msg.role === "user";
  const isAssistant = msg.role === "assistant";

  return (
    <div
      className={cn(
        "flex w-full max-w-[92%]",
        isUser ? "ml-auto justify-end" : "mr-auto justify-start",
      )}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <Avatar className="h-6 w-6 mr-1.5 mt-0.5 shrink-0 ring-1 ring-border/40">
          {avatarUrl ? (
            <AvatarImage
              src={avatarUrl}
              alt={chatbotSettings.assistant_name}
              className="object-cover"
            />
          ) : null}
          <AvatarFallback className="text-primary font-bold text-[10px] bg-muted">
            {chatbotSettings.assistant_name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="flex items-end gap-1">
        <div
          className={cn(
            "rounded-xl px-2.5 py-1.5 text-[13px] break-words max-w-full leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
              : "bg-card text-card-foreground rounded-bl-sm shadow-sm ring-1 ring-border/30",
          )}
        >
          {isUser ? (
            <div>
              {/* User-attached images rendered above the text */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex gap-1 mb-1.5">
                  {msg.attachments.map((att, i) => (
                    <img
                      key={i}
                      src={att.url}
                      alt={att.name || "attachment"}
                      className="max-w-[120px] max-h-[80px] rounded object-cover"
                    />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ) : (
            <div className="max-w-none group relative">
              {/* Copy button — visible on hover */}
              <button
                className="absolute -top-0.5 -right-0.5 p-1 rounded-md bg-muted/80 shrink-0 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={() => onCopy(msg.content, msg.id)}
                title="Copy"
              >
                {copiedId === msg.id ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3 text-muted-foreground" />
                )}
              </button>

              <ReactMarkdown
                components={markdownComponents}
                rehypePlugins={[rehypeKatex]}
                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
