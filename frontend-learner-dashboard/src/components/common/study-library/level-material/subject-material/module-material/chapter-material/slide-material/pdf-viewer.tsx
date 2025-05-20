"use client";

import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import type {
  DocumentLoadEvent,
  PageChangeEvent,
} from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { v4 as uuidv4 } from "uuid";
import { useTrackingStore } from "@/stores/study-library/pdf-tracking-store";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { getISTTime } from "./utils";
import { usePDFSync } from "@/hooks/study-library/usePdfSync";
import { getEpochTimeInMillis } from "./utils";
import { PdfViewerComponent } from "./pdf-viewer-component";
import { Preferences } from "@capacitor/preferences";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";

interface PDFViewerProps {
  documentId?: string;
  pdfUrl: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ documentId, pdfUrl }) => {
  const { addActivity } = useTrackingStore();
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageStartTime = useRef<Date>(new Date());
  const activityId = useRef(uuidv4());
  const startTime = useRef(getISTTime());
  const pageViews = useRef<
    Array<{
      id: string;
      page: number;
      duration: number;
      start_time: string;
      end_time: string;
      start_time_in_millis: number;
      end_time_in_millis: number;
    }>
  >([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalPagesReadRef = useRef<number>(0);
  const startTimeInMillis = useRef(getEpochTimeInMillis());
  const { syncPDFTrackingData } = usePDFSync();
  const [isFirstView, setIsFirstView] = useState(true);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { activeItem } = useContentStore();

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCountdown, setVerificationCountdown] = useState(59);
  const [verificationNumbers, setVerificationNumbers] = useState<number[]>([]);
  const [lastVerificationTime, setLastVerificationTime] = useState(0);
  const [responseTimesArray, setResponseTimesArray] = useState<number[]>([]);
  const [answeredTimeArray, setAnsweredTimeArray] = useState<number[]>([]);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Update the state variables to include tab switch tracking and missed answers
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [missedAnswerCount, setMissedAnswerCount] = useState(0);
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0);

  // Track user activity
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityThreshold = 60000;

  // Load saved verification time from Capacitor preferences
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Load answered_time array
        const { value: answeredTimeValue } = await Preferences.get({
          key: "pdf_answered_time",
        });
        if (answeredTimeValue) {
          const savedAnsweredTime = JSON.parse(answeredTimeValue);
          setAnsweredTimeArray(savedAnsweredTime);
        }

        // Load last verification time
        const { value } = await Preferences.get({
          key: "pdf_verification_time",
        });
        if (value) {
          const savedTime = Number.parseInt(value, 10);
          setLastVerificationTime(savedTime);
          console.log(lastVerificationTime);
        }
      } catch (error) {
        console.error("Error loading saved verification data:", error);
      }
    };

    loadSavedData();
  }, []);

  // Save verification time to Capacitor preferences
  const saveVerificationTime = async (time: number) => {
    try {
      await Preferences.set({
        key: "pdf_verification_time",
        value: time.toString(),
      });
    } catch (error) {
      console.error("Error saving verification time:", error);
    }
  };

  // Save answered time array to Capacitor preferences
  const saveAnsweredTimeArray = async (times: number[]) => {
    try {
      await Preferences.set({
        key: "pdf_answered_time",
        value: JSON.stringify(times),
      });
    } catch (error) {
      console.error("Error saving answered time array:", error);
    }
  };

  // Update the generateVerificationNumbers function to randomize the order
  const generateVerificationNumbers = useCallback(() => {
    const correctNum = Math.floor(Math.random() * 100);
    let num1 = correctNum;
    let num2 = correctNum;

    // Ensure numbers are different from the correct one
    while (num1 === correctNum) {
      num1 = Math.floor(Math.random() * 100);
    }

    while (num2 === correctNum || num2 === num1) {
      num2 = Math.floor(Math.random() * 100);
    }

    // Create array with all three numbers
    const numbers = [num1, correctNum, num2];

    // Shuffle the array to randomize the position of the correct number
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    setVerificationNumbers(numbers);
    return numbers.indexOf(correctNum);
  }, []);

  // Start the verification countdown timer
  const startVerificationTimer = useCallback(() => {
    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
    }

    setVerificationCountdown(59);

    verificationTimerRef.current = setInterval(() => {
      setVerificationCountdown((prev) => {
        if (prev <= 1) {
          // Time's up, pause the PDF viewing
          setIsPaused(true);

          // Record missed answer
          setMissedAnswerCount((prev) => prev + 1);

          // Clear the timer
          if (verificationTimerRef.current) {
            clearInterval(verificationTimerRef.current);
            verificationTimerRef.current = null;
          }

          // Hide verification
          setShowVerification(false);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Show verification after inactivity
  const startInactivityVerification = useCallback(() => {
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }

    // Set timeout to show verification after inactivity threshold
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

  // Update the handleVerificationClick function to track wrong answers
  const handleVerificationClick = (index: number) => {
    // Clear the verification timer
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

    // Add response time to arrays regardless of correct/incorrect
    const newAnsweredTimes = [...answeredTimeArray, responseTime];
    setAnsweredTimeArray(newAnsweredTimes);
    saveAnsweredTimeArray(newAnsweredTimes);

    // Check if correct number was clicked
    if (index === correctIndex) {
      // Record verification time
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      setLastVerificationTime(currentTimeInSeconds);
      saveVerificationTime(currentTimeInSeconds);

      // Add response time to arrays
      const newResponseTimes = [...responseTimesArray, responseTime];
      setResponseTimesArray(newResponseTimes);

      // Resume PDF viewing
      setIsPaused(false);

      // Hide verification
      setShowVerification(false);

      // Reset inactivity verification timer
      startInactivityVerification();
    } else {
      // Wrong number clicked, keep PDF paused
      setIsPaused(true);

      // Record wrong answer
      setWrongAnswerCount((prev) => prev + 1);

      // Close the verification dialog
      setShowVerification(false);
    }
  };

  // User activity tracking - updated to reset inactivity timer
  const handleUserActivity = useCallback(() => {
    lastActivityTimeRef.current = Date.now();

    // If PDF is paused due to inactivity, resume it
    if (isPaused) {
      setIsPaused(false);
    }

    // Reset inactivity timeout for auto-pause
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    // Set new inactivity timeout (5 minutes)
    inactivityTimeoutRef.current = setTimeout(
      () => {
        setIsPaused(true);
      },
      5 * 60 * 1000
    );

    // Reset verification timeout
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }

    // If verification is showing, don't start a new verification timer
    if (!showVerification) {
      startInactivityVerification();
    }
  }, [isPaused, showVerification, startInactivityVerification]);

  // Add event listeners for user activity
  useEffect(() => {
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("mousedown", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);
    window.addEventListener("scroll", handleUserActivity);

    // Set initial inactivity timeout
    inactivityTimeoutRef.current = setTimeout(
      () => {
        setIsPaused(true);
      },
      5 * 60 * 1000
    );

    // Start initial verification timeout
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

  // Pause timer when PDF is paused
  useEffect(() => {
    if (isPaused) {
      stopTimer();
    } else {
      startTimer();
    }
  }, [isPaused]);

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start timer when component mounts
  useEffect(() => {
    startTimer();
    return () => {
      stopTimer();
    };
  }, []);

  // Add tab visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switched away
        setTabSwitchCount((prev) => prev + 1);
        setIsPaused(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Update activity in real-time when elapsedTime changes
  useEffect(() => {
    totalPagesReadRef.current = new Set(
      pageViews.current.map((v) => v.page)
    ).size;

    addActivity(
      {
        slide_id: activeItem?.id || "",
        activity_id: activityId.current,
        source: "DOCUMENT" as const,
        source_id: documentId || "",
        start_time: startTime.current,
        end_time: getISTTime(),
        start_time_in_millis: startTimeInMillis.current,
        end_time_in_millis: getEpochTimeInMillis(),
        duration: elapsedTime.toString(),
        page_views: pageViews.current,
        total_pages_read: totalPagesReadRef.current,
        sync_status: "STALE",
        current_page: currentPage,
        current_page_start_time_in_millis: pageStartTime.current.getTime(),
        new_activity: true,
        // is_paused: isPaused,
        concentration_score: {
          id: activityId.current,
          concentration_score: 0,
          tab_switch_count: tabSwitchCount,
          pause_count: missedAnswerCount,
          wrong_answer_count: wrongAnswerCount,
          answer_times_in_seconds: answeredTimeArray,
        },
      },
      // true
    );
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
    currentPage,
  ]);

  const handleDocumentLoad = (e: DocumentLoadEvent) => {
    setTotalPages(e.doc.numPages);
    console.log(totalPages);
    const now = getEpochTimeInMillis();
    pageStartTime.current = new Date();
    startTimeInMillis.current = now;

    if (isFirstView) {
      console.log("integrate add document activity api now");
      syncPDFTrackingData();
      setIsFirstView(false);

      // Start the 2-minute interval for update notifications
      if (!updateIntervalRef.current) {
        updateIntervalRef.current = setInterval(
          () => {
            console.log("integrate update document activity api now");
            syncPDFTrackingData();
          },
          2 * 60 * 1000
        ); // 2 minutes in milliseconds
      }
    }
  };

  const handlePageChange = (e: PageChangeEvent) => {
    const now = getEpochTimeInMillis();
    const duration = Math.round((now - pageStartTime.current.getTime()) / 1000);

    if (duration >= 10) {
      pageViews.current.push({
        id: uuidv4(),
        page: currentPage,
        duration,
        start_time: new Date(pageStartTime.current).toISOString(),
        end_time: new Date(now).toISOString(),
        start_time_in_millis: pageStartTime.current.getTime(),
        end_time_in_millis: now,
      });
    }

    setCurrentPage(e.currentPage);
    pageStartTime.current = new Date();

    // Changing page counts as user activity
    handleUserActivity();
  };

  useEffect(() => {
    startTimer();
    return () => {
      stopTimer();
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
      }
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
    };
  }, []);

  // Update the return JSX to include a more informative pause dialog
  return (
    <div className="relative w-full h-full">
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
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg text-center max-w-md">
            <h3 className="text-lg font-semibold mb-2">Reading Paused</h3>
            {document.hidden ? (
              <p className="mb-4">
                Please return to this tab to continue reading.
              </p>
            ) : missedAnswerCount > 0 || wrongAnswerCount > 0 ? (
              <div className="mb-4">
                <p>Your session was paused due to:</p>
                {missedAnswerCount > 0 && (
                  <p className="text-amber-600">
                    • Missed verification ({missedAnswerCount} times)
                  </p>
                )}
                {wrongAnswerCount > 0 && (
                  <p className="text-red-600">
                    • Incorrect verification ({wrongAnswerCount} times)
                  </p>
                )}
                <p className="mt-2">
                  Click the button below to resume reading.
                </p>
              </div>
            ) : (
              <p className="mb-4">
                Click the button below or interact with the page to continue
                reading.
              </p>
            )}
            <button
              onClick={handleUserActivity}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Resume Reading
            </button>
          </div>
        </div>
      )}

      <PdfViewerComponent
        pdfUrl={pdfUrl}
        handlePageChange={handlePageChange}
        handleDocumentLoad={handleDocumentLoad}
        initialPage={activeItem?.progress_marker}
      />
    </div>
  );
};

export default PDFViewer;
