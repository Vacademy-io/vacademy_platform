/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Code,
  Play,
  Moon,
  Sun,
  Copy,
  Download,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
  Minimize2,
  Maximize2,
  GripVertical,
} from "lucide-react";

import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Activity tracking imports
import { v4 as uuidv4 } from "uuid";
import { useTrackingStore } from "@/stores/study-library/pdf-tracking-store";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { usePDFSync } from "@/hooks/study-library/usePdfSync";
import { Preferences } from "@capacitor/preferences";
import { executeCode } from "./code-slide-utils.";
import { getEpochTimeInMillis, getISTTime } from "./utils";
import {
  DEFAULT_CODE_SAMPLES,
  SupportedLanguage,
} from "./constants/code-slide";

export interface CodeEditorData {
  language: string;
  theme: "dark" | "light";
  // Legacy field for backward compatibility
  code: string;
  viewMode: "edit" | "view";
  // New structure to store all languages' data with timestamps
  allLanguagesData: {
    python: {
      code: string;
      lastEdited: number;
    };
    javascript: {
      code: string;
      lastEdited: number;
    };
  };
  // Legacy fields for backward compatibility
  readOnly?: boolean;
  showLineNumbers?: boolean;
  fontSize?: number;
  editorType?: "codeEditor";
  timestamp?: number;
}

interface CodeEditorSlideProps {
  published_data: string;
  documentId: string;
}

export interface EditorState {
  currentLanguage: SupportedLanguage;
  theme: "dark" | "light";
  readOnly: boolean;
  viewMode: "edit" | "view";
  codeSamples: {
    python: string;
    javascript: string;
  };
}

export const CodeEditorSlide: React.FC<CodeEditorSlideProps> = ({
  published_data,
  documentId,
}) => {
  const [editorState, setEditorState] = useState<EditorState>({
    currentLanguage: "python",
    theme: "dark",
    readOnly: false,
    viewMode: "edit",
    codeSamples: {
      python: "",
      javascript: "",
    },
  });

  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // Activity tracking state
  const { addActivity } = useTrackingStore();
  const { activeItem } = useContentStore();
  const { syncPDFTrackingData } = usePDFSync();

  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activityId = useRef(uuidv4());
  const startTime = useRef(getISTTime());
  const startTimeInMillis = useRef(getEpochTimeInMillis());
  const [isFirstView, setIsFirstView] = useState(true);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Activity tracking for code editor (treating each action as a "page view")
  const [currentAction, setCurrentAction] = useState(1); // 1 for editing, 2 for running code, etc.
  const actionStartTime = useRef<Date>(new Date());
  const actionViews = useRef<
    Array<{
      id: string;
      page: number; // Using page as action type (1=editing, 2=running, 3=language switch)
      duration: number;
      start_time: string;
      end_time: string;
      start_time_in_millis: number;
      end_time_in_millis: number;
    }>
  >([]);
  const totalActionsPerformedRef = useRef<number>(0);

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCountdown, setVerificationCountdown] = useState(59);
  const [verificationNumbers, setVerificationNumbers] = useState<number[]>([]);
  const [responseTimesArray, setResponseTimesArray] = useState<number[]>([]);
  const [answeredTimeArray, setAnsweredTimeArray] = useState<number[]>([]);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Activity metrics
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [missedAnswerCount, setMissedAnswerCount] = useState(0);
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityThreshold = 60000;

  // state for output panel
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);
  const [isOutputFullScreen, setIsOutputFullScreen] = useState(false);
  const [outputHeight, setOutputHeight] = useState(200); // Default height in pixels
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Save verification data
  const saveVerificationTime = async (time: number) => {
    try {
      await Preferences.set({
        key: "code_editor_verification_time",
        value: time.toString(),
      });
    } catch (error) {
      console.error("Error saving verification time:", error);
    }
  };

  const saveAnsweredTimeArray = async (times: number[]) => {
    try {
      await Preferences.set({
        key: "code_editor_answered_time",
        value: JSON.stringify(times),
      });
    } catch (error) {
      console.error("Error saving answered time array:", error);
    }
  };

  // Load saved verification data
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const { value: answeredTimeValue } = await Preferences.get({
          key: "code_editor_answered_time",
        });
        if (answeredTimeValue) {
          const savedAnsweredTime = JSON.parse(answeredTimeValue);
          setAnsweredTimeArray(savedAnsweredTime);
        }

        const { value } = await Preferences.get({
          key: "code_editor_verification_time",
        });
        if (value) {
          // Can be used for verification time tracking if needed
        }
      } catch (error) {
        console.error("Error loading saved verification data:", error);
      }
    };

    loadSavedData();
  }, []);

  // Timer management
  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Generate verification numbers
  const generateVerificationNumbers = useCallback(() => {
    const correctNum = Math.floor(Math.random() * 100);
    let num1 = correctNum;
    let num2 = correctNum;
    while (num1 === correctNum) num1 = Math.floor(Math.random() * 100);
    while (num2 === correctNum || num2 === num1)
      num2 = Math.floor(Math.random() * 100);
    const numbers = [num1, correctNum, num2];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    setVerificationNumbers(numbers);
    return numbers.indexOf(correctNum);
  }, []);

  // Start verification timer
  const startVerificationTimer = useCallback(() => {
    if (verificationTimerRef.current)
      clearInterval(verificationTimerRef.current);
    setVerificationCountdown(59);
    verificationTimerRef.current = setInterval(() => {
      setVerificationCountdown((prev) => {
        if (prev <= 1) {
          setIsPaused(true);
          setMissedAnswerCount((prev) => prev + 1);
          if (verificationTimerRef.current) {
            clearInterval(verificationTimerRef.current);
            verificationTimerRef.current = null;
          }
          setShowVerification(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Inactivity verification
  const startInactivityVerification = useCallback(() => {
    if (verificationTimeoutRef.current)
      clearTimeout(verificationTimeoutRef.current);
    verificationTimeoutRef.current = setTimeout(() => {
      if (!showVerification && !isPaused) {
        setShowVerification(true);
        generateVerificationNumbers();
        startVerificationTimer();
      }
    }, inactivityThreshold);
  }, [
    generateVerificationNumbers,
    isPaused,
    showVerification,
    startVerificationTimer,
  ]);

  // User activity tracking
  const handleUserActivity = useCallback(() => {
    lastActivityTimeRef.current = Date.now();

    if (isPaused) {
      setIsPaused(false);
    }

    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      setIsPaused(true);
    }, 5 * 60 * 1000);

    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }

    if (!showVerification) {
      startInactivityVerification();
    }
  }, [isPaused, showVerification, startInactivityVerification]);

  // Add tab visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      if (isHidden) {
        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          return newCount;
        });
        setIsPaused(true);
        stopTimer();
      } else {
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [documentId, stopTimer]);

  // Start timer when component mounts
  useEffect(() => {
    startTimer();
    return () => {
      stopTimer();
    };
  }, [startTimer, stopTimer, documentId]);

  // Handle resume activity
  const handleResumeActivity = useCallback(() => {
    setIsPaused(false);
    startTimer();
    handleUserActivity();
  }, [startTimer, handleUserActivity]);

  // Handle verification click
  const handleVerificationClick = useCallback(
    (index: number) => {
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
        verificationTimerRef.current = null;
      }

      const responseTime = 59 - verificationCountdown;
      const correctIndex = verificationNumbers.indexOf(
        Math.max(
          ...verificationNumbers.filter(
            (n) =>
              n !== verificationNumbers[0] ||
              (verificationNumbers[0] !== verificationNumbers[1] &&
                verificationNumbers[0] !== verificationNumbers[2])
          )
        )
      );

      const newAnsweredTimes = [...answeredTimeArray, responseTime];
      setAnsweredTimeArray(newAnsweredTimes);
      saveAnsweredTimeArray(newAnsweredTimes);

      if (index === correctIndex) {
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        saveVerificationTime(currentTimeInSeconds);

        const newResponseTimes = [...responseTimesArray, responseTime];
        setResponseTimesArray(newResponseTimes);

        setIsPaused(false);
        setShowVerification(false);
        startInactivityVerification();
      } else {
        setIsPaused(true);
        setWrongAnswerCount((prev) => prev + 1);
        setShowVerification(false);
      }
    },
    [
      verificationCountdown,
      verificationNumbers,
      answeredTimeArray,
      responseTimesArray,
      startInactivityVerification,
    ]
  );

  // Add event listeners for user activity
  useEffect(() => {
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("mousedown", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);

    inactivityTimeoutRef.current = setTimeout(() => {
      setIsPaused(true);
    }, 5 * 60 * 1000);

    startInactivityVerification();

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("mousedown", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);

      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }

      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
    };
  }, [handleUserActivity, startInactivityVerification]);

  // Timer management
  useEffect(() => {
    if (isPaused) {
      stopTimer();
    } else {
      startTimer();
    }
  }, [isPaused, startTimer, stopTimer]);

  // Handle document load (first view)
  const handleDocumentLoad = () => {
    if (isFirstView) {
      syncPDFTrackingData();
      setIsFirstView(false);

      if (!updateIntervalRef.current) {
        updateIntervalRef.current = setInterval(() => {
          syncPDFTrackingData();
        }, 60 * 1000);
      }
    }
  };

  // Track action changes (like switching languages, running code, etc.)
  const handleActionChange = useCallback(
    (actionType: number) => {
      const now = getEpochTimeInMillis();
      const duration = Math.round(
        (now - actionStartTime.current.getTime()) / 1000
      );

      if (duration >= 5) {
        // Only track actions longer than 5 seconds
        actionViews.current.push({
          id: uuidv4(),
          page: currentAction,
          duration,
          start_time: new Date(actionStartTime.current).toISOString(),
          end_time: new Date(now).toISOString(),
          start_time_in_millis: actionStartTime.current.getTime(),
          end_time_in_millis: now,
        });
      }

      setCurrentAction(actionType);
      actionStartTime.current = new Date();
      handleUserActivity();
    },
    [currentAction, handleUserActivity]
  );

  // Initialize from published_data with proper priority
  useEffect(() => {
    if (!published_data) {
      setEditorState({
        currentLanguage: "python",
        theme: "dark",
        readOnly: false,
        viewMode: "edit",
        codeSamples: {
          python: DEFAULT_CODE_SAMPLES.python,
          javascript: DEFAULT_CODE_SAMPLES.javascript,
        },
      });
      return;
    }

    try {
      const data = JSON.parse(published_data) as CodeEditorData;

      const initialLanguage =
        (data.language as keyof typeof DEFAULT_CODE_SAMPLES) || "python";

      // Priority logic for code content:
      // 1. New allLanguagesData structure (if exists and has content)
      // 2. Legacy code field (for backward compatibility)
      // 3. Default samples
      const getCodeForLanguage = (
        lang: keyof typeof DEFAULT_CODE_SAMPLES,
        allLanguagesData?: {
          python: { code: string; lastEdited: number };
          javascript: { code: string; lastEdited: number };
        },
        legacyCode?: string,
        isCurrentLanguage?: boolean
      ) => {
        // First priority: New allLanguagesData structure
        if (
          allLanguagesData &&
          allLanguagesData[lang] &&
          allLanguagesData[lang].code &&
          allLanguagesData[lang].code.trim()
        ) {
          return allLanguagesData[lang].code;
        }

        // Second priority: Legacy code field (only for current language)
        if (isCurrentLanguage && legacyCode && legacyCode.trim()) {
          return legacyCode;
        }

        // Fallback: Default samples
        return DEFAULT_CODE_SAMPLES[lang];
      };

      const newState = {
        currentLanguage: initialLanguage,
        theme: data.theme || "dark",
        readOnly: data.readOnly || false,
        viewMode: data.viewMode || "edit",
        codeSamples: {
          python: getCodeForLanguage(
            "python",
            data.allLanguagesData,
            data.code,
            initialLanguage === "python"
          ),
          javascript: getCodeForLanguage(
            "javascript",
            data.allLanguagesData,
            data.code,
            initialLanguage === "javascript"
          ),
        },
      };

      setEditorState(newState as EditorState);

      // Initialize activity tracking on first load
      handleDocumentLoad();
    } catch (error) {
      console.error("[CodeEditor] Error parsing published_data:", error);
      // Fallback to defaults only if parsing completely fails
      setEditorState({
        currentLanguage: "python",
        theme: "dark",
        readOnly: false,
        viewMode: "edit",
        codeSamples: {
          python: DEFAULT_CODE_SAMPLES.python,
          javascript: DEFAULT_CODE_SAMPLES.javascript,
        },
      });
    }
  }, [published_data]);

  // Update activity tracking
  useEffect(() => {
    totalActionsPerformedRef.current = new Set(
      actionViews.current.map((v) => v.page)
    ).size;

    addActivity({
      slide_id: activeItem?.id || "",
      activity_id: activityId.current,
      source: "DOCUMENT" as const,
      source_id: documentId || "",
      start_time: startTime.current,
      end_time: getISTTime(),
      start_time_in_millis: startTimeInMillis.current,
      end_time_in_millis: getEpochTimeInMillis(),
      duration: elapsedTime.toString(),
      page_views: actionViews.current,
      total_pages_read: totalActionsPerformedRef.current,
      sync_status: "STALE",
      current_page: currentAction,
      current_page_start_time_in_millis: actionStartTime.current.getTime(),
      new_activity: true,
      concentration_score: {
        id: activityId.current,
        concentration_score: 0,
        tab_switch_count: tabSwitchCount,
        pause_count: missedAnswerCount,
        wrong_answer_count: wrongAnswerCount,
        answer_times_in_seconds: answeredTimeArray,
      },
    });
  }, [
    elapsedTime,
    documentId,
    isPaused,
    answeredTimeArray,
    tabSwitchCount,
    missedAnswerCount,
    wrongAnswerCount,
    activeItem?.id,
    addActivity,
    currentAction,
  ]);

  const getCurrentCode = () => {
    return editorState.codeSamples[editorState.currentLanguage];
  };
  const isEditable = !editorState.readOnly;

  const runCode = useCallback(async () => {
    const currentCode = getCurrentCode();

    if (!currentCode.trim()) {
      setOutput("No code to execute. Please write some code first.");
      setIsOutputExpanded(true);
      return;
    }

    setIsRunning(true);
    setIsPyodideLoading(true);
    setIsOutputExpanded(true);
    setOutput("Loading Python environment...");

    // Track code execution activity
    handleActionChange(2); // Action type 2 for running code
    try {
      const { output } = await executeCode(
        currentCode,
        editorState.currentLanguage
      );
      setOutput(output);
    } catch (error) {
      setOutput(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsRunning(false);
      setIsPyodideLoading(false);
    }
  }, [editorState.currentLanguage, getCurrentCode, handleActionChange]);

  const copyCode = () => {
    navigator.clipboard.writeText(getCurrentCode());
    handleUserActivity(); // Track copy activity
  };

  const downloadCode = () => {
    const code = getCurrentCode();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${
      editorState.currentLanguage === "python" ? "py" : "js"
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    handleUserActivity(); // Track download activity
  };

  const handleThemeChange = () => {
    setEditorState((prev) => ({
      ...prev,
      theme: prev.theme === "dark" ? "light" : "dark",
    }));
    handleUserActivity(); // Track theme change activity
  };

  const handleCodeChange = (value: string | undefined) => {
    if (editorState.readOnly || editorState.viewMode === "view") return;

    const newCode = value || "";
    setEditorState((prev) => ({
      ...prev,
      codeSamples: {
        ...prev.codeSamples,
        [prev.currentLanguage]: newCode,
      },
    }));

    // Track code editing activity
    handleUserActivity();
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Add Ctrl+Enter shortcut to run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCode();
    });

    // Track editor mounting
    handleUserActivity();
  };

  // Output panel controls
  const toggleOutputExpanded = useCallback(() => {
    setIsOutputExpanded(!isOutputExpanded);
    if (isOutputFullScreen) {
      setIsOutputFullScreen(false);
    }
  }, [isOutputExpanded, isOutputFullScreen]);

  const toggleOutputFullScreen = useCallback(() => {
    setIsOutputFullScreen(!isOutputFullScreen);
  }, [isOutputFullScreen]);

  // Resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const container = resizeRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;

      // Set minimum and maximum heights
      const minHeight = 100;
      const maxHeight = window.innerHeight * 0.8;

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setOutputHeight(newHeight);
      }
    },
    [isResizing]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add keyboard shortcut for running code
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!isRunning && isEditable) {
          runCode();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRunning, isEditable, runCode]);

  // Add resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    }
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Calculate editor height based on output panel state
  const getEditorHeight = () => {
    if (isOutputFullScreen) return "0px";
    if (!isOutputExpanded) return "100%";
    return `calc(100% - ${outputHeight}px)`;
  };

  return (
    <div className="h-full p-1 relative">
      {/* Verification overlay */}
      {showVerification && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-full max-w-xs z-[10000] animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-yellow-50 border bg-primary-500 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2">
              <div className="mt-1">
                <p className="text-xs text-neutral-600">
                  Just ensuring that you are actively learning, please click the
                  number{" "}
                  <span className="text-primary-500">
                    {Math.max(
                      ...verificationNumbers.filter(
                        (n) =>
                          n !== verificationNumbers[0] ||
                          (verificationNumbers[0] !== verificationNumbers[1] &&
                            verificationNumbers[0] !== verificationNumbers[2])
                      )
                    )}
                  </span>{" "}
                  within{" "}
                  <span className="text-primary-500">
                    {verificationCountdown}{" "}
                  </span>
                  seconds.
                </p>
              </div>
              <div className="mt-2 flex justify-center space-x-2">
                {verificationNumbers.map((number, index) => (
                  <button
                    key={index}
                    onClick={() => handleVerificationClick(index)}
                    className="px-2 py-1 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white text-neutral-600 border-xl"
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 text-center">
            <h3 className="mb-4 text-lg font-semibold">Code Editor Paused</h3>
            <p className="mb-4 text-sm text-gray-600">
              You've switched tabs {tabSwitchCount} times. Please click below to
              resume coding.
            </p>
            <button
              onClick={handleResumeActivity}
              className="rounded bg-primary-500 px-4 py-2 text-white hover:bg-primary-600"
            >
              Resume Coding
            </button>
          </div>
        </div>
      )}

      <Card className="h-full" onClick={handleUserActivity}>
        <CardHeader className="pb-2">
          <div className="flex flex-col items-center justify-between gap-2 lg:flex-row">
            <div className="flex items-center gap-2">
              <Code className="size-5" />
              <span className="text-lg font-semibold">Code Editor</span>
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-normal text-gray-600">
                {editorState.viewMode === "edit" ? "Edit Mode" : "View Mode"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={runCode}
                disabled={isRunning || !isEditable}
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Play className="mr-1 size-4" />
                {isRunning ? "Running..." : "Run"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUserActivity}
                  >
                    <Settings className="mr-1 size-4" />
                    Settings
                    <ChevronDown className="ml-1 size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => {
                      handleThemeChange();
                      handleUserActivity();
                    }}
                    disabled={!isEditable}
                  >
                    {editorState.theme === "light" ? (
                      <>
                        <Moon className="mr-2 size-4" />
                        Switch to Dark Theme
                      </>
                    ) : (
                      <>
                        <Sun className="mr-2 size-4" />
                        Switch to Light Theme
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => {
                      copyCode();
                      handleUserActivity();
                    }}
                  >
                    <Copy className="mr-2 size-4" />
                    Copy Code
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      downloadCode();
                      handleUserActivity();
                    }}
                  >
                    <Download className="mr-2 size-4" />
                    Download Code
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex h-[550px] flex-col">
            <div
              className="flex-1 border-t"
              style={{ height: getEditorHeight() }}
            >
              <Editor
                height="100%"
                language={editorState.currentLanguage}
                value={getCurrentCode()}
                theme={editorState.theme === "dark" ? "vs-dark" : "light"}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                options={{
                  readOnly: !isEditable || editorState.viewMode === "view",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  fontSize: 14,
                  lineNumbers: "on",
                  roundedSelection: false,
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  padding: { top: 16 },
                }}
              />
            </div>
            {isOutputExpanded && (
              <>
                {/* Resize Handle */}
                <div
                  ref={resizeRef}
                  className="flex h-1 cursor-ns-resize items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                  onMouseDown={handleResizeStart}
                >
                  <GripVertical className="size-4 text-gray-500" />
                </div>

                {/* Output Content */}
                <div
                  className="flex flex-col overflow-y-scroll border-t"
                  style={{
                    height: isOutputFullScreen ? "100vh" : `${outputHeight}px`,
                  }}
                >
                  {/* Output Header */}
                  <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2 dark:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Console</span>
                      {output && !isRunning && (
                        <span className="inline-flex size-2 rounded-full bg-green-500"></span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleOutputFullScreen}
                        className="size-8 p-0"
                      >
                        {isOutputFullScreen ? (
                          <Minimize2 className="size-4" />
                        ) : (
                          <Maximize2 className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleOutputExpanded}
                        className="size-8 p-0"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Output Content */}
                  <div className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-sm text-green-400">
                    <pre className="whitespace-pre-wrap">
                      {isPyodideLoading && isRunning
                        ? "Loading Python environment (this may take a few seconds on first run)..."
                        : output || 'Click "Run Code" to see output here...'}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {/* Output Toggle Button (when collapsed) */}
            {!isOutputExpanded && (
              <div className="border-t p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleOutputExpanded}
                >
                  <ChevronUp className="mr-1 size-4" />
                  Show Output
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
