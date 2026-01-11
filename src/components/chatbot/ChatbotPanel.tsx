import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Send,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
} from "lucide-react";
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
import { useChatbotContext } from "./useChatbotContext";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Check } from "phosphor-react";
import { avatarUrl } from "@/services/chatbot-settings";

interface ChatbotPanelProps {
  onOpenChange?: (isOpen: boolean) => void;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ onOpenChange }) => {
  const {
    isOpen,
    setIsOpen,
    messages,
    isLoading,
    aiStatus,
    inputValue,
    setInputValue,
    sendMessage,
    startNewChat,
    closeSession,
    shouldShowChatbot,
    messagesEndRef,
    chatbotSettings,
    instituteName,
    hasError,
    isSessionClosed,
    isInitializing,
    sessionId,
  } = useChatbotContext();

  const [panelWidth, setPanelWidth] = useState(400); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      // Set min width of 300px and max width of 90vw
      if (newWidth >= 300 && newWidth <= window.innerWidth * 0.9) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  if (!shouldShowChatbot()) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
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

  return (
    <>
      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-[10000]"
              onClick={() => setIsOpen(false)}
            />

            {/* Chat Panel */}
            <motion.div
              ref={panelRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              style={isFullScreen ? {} : { width: `${panelWidth}px` }}
              className={cn(
                "fixed top-0 right-0 h-screen z-[10001] flex flex-col bg-background border-l border-border shadow-2xl",
                isFullScreen && "left-0 w-full"
              )}
            >
              {/* Resizable edge - drag to resize (hidden in fullscreen) */}
              {!isFullScreen && (
                <div
                  ref={resizeRef}
                  onMouseDown={() => setIsResizing(true)}
                  className={cn(
                    "absolute left-0 top-0 w-1 h-full cursor-col-resize bg-border hover:bg-primary/50 transition-colors",
                    isResizing && "bg-primary"
                  )}
                />
              )}

              {/* Header */}
              <CardHeader className="bg-primary text-primary-foreground px-4 py-3 flex flex-row items-center justify-between space-y-0 border-b shrink-0">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 bg-background shrink-0">
                    {avatarUrl ? (
                      <AvatarImage
                        src={avatarUrl}
                        alt={chatbotSettings.assistant_name}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="text-primary font-bold">
                      {chatbotSettings.assistant_name
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold truncate">
                      {chatbotSettings.assistant_name}
                    </CardTitle>
                    <p className="text-xs text-primary-foreground/80 truncate">
                      {instituteName}
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center space-x-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={startNewChat}
                    title="Start new chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={closeSession}
                    title="Close session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    title={isFullScreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isFullScreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={() => setIsOpen(false)}
                    title="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages Area */}
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="flex flex-col space-y-4">
                    {isInitializing && messages.length === 0 && (
                      <div className="w-full bg-muted/50 border border-muted-foreground/20 rounded-lg px-4 py-2 text-center text-sm text-muted-foreground">
                        Initialising chat...
                      </div>
                    )}

                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex w-full max-w-[90%]",
                          msg.role === "user"
                            ? "ml-auto justify-end"
                            : "mr-auto justify-start"
                        )}
                      >
                        {msg.role === "assistant" && (
                          <Avatar className="h-8 w-8 mr-2 mt-1 shrink-0">
                            {avatarUrl ? (
                              <AvatarImage
                                src={avatarUrl}
                                alt={chatbotSettings.assistant_name}
                                className="object-cover"
                              />
                            ) : null}
                            <AvatarFallback className="text-primary font-bold">
                              {chatbotSettings.assistant_name
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex items-end gap-2">
                          <div
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm break-words",
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {msg.role === "user" ? (
                              <p className="whitespace-pre-wrap">
                                {msg.content}
                              </p>
                            ) : (
                              <div className="max-w-none group">
                                <button
                                  className="shrink-0 hover:text-muted-foreground float-right group-hover:opacity-100 opacity-0 transition-opacity"
                                  onClick={() =>
                                    handleCopyMessage(msg.content, msg.id)
                                  }
                                  title="Copy message"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <Check className="size-4 text-green-600" />
                                  ) : (
                                    <Copy className="size-4" />
                                  )}
                                </button>

                                <ReactMarkdown
                                  components={{
                                    h1: ({ ...props }) => (
                                      <h1
                                        className="text-3xl font-bold mt-6 mb-4"
                                        {...props}
                                      />
                                    ),
                                    h2: ({ ...props }) => (
                                      <h2
                                        className="text-2xl font-bold mt-5 mb-3"
                                        {...props}
                                      />
                                    ),
                                    h3: ({ ...props }) => (
                                      <h3
                                        className="text-xl font-semibold mt-4 mb-2"
                                        {...props}
                                      />
                                    ),
                                    p: ({ ...props }) => (
                                      <p
                                        className="text-base leading-7 mb-4"
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
                                        className="list-disc list-inside mb-4 space-y-2"
                                        {...props}
                                      />
                                    ),
                                    ol: ({ ...props }) => (
                                      <ol
                                        className="list-decimal list-inside mb-4 space-y-2"
                                        {...props}
                                      />
                                    ),
                                    li: ({ ...props }) => (
                                      <li className="ml-2" {...props} />
                                    ),
                                    code: (({
                                      inline,
                                      ...props
                                    }: {
                                      inline?: boolean;
                                      children?: React.ReactNode;
                                      [key: string]: unknown;
                                    }) => {
                                      return inline ? (
                                        <code
                                          className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                                          {...(props as React.HTMLAttributes<HTMLElement>)}
                                        />
                                      ) : (
                                        <code
                                          className="block bg-muted p-3 rounded-lg text-sm font-mono mb-4 overflow-x-auto"
                                          {...(props as React.HTMLAttributes<HTMLElement>)}
                                        />
                                      );
                                    }) as unknown as React.ComponentType<{
                                      inline?: boolean;
                                      children?: React.ReactNode;
                                      [key: string]: unknown;
                                    }>,
                                    blockquote: ({ ...props }) => (
                                      <blockquote
                                        className="border-l-4 border-primary pl-4 py-2 my-4 italic text-muted-foreground"
                                        {...props}
                                      />
                                    ),
                                  }}
                                  rehypePlugins={[remarkGfm]}
                                  remarkPlugins={[remarkBreaks]}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {(isLoading || aiStatus === "thinking") && (
                      <div className="mr-auto flex max-w-[80%] items-end space-x-2">
                        <Avatar className="h-8 w-8 mr-2 shrink-0">
                          {avatarUrl ? (
                            <AvatarImage
                              src={avatarUrl}
                              alt={chatbotSettings.assistant_name}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className="text-primary font-bold">
                            {chatbotSettings.assistant_name
                              .substring(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                          <div className="flex space-x-1 items-center h-4">
                            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                            <div
                              className="h-2 w-2 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            />
                            <div
                              className="h-2 w-2 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {hasError && (
                      <div className="w-full bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2 text-center text-sm text-destructive">
                        An error occurred, please start new
                      </div>
                    )}

                    {isSessionClosed && (
                      <div className="w-full bg-muted/50 border border-muted-foreground/20 rounded-lg px-4 py-2 text-center text-sm text-muted-foreground">
                        This chat has ended
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Input Area */}
              <CardFooter className="border-t p-3 shrink-0 gap-2">
                <Input
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!sessionId || isLoading}
                  className="text-sm h-10"
                />
                <Button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </CardFooter>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
