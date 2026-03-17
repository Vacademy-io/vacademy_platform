import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "@tanstack/react-router";
import axios from "axios";
import { ChatMessage, ChatbotContext, QuizSubmission } from "./types";
import {
  chatbotAPI,
  ContextType,
  ContextMeta,
  MessageEvent,
  AIStatus,
  MessageIntent,
} from "@/services/chatbot-api";
import { enqueueMessage, peekQueue, dequeueMessage, QueuedMessage } from "@/services/offline-queue";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import { useParentPortalStore } from "@/stores/parent-portal-store";
import { useCourseDetailsStore } from "@/stores/study-library/useCourseDetailsStore";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";
import { getSubjectName } from "@/utils/study-library/get-name-by-id/getSubjectNameById";
import { getModuleName } from "@/utils/study-library/get-name-by-id/getModuleNameById";
import { getChapterName } from "@/utils/study-library/get-name-by-id/getChapterById";
import {
  ChatbotSettingsData,
  DEFAULT_CHATBOT_SETTINGS,
  getChatbotSettings,
} from "@/services/chatbot-settings";
import { isChatbotVisibleOnRoute } from "@/config/chatbot-routes";

export const useChatbot = () => {
  // Check if parent portal is active
  const parentPortal = useParentPortalStore();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [chatbotSettings, setChatbotSettings] = useState<ChatbotSettingsData>(
    DEFAULT_CHATBOT_SETTINGS,
  );
  const [instituteName, setInstituteName] = useState<string>("Vacademy");
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus>("idle");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isCreditsExhausted, setIsCreditsExhausted] = useState(false);
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([]);

  // Ref to scroll to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Subscribe to stores for reactive context
  const activeSlide = useContentStore((state) => state.activeItem);
  const instituteDetails = useInstituteDetailsStore(
    (state) => state.instituteDetails,
  );
  const getCourseDetails = useCourseDetailsStore(
    (state) => state.getCourseDetails,
  );
  const studyLibraryData = useStudyLibraryStore(
    (state) => state.studyLibraryData,
  );
  const modulesWithChaptersData = useModulesWithChaptersStore(
    (state) => state.modulesWithChaptersData,
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (sessionId) {
        chatbotAPI.closeSession(sessionId).catch(console.error);
      }
    };
  }, [sessionId]);

  // Flush offline queue when back online
  const flushOfflineQueue = useCallback(async () => {
    if (!sessionId) return;
    const queued = peekQueue();
    for (const msg of queued) {
      if (msg.sessionId === sessionId) {
        try {
          await chatbotAPI.sendMessage(sessionId, msg.message, msg.intent as MessageIntent | undefined);
          dequeueMessage();
        } catch (e) {
          console.error("Failed to flush queued message:", e);
          break; // Stop if sending fails
        }
      }
    }
    setPendingMessages([]);
  }, [sessionId]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      flushOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushOfflineQueue]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    // No longer auto-closing sessions on inactivity
    // Users must explicitly close or start new chat
  }, []);

  useEffect(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        getChatbotSettings(true).then((settings) => {
          setChatbotSettings(settings);
          setInstituteName(settings.institute_name);
        });
      } catch (error) {
        console.error("Failed to fetch chatbot settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const shouldShowChatbot = () => {
    // Restrict chatbot for parent portal users
    if (parentPortal.selectedChild) return false;
    // Check global visibility setting first
    if (!chatbotSettings.enable) return false;
    // Check centralized route configuration
    return isChatbotVisibleOnRoute(location.pathname);
  };

  const getContext = useCallback((): ChatbotContext => {
    const searchParams = new URLSearchParams(window.location.search);

    return {
      route: location.pathname,
      courseId: searchParams.get("courseId") || undefined,
      packageSessionId: searchParams.get("packageSessionId") || undefined,
      subjectId: searchParams.get("subjectId") || undefined,
      moduleId: searchParams.get("moduleId") || undefined,
      chapterId: searchParams.get("chapterId") || undefined,
      slideId: searchParams.get("slideId") || undefined,
      sessionId: searchParams.get("sessionId") || undefined,
    };
  }, [location.pathname]);

  const getContextType = useCallback((): ContextType => {
    const path = location.pathname;

    // Check if we're on the slide page
    if (path.includes("/slides")) {
      return "slide";
    }
    // Check if we're on course details page (but not on nested routes)
    else if (path.includes("/course-details") && !path.includes("/subjects")) {
      return "course_details";
    }
    return "general";
  }, [location.pathname]);

  const buildContextMeta = useCallback(async (): Promise<ContextMeta> => {
    const contextType = getContextType();
    const context = getContext();

    if (contextType === "slide") {
      // Data is already subscribed via hooks above
      if (activeSlide) {
        // Determine slide type
        let slideType = "DOCUMENT";
        let slideContent = "";
        let questions: string[] = [];
        let options: string[] = [];

        if (activeSlide.source_type === "VIDEO") {
          slideType = "VIDEO";
          if (activeSlide.video_slide) {
            slideContent = activeSlide.video_slide.description || "";
          }
        } else if (activeSlide.source_type === "DOCUMENT") {
          if (activeSlide.document_slide?.type === "CODE") {
            slideType = "CODE";
            slideContent = activeSlide.document_slide.published_data || "";
          } else slideType = "DOCUMENT";
          if (activeSlide.document_slide) {
            slideContent = activeSlide.document_slide.published_data || "";
          }
        } else if (activeSlide.source_type === "QUESTION") {
          slideType = "QUESTION";
          if (activeSlide.question_slide) {
            questions = [activeSlide.question_slide.text_data?.content];
            options =
              activeSlide.question_slide.options?.map(
                (opt) => opt.text?.content || "",
              ) || [];
          }
        } else if (activeSlide.source_type === "QUIZ") {
          slideType = "QUIZ";
          if (activeSlide.quiz_slide) {
            // Todo handle the case where quiz slide has multiple questions and options to store them all
            // we have to store all the questions of that quiz slide
            const quizQuestions = activeSlide.quiz_slide.questions;
            if (quizQuestions && quizQuestions.length > 0) {
              questions = quizQuestions.map((q) => q.text?.content || "");
              //  for options we can send 2d array or we can send as string joined by new line
              // send like [["option1","option2"],["option1","option2"]]
              //@ts-expect-error : options type issue
              options = quizQuestions.map((q) =>
                q.options?.map((opt) => opt.text?.content || ""),
              ) as string[][];
            }
          }
        } else if (activeSlide.source_type === "ASSIGNMENT") {
          slideType = "ASSIGNMENT";
          if (activeSlide.assignment_slide) {
            questions = [activeSlide.assignment_slide.text_data?.content || ""];
          }
        }

        // Get course info from batches
        let courseName = "";
        if (context.courseId) {
          let matches = instituteDetails?.batches_for_sessions || [];
          if (!matches || matches.length === 0) {
            try {
              const { fetchBatchesForCourse } =
                await import("@/services/courseBatches");
              matches = await fetchBatchesForCourse(context.courseId);
            } catch (e) {
              console.error(e);
            }
          }

          const batch = matches?.find(
            (b) => b.package_dto.id === context.courseId,
          );
          courseName = batch?.package_dto?.package_name || "";
        }

        // Resolve chapter/subject/module names from stores using URL params
        const chapterNameStr = context.chapterId
          ? getChapterName(context.chapterId, modulesWithChaptersData) || ""
          : "";
        const moduleNameStr = context.moduleId
          ? getModuleName(context.moduleId, modulesWithChaptersData)
          : "";
        const subjectNameStr = context.subjectId
          ? getSubjectName(context.subjectId, studyLibraryData) || ""
          : "";

        return {
          name: activeSlide.title || "Current Slide",
          type: slideType,
          content: slideContent,
          questions: questions || undefined,
          options: options.length > 0 ? options : undefined,
          order: activeSlide.slide_order,
          chapter: chapterNameStr,
          module: moduleNameStr,
          subject: subjectNameStr,
          course: courseName,
          progress: `${Math.round(activeSlide.percentage_completed || 0)}%`,
        };
      }

      // Fallback if no active slide
      return {
        name: "Current Slide",
        type: "DOCUMENT",
        content: "",
        level: "",
        order: 0,
        chapter: "",
        module: "",
        subject: "",
        course: "",
      };
    } else if (contextType === "course_details") {
      // Data subscribed via hooks
      if (context.courseId) {
        // Try to get cached course details first
        // @ts-expect-error : course details type issue
        const courseDetails: {
          about_the_course_html: string;
          package_name: string;
          read_time_in_minutes: number | null;
          why_learn_html: string;
          who_should_learn_html: string;
        } = getCourseDetails(context.courseId);
        console.log("Building context meta for course details:", courseDetails);

        // Find batch info for basic metadata
        let matches = instituteDetails?.batches_for_sessions || [];
        if (!matches || matches.length === 0) {
          try {
            const { fetchBatchesForCourse } =
              await import("@/services/courseBatches");
            matches = await fetchBatchesForCourse(context.courseId);
          } catch (e) {
            console.error(e);
          }
        }

        const batch = matches?.find(
          (b) => b.package_dto.id === context.courseId,
        );

        if (courseDetails?.package_name) {
          // Helper to strip HTML tags and clean text
          const stripHtml = (html: string) => {
            if (!html) return "";
            return html
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .trim();
          };

          return {
            name: courseDetails.package_name || "Current Course",
            total_length_in_minutes: courseDetails.read_time_in_minutes || null, // TODO: Calculate from course progress
            about: stripHtml(courseDetails.about_the_course_html) || "",
            why_learn: stripHtml(courseDetails.why_learn_html) || "",
            who_should_learn:
              stripHtml(courseDetails.who_should_learn_html) || "",
          };
        } else if (batch) {
          // Fallback to basic batch info if course details not available
          return {
            name: batch.package_dto?.package_name || "Current Course",
            total_length_in_minutes: null,
            about: "",
          };
        }
      }

      return {
        name: "Current Course",
        total_length_in_minutes: null,
        about: "",
      };
    }

    return {};
  }, [
    getContextType,
    getContext,
    activeSlide,
    instituteDetails,
    getCourseDetails,
    studyLibraryData,
    modulesWithChaptersData,
  ]);

  const initializeSession = useCallback(async () => {
    if (isInitializing || sessionId) return;

    setIsInitializing(true);
    setIsWaitingForResponse(true);
    setHasError(false);
    setIsSessionClosed(false);
    console.log("Starting session initialization...");

    try {
      const contextType = getContextType();
      const context = getContext();

      // Pre-fetch course details if we're on course_details page
      if (contextType === "course_details" && context.courseId) {
        try {
          const { fetchCourseDetails } = useCourseDetailsStore.getState();
          await fetchCourseDetails(context.courseId);
        } catch (error) {
          console.warn(
            "Failed to fetch course details, will use basic info:",
            error,
          );
        }
      }

      const contextMeta = await buildContextMeta();
      console.log("Initializing session with context:", contextMeta);

      const response = await chatbotAPI.initSession(
        undefined,
        contextType,
        contextMeta,
      );

      setSessionId(response.session_id);
      setAiStatus(response.status);

      // Add small delay before establishing SSE connection
      // to ensure backend is ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Setting up SSE connection...");

      // Setup SSE connection
      const eventSource = chatbotAPI.createEventSource(response.session_id);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("message", (event) => {
        try {
          const messageData: MessageEvent = JSON.parse(event.data);

          // Check for credits exhausted error in message data
          if (
            (messageData as any).type === "ERROR" &&
            (messageData as any).code === 402
          ) {
            setIsCreditsExhausted(true);
            setIsWaitingForResponse(false);
            setIsLoading(false);
            setAiStatus("idle");

            const creditsMessage: ChatMessage = {
              id: Date.now(),
              role: "assistant",
              content:
                "Your OpenRouter credits have been exhausted. Please recharge your credits to continue using the AI assistant.",
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, creditsMessage]);
            return;
          }

           // Handle tool_call: show indicator; tool_result: clear it
          if (messageData.type === "tool_call") {
            setActiveToolCall(messageData.metadata?.tool_name || null);
            return;
          }
          if (messageData.type === "tool_result") {
            setActiveToolCall(null);
            return;
          }

          // Skip user messages from SSE since we already show them optimistically
          if (messageData.type === "user") {
            return;
          }

          // Clear waiting state and tool indicator when we get an actual assistant message
          setIsWaitingForResponse(false);
          setActiveToolCall(null);

          // When we receive a full assistant message, clear streaming state
          if (messageData.type === "assistant") {
            setIsStreaming(false);
            setStreamingContent("");
          }

          const newMessage: ChatMessage = {
            id: messageData.id,
            role: messageData.type as ChatMessage["role"],
            content: messageData.content,
            timestamp: new Date(messageData.created_at).getTime(),
            metadata: messageData.metadata as ChatMessage["metadata"],
          };

          setMessages((prev) => {
            // Check if message already exists
            const exists = prev.some((msg) => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        } catch (error) {
          console.error("Error parsing message event:", error);
        }
      });

      eventSource.addEventListener("token", (event) => {
        try {
          const data = JSON.parse(event.data);
          setIsStreaming(true);
          setStreamingContent((prev) => prev + (data.content || ""));
          scrollToBottom();
        } catch (e) {
          console.error("Error parsing token event:", e);
        }
      });

      eventSource.addEventListener("status", (event) => {
        try {
          const statusData = JSON.parse(event.data);
          setAiStatus(statusData.ai_status);

          // Check if session is closed
          if (statusData.session_status === "CLOSED") {
            setIsSessionClosed(true);
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
          }
        } catch (error) {
          console.error("Error parsing status event:", error);
        }
      });

      eventSource.addEventListener("error", (event) => {
        // Check if this is a structured error event with data (e.g. credits exhausted)
        try {
          const errorEvent = event as MessageEvent;
          if (errorEvent.data) {
            const errorData = JSON.parse(errorEvent.data);
            if (errorData.type === "ERROR" && errorData.code === 402) {
              console.error("Credits exhausted (402):", errorData.message);
              setIsCreditsExhausted(true);
              setIsWaitingForResponse(false);
              setIsLoading(false);
              setAiStatus("idle");

              const creditsMessage: ChatMessage = {
                id: Date.now(),
                role: "assistant",
                content:
                  "Your OpenRouter credits have been exhausted. Please recharge your credits to continue using the AI assistant.",
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, creditsMessage]);
              return;
            }
          }
        } catch {
          // Not a JSON error event, handle as regular SSE error below
        }

        console.error("SSE Error event:", event);
        console.error("EventSource readyState:", eventSource.readyState);
        console.error("EventSource url:", eventSource.url);

        // ReadyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error("EventSource connection closed");
          setHasError(true);
          eventSource.close();
          eventSourceRef.current = null;
        }
      });

      eventSource.onerror = (error) => {
        console.error("EventSource failed:", error);
        console.error("EventSource readyState:", eventSource.readyState);

        // Set error state to prevent re-initialization
        if (eventSource.readyState === EventSource.CLOSED) {
          setHasError(true);
          eventSource.close();
          eventSourceRef.current = null;
        }
      };
    } catch (error) {
      console.error("Failed to initialize session:", error);
      setHasError(true);

      let errorMessage = `Hi! I'm ${chatbotSettings.assistant_name}, your AI assistant. `;
      if (axios.isAxiosError(error)) {
        if (error.code === "ERR_NETWORK") {
          errorMessage +=
            "I'm having trouble connecting to the server. Please check your network connection.";
        } else if (error.response?.status === 404) {
          errorMessage +=
            "The AI service endpoint was not found. Please check the configuration.";
        } else if (
          error.response?.status === 403 ||
          error.response?.status === 401
        ) {
          errorMessage += "Authentication failed. Please try logging in again.";
        } else {
          errorMessage += `I'm having trouble connecting right now (Error: ${error.message}). How can I help you?`;
        }
      } else {
        errorMessage +=
          "I'm having trouble connecting right now. How can I help you?";
      }

      setMessages([
        {
          id: Date.now(),
          role: "assistant",
          content: errorMessage,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsInitializing(false);
    }
  }, [
    isInitializing,
    sessionId,
    chatbotSettings.assistant_name,
    getContextType,
    getContext,
    buildContextMeta,
  ]);

  // Initialize session when chatbot opens
  useEffect(() => {
    if (isOpen && !sessionId && !isInitializing && !hasError) {
      initializeSession();
    }
  }, [isOpen, sessionId, isInitializing, hasError, initializeSession]);

  // Update context when page/route changes or active slide changes
  useEffect(() => {
    if (!isOpen || !sessionId || isInitializing) return;

    const updateContextAsync = async () => {
      try {
        const contextType = getContextType();
        const contextMeta = await buildContextMeta();

        console.log("Updating context:", { contextType, contextMeta });

        await chatbotAPI.updateContext(sessionId, contextType, contextMeta);
        console.log("Context updated successfully");
      } catch (error) {
        console.error("Failed to update context:", error);
        // Don't show error to user - context update is non-critical
      }
    };

    updateContextAsync();
  }, [
    sessionId,
    isOpen,
    isInitializing,
    getContextType,
    buildContextMeta,
    location.pathname,
    activeSlide,
  ]);

  const sendMessage = async (content: string, intent?: MessageIntent, attachments?: Array<{type: string; url: string; mime_type?: string; name?: string}>) => {
    if (!content.trim() || !sessionId) return;

    if (isCreditsExhausted) {
      const creditsMessage: ChatMessage = {
        id: Date.now(),
        role: "assistant",
        content:
          "Your OpenRouter credits have been exhausted. Please recharge your credits to continue using the AI assistant.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, creditsMessage]);
      return;
    }

    // Queue message if offline
    if (!navigator.onLine) {
      const queued = enqueueMessage({ sessionId, message: content, intent });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "user",
          content,
          timestamp: Date.now(),
          status: "pending",
        },
      ]);
      setPendingMessages(peekQueue());
      setInputValue("");
      return;
    }

    const newMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content,
      timestamp: Date.now(),
      attachments: attachments?.map(att => ({ ...att, type: att.type as 'image' | 'video' })),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
    // If intent is practice, show generating_quiz status, else thinking
    setIsLoading(true);
    setAiStatus(intent === "practice" ? "generating_quiz" : "thinking");

    try {
      await chatbotAPI.sendMessage(sessionId, content, intent, undefined, attachments);
      // Response will come through SSE
    } catch (error) {
      console.error("Failed to send message:", error);

      // Check for 402 credits exhausted
      if (axios.isAxiosError(error) && error.response?.status === 402) {
        setIsCreditsExhausted(true);
        const creditsMsg: ChatMessage = {
          id: Date.now(),
          role: "assistant",
          content:
            "Your OpenRouter credits have been exhausted. Please recharge your credits to continue using the AI assistant.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, creditsMsg]);
        setAiStatus("idle");
      } else {
        setHasError(true);
        const errorMessage: ChatMessage = {
          id: Date.now(),
          role: "assistant",
          content:
            "I'm sorry, I encountered an error while processing your request. Please try again.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setAiStatus("idle");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitQuiz = async (submission: QuizSubmission) => {
    if (!sessionId) return;

    setIsLoading(true);
    setAiStatus("thinking");

    try {
      await chatbotAPI.sendMessage(
        sessionId,
        "Quiz completed",
        undefined,
        submission,
      );
      // Response will come through SSE as quiz_feedback
    } catch (error) {
      console.error("Failed to submit quiz:", error);
      setHasError(true);
      const errorMessage: ChatMessage = {
        id: Date.now(),
        role: "assistant",
        content: "I'm sorry, I couldn't submit your quiz. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setAiStatus("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = useCallback(async () => {
    // Close existing session
    if (sessionId) {
      try {
        await chatbotAPI.closeSession(sessionId);
      } catch (error) {
        console.error("Failed to close session:", error);
      }
    }

    // Close EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset state
    setSessionId(null);
    setMessages([]);
    setInputValue("");
    setIsLoading(false);
    setAiStatus("idle");
    setIsInitializing(false);
    setIsWaitingForResponse(false);
    setHasError(false);
    setIsCreditsExhausted(false);
    setIsSessionClosed(false);
    setActiveToolCall(null);
    setStreamingContent("");
    setIsStreaming(false);

    // Initialize new session
    await initializeSession();
  }, [sessionId, initializeSession]);

  const closeSession = useCallback(async () => {
    // Close existing session
    if (sessionId) {
      try {
        await chatbotAPI.closeSession(sessionId);
      } catch (error) {
        console.error("Failed to close session:", error);
      }
    }

    // Close EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset state
    setSessionId(null);
    setMessages([]);
    setInputValue("");
    setIsLoading(false);
    setAiStatus("idle");
    setIsInitializing(false);
    setIsWaitingForResponse(false);
    setHasError(false);
    setIsSessionClosed(true);
    setActiveToolCall(null);
    setStreamingContent("");
    setIsStreaming(false);
  }, [sessionId]);

  return {
    isOpen,
    setIsOpen,
    messages,
    isLoading:
      isLoading || aiStatus === "thinking" || aiStatus === "generating_quiz",
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
    isExpanded,
    setIsExpanded,
    aiStatus,
    sessionId,
    isWaitingForResponse,
    hasError,
    isCreditsExhausted,
    isSessionClosed,
    isInitializing,
    activeToolCall,
    streamingContent,
    isStreaming,
    isOffline,
    pendingMessages,
  };
};
