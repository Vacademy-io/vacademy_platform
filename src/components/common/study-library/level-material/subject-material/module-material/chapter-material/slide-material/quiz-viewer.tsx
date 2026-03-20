import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "lucide-react";
import QuizTimer from "./QuizTimer";
import QuizTimeWarning from "./QuizTimeWarning";
import { MyInput } from "@/components/design-system/input";
import { MyButton } from "@/components/design-system/button";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitQuizSlideActivityLog } from "@/services/study-library/tracking-api/submit-quiz-slide-activity-log";
import { QuizSlideActivityLogPayload } from "@/types/quiz-slide-activity-log";
import { getUserId } from "@/constants/getUserId";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import QuizReview from "./QuizReview";
import { useGetQuizSlideActivityLogs } from "@/services/study-library/tracking-api/get-quiz-slide-activity-logs";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import confetti from "canvas-confetti";
import katex from "katex";
import "katex/dist/katex.css";
import { useQueryClient } from "@tanstack/react-query";
import type { Slide } from "@/hooks/study-library/use-slides";
import { useSelectedSessionStore } from "@/stores/study-library/selected-session-store";

interface Option {
  id: string;
  text: { content: string };
}

interface Question {
  id: string;
  parent_rich_text?: {
    id?: string;
    type?: string;
    content?: string;
  }; // Passage for comprehension questions
  text?: {
    id?: string;
    type?: string;
    content?: string;
  } | string; // Question text (always present)
  text_data?: {
    id?: string;
    type?: string;
    content?: string;
  }; // Alternative field name for question text
  options: Option[];
  question_type?: string;
  auto_evaluation_json?: string;
  marks?: number | null;
  negative_marking?: number | null;
}

export interface ScoreCard {
  earned: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  skipped: number;
}

interface QuizViewerProps {
  questions: Question[];
  onAnswer: (questionId: string, selectedOptionId: string | number | string[]) => void;
  onComplete?: () => void;
  timeLimitMinutes?: number | null;
  marksPerQuestion?: number;
  defaultNegativeMarking?: number;
  passPercentage?: number | null;
  reAttemptCount?: number | null;
}

const BASE_QUESTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  MCQS: "Multiple Choice Questions - Single Correct Option",
  MCQM: "Multiple Choice Questions - Multiple Correct Option",
  NUMERIC: "Numeric Answer",
  ONE_WORD: "One Word Answer",
  TEXT: "Short Answer - Text Response",
  LONG_ANSWER: "Long Answer - Detailed Response",
  TRUE_FALSE: "True or False",
  MATCH: "Match the Following",
  FILL_IN_THE_BLANK: "Fill in the Blank",
};

const formatQuestionTypeLabel = (type?: string) => {
  if (!type) return "Question";
  return type
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getQuestionTypeDescription = (type?: string): string => {
  if (!type) {
    return BASE_QUESTION_TYPE_DESCRIPTIONS.MCQS;
  }

  const directMatch = BASE_QUESTION_TYPE_DESCRIPTIONS[type];
  if (directMatch) {
    return directMatch;
  }

  if (type.startsWith("C")) {
    const baseType = type.slice(1);
    const baseDescription = BASE_QUESTION_TYPE_DESCRIPTIONS[baseType];
    if (baseDescription) {
      return `Comprehension ${baseDescription}`;
    }
  }

  return formatQuestionTypeLabel(type);
};





export const QuizViewer: React.FC<QuizViewerProps> = ({
  questions,
  onAnswer,
  onComplete,
  timeLimitMinutes,
  marksPerQuestion = 1,
  defaultNegativeMarking = 0,
  passPercentage,
  reAttemptCount,
}) => {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string | number | string[] }>({});
  const [numericErrors, setNumericErrors] = useState<{ [questionId: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFullPassage, setShowFullPassage] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [moveOnlyOnCorrectAnswer, setMoveOnlyOnCorrectAnswer] = useState(false);
  const [celebrateOnQuizComplete, setCelebrateOnQuizComplete] = useState(true);
  const [showReportAndCorrectAnswers, setShowReportAndCorrectAnswers] = useState(true);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [showIncorrectNotice, setShowIncorrectNotice] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const timerExpiredRef = useRef(false);
  // Keep a ref to always-current answers so the timer's stale closure gets the latest values
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const [scoreCard, setScoreCard] = useState<ScoreCard | null>(null);

  const submitQuizMutation = useSubmitQuizSlideActivityLog();
  const queryClient = useQueryClient();
  const { selectedSession } = useSelectedSessionStore();

  // Resolve userId for attempt tracking query
  useEffect(() => {
    getUserId().then((id) => setCurrentUserId(id || undefined));
  }, []);
  const currentSlideIdForAttempts = useMemo(() => {
    return new URLSearchParams(window.location.search).get("slideId") || undefined;
  // Re-compute when questions change (indicates slide navigation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);
  const attemptLogsQuery = useGetQuizSlideActivityLogs(currentUserId, currentSlideIdForAttempts);

  // ✅ Helper: Restore 100% for ALL completed quizzes from localStorage
  const restoreLocalStorageCompletions = useCallback((chapterId: string) => {
    queryClient.setQueryData<Slide[]>(["slides", chapterId], (oldSlides) => {
      if (!oldSlides) return oldSlides;
      
      return oldSlides.map((slide) => {
        // Check if this slide has completed answers in localStorage
        const storageKey = `quiz_answers_${slide.id}_${chapterId}`;
        const hasStoredAnswers = localStorage.getItem(storageKey);
        
        // If quiz is completed, ensure 100%
        if (hasStoredAnswers && slide.source_type === 'QUIZ') {
          return { ...slide, percentage_completed: 100 };
        }
        
        return slide;
      });
    });
  }, [queryClient]);

  // Helpers: decode HTML entities and render KaTeX spans
  const decodeHtml = (input: string): string => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = input;
    return textarea.value || textarea.textContent || "";
  };

  const renderHtmlWithMath = (html: string | undefined | null): string => {
    if (!html) return "";
    // If the string is HTML-escaped (contains &lt;), decode it first
    const decoded = html.includes("&lt;") ? decodeHtml(html) : html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(decoded, "text/html");
      // Basic hardening: strip script tags
      doc.querySelectorAll("script").forEach((s) => s.remove());
      // Find math spans and render using KaTeX
      const mathNodes = doc.querySelectorAll("span.math-inline, span.math-display");
      mathNodes.forEach((node) => {
        const tex = node.getAttribute("data-latex") || node.getAttribute("latex") || node.textContent || "";
        const display = node.classList.contains("math-display");
        try {
          const rendered = katex.renderToString(tex, { displayMode: display, throwOnError: false });
          node.innerHTML = rendered;
        } catch {
          // ignore rendering errors, leave original content
        }
      });
      return doc.body.innerHTML;
    } catch {
      return decoded;
    }
  };

  // Load student display settings (specifically courseSettings.quiz.moveOnlyOnCorrectAnswer)
  useEffect(() => {
    getStudentDisplaySettings(false)
      .then((s) => {
        const flag = s?.courseSettings?.quiz?.moveOnlyOnCorrectAnswer ?? false;
        setMoveOnlyOnCorrectAnswer(Boolean(flag));
        const celebrate = s?.courseSettings?.quiz?.celebrateOnQuizComplete ?? true;
        setCelebrateOnQuizComplete(Boolean(celebrate));
        const showReport = s?.courseSettings?.quiz?.showReportAndCorrectAnswers ?? true;
        setShowReportAndCorrectAnswers(Boolean(showReport));
      })
      .catch(() => {
        setMoveOnlyOnCorrectAnswer(false);
        setCelebrateOnQuizComplete(true);
        setShowReportAndCorrectAnswers(true);
      });
  }, []);

  // ✅ Load answers from localStorage on mount AND when slide changes
  useEffect(() => {
    const { slideId, chapterId } = getUrlParams();
    console.log("🔄 [QuizViewer] useEffect triggered - checking slide:", { slideId, chapterId });
    
    if (!slideId || !chapterId) {
      console.log("⚠️ [QuizViewer] Missing slideId or chapterId");
      return;
    }

    // ✅ STEP 1: Restore 100% for ALL completed quizzes using helper function
    console.log("🔄 [QuizViewer] Restoring all localStorage completions...");
    restoreLocalStorageCompletions(chapterId);
    console.log("✅ [QuizViewer] All completed quizzes restored to 100%");

    // ✅ STEP 2: Check if CURRENT slide has stored answers
    const storageKey = `quiz_answers_${slideId}_${chapterId}`;
    const storedAnswers = localStorage.getItem(storageKey);
    console.log("🔍 [QuizViewer] Checking for stored answers:", { 
      storageKey, 
      found: !!storedAnswers,
      slideId,
      chapterId
    });

    // If we have stored answers for CURRENT slide, show review
    if (storedAnswers) {
      console.log("✅ [QuizViewer] Found stored answers for current slide - showing Quiz Review");
      try {
        const parsedAnswers = JSON.parse(storedAnswers);
        console.log("✅ [QuizViewer] Parsed answers from localStorage:", parsedAnswers);
        setAnswers(parsedAnswers);
        setShowReview(true);
      } catch (e) {
        console.error("❌ [QuizViewer] Failed to parse stored answers:", e);
      }
    } else {
      console.log("ℹ️ [QuizViewer] No stored answers - quiz not completed yet, resetting state");
      // ✅ Reset state when navigating to a different quiz that hasn't been completed
      setAnswers({});
      setShowReview(false);
      setCurrent(0);
    }
  }, [queryClient, questions, restoreLocalStorageCompletions]);

  // Helper to get URL params
  const getUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    /**
     * IMPORTANT: In the study library flow, courseId IS the package session ID.
     * The slides route always has courseId in the URL, so we use that as the primary source.
     * 
     * Fallback order (only for backward compatibility):
     * 1. sessionId (if explicitly provided and non-empty)
     * 2. courseId (primary - always present in study library routes)
     * 3. selectedSession from store (for edge cases)
     */
    const courseId = urlParams.get("courseId") || "";
    const sessionId = urlParams.get("sessionId") || "";
    const sessionFromStore = selectedSession?.id || "";
    
    // Use sessionId only if it's explicitly provided and non-empty
    const packageSessionId = (sessionId && sessionId.trim()) || courseId || sessionFromStore;
    
    return {
      slideId: urlParams.get("slideId") || "",
      chapterId: urlParams.get("chapterId") || "",
      moduleId: urlParams.get("moduleId") || "",
      subjectId: urlParams.get("subjectId") || "",
      packageSessionId,
    };
  };

  // Helper to build payload
  const buildQuizPayload = async (): Promise<QuizSlideActivityLogPayload> => {
    const userId = (await getUserId()) || "";
    const { slideId } = getUrlParams();
    const now = Date.now();
    return {
      id: uuidv4(),
      source_id: slideId,
      source_type: "QUIZ",
      user_id: userId,
      slide_id: slideId,
      start_time_in_millis: now - 60000, // Example: started 1 min ago
      end_time_in_millis: now,
      percentage_watched: 100,
      videos: [],
      documents: [],
      question_slides: [],
      assignment_slides: [],
      video_slides_questions: [],
      new_activity: true,
      concentration_score: {
        id: uuidv4(),
        concentration_score: 100,
        tab_switch_count: 0,
        pause_count: 0,
        answer_times_in_seconds: [],
      },
      quiz_sides: questions.map((q) => ({
        id: uuidv4(),
        response_json: JSON.stringify({ answer: answers[q.id] }),
        response_status: "SUBMITTED",
        activity_id: slideId,
        question_id: q.id,
      })),
    };
  };

  const currentQuestion = questions?.[current];
  const total = questions?.length || 0;
  const questionType = currentQuestion?.question_type || "MCQS";
  const questionTypeDescription = useMemo(
    () => getQuestionTypeDescription(questionType),
    [questionType]
  );
  // Derive correct answers from auto_evaluation_json
  const correctAnswers = useMemo<(string | number)[]>(() => {
    const q = currentQuestion;
    if (!q?.auto_evaluation_json) return [];
    try {
      const parsed = JSON.parse(q.auto_evaluation_json);
      if (Array.isArray(parsed.correctAnswers)) {
        // If numbers represent indices, map to option ids
        if (typeof parsed.correctAnswers[0] === "number" && q.options?.length) {
          return parsed.correctAnswers.map((idx: number) => q.options[idx]?.id ?? idx);
        }
        return parsed.correctAnswers;
      }
      if (typeof parsed.correctAnswers === "string" || typeof parsed.correctAnswers === "number") {
        return [parsed.correctAnswers];
      }
      if (parsed.data) {
        if (typeof parsed.data.answer === "string" || typeof parsed.data.answer === "number") {
          return [parsed.data.answer];
        }
        if (parsed.data.answer && typeof parsed.data.answer === "object" && typeof parsed.data.answer.content === "string") {
          return [parsed.data.answer.content];
        }
      }
    } catch {
      // ignore parsing errors
    }
    return [];
  }, [currentQuestion]);

  const isCurrentAnswerCorrect = useMemo(() => {
    // If there are no correct answers available, don't block progression
    if (!correctAnswers || correctAnswers.length === 0) return true;
    if (!currentQuestion) return true;

    const userAns = answers[currentQuestion.id];
    if (userAns == null || (typeof userAns === "string" && userAns.trim() === "")) return false;

    // Multiple answers
    if (Array.isArray(userAns)) {
      const asStrings = userAns.map((x) => String(x));
      const correctAsStrings = correctAnswers.map((x) => String(x));
      if (asStrings.length !== correctAsStrings.length) return false;
      // Set equality
      return correctAsStrings.every((c) => asStrings.includes(c));
    }

    // Single answer
    return correctAnswers.map((x) => String(x)).includes(String(userAns));
  }, [answers, correctAnswers, currentQuestion]);

  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 text-gray-400 text-2xl font-bold">?</div>
          </div>
          <p className="text-gray-500">No quiz questions available.</p>
        </div>
      </div>
    );
  }

  // Score computation (called once before showing review)
  const computeScore = (finalAnswers: typeof answers): ScoreCard => {
    let earned = 0;
    let totalMarks = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    const checkAnswerCorrect = (q: Question, userAns: string | number | string[] | undefined): boolean => {
      if (userAns == null || (typeof userAns === "string" && userAns.trim() === "")) return false;
      if (!q.auto_evaluation_json) return false;
      try {
        const parsed = JSON.parse(q.auto_evaluation_json);
        const correctAnswers: (string | number)[] = Array.isArray(parsed.correctAnswers)
          ? parsed.correctAnswers[0] !== undefined && typeof parsed.correctAnswers[0] === "number" && q.options?.length
            ? parsed.correctAnswers.map((idx: number) => q.options[idx]?.id ?? idx)
            : parsed.correctAnswers
          : [];
        if (correctAnswers.length === 0) return false;
        if (Array.isArray(userAns)) {
          const asStr = userAns.map(String);
          const corrStr = correctAnswers.map(String);
          return asStr.length === corrStr.length && corrStr.every((c) => asStr.includes(c));
        }
        return correctAnswers.map(String).includes(String(userAns));
      } catch {
        return false;
      }
    };

    questions.forEach((q) => {
      const qMarks = q.marks != null ? q.marks : marksPerQuestion;
      const qNeg = q.negative_marking != null ? q.negative_marking : defaultNegativeMarking;
      totalMarks += qMarks;
      const isAnswered = finalAnswers[q.id] != null;
      const isCorrect = isAnswered && checkAnswerCorrect(q, finalAnswers[q.id]);
      if (isCorrect) {
        earned += qMarks;
        correct++;
      } else if (isAnswered) {
        earned -= qNeg;
        wrong++;
      } else {
        skipped++;
      }
    });

    return { earned: Math.max(0, earned), totalMarks, correct, wrong, skipped };
  };

  // ✅ Only show review if we have answers (prevents "undefined" on first click)
  if (showReview && Object.keys(answers).length > 0) {
    // Optimistic: if the query hasn't refetched yet after this submission,
    // ensure the current attempt is counted (+1 when logs don't include it yet).
    const logsCount = attemptLogsQuery.data?.length ?? 0;
    const totalAttempts = logsCount > 0 ? logsCount : 1;
    // If reAttemptCount is set, check if the user has exhausted their attempts
    const canReattempt = reAttemptCount == null || totalAttempts < reAttemptCount;
    return <QuizReview
      questions={questions}
      userAnswers={answers}
      scoreCard={scoreCard ?? undefined}
      showCorrectAnswers={showReportAndCorrectAnswers}
      passed={passed}
      passPercentage={passPercentage}
      attemptNumber={totalAttempts}
      maxAttempts={reAttemptCount}
      canReattempt={canReattempt}
      attemptLogs={attemptLogsQuery.data}
      onRestart={() => {
        // ✅ Clear localStorage when retaking quiz
        const { slideId, chapterId } = getUrlParams();
        const storageKey = `quiz_answers_${slideId}_${chapterId}`;
        localStorage.removeItem(storageKey);

        // Reset quiz state
        setShowReview(false);
        setCurrent(0);
        setAnswers({});
        setScoreCard(null);
        setPassed(null);
        timerExpiredRef.current = false;
      }}
    />;
  }

  // Auto-submit handler when timer expires
  const handleTimerExpire = () => {
    if (timerExpiredRef.current) return;
    timerExpiredRef.current = true;
    // Use ref to avoid stale closure — answersRef always holds the latest answers
    handleQuizSubmit(answersRef.current);
  };

  const handleQuizSubmit = async (finalAnswers: typeof answers) => {
    setIsSubmitting(true);
    try {
      const { slideId, chapterId, moduleId, subjectId, packageSessionId } = getUrlParams();
      const userId = (await getUserId()) || "";

      if (!slideId || !chapterId || !moduleId || !subjectId || !packageSessionId || !userId) {
        toast.error("Cannot submit quiz — missing context. Please reopen this slide.");
        return;
      }

      const now = Date.now();
      const payload: QuizSlideActivityLogPayload = {
        id: uuidv4(),
        source_id: slideId,
        source_type: "QUIZ",
        user_id: userId,
        slide_id: slideId,
        start_time_in_millis: now - 60000,
        end_time_in_millis: now,
        percentage_watched: 100,
        videos: [],
        documents: [],
        question_slides: [],
        assignment_slides: [],
        video_slides_questions: [],
        new_activity: true,
        concentration_score: {
          id: uuidv4(),
          concentration_score: 100,
          tab_switch_count: 0,
          pause_count: 0,
          answer_times_in_seconds: [],
        },
        quiz_sides: questions.map((q) => ({
          id: uuidv4(),
          response_json: JSON.stringify({ answer: finalAnswers[q.id] }),
          response_status: "SUBMITTED",
          activity_id: slideId,
          question_id: q.id,
        })),
      };

      await submitQuizMutation.mutateAsync({
        slideId, chapterId, moduleId, subjectId,
        packageSessionId, userId,
        requestPayload: payload,
      });

      toast.success("Quiz submitted!", { className: "text-center" });

      // Refresh attempt history
      queryClient.invalidateQueries({ queryKey: ["quiz-slide-activity-logs", currentUserId, currentSlideIdForAttempts] });

      const storageKey = `quiz_answers_${slideId}_${chapterId}`;
      localStorage.setItem(storageKey, JSON.stringify(finalAnswers));

      queryClient.setQueryData<Slide[]>(["slides", chapterId], (oldSlides) => {
        if (!oldSlides) return oldSlides;
        return oldSlides.map((slide) =>
          slide.id === slideId ? { ...slide, percentage_completed: 100 } : slide
        );
      });

      setTimeout(async () => {
        try {
          await queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "GET_MODULES_WITH_CHAPTERS" });
          await queryClient.refetchQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "GET_MODULES_WITH_CHAPTERS" });
          setTimeout(async () => {
            try {
              await queryClient.invalidateQueries({ queryKey: ["slides", chapterId] });
              await queryClient.refetchQueries({ queryKey: ["slides", chapterId] });
              restoreLocalStorageCompletions(chapterId);
            } catch { /* ignore */ }
          }, 3000);
        } catch { /* ignore */ }
      }, 2000);

      const card = computeScore(finalAnswers);
      setScoreCard(card);
      if (passPercentage != null && card.totalMarks > 0) {
        const pct = (card.earned / card.totalMarks) * 100;
        setPassed(pct >= passPercentage);
      } else {
        setPassed(null);
      }
      setAnswers(finalAnswers);
      setShowReview(true);
      if (onComplete) onComplete();
    } catch {
      toast.error("Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleOptionSelect = (optionId: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
    onAnswer(currentQuestion.id, optionId);
    setShowIncorrectNotice(false);
  };

  const handleTextInput = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    onAnswer(currentQuestion.id, value);
    setShowIncorrectNotice(false);
  };

  const handleNumericInput = (value: string) => {
    // Check if the input is a valid number
    const isNumeric = /^\d*\.?\d*$/.test(value);
    
    if (value === "") {
      setNumericErrors((prev) => ({ ...prev, [currentQuestion.id]: "" }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: "" }));
      onAnswer(currentQuestion.id, "");
    } else if (!isNumeric) {
      setNumericErrors((prev) => ({ ...prev, [currentQuestion.id]: "Please enter a valid number" }));
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
      onAnswer(currentQuestion.id, value);
    } else {
      setNumericErrors((prev) => ({ ...prev, [currentQuestion.id]: "" }));
      const numericValue = parseFloat(value) || 0;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: numericValue }));
      onAnswer(currentQuestion.id, numericValue);
      setShowIncorrectNotice(false);
    }
  };

  // For MCQM (multiple choice, multiple answers)
  const handleMultiOptionSelect = (optionId: string) => {
    let current = Array.isArray(answers[currentQuestion.id]) ? [...(answers[currentQuestion.id] as string[])] : [];
    if (current.includes(optionId)) {
      current = current.filter((id) => id !== optionId);
    } else {
      current.push(optionId);
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: current }));
    onAnswer(currentQuestion.id, current);
    setShowIncorrectNotice(false);
  };

  const handlePrev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const handleNext = async () => {
    // When showReportAndCorrectAnswers is on, don't block on wrong answers —
    // correct answers will be shown in the final report after the quiz.
    if (!showReportAndCorrectAnswers && moveOnlyOnCorrectAnswer && !isCurrentAnswerCorrect) {
      setShowIncorrectNotice(true);
      toast.error("Incorrect answer. Please try again.");
      return;
    }

    if (current < total - 1) {
      setCurrent(current + 1);
      setShowIncorrectNotice(false);
    } else {
      // On Finish: submit quiz
      setIsSubmitting(true);
      try {
        const { slideId, chapterId, moduleId, subjectId, packageSessionId } = getUrlParams();
        const userId = (await getUserId()) || "";

        if (!slideId || !chapterId || !moduleId || !subjectId || !packageSessionId || !userId) {
          console.error("❌ 391 [QuizViewer] Missing required params for quiz submission", {
            slideId,
            chapterId,
            moduleId,
            subjectId,
            packageSessionId: packageSessionId,
            userId,
          });
          toast.error("Cannot submit quiz — missing context. Please reopen this slide.");
          return;
        }

        const payload = await buildQuizPayload();

        console.group("📤 [QuizViewer] Submitting quiz activity log");
        console.log("Params:", { slideId, chapterId, moduleId, subjectId, packageSessionId, userId });
        console.log("Payload summary:", {
          id: payload.id,
          slide_id: payload.slide_id,
          questionsCount: payload.quiz_sides?.length || 0,
          new_activity: payload.new_activity,
        });
        console.debug("Full payload:", payload);
        const response = await submitQuizMutation.mutateAsync({
          slideId,
          chapterId,
          moduleId,
          subjectId,
          packageSessionId: packageSessionId,
          userId,
          requestPayload: payload,
        });
        console.log("✅ [QuizViewer] API response:", response?.data ?? response);
        console.groupEnd();
        console.log("Quiz submitted successfully");
        toast.success("Quiz submitted successfully!", {
          className: "text-center"
        });
        queryClient.invalidateQueries({ queryKey: ["quiz-slide-activity-logs", currentUserId, currentSlideIdForAttempts] });
        
        // ✅ STEP 1: Save answers to localStorage for persistence across refreshes
        const storageKey = `quiz_answers_${slideId}_${chapterId}`;
        localStorage.setItem(storageKey, JSON.stringify(answers));
        console.log("💾 [QuizViewer] Saved answers to localStorage:", storageKey);
        
        // ✅ STEP 2: Optimistic UI update - instantly show 100% in sidebar
        queryClient.setQueryData<Slide[]>(["slides", chapterId], (oldSlides) => {
          if (!oldSlides) return oldSlides;
          console.log("🎯 [QuizViewer] Setting optimistic 100% for slideId:", slideId);
          return oldSlides.map((slide) =>
            slide.id === slideId
              ? { ...slide, percentage_completed: 100 }
              : slide
          );
        });
        console.log("✅ [QuizViewer] Optimistic 100% set in React Query cache");
        
        // ✅ STEP 3: Background refresh (delayed to avoid overwriting optimistic update)
        setTimeout(async () => {
          try {
            console.log("🔄 [QuizViewer] Background (3s): Updating course structure...");
            
            // Invalidate and refetch modules query - this updates course structure
            await queryClient.invalidateQueries({
                predicate: (query) => {
                const queryKey = query.queryKey;
                return Array.isArray(queryKey) && queryKey[0] === "GET_MODULES_WITH_CHAPTERS";
                },
            });
              
            await queryClient.refetchQueries({
                predicate: (query) => {
                const queryKey = query.queryKey;
                return Array.isArray(queryKey) && queryKey[0] === "GET_MODULES_WITH_CHAPTERS";
              },
            });
            
            console.log("✅ [QuizViewer] Course structure updated successfully");
            
            // ✅ STEP 4: After another delay, sync slides with server data
            setTimeout(async () => {
              try {
                console.log("🔄 [QuizViewer] Background (8s): Syncing slides with server...");
                
                // Now it's safe to refetch slides from server
                await queryClient.invalidateQueries({
                  queryKey: ["slides", chapterId],
                });
                
                await queryClient.refetchQueries({
                  queryKey: ["slides", chapterId],
                });
                
                console.log("✅ [QuizViewer] Slides synced with server data");
            
                // ✅ CRITICAL: After refetch, restore localStorage completions again
                console.log("🔄 [QuizViewer] Re-applying localStorage completions after server sync...");
            restoreLocalStorageCompletions(chapterId);
                console.log("✅ [QuizViewer] localStorage completions restored after server sync");
              } catch (e) {
                console.error("❌ [QuizViewer] Slides sync error:", e);
              }
            }, 3000); // Wait additional 5 seconds for slides sync (total 8s)
            
          } catch (e) {
            console.error("❌ [QuizViewer] Background refresh error:", e);
          }
        }, 2000); // Wait 3 seconds before updating course structure
        if (celebrateOnQuizComplete) {
          try {
            // Confetti: multi-wave, spread across screen with streamers and bursts
            const shoot = (opts: Partial<import("canvas-confetti").Options>) => confetti({
              particleCount: 120,
              spread: 90,
              startVelocity: 55,
              ticks: 240,
              gravity: 0.9,
              scalar: 1.0,
              origin: { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.2 + 0.05 },
              ...opts,
            });

            // Fan-shaped side bursts
            const sideBurst = (x: number) => confetti({
              particleCount: 80,
              angle: x < 0.5 ? 60 : 120,
              spread: 55,
              origin: { x, y: 0.6 },
              colors: ["#22C55E", "#3B82F6", "#A78BFA", "#F59E0B"],
            });

            // Main waves
            shoot({ colors: ["#00C2FF", "#3B82F6", "#22C55E", "#F59E0B"], shapes: ["square", "circle"], scalar: 1.1 });
            setTimeout(() => shoot({ colors: ["#A78BFA", "#EC4899", "#F43F5E", "#10B981"], scalar: 1.25 }), 250);
            setTimeout(() => shoot({ colors: ["#FBBF24", "#34D399", "#60A5FA", "#F472B6"], scalar: 1.2 }), 600);

            // Side streamers
            setTimeout(() => sideBurst(0.15), 150);
            setTimeout(() => sideBurst(0.85), 320);
            setTimeout(() => sideBurst(0.25), 520);
            setTimeout(() => sideBurst(0.75), 700);

            // Simple fanfare using Web Audio API (no external asset)
            type WindowWithWebAudio = Window & { webkitAudioContext?: typeof AudioContext; AudioContext?: typeof AudioContext };
            const w = window as WindowWithWebAudio;
            const AudioCtx: typeof AudioContext | undefined = w.AudioContext || w.webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const now = ctx.currentTime;

              // Create a short triumphant chord progression with percussion hit
              const makeVoice = (freqs: number[], type: OscillatorType, startOffset = 0) => {
                freqs.forEach((freq, i) => {
                  const o = ctx.createOscillator();
                  const g = ctx.createGain();
                  o.type = type;
                  o.frequency.value = freq;
                  o.connect(g);
                  g.connect(ctx.destination);
                  const t0 = now + startOffset + i * 0.14;
                  g.gain.setValueAtTime(0, t0);
                  g.gain.linearRampToValueAtTime(0.15, t0 + 0.03);
                  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
                  o.start(t0);
                  o.stop(t0 + 0.36);
                });
              };

              // Melody and harmony (C major): C5 E5 G5 C6 -> E5 G5 B5 E6
              makeVoice([523.25, 659.25, 783.99, 1046.5], "triangle", 0); // melody
              makeVoice([392.0, 523.25, 659.25, 987.77], "sine", 0.02);   // harmony

              // Percussive hit (noise burst)
              const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
              const data = noiseBuffer.getChannelData(0);
              for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
              const noise = ctx.createBufferSource();
              noise.buffer = noiseBuffer;
              const noiseGain = ctx.createGain();
              noise.connect(noiseGain);
              noiseGain.connect(ctx.destination);
              noiseGain.gain.setValueAtTime(0.0001, now);
              noiseGain.gain.exponentialRampToValueAtTime(0.4, now + 0.01);
              noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
              noise.start(now + 0.02);
              noise.stop(now + 0.3);
            }
          } catch {
            // ignore celebration errors
          }
        }
        const card = computeScore(answers);
        setScoreCard(card);
        if (passPercentage != null && card.totalMarks > 0) {
          const pct = (card.earned / card.totalMarks) * 100;
          setPassed(pct >= passPercentage);
        } else {
          setPassed(null);
        }
        setShowReview(true); // <-- Show review page
        if (onComplete) onComplete();
      } catch (err) {
        console.error("❌ [QuizViewer] Quiz submission failed", err);
        toast.error("Failed to submit quiz. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Progress bar width
  const progress = ((current + 1) / total) * 100;

  // Check if question has a passage (comprehension question)
  const hasPassage = currentQuestion.parent_rich_text?.content && currentQuestion.parent_rich_text.content.trim() !== "";
  console.log("Has passage:", hasPassage, "Passage content:", currentQuestion.parent_rich_text?.content);

  // Helper function to safely get question text content
  const getQuestionText = () => {
    // Try different possible field names for question text
    if (currentQuestion.text && typeof currentQuestion.text === 'object' && currentQuestion.text.content) {
      return currentQuestion.text.content;
    }
    if (currentQuestion.text_data?.content) {
      return currentQuestion.text_data.content;
    }
    if (typeof currentQuestion.text === 'string') {
      return currentQuestion.text;
    }
    return "";
  };

  // Helper function to safely get passage content
  const getPassageText = () => {
    if (currentQuestion.parent_rich_text?.content) {
      return currentQuestion.parent_rich_text.content;
    }
    return "";
  };

  // Helper to get plain text from HTML
  const getPlainText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  // Passage logic
  const passageHtml = getPassageText();
  const passagePlain = getPlainText(passageHtml);
  const PASSAGE_LIMIT = 200;
  const isPassageLong = passagePlain.length > PASSAGE_LIMIT;
  const passageToShow = showFullPassage || !isPassageLong
    ? passageHtml
    : getPlainText(passageHtml).slice(0, PASSAGE_LIMIT) + "...";

  // Render input based on question type
  const renderInput = () => {
    const currentAnswer = answers[currentQuestion.id];

    switch (questionType) {
      case "CNUMERIC":
      case "NUMERIC":
        return (
          <div className="space-y-3 sm:space-y-4 mt-4">
            <MyInput
              inputType="text"
              input={String(currentAnswer || "")}
              onChangeFunction={(e) => handleNumericInput(e.target.value)}
              inputPlaceholder="Enter numeric value"
              inputMode="numeric"
              className={`text-sm py-3 font-normal w-full border-primary-100 focus:border-primary-500 focus:ring-primary-500 ${
                numericErrors[currentQuestion.id] ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600" : ""
              }`}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
            {numericErrors[currentQuestion.id] && (
              <p className="text-danger-600 text-sm mt-1">{numericErrors[currentQuestion.id]}</p>
            )}
          </div>
        );

      case "ONE_WORD":
      case "TEXT":
        return (
          <div className="w-full mt-2 sm:mt-4">
            <MyInput
              inputType="text"
              input={String(currentAnswer || "")}
              onChangeFunction={(e) => handleTextInput(e.target.value)}
              inputPlaceholder="Type your answer"
              className="text-sm py-3 font-normal w-full border-primary-100 focus:border-primary-500 focus:ring-primary-500"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
          </div>
        );

      case "LONG_ANSWER":
        return (
          <div className="w-full mt-2 sm:mt-4">
            <Textarea
              value={currentAnswer || ""}
              onChange={(e) => handleTextInput(e.target.value)}
              placeholder="Type your answer..."
              className="min-h-[150px] sm:min-h-[200px] text-sm w-full border-primary-100 focus:border-primary-500 focus:ring-primary-500"
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
            />
          </div>
        );

      case "CMCQM":
      case "MCQM":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
            {currentQuestion.options.map((option, index) => {
              const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
              return (
                <div
                  key={option.id}
                  onClick={() => handleMultiOptionSelect(option.id)}
                  className={`flex items-center space-x-3 rounded-md border p-3 w-full cursor-pointer transition-all duration-200 select-none
                    ${selected
                      ? "border-primary-500 text-primary-700"
                      : "border-primary-100 hover:border-primary-500 text-neutral-700"}
                  `}
                  style={{ userSelect: "none" }}
                >
                  <div className="relative flex items-center">
                    <div
                      className={`w-5 h-5 border rounded-md flex items-center justify-center transition-colors
                        ${selected ? "bg-primary-500 border-primary-500" : "border-primary-200 bg-white"}
                      `}
                    >
                      {selected && <span className="text-white text-sm">✓</span>}
                    </div>
                  </div>
                  <label
                    className={`flex items-center text-sm ${selected ? "font-medium text-primary-700" : "text-neutral-700"}`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(97 + index)}.</span>
                    <span dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(option.text.content) }} />
                  </label>
                </div>
              );
            })}
          </div>
        );
      case "CMCQS":
      case "MCQS":
      case "TRUE_FALSE":
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4">
            {currentQuestion.options.map((option, index) => {
              const selected = currentAnswer === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => handleOptionSelect(option.id)}
                  className={`flex items-center space-x-3 rounded-md border p-3 w-full cursor-pointer transition-all duration-200 select-none
                    ${selected
                      ? "border-primary-500 text-primary-700"
                      : "border-primary-100 hover:border-primary-500 text-neutral-700"}
                  `}
                  style={{ userSelect: "none" }}
                >
                  <div className="relative flex items-center">
                    <div
                      className={`w-5 h-5 border rounded-md flex items-center justify-center transition-colors
                        ${selected ? "bg-primary-500 border-primary-500" : "border-primary-200 bg-white"}
                      `}
                    >
                      {selected && <span className="text-white text-sm">✓</span>}
                    </div>
                  </div>
                  <label
                    className={`flex items-center text-sm ${selected ? "font-medium text-primary-700" : "text-neutral-700"}`}
                  >
                    {questionType === "TRUE_FALSE" ? (
                      <span dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(option.text.content) }} />
                    ) : (
                      <>
                        <span className="font-medium mr-2">{String.fromCharCode(97 + index)}.</span>
                        <span dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(option.text.content) }} />
                      </>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        );
    }
  };

  // Check if current question is answered
  const isAnswered = () => {
    const currentAnswer = answers[currentQuestion.id];
    if (!currentAnswer) return false;
    
    switch (questionType) {
      case "CNUMERIC":
      case "NUMERIC":
        return typeof currentAnswer === "number" && currentAnswer !== 0;
      case "CMCQM":
      case "MCQM":
      case "MULTIPLE_CHOICE":
        return Array.isArray(currentAnswer) && currentAnswer.length > 0;
      default:
        return typeof currentAnswer === "string" && currentAnswer.trim() !== "";
    }
  };

  return (
    <div className="w-full min-h-[80vh] bg-white rounded-xl shadow-lg p-4 sm:p-8">
      {/* Timer warning overlay */}
      {showWarning && <QuizTimeWarning onDismiss={() => setShowWarning(false)} />}

      {/* Question X of Y and Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">Question {current + 1} of {total}</span>
          <div className="ml-auto flex items-center gap-3">
            {timeLimitMinutes && timeLimitMinutes > 0 && (
              <QuizTimer
                totalSeconds={timeLimitMinutes * 60}
                onWarn={() => setShowWarning(true)}
                onExpire={handleTimerExpire}
              />
            )}
            <span className="text-xs text-primary-600 font-medium" style={{ minWidth: 80, textAlign: 'right' }}>
              {questionTypeDescription}
            </span>
          </div>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden bg-gray-200 relative">
          <div
            className="h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-primary-400 to-primary-600 absolute left-0 top-0"
            style={{ width: `${progress}%` }}
          />
          {/* The gray background is already present as bg-gray-200 */}
        </div>
      </div>

      {/* Question Content */}
      <div className="mb-8">
        {/* Render passage and question together if passage exists */}
        {hasPassage ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Passage:</h3>
            <div 
              className="text-sm text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: showFullPassage || !isPassageLong ? renderHtmlWithMath(passageHtml) : renderHtmlWithMath(passageToShow) }}
            />
            {isPassageLong && (
              <button
                className="mt-2 text-primary-600 hover:underline text-xs font-medium focus:outline-none"
                onClick={() => setShowFullPassage((prev) => !prev)}
                type="button"
              >
                {showFullPassage ? "Show less" : "Show more"}
              </button>
            )}
            {/* Question text inside the same box */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Question:</h3>
              <div 
                className="text-sm font-medium text-gray-900 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(getQuestionText() || "Question text not available") }}
              />
            </div>
          </div>
        ) : (
          // No passage, just show question text as before
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Question:</h3>
            <div 
              className="text-sm font-medium text-gray-900 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(getQuestionText() || "Question text not available") }}
            />
          </div>
        )}

        {renderInput()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <MyButton
          buttonType="secondary"
          scale="medium"
          disable={current === 0}
          onClick={handlePrev}
          className="flex items-center justify-center min-w-[120px] space-x-2"
        >
          <span>←</span>
          <span>Previous</span>
        </MyButton>

        <div className="flex items-center space-x-2">
          {isAnswered() && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          <span className="text-sm text-gray-500">
            {isAnswered() ? "Answered" : "Not answered"}
          </span>
          {showIncorrectNotice && (
            <span className="text-sm text-danger-600 ml-2">Incorrect. Try again.</span>
          )}
        </div>

        <MyButton
          buttonType="primary"
          scale="medium"
          disable={!isAnswered() || isSubmitting}
          onClick={handleNext}
          className="flex items-center justify-center min-w-[120px] space-x-2"
        >
          <span>{isSubmitting ? "Submitting..." : current === total - 1 ? "Finish" : "Next"}</span>
          {current !== total - 1 && !isSubmitting && <span>→</span>}
        </MyButton>
      </div>
    </div>
  );
};

export default QuizViewer;
