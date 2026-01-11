import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Maximize2,
  Minimize2,
  Info,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChatbot } from "./useChatbot";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { avatarUrl } from "@/services/chatbot-settings";

const markdownComponents = {
  h1: ({ ...props }) => (
    <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />
  ),
  h2: ({ ...props }) => (
    <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />
  ),
  h3: ({ ...props }) => (
    <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />
  ),
  p: ({ ...props }) => <p className="text-base leading-7 mb-4" {...props} />,
  ul: ({ ...props }) => (
    <ul className="list-disc list-inside space-y-2 mb-4" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal list-inside space-y-2 mb-4" {...props} />
  ),
  li: ({ ...props }) => <li className="text-base" {...props} />,
  strong: ({ ...props }) => (
    <strong className="font-bold text-gray-900" {...props} />
  ),
  em: ({ ...props }) => <em className="italic text-gray-700" {...props} />,
  code: ({ inline, ...props }: { inline?: boolean }) =>
    inline ? (
      <code
        className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
        {...props}
      />
    ) : (
      <code
        className="block bg-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto mb-4"
        {...props}
      />
    ),
  blockquote: ({ ...props }) => (
    <blockquote
      className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4"
      {...props}
    />
  ),
  a: ({ ...props }) => (
    <a className="text-blue-600 hover:underline" {...props} />
  ),
};

export const ChatbotWidget = () => {
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
    shouldShowChatbot,
    messagesEndRef,
    chatbotSettings,
    instituteName,
    isExpanded,
    setIsExpanded,
    hasError,
    isSessionClosed,
    isInitializing,
  } = useChatbot();

  if (!shouldShowChatbot()) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[10002] flex flex-col items-end space-y-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "origin-bottom-right transition-all duration-300 ease-in-out",
              isExpanded
                ? "fixed bottom-24 right-6 w-[90vw] h-[80vh] z-[10003]"
                : "w-[350px] sm:w-[400px]"
            )}
          >
            <Card
              className={cn(
                "border-2 shadow-xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out bg-background",
                isExpanded ? "h-full w-full" : "h-[500px]"
              )}
            >
              <CardHeader className="bg-primary text-primary-foreground p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8 bg-background">
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
                  <div>
                    <CardTitle className="text-md font-bold">
                      {chatbotSettings.assistant_name}
                    </CardTitle>
                    <p className="text-xs text-primary-foreground/80">
                      {instituteName} AI Assistant
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={startNewChat}
                    title="Start new chat"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <Maximize2 className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>

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
                              "rounded-lg px-3 py-2 text-sm",
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {msg.role === "user" ? (
                              <p className="whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            ) : (
                              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-li:my-0">
                                <ReactMarkdown
                                  // @ts-expect-error : types issue with react-markdown
                                  components={markdownComponents}
                                  remarkPlugins={[remarkBreaks, remarkGfm]}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>

                          {/* Info Icon for Context - Using Popover for click interaction */}
                          {msg.role === "assistant" && msg.context && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity mb-1">
                                  <Info
                                    size={14}
                                    className="text-muted-foreground"
                                  />
                                </div>
                              </PopoverTrigger>
                              <PopoverContent
                                side="right"
                                className="max-w-[250px] text-xs p-2 z-[10005]"
                              >
                                <p className="font-bold mb-1">Context Used:</p>
                                <div className="space-y-1">
                                  <p>
                                    <span className="font-semibold">
                                      Route:
                                    </span>{" "}
                                    <span className="break-all">
                                      {msg.context.route}
                                    </span>
                                  </p>
                                  {msg.context.courseId && (
                                    <p>
                                      <span className="font-semibold">
                                        Course ID:
                                      </span>{" "}
                                      <span className="break-all">
                                        {msg.context.courseId}
                                      </span>
                                    </p>
                                  )}
                                  {msg.context.slideId && (
                                    <p>
                                      <span className="font-semibold">
                                        Slide ID:
                                      </span>{" "}
                                      <span className="break-all">
                                        {msg.context.slideId}
                                      </span>
                                    </p>
                                  )}
                                  {msg.context.moduleId && (
                                    <p>
                                      <span className="font-semibold">
                                        Module ID:
                                      </span>{" "}
                                      <span className="break-all">
                                        {msg.context.moduleId}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
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
                            <motion.div
                              className="h-2 w-2 bg-foreground/40 rounded-full"
                              animate={{ y: [0, -5, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0,
                              }}
                            />
                            <motion.div
                              className="h-2 w-2 bg-foreground/40 rounded-full"
                              animate={{ y: [0, -5, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.2,
                              }}
                            />
                            <motion.div
                              className="h-2 w-2 bg-foreground/40 rounded-full"
                              animate={{ y: [0, -5, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: 0.4,
                              }}
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

              <CardFooter className="p-3 bg-background border-t">
                <div className="flex w-full items-center space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="flex-1 focus-visible:ring-1"
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessage(inputValue)}
                    disabled={isLoading || !inputValue.trim()}
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl flex items-center justify-center focus:outline-none",
          isOpen
            ? "bg-primary text-primary-foreground"
            : avatarUrl
            ? "bg-transparent p-0"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Chat"
            className="w-full h-full object-cover rounded-full shadow-2xl"
          />
        ) : (
          <MessageCircle className="h-7 w-7" />
        )}
      </button>
    </div>
  );
};
