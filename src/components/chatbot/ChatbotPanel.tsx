import React, { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Send,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Settings,
  GripVertical,
  Lightbulb,
  FileQuestion,
  BookOpen,
  MessageSquareQuote,
  Repeat,
  HelpCircle,
  WifiOff,
  ImagePlus,
  Sigma,
  Loader2,
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
import { ToolIndicator } from "./ToolIndicator";
import { UploadFileInS3 } from "@/services/upload_file";
import { getPublicUrl } from "@/services/upload_file";
import { getUserId } from "@/constants/getUserId";

// Sound notification for new messages
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.warn("Could not play notification sound:", e);
  }
};

// Haptic feedback for mobile (uses Vibration API)
const triggerHapticFeedback = () => {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  } catch {
    // Haptic feedback not available
  }
};

import { MessageIntent } from "@/services/chatbot-api";

// ... existing imports

// Context-aware quick action suggestions
const getQuickActions = (pathname: string): { label: string; icon: React.ElementType; prompt: string; intent?: MessageIntent }[] => {
  // Slide/content pages
  if (pathname.includes("/slides") || pathname.includes("/content")) {
    return [
      { label: "Explain this", icon: Lightbulb, prompt: "Explain what's on this slide in simple terms", intent: "doubt" },
      { label: "Quiz me", icon: FileQuestion, prompt: "Create a quick quiz based on this content", intent: "practice" },
      { label: "Summarize", icon: BookOpen, prompt: "Give me a brief summary of this slide", intent: "general" },
    ];
  }
  
  // Course details page
  if (pathname.includes("/courses/") || pathname.includes("/course-details")) {
    return [
      { label: "Course overview", icon: BookOpen, prompt: "Give me an overview of this course", intent: "general" },
      { label: "Learning path", icon: Repeat, prompt: "What's the recommended learning path for this course?", intent: "general" },
      { label: "Prerequisites", icon: HelpCircle, prompt: "What are the prerequisites for this course?", intent: "doubt" },
    ];
  }
  
  // Assessment/quiz pages
  if (pathname.includes("/assessment") || pathname.includes("/quiz")) {
    return [
      { label: "Hint", icon: Lightbulb, prompt: "Give me a hint for this question without revealing the answer", intent: "doubt" },
      { label: "Explain concept", icon: MessageSquareQuote, prompt: "Explain the concept being tested in this question", intent: "doubt" },
    ];
  }
  
  // Default/general suggestions
  return [
    { label: "Help me learn", icon: Lightbulb, prompt: "What should I learn today?", intent: "general" },
    { label: "Ask a doubt", icon: HelpCircle, prompt: "I have a question about ", intent: "doubt" },
    { label: "Practice", icon: FileQuestion, prompt: "I want to practice", intent: "practice" },
  ];
};

interface ChatbotPanelProps {
  onOpenChange?: (isOpen: boolean) => void;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 520;

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ onOpenChange }) => {
  const location = useLocation();
  const {
    isOpen,
    setIsOpen,
    messages,
    isLoading,
    aiStatus,
    inputValue,
    setInputValue,
    sendMessage,
    submitQuiz,
    startNewChat,
    closeSession,
    shouldShowChatbot,
    messagesEndRef,
    chatbotSettings,
    instituteName,
    hasError,
    isCreditsExhausted,
    isSessionClosed,
    isInitializing,
    sessionId,
    activeToolCall,
    streamingContent,
    isStreaming,
    isOffline,
  } = useChatbotContext();

  // Check if the docked panel should be used - checking store AND route for immediate detection
  const { isDockedMode } = useChatbotPanelStore();
  // Always use docked mode on desktop - the floating panel is no longer needed
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const shouldUseDockedMode = isDockedMode || isDesktop;

  // Get context-aware quick actions
  const quickActions = getQuickActions(location.pathname);

  // Panel dimensions and position
  const [panelSize, setPanelSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Sound/Haptic feedback when new assistant message arrives
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        playNotificationSound();
        triggerHapticFeedback();
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);
  const [hasInitializedPosition, setHasInitializedPosition] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, panelX: 0, panelY: 0 });
  
  const [selectedIntent, setSelectedIntent] = useState<MessageIntent>("general");
  const [pendingAttachments, setPendingAttachments] = useState<Array<{type: string; url: string; name?: string; previewUrl?: string}>>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showLatexHelper, setShowLatexHelper] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop image handler
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const previewUrl = URL.createObjectURL(file);
    const tempIdx = pendingAttachments.length;
    setPendingAttachments(prev => [...prev, { type: 'image', url: '', name: file.name, previewUrl }]);
    setIsUploadingImage(true);
    try {
      const userId = await getUserId();
      const fileId = await UploadFileInS3(file, () => {}, userId || '', 'CHATBOT_IMAGES', 'LEARNER');
      if (fileId) {
        const publicUrl = await getPublicUrl(fileId);
        setPendingAttachments(prev => prev.map((att, i) =>
          i === tempIdx ? { ...att, url: publicUrl } : att
        ));
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setPendingAttachments(prev => prev.filter((_, i) => i !== tempIdx));
      URL.revokeObjectURL(previewUrl);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640; // sm breakpoint
      setIsMobile(mobile);
      if (mobile && isOpen) {
        setIsFullScreen(true);
      }
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [isOpen]);

  // Initialize panel position to center of screen
  useEffect(() => {
    if (isOpen && !hasInitializedPosition) {
      // On mobile, go fullscreen immediately
      if (window.innerWidth < 640) {
        setIsFullScreen(true);
        setPanelPosition({ x: 0, y: 0 });
      } else {
        // Calculate safe dimensions for current viewport
        const safeWidth = Math.min(DEFAULT_WIDTH, window.innerWidth - 40);
        const safeHeight = Math.min(DEFAULT_HEIGHT, window.innerHeight - 40);
        setPanelSize({ width: safeWidth, height: safeHeight });
        
        const x = Math.max(20, (window.innerWidth - safeWidth) / 2);
        const y = Math.max(20, (window.innerHeight - safeHeight) / 2);
        setPanelPosition({ x, y });
      }
      setHasInitializedPosition(true);
    }
  }, [isOpen, hasInitializedPosition]);

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isFullScreen) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: panelPosition.x,
      panelY: panelPosition.y,
    };
  }, [isFullScreen, panelPosition]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    const newX = Math.max(0, Math.min(window.innerWidth - panelSize.width, dragStartRef.current.panelX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - panelSize.height, dragStartRef.current.panelY + deltaY));
    
    setPanelPosition({ x: newX, y: newY });
  }, [isDragging, panelSize]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (isFullScreen) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelSize.width,
      height: panelSize.height,
      panelX: panelPosition.x,
      panelY: panelPosition.y,
    };
  }, [isFullScreen, panelSize, panelPosition]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeDirection) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newX = resizeStartRef.current.panelX;
    let newY = resizeStartRef.current.panelY;
    
    // Handle different resize directions
    if (resizeDirection.includes("e")) {
      newWidth = Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX);
    }
    if (resizeDirection.includes("w")) {
      const potentialWidth = resizeStartRef.current.width - deltaX;
      if (potentialWidth >= MIN_WIDTH) {
        newWidth = potentialWidth;
        newX = resizeStartRef.current.panelX + deltaX;
      }
    }
    if (resizeDirection.includes("s")) {
      newHeight = Math.max(MIN_HEIGHT, resizeStartRef.current.height + deltaY);
    }
    if (resizeDirection.includes("n")) {
      const potentialHeight = resizeStartRef.current.height - deltaY;
      if (potentialHeight >= MIN_HEIGHT) {
        newHeight = potentialHeight;
        newY = resizeStartRef.current.panelY + deltaY;
      }
    }
    
    // Constrain to viewport
    newWidth = Math.min(newWidth, window.innerWidth - newX);
    newHeight = Math.min(newHeight, window.innerHeight - newY);
    
    setPanelSize({ width: newWidth, height: newHeight });
    setPanelPosition({ x: newX, y: newY });
  }, [isResizing, resizeDirection]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd);
      document.body.style.userSelect = "none";
      return () => {
        document.removeEventListener("mousemove", handleDragMove);
        document.removeEventListener("mouseup", handleDragEnd);
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.userSelect = "none";
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Early return if chatbot should not be shown or if docked mode is active
  if (!shouldShowChatbot() || shouldUseDockedMode) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue, selectedIntent, pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setPendingAttachments([]);
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

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Resize handle component - only show on desktop
  const ResizeHandle = ({ direction, className }: { direction: string; className: string }) => {
    if (isMobile) return null;
    return (
      <div
        onMouseDown={(e) => handleResizeStart(e, direction)}
        className={cn(
          "absolute z-10 opacity-0 hover:opacity-100 transition-opacity",
          className,
          isResizing && resizeDirection === direction && "opacity-100"
        )}
      />
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>

            {/* Chat Panel - Floating Overlay */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={
                isFullScreen
                  ? { left: 0, top: 0, right: 0, bottom: 0, width: "100%", height: "100%" }
                  : {
                      left: panelPosition.x,
                      top: panelPosition.y,
                      width: panelSize.width,
                      height: panelSize.height,
                    }
              }
              className={cn(
                "fixed z-[10001] flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden",
                isDragging && "cursor-grabbing",
                isFullScreen && "rounded-none",
                isDragOver && "ring-2 ring-inset ring-primary/50"
              )}
              onDrop={handleFileDrop}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
            >
              {/* Drag overlay for image drop */}
              {isDragOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/5 backdrop-blur-[2px] pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <ImagePlus className="h-10 w-10" />
                    <span className="text-sm font-medium">Drop image here</span>
                  </div>
                </div>
              )}

              {/* Resize Handles (hidden in fullscreen) */}
              {!isFullScreen && (
                <>
                  {/* Corner handles */}
                  <ResizeHandle direction="nw" className="top-0 left-0 w-3 h-3 cursor-nwse-resize" />
                  <ResizeHandle direction="ne" className="top-0 right-0 w-3 h-3 cursor-nesw-resize" />
                  <ResizeHandle direction="sw" className="bottom-0 left-0 w-3 h-3 cursor-nesw-resize" />
                  <ResizeHandle direction="se" className="bottom-0 right-0 w-3 h-3 cursor-nwse-resize" />
                  {/* Edge handles */}
                  <ResizeHandle direction="n" className="top-0 left-3 right-3 h-1 cursor-ns-resize" />
                  <ResizeHandle direction="s" className="bottom-0 left-3 right-3 h-1 cursor-ns-resize" />
                  <ResizeHandle direction="w" className="left-0 top-3 bottom-3 w-1 cursor-ew-resize" />
                  <ResizeHandle direction="e" className="right-0 top-3 bottom-3 w-1 cursor-ew-resize" />
                </>
              )}

              {/* Header - Draggable */}
              <CardHeader
                onMouseDown={handleDragStart}
                className={cn(
                  "bg-primary text-primary-foreground px-3 py-2 flex flex-row items-center justify-between space-y-0 border-b shrink-0",
                  !isFullScreen && "cursor-grab",
                  isDragging && "cursor-grabbing"
                )}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {/* Drag indicator */}
                  {!isFullScreen && (
                    <GripVertical className="h-4 w-4 text-primary-foreground/60 shrink-0" />
                  )}
                  <Avatar className="h-7 w-7 bg-background shrink-0">
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
                <div className="flex items-center space-x-0.5 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={(e) => { e.stopPropagation(); startNewChat(); }}
                    title="Start new chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={(e) => { e.stopPropagation(); closeSession(); }}
                    title="Close session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link to="/ai-settings" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                      title="AI Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }}
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
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    title="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages Area */}
              <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="flex flex-col space-y-4">
                    {isOffline && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs rounded-md">
                        <WifiOff className="size-3.5 shrink-0" />
                        <span>You're offline. Messages will be sent when you reconnect.</span>
                      </div>
                    )}

                    {isInitializing && messages.length === 0 && (
                      <div className="w-full bg-muted/50 border border-muted-foreground/20 rounded-lg px-4 py-2 text-center text-sm text-muted-foreground">
                        Initialising chat...
                      </div>
                    )}

                    {messages.map((msg) => {
                      if (msg.role === "quiz" && msg.metadata?.quiz_data) {
                        return (
                          <div key={msg.id} className="w-full max-w-[95%] mr-auto">
                           {/* Add avatar for quiz messages too */}
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
                                    {chatbotSettings.assistant_name.substring(0, 2).toUpperCase()}
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
                                    {chatbotSettings.assistant_name.substring(0, 2).toUpperCase()}
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
                          "flex w-full max-w-[90%]",
                          msg.role === "user"
                            ? "ml-auto justify-end"
                            : "mr-auto justify-start"
                        )}
                      >
                        {msg.role === "assistant" && (
                          <Avatar className="h-7 w-7 mr-2 mt-1 shrink-0">
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
                        )}
                        <div className="flex items-end gap-2">
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words",
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-sm ml-2"
                                : "bg-muted/80 backdrop-blur-sm text-foreground rounded-bl-sm mr-2"
                            )}
                          >
                            {msg.role === "user" ? (
                              <div>
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="flex gap-1 mb-1.5">
                                    {msg.attachments.map((att, i) => (
                                      <img
                                        key={i}
                                        src={att.url}
                                        alt={att.name || 'attachment'}
                                        className="max-w-[120px] max-h-[80px] rounded object-cover"
                                      />
                                    ))}
                                  </div>
                                )}
                                <p className="whitespace-pre-wrap">
                                  {msg.content}
                                  {msg.status === "pending" && (
                                    <span className="text-xs text-primary-foreground/60 ml-1" title="Queued - will send when online">&#x23F3;</span>
                                  )}
                                </p>
                              </div>
                            ) : (
                              <div className="max-w-none group relative">
                                <button
                                  className="absolute -top-0.5 -right-0.5 p-1 rounded-md bg-muted/80 z-10 shrink-0 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
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
                                    code: ({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) => {
                                      const isInline = !className?.includes('language-');
                                      return isInline ? (
                                        <code
                                          className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                                          {...rest}
                                        >{children}</code>
                                      ) : (
                                        <code
                                          className="block bg-muted p-2 rounded-lg text-xs font-mono mb-3 overflow-x-auto"
                                          {...rest}
                                        >{children}</code>
                                      );
                                    },
                                    blockquote: ({ ...props }) => (
                                      <blockquote
                                        className="border-l-4 border-primary pl-3 py-1 my-3 italic text-muted-foreground text-sm"
                                        {...props}
                                      />
                                    ),
                                  }}
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
                    })}

                    {/* Streaming response */}
                    {isStreaming && streamingContent && (
                      <div className="flex items-start gap-2.5 mr-auto max-w-[90%]">
                        <Avatar className="size-7 shrink-0 border border-primary/20">
                          {avatarUrl ? (
                            <AvatarImage
                              src={avatarUrl}
                              alt={chatbotSettings.assistant_name}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className="text-primary font-bold text-xs">
                            {chatbotSettings.assistant_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words bg-muted/80 backdrop-blur-sm text-foreground rounded-bl-sm mr-2">
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

                    {!isStreaming && (isLoading || aiStatus === "thinking" || aiStatus === "generating_quiz") && (
                      <div className="mr-auto flex max-w-[80%] items-end space-x-2">
                        <Avatar className="h-7 w-7 mr-2 shrink-0">
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
                        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
                          <div className="flex space-x-2 items-center h-4">
                            {aiStatus === "generating_quiz" ? (
                              <span className="text-xs text-muted-foreground animate-pulse">Generating quiz...</span>
                            ) : (
                              <>
                                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                                <div
                                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                                  style={{ animationDelay: "0.15s" }}
                                />
                                <div
                                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                                  style={{ animationDelay: "0.3s" }}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isCreditsExhausted && (
                      <div className="w-full bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-center text-sm text-amber-800">
                        Your OpenRouter credits have been exhausted. Please recharge your credits to continue using the AI assistant.
                      </div>
                    )}

                    {hasError && !isCreditsExhausted && (
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
              <CardFooter className="border-t p-2 shrink-0 max-h-[45%] overflow-y-auto flex-col gap-0">
                {/* Quick Action Chips - only show when no messages yet or input is empty */}
                {messages.length === 0 && !inputValue.trim() && (
                  <div className="w-full flex flex-wrap gap-1.5 pb-1">
                    {quickActions.map((action, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                           if (action.prompt.endsWith(" ")) {
                             setInputValue(action.prompt);
                           } else {
                             sendMessage(action.prompt, action.intent);
                           }
                        }}
                        disabled={isLoading || !sessionId}
                        className="h-7 rounded-full text-xs px-3 bg-primary/5 text-primary hover:bg-primary/15 hover:text-primary transition-colors border border-primary/10"
                      >
                        <action.icon className="h-3 w-3 mr-1.5" />
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Attachment preview */}
                {pendingAttachments.length > 0 && (
                  <div className="flex gap-2 w-full px-1 py-1.5">
                    {pendingAttachments.map((att, i) => (
                      <div key={i} className="relative size-12 rounded border overflow-hidden">
                        <img src={att.previewUrl || att.url} alt={att.name || 'attachment'} className="size-full object-cover" />
                        {!att.url && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          </div>
                        )}
                        <button
                          className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center"
                          onClick={() => {
                            if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
                            setPendingAttachments(prev => prev.filter((_, idx) => idx !== i));
                          }}
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hidden file input — uploads to S3 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                    e.target.value = '';
                  }}
                />

                {/* LaTeX quick-insert helper */}
                {showLatexHelper && (
                  <div className="w-full flex flex-wrap gap-1 px-1 py-1 bg-muted/30 rounded-lg border border-border/50">
                    {[
                      { label: '√', insert: '\\sqrt{}' },
                      { label: 'x²', insert: '^{2}' },
                      { label: 'xₙ', insert: '_{n}' },
                      { label: '∫', insert: '\\int_{a}^{b}' },
                      { label: 'Σ', insert: '\\sum_{i=1}^{n}' },
                      { label: 'π', insert: '\\pi' },
                      { label: 'α', insert: '\\alpha' },
                      { label: 'β', insert: '\\beta' },
                      { label: 'θ', insert: '\\theta' },
                      { label: '∞', insert: '\\infty' },
                      { label: '≠', insert: '\\neq' },
                      { label: '≤', insert: '\\leq' },
                      { label: '≥', insert: '\\geq' },
                      { label: '÷', insert: '\\frac{}{}' },
                      { label: 'lim', insert: '\\lim_{x \\to }' },
                      { label: 'dx', insert: '\\frac{d}{dx}' },
                      { label: '∂', insert: '\\partial' },
                      { label: '±', insert: '\\pm' },
                    ].map((item) => (
                      <button
                        key={item.label}
                        className="h-7 min-w-[32px] px-1.5 text-xs font-mono rounded bg-background hover:bg-primary/10 hover:text-primary border border-border/50 transition-colors"
                        onClick={() => {
                          // Wrap in $ delimiters if not already in a math context
                          const hasOpenDelimiter = inputValue.lastIndexOf('$') > inputValue.lastIndexOf(' ');
                          const toInsert = hasOpenDelimiter ? item.insert : `$${item.insert}$`;
                          setInputValue(prev => prev + toInsert);
                        }}
                        title={item.insert}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* LaTeX preview — show rendered formula when user types $ */}
                {inputValue.includes('$') && (
                  <div className="w-full px-2 py-1 bg-muted/20 rounded border border-dashed border-border/50 text-xs overflow-x-auto">
                    <span className="text-muted-foreground text-[10px] block mb-0.5">Preview:</span>
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {inputValue}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Input Row */}
                <div className="w-full flex items-center gap-1.5">
                  <Select
                    value={selectedIntent}
                    onValueChange={(value) => setSelectedIntent(value as MessageIntent)}
                  >
                    <SelectTrigger className="w-[90px] h-9 text-xs">
                      <SelectValue placeholder="Intent" />
                    </SelectTrigger>
                    <SelectContent className="z-[10006]">
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="doubt">Doubt</SelectItem>
                      <SelectItem value="practice">Practice</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Type message... (use $ for math)"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!sessionId || isLoading}
                    className="text-sm h-9 flex-1 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-lg",
                      showLatexHelper && "bg-primary/10 text-primary"
                    )}
                    onClick={() => setShowLatexHelper(prev => !prev)}
                    title="Math symbols"
                  >
                    <Sigma className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!sessionId || isLoading || isUploadingImage}
                    title="Attach image (math photos auto-detected)"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      const readyAttachments = pendingAttachments.filter(a => a.url);
                      sendMessage(inputValue, selectedIntent, readyAttachments.length > 0 ? readyAttachments : undefined);
                      // Clean up preview URLs
                      pendingAttachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
                      setPendingAttachments([]);
                    }}
                    disabled={(!inputValue.trim() && pendingAttachments.filter(a => a.url).length === 0) || isLoading || isUploadingImage}
                    size="icon"
                    className="h-9 w-9 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
