import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  X,
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  Settings,
  Lightbulb,
  FileQuestion,
  BookOpen,
  MessageSquareQuote,
  Repeat,
  HelpCircle,
  GripVertical,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatbotContext } from "./useChatbotContext";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "@/styles/katex-dark.css";
import { avatarUrl } from "@/services/chatbot-settings";
import { QuizComponent } from "./QuizComponent";
import { QuizFeedbackComponent } from "./QuizFeedbackComponent";
import { useChatbotPanelStore } from "@/stores/chatbot/useChatbotPanelStore";
import { MessageIntent } from "@/services/chatbot-api";
import { AnimatePresence } from "framer-motion";
import { ToolIndicator } from "./ToolIndicator";

// Context-aware quick action suggestions
const getQuickActions = (
  pathname: string,
): {
  label: string;
  icon: React.ElementType;
  prompt: string;
  intent?: MessageIntent;
}[] => {
  // Slide/content pages
  if (pathname.includes("/slides") || pathname.includes("/content")) {
    return [
      {
        label: "Explain this",
        icon: Lightbulb,
        prompt: "Explain what's on this slide in simple terms",
        intent: "doubt",
      },
      {
        label: "Quiz me",
        icon: FileQuestion,
        prompt: "Create a quick quiz based on this content",
        intent: "practice",
      },
      {
        label: "Summarize",
        icon: BookOpen,
        prompt: "Give me a brief summary of this slide",
        intent: "general",
      },
    ];
  }

  // Course details page
  if (pathname.includes("/courses/") || pathname.includes("/course-details")) {
    return [
      {
        label: "Course overview",
        icon: BookOpen,
        prompt: "Give me an overview of this course",
        intent: "general",
      },
      {
        label: "Learning path",
        icon: Repeat,
        prompt: "What's the recommended learning path for this course?",
        intent: "general",
      },
      {
        label: "Prerequisites",
        icon: HelpCircle,
        prompt: "What are the prerequisites for this course?",
        intent: "doubt",
      },
    ];
  }

  // Assessment/quiz pages
  if (pathname.includes("/assessment") || pathname.includes("/quiz")) {
    return [
      {
        label: "Hint",
        icon: Lightbulb,
        prompt: "Give me a hint for this question without revealing the answer",
        intent: "doubt",
      },
      {
        label: "Explain concept",
        icon: MessageSquareQuote,
        prompt: "Explain the concept being tested in this question",
        intent: "doubt",
      },
    ];
  }

  // Default/general suggestions
  return [
    {
      label: "Help me learn",
      icon: Lightbulb,
      prompt: "What should I learn today?",
      intent: "general",
    },
    {
      label: "Ask a doubt",
      icon: HelpCircle,
      prompt: "I have a question about ",
      intent: "doubt",
    },
    {
      label: "Practice",
      icon: FileQuestion,
      prompt: "I want to practice",
      intent: "practice",
    },
  ];
};

export const ChatbotSidePanel: React.FC = () => {
  const location = useLocation();
  const {
    isOpen,
    messages,
    isLoading,
    aiStatus,
    inputValue,
    setInputValue,
    sendMessage,
    submitQuiz,
    startNewChat,
    closeSession,
    messagesEndRef,
    chatbotSettings,
    instituteName,
    hasError,
    isCreditsExhausted,
    isSessionClosed,
    isInitializing,
    sessionId,
    setIsOpen,
    shouldShowChatbot,
    activeToolCall,
    streamingContent,
    isStreaming,
  } = useChatbotContext();

  const {
    panelWidth,
    setPanelWidth,
    setIsOpen: setStorePanelOpen,
  } = useChatbotPanelStore();

  // Get context-aware quick actions
  const quickActions = getQuickActions(location.pathname);

  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedIntent, setSelectedIntent] =
    useState<MessageIntent>("general");
  const resizeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(newWidth);
    },
    [isResizing, setPanelWidth],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Sync store isOpen with context isOpen
  useEffect(() => {
    setStorePanelOpen(isOpen);
  }, [isOpen, setStorePanelOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue, selectedIntent);
    }
  };

  const handleCopyMessage = (content: string, messageId: number) => {
    setCopiedMessageId(messageId);
    navigator.clipboard.writeText(content).catch((err) => {
      console.error("Could not copy text: ", err);
    });
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setStorePanelOpen(false);
  };

  if (!isOpen || !shouldShowChatbot()) return null;

  return (
    <div
      ref={panelRef}
      style={{ width: panelWidth }}
      className="h-full flex flex-col bg-background/95 backdrop-blur-sm border-l border-border/50 relative shrink-0 shadow-xl"
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10",
          "hover:bg-primary/20 transition-colors",
          isResizing && "bg-primary/30",
        )}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 flex items-center justify-center -ml-1.5 opacity-0 hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground px-3 py-2 flex flex-row items-center justify-between space-y-0 border-b border-primary/20 shrink-0">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Avatar className="h-7 w-7 bg-background ring-1 ring-primary-foreground/20 shrink-0">
            {avatarUrl ? (
              <AvatarImage
                src={avatarUrl}
                alt={chatbotSettings.assistant_name}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="text-primary font-bold text-xs bg-primary-foreground">
              {chatbotSettings.assistant_name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold tracking-tight truncate">
              {chatbotSettings.assistant_name}
            </CardTitle>
            <p className="text-[10px] text-primary-foreground/70 truncate">
              {instituteName}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center shrink-0 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={startNewChat}
            title="Start new chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
            onClick={closeSession}
            title="Close session"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Link to="/ai-settings">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground"
              title="AI Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-primary-foreground/80 hover:bg-destructive/80 hover:text-destructive-foreground"
            onClick={handleClose}
            title="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="flex-1 p-0 overflow-hidden bg-gradient-to-b from-muted/20 to-background">
        <ScrollArea className="h-full px-2.5 py-2">
          <div className="flex flex-col space-y-2.5">
            {isInitializing && messages.length === 0 && (
              <div className="w-full bg-muted/40 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span>Initializing...</span>
                </div>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.role === "quiz" && msg.metadata?.quiz_data) {
                return (
                  <div key={msg.id} className="w-full max-w-[95%] mr-auto">
                    <div className="flex gap-2">
                      <Avatar className="h-7 w-7 mt-1 shrink-0">
                        {avatarUrl ? (
                          <AvatarImage
                            src={avatarUrl}
                            alt={chatbotSettings.assistant_name}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="text-primary font-bold text-xs">
                          {chatbotSettings.assistant_name
                            .substring(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {msg.content && (
                          <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm mb-2 w-fit">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}
                        <QuizComponent
                          quizData={msg.metadata.quiz_data}
                          onSubmit={submitQuiz}
                          disabled={isSessionClosed}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (msg.role === "quiz_feedback" && msg.metadata?.feedback) {
                return (
                  <div key={msg.id} className="w-full max-w-[95%] mr-auto">
                    <div className="flex gap-2">
                      <Avatar className="h-7 w-7 mt-1 shrink-0">
                        {avatarUrl ? (
                          <AvatarImage
                            src={avatarUrl}
                            alt={chatbotSettings.assistant_name}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="text-primary font-bold text-xs">
                          {chatbotSettings.assistant_name
                            .substring(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <QuizFeedbackComponent
                          feedback={msg.metadata.feedback}
                          content={msg.content}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex w-full max-w-[92%]",
                    msg.role === "user"
                      ? "ml-auto justify-end"
                      : "mr-auto justify-start",
                  )}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="h-6 w-6 mr-1.5 mt-0.5 shrink-0 ring-1 ring-border/40">
                      {avatarUrl ? (
                        <AvatarImage
                          src={avatarUrl}
                          alt={chatbotSettings.assistant_name}
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback className="text-primary font-bold text-[10px] bg-muted">
                        {chatbotSettings.assistant_name
                          .substring(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex items-end gap-1">
                    <div
                      className={cn(
                        "rounded-xl px-2.5 py-1.5 text-[13px] break-words max-w-full leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                          : "bg-card text-card-foreground rounded-bl-sm shadow-sm ring-1 ring-border/30",
                      )}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="max-w-none group relative">
                          <button
                            className="absolute -top-0.5 -right-0.5 p-1 rounded-md bg-muted/80 shrink-0 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() =>
                              handleCopyMessage(msg.content, msg.id)
                            }
                            title="Copy"
                          >
                            {copiedMessageId === msg.id ? (
                              <Check className="size-3 text-green-500" />
                            ) : (
                              <Copy className="size-3 text-muted-foreground" />
                            )}
                          </button>

                          <ReactMarkdown
                            components={{
                              h1: ({ ...props }) => (
                                <h1
                                  className="text-2xl font-bold mt-4 mb-3"
                                  {...props}
                                />
                              ),
                              h2: ({ ...props }) => (
                                <h2
                                  className="text-xl font-bold mt-3 mb-2"
                                  {...props}
                                />
                              ),
                              h3: ({ ...props }) => (
                                <h3
                                  className="text-lg font-semibold mt-3 mb-2"
                                  {...props}
                                />
                              ),
                              p: ({ ...props }) => (
                                <p
                                  className="text-sm leading-6 mb-3"
                                  {...props}
                                />
                              ),
                              a: ({ ...props }) => (
                                <a
                                  className="text-primary underline hover:text-primary/80"
                                  {...props}
                                />
                              ),
                              ul: ({ ...props }) => (
                                <ul
                                  className="list-disc list-inside mb-3 space-y-1 text-sm"
                                  {...props}
                                />
                              ),
                              ol: ({ ...props }) => (
                                <ol
                                  className="list-decimal list-inside mb-3 space-y-1 text-sm"
                                  {...props}
                                />
                              ),
                              li: ({ ...props }) => (
                                <li className="ml-2" {...props} />
                              ),
                              code: ((props: {
                                inline?: boolean;
                                children?: React.ReactNode;
                                [key: string]: unknown;
                              }) => {
                                const { inline, ...rest } = props;
                                return inline ? (
                                  <code
                                    className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                                    {...(rest as React.HTMLAttributes<HTMLElement>)}
                                  />
                                ) : (
                                  <code
                                    className="block bg-muted p-2 rounded-lg text-xs font-mono mb-3 overflow-x-auto"
                                    {...(rest as React.HTMLAttributes<HTMLElement>)}
                                  />
                                );
                              }) as unknown as React.ComponentType<{
                                inline?: boolean;
                                children?: React.ReactNode;
                                [key: string]: unknown;
                              }>,
                              blockquote: ({ ...props }) => (
                                <blockquote
                                  className="border-l-4 border-primary pl-3 py-1 my-3 italic text-muted-foreground text-sm"
                                  {...props}
                                />
                              ),
                            }}
                            rehypePlugins={[rehypeKatex]}
                            remarkPlugins={[
                              remarkGfm,
                              remarkMath,
                              remarkBreaks,
                            ]}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Streaming response */}
            {isStreaming && streamingContent && (
              <div className="flex items-start gap-1.5 mr-auto max-w-[90%]">
                <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/40">
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
                <div className="rounded-xl rounded-bl-sm bg-card text-card-foreground px-2.5 py-1.5 shadow-sm ring-1 ring-border/30 text-[13px] leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkBreaks, remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {streamingContent}
                  </ReactMarkdown>
                  <span className="inline-block w-1.5 h-4 bg-foreground/60 animate-pulse ml-0.5" />
                </div>
              </div>
            )}

            <AnimatePresence>
              {activeToolCall && <ToolIndicator toolName={activeToolCall} />}
            </AnimatePresence>

            {!isStreaming && (isLoading ||
              aiStatus === "thinking" ||
              aiStatus === "generating_quiz") && (
              <div className="mr-auto flex max-w-[90%] items-end space-x-1.5">
                <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/40">
                  {avatarUrl ? (
                    <AvatarImage
                      src={avatarUrl}
                      alt={chatbotSettings.assistant_name}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="text-primary font-bold text-[10px] bg-muted">
                    {chatbotSettings.assistant_name
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-xl rounded-bl-sm bg-card text-card-foreground px-2.5 py-1.5 shadow-sm ring-1 ring-border/30">
                  <div className="flex space-x-1 items-center h-4">
                    {aiStatus === "generating_quiz" ? (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        Generating...
                      </span>
                    ) : (
                      <>
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                        <div
                          className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <div
                          className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                          style={{ animationDelay: "0.3s" }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isCreditsExhausted && (
              <div className="w-full bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-2 text-center">
                <p className="text-xs text-amber-800">
                  Your OpenRouter credits have been exhausted. Please recharge your credits to continue.
                </p>
              </div>
            )}

            {hasError && !isCreditsExhausted && (
              <div className="w-full bg-destructive/10 border border-destructive/30 rounded-lg px-2.5 py-1.5 text-center">
                <p className="text-xs text-destructive">
                  Something went wrong. Start a new chat.
                </p>
              </div>
            )}

            {isSessionClosed && (
              <div className="w-full bg-muted/40 border border-border/50 rounded-lg px-2.5 py-1.5 text-center">
                <p className="text-xs text-muted-foreground">
                  Session ended. Start a new chat.
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input Area */}
      <CardFooter className="border-t border-border/40 px-2.5 py-2 shrink-0 flex-col gap-2 bg-background">
        {/* Quick Action Chips - only show when no messages yet or input is empty */}
        {messages.length === 0 && !inputValue.trim() && (
          <div className="w-full flex flex-wrap gap-1.5">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  if (action.prompt.endsWith(" ")) {
                    setInputValue(action.prompt);
                  } else {
                    sendMessage(action.prompt, action.intent);
                  }
                }}
                disabled={isLoading || !sessionId}
                className="inline-flex items-center h-6 px-2.5 text-[11px] font-medium text-muted-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary rounded-full border border-transparent hover:border-primary/20 transition-colors disabled:opacity-50"
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Intent Selector Row */}
        <div className="w-full flex items-center gap-1.5 mb-0.5">
          <Select
            value={selectedIntent}
            onValueChange={(value) => setSelectedIntent(value as MessageIntent)}
          >
            <SelectTrigger className="w-auto h-6 text-[10px] px-2 rounded-md border-0 bg-muted/60 hover:bg-muted text-muted-foreground gap-1">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent className="z-[10006] min-w-[90px]">
              <SelectItem value="general" className="text-xs">
                General
              </SelectItem>
              <SelectItem value="doubt" className="text-xs">
                Doubt
              </SelectItem>
              <SelectItem value="practice" className="text-xs">
                Practice
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Modern Unified Input Box */}
        <div className="w-full flex items-center gap-2 bg-muted/40 rounded-xl p-1 ring-1 ring-border/50 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
          <Input
            placeholder="Ask a question..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!sessionId || isLoading}
            className="flex-1 h-8 px-3 text-[13px] bg-transparent border-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
          <Button
            onClick={() => sendMessage(inputValue, selectedIntent)}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0 rounded-lg transition-all",
              inputValue.trim()
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardFooter>
    </div>
  );
};
