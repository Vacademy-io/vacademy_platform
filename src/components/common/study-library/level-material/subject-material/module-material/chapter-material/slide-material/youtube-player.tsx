/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import type React from "react";
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { useTrackingStore } from "@/stores/study-library/youtube-video-tracking-store";
import { getEpochTimeInMillis } from "./utils";
import { convertTimeToSeconds } from "@/utils/study-library/tracking/convertTimeToSeconds";
import { formatVideoTime } from "@/utils/study-library/tracking/formatVideoTime";
import { calculateNetDuration } from "@/utils/study-library/tracking/calculateNetDuration";
import { useVideoSync } from "@/hooks/study-library/useVideoSync";
import YouTube, {
  type YouTubeEvent,
  type YouTubePlayer,
  type YouTubeProps,
} from "react-youtube";
import {
  ArrowsOut,
  FastForward,
  Pause,
  Play,
  Rewind,
  X,
  Gauge,
} from "@phosphor-icons/react";
import { Preferences } from "@capacitor/preferences";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import VideoQuestionOverlay from "./video-question-overlay";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";

// Add the YouTube PlayerState enum to avoid window.YT references
enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

interface YouTubePlayerProps {
  videoId: string;
  videoTitle?: string;
  onTimeUpdate?: (currentTime: number) => void;
  ms?: number;
  questions?: Array<{
    id: string;
    question_time_in_millis: number;
    text_data: {
      content: string;
    };
    parent_rich_text?: {
      content: string;
    };
    options: Array<{
      id: string;
      text: {
        content: string;
      };
    }>;
    can_skip?: boolean;
    question_type?: string;
    auto_evaluation_json?: string;
  }>;
  allowPlayPause?: boolean; // If false, play/pause controls are disabled
  allowRewind?: boolean; // If false, rewind controls are disabled
  isLiveStream?: boolean; // If true, indicates this is a live stream
  liveTimestamp?: number; // Current live timestamp in seconds (for live streams)
  liveClassStartTime?: string; // ISO timestamp when the live class started (for syncing video position)
  enableConcentrationScore?: boolean; // If false, concentration score features are disabled
}

export const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export const YouTubePlayerComp: React.FC<YouTubePlayerProps> = ({
  videoId,
  onTimeUpdate,
  ms = 0,
  questions = [],
  allowPlayPause = true,
  allowRewind = true,
  isLiveStream = false,
  liveTimestamp = 0,
  liveClassStartTime,
  enableConcentrationScore = true,
}) => {
  const { activeItem } = useContentStore();
  // Subscribe only to addActivity to avoid re-render on every trackingData update
  const addActivity = useTrackingStore((state) => state.addActivity);
  const activityId = useRef(uuidv4());
  const currentTimestamps = useRef<
    Array<{
      id: string;
      start_time: string;
      end_time: string;
      start: number;
      end: number;
    }>
  >([]);
  const videoStartTime = useRef<number>(0);
  const videoEndTime = useRef<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentStartTimeRef = useRef("");
  const timestampDurationRef = useRef(0);
  const [isFirstPlay, setIsFirstPlay] = useState(true);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { syncVideoTrackingData } = useVideoSync();
  const currentStartTimeInEpochRef = useRef<number>(0);

  const [isPlayed, setIsPlayed] = useState(allowPlayPause ? false : true);
  const [player, setPlayer] = useState<YouTubePlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [duration, setDuration] = useState(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [minutesInput, setMinutesInput] = useState("");
  const [secondsInput, setSecondsInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const concentrationScoreId = useRef(uuidv4());
  const [showFullscreenControls, setShowFullscreenControls] = useState(false);
  const fullscreenControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const hasAutoPlayAttempted = useRef(false);
  const [showManualPlayButton, setShowManualPlayButton] = useState(false);

  // Playback speed state
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const speedButtonRef = useRef<HTMLButtonElement>(null);

  // Volume control state
  const [volume, setVolume] = useState(100); // 0 - 100

  // UI control states
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showSeekAnimation, setShowSeekAnimation] = useState<{
    side: "left" | "right";
    show: boolean;
  }>({ side: "left", show: false });

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<
    Record<
      string,
      {
        answered: boolean;
        selectedOptions: string | string[];
        isCorrect?: boolean;
        timestamp: number;
      }
    >
  >({});

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCountdown, setVerificationCountdown] = useState(59);
  const [verificationNumbers, setVerificationNumbers] = useState<number[]>([]);
  const [verificationInterval] = useState(180);
  const [lastVerificationTime, setLastVerificationTime] = useState(0);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Concentration metrics
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [pauseCount, setPauseCount] = useState(0);
  const [wrongAnswerCount, setWrongAnswerCount] = useState(0);
  const [missedAnswerCount, setMissedAnswerCount] = useState(0);
  const [answerTimesInSeconds, setAnswerTimesInSeconds] = useState<number[]>(
    []
  );
  const [concentrationScore, setConcentrationScore] = useState(100); // Start with perfect score

  // Live stream state
  const [isBehindLive, setIsBehindLive] = useState(false);
  const [wasPausedByTabSwitch, setWasPausedByTabSwitch] = useState(false);

  // Memoize questions to prevent unnecessary re-renders
  const memoizedQuestions = useMemo(
    () => questions,
    [JSON.stringify(questions)]
  );

  // Memoize timeToQuestionMap to prevent recreating it unnecessarily
  const timeToQuestionMap = useMemo(() => {
    if (memoizedQuestions && memoizedQuestions.length > 0) {
      return memoizedQuestions.map((q) => ({
        time: q.question_time_in_millis,
        question: q,
      }));
    }
    return [];
  }, [memoizedQuestions]);

  // Subscribe only to setter functions to avoid re-render on store updates
  const setCurrentYoutubeTime = useMediaRefsStore(
    (state) => state.setCurrentYoutubeTime
  );
  const setCurrentYoutubeVideoLength = useMediaRefsStore(
    (state) => state.setCurrentYoutubeVideoLength
  );

  useEffect(() => {
    setCurrentYoutubeTime(currentTime);
  }, [currentTime, setCurrentYoutubeTime]);

  // Reset answered questions when questions or videoId changes
  useEffect(() => {
    setAnsweredQuestions({});
  }, [memoizedQuestions, videoId]);

  // Helper function to safely get a number from potentially a Promise<number>
  const safeGetNumber = async (value: any): Promise<number> => {
    if (value === undefined || value === null) return 0;
    if (typeof value === "number") return value;
    if (value instanceof Promise) {
      try {
        const resolved = await value;
        return typeof resolved === "number" ? resolved : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  // Helper function to verify player iframe is ready before operations
  const isPlayerIframeReady = async (
    playerInstance: YouTubePlayer | null
  ): Promise<boolean> => {
    if (!playerInstance) return false;
    try {
      const iframe = await playerInstance.getIframe();
      return !!(iframe && iframe.src);
    } catch (err) {
      console.warn("Unable to verify iframe state:", err);
      return false;
    }
  };

  // Safe wrapper for player operations
  const safePlayerOperation = async (
    operation: () => void,
    operationName: string = "player operation"
  ): Promise<boolean> => {
    if (!player || !playerReady) {
      console.warn(`${operationName}: Player not ready`);
      return false;
    }

    const iframeReady = await isPlayerIframeReady(player);
    if (!iframeReady) {
      console.warn(`${operationName}: Iframe not ready, skipping operation`);
      return false;
    }

    try {
      operation();
      return true;
    } catch (error) {
      console.error(`Error during ${operationName}:`, error);
      return false;
    }
  };

  const checkForQuestions = useCallback(async () => {
    if (!timeToQuestionMap || timeToQuestionMap.length === 0 || !player) return;

    try {
      const currentTime = await player.getCurrentTime();
      if (typeof currentTime !== "number" || isNaN(currentTime)) return;
      const currentTimeMs = currentTime * 1000;

      const questionToShow = timeToQuestionMap.find(({ time, question }) => {
        if (answeredQuestions && answeredQuestions[question.id]?.answered)
          return false;
        return Math.abs(currentTimeMs - time) < 500;
      });

      if (questionToShow && !showQuestion) {
        // Use the force pause function for immediate pause
        player.pauseVideo();
        setIsPlayed(false);
        stopProgressTracking();
        stopTimer();
        setCurrentQuestion(questionToShow.question);
        setShowQuestion(true);
      }
    } catch (error) {
      console.error("Error checking for questions:", error);
    }
  }, [timeToQuestionMap, showQuestion, answeredQuestions, player]);

  // Handle question submission
  const handleQuestionSubmit = async (selectedOption: string | string[]) => {
    if (!currentQuestion) return { success: false };

    // Evaluate the answer (you can enhance this logic)
    const isCorrect = true; // This should be based on actual evaluation logic

    // Mark question as answered with detailed info
    setAnsweredQuestions((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        answered: true,
        selectedOptions: selectedOption,
        isCorrect,
        timestamp: Date.now(),
      },
    }));

    // Return mock response (in a real app, this would come from the server)
    return {
      success: true,
      isCorrect: isCorrect,
      explanation: "Great job! You've answered correctly.",
    };
  };

  // Handle closing the question overlay (skip/close)
  const handleQuestionClose = () => {
    // Mark question as skipped only if it's skippable
    if (currentQuestion && currentQuestion.can_skip) {
      setAnsweredQuestions((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          answered: true,
          selectedOptions: [],
          isCorrect: false,
          timestamp: Date.now(),
        },
      }));
    }

    setShowQuestion(false);
    setCurrentQuestion(null);

    // Resume video playback
    if (player) {
      player.playVideo();
      setIsPlayed(true);
    }
  };

  // Load saved verification time from Capacitor preferences
  useEffect(() => {
    if (!enableConcentrationScore) return;

    const loadSavedData = async () => {
      try {
        const { value } = await Preferences.get({
          key: "video_concentration_metrics",
        });
        if (value) {
          const savedMetrics = JSON.parse(value);
          setTabSwitchCount(savedMetrics.tabSwitchCount || 0);
          setWrongAnswerCount(savedMetrics.wrongAnswerCount || 0);
          setMissedAnswerCount(savedMetrics.missedAnswerCount || 0);
          setPauseCount(savedMetrics.pauseCount || 0);
          setAnswerTimesInSeconds(savedMetrics.answerTimesInSeconds || []);
          setConcentrationScore(savedMetrics.concentrationScore || 100);
        }

        // Load last verification time
        const { value: verificationTimeValue } = await Preferences.get({
          key: "verification_time",
        });
        if (verificationTimeValue) {
          const savedTime = Number.parseInt(verificationTimeValue, 10);
          setLastVerificationTime(savedTime);
        }
      } catch (error) {
        console.error("Error loading saved concentration metrics:", error);
      }
    };

    loadSavedData();
  }, [enableConcentrationScore]);

  // Save concentration metrics to Capacitor preferences
  const saveConcentrationMetrics = useCallback(async () => {
    try {
      const metrics = {
        tabSwitchCount,
        wrongAnswerCount,
        missedAnswerCount,
        pauseCount,
        answerTimesInSeconds,
        concentrationScore,
      };

      await Preferences.set({
        key: "video_concentration_metrics",
        value: JSON.stringify(metrics),
      });
    } catch (error) {
      console.error("Error saving concentration metrics:", error);
    }
  }, [
    tabSwitchCount,
    wrongAnswerCount,
    missedAnswerCount,
    pauseCount,
    answerTimesInSeconds,
    concentrationScore,
  ]);

  // Save verification time to Capacitor preferences
  const saveVerificationTime = async (time: number) => {
    try {
      await Preferences.set({
        key: "verification_time",
        value: time.toString(),
      });
    } catch (error) {
      console.error("Error saving verification time:", error);
    }
  };

  // Update concentration score based on metrics
  useEffect(() => {
    if (!enableConcentrationScore) return;

    // Simple algorithm to calculate concentration score
    // This can be adjusted based on specific requirements
    const baseScore = 100;
    const tabSwitchPenalty = tabSwitchCount * 10;
    const wrongAnswerPenalty = wrongAnswerCount * 5;
    const pouseCountPenalty = pauseCount * 5;
    const missedAnswerPenalty = missedAnswerCount * 20;

    let newScore =
      baseScore -
      tabSwitchPenalty -
      wrongAnswerPenalty -
      missedAnswerPenalty -
      pouseCountPenalty;
    newScore = Math.max(0, newScore); // Ensure score doesn't go below 0

    setConcentrationScore(newScore);
    saveConcentrationMetrics();
  }, [
    tabSwitchCount,
    wrongAnswerCount,
    missedAnswerCount,
    pauseCount,
    saveConcentrationMetrics,
    enableConcentrationScore,
  ]);

  // Generate verification numbers
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

    // Set in a fixed order - correct number is always in the middle
    setVerificationNumbers([num1, correctNum, num2]);
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
          // Time's up, pause the video
          if (player) {
            player.pauseVideo();
            setIsPlayed(false);
          }
          // Increment missed answer count
          setMissedAnswerCount((prev) => prev + 1);
          // Clear the timer
          if (verificationTimerRef.current) {
            clearInterval(verificationTimerRef.current);
            verificationTimerRef.current = null;
          }
          // Close the verification dialog
          setShowVerification(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [player]);

  // Handle verification number click
  const handleVerificationClick = (index: number) => {
    // Clear the verification timer
    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }

    const responseTime = 59 - verificationCountdown;
    // Add response time to array
    const newAnswerTimes = [...answerTimesInSeconds, responseTime];
    setAnswerTimesInSeconds(newAnswerTimes);
    // Check if correct number was clicked (middle position, index 1)
    if (index === 1) {
      // Record verification time
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      setLastVerificationTime(currentTimeInSeconds);
      saveVerificationTime(currentTimeInSeconds);

      // Hide verification
      setShowVerification(false);
    } else {
      // Wrong number clicked, increment wrong answer count
      setWrongAnswerCount((prev) => prev + 1);

      // Pause the video
      if (player) {
        player.pauseVideo();
        setIsPlayed(false);
      }

      // Close the verification dialog
      setShowVerification(false);
    }
  };

  // Check if verification is needed based on elapsed time
  useEffect(() => {
    if (!enableConcentrationScore) return;

    if (
      isPlayed &&
      elapsedTime > 0 &&
      elapsedTime % verificationInterval === 0
    ) {
      // Show verification without pausing the video
      setShowVerification(true);
      generateVerificationNumbers();
      startVerificationTimer();
      console.log(lastVerificationTime);
    }
  }, [
    elapsedTime,
    verificationInterval,
    isPlayed,
    generateVerificationNumbers,
    startVerificationTimer,
    enableConcentrationScore,
  ]);

  const calculatePercentageWatched = (totalDuration: number) => {
    const netDuration = calculateNetDuration(currentTimestamps.current);
    return ((netDuration / totalDuration) * 100).toFixed(2);
  };

  const clearUpdateInterval = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
      timestampDurationRef.current += 1;
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start progress tracking interval when player is playing
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) return;
    progressIntervalRef.current = setInterval(async () => {
      if (player) {
        try {
          const time = await safeGetNumber(player.getCurrentTime());
          setCurrentTime(time);

          // Check for questions at current timestamp
          checkForQuestions();

          if (onTimeUpdate) {
            onTimeUpdate(time);
          }
        } catch (error) {
          console.error("Error getting current time for progress bar:", error);
        }
      }
    }, 250); // Update 4 times per second for smoother progress
  }, [player, onTimeUpdate, checkForQuestions]);

  // Stop progress tracking interval
  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Function to check if user can navigate to a specific time
  const canNavigateToTime = useCallback(
    (targetTimeSeconds: number) => {
      const targetTimeMs = targetTimeSeconds * 1000;

      // Find all questions that come before or at the target time
      const previousQuestions = timeToQuestionMap.filter(
        ({ time }) => time <= targetTimeMs
      );

      // Check if all previous questions that cannot be skipped are answered
      for (const { question } of previousQuestions) {
        if (!question.can_skip && !answeredQuestions[question.id]?.answered) {
          return false; // Cannot navigate forward past unanswered required questions
        }
      }

      return true;
    },
    [timeToQuestionMap, answeredQuestions]
  );

  // Function to handle question marker click
  const handleQuestionMarkerClick = useCallback(
    (questionData: any) => {
      // Check if we can navigate to this question's time
      const questionTimeSeconds = questionData.question_time_in_millis / 1000;

      if (!canNavigateToTime(questionTimeSeconds)) {
        // Show a message that they need to answer previous questions first
        return;
      }

      // Set the current question and show overlay
      setCurrentQuestion(questionData);
      setShowQuestion(true);

      // Pause the video
      if (player) {
        player.pauseVideo();
        setIsPlayed(false);
        stopProgressTracking();
        stopTimer();
      }
    },
    [canNavigateToTime, player, stopProgressTracking, stopTimer]
  );

  // Pause video when tab is switched
  useEffect(() => {
    if (!enableConcentrationScore) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switched away
        setTabSwitchCount((prev) => prev + 1);

        if (player && isPlayed) {
          player.pauseVideo();
          setIsPlayed(false);
          setWasPausedByTabSwitch(true); // Mark that video was paused by tab switch
        }

        // Close the verification dialog if it's open
        if (showVerification) {
          setShowVerification(false);

          // Clear the verification timer
          if (verificationTimerRef.current) {
            clearInterval(verificationTimerRef.current);
            verificationTimerRef.current = null;
          }
        }
      } else {
        // Tab is back in focus
        // Auto-play if allowPlayPause is false and video was paused by tab switch
        if (player && wasPausedByTabSwitch && !allowPlayPause) {
          setTimeout(() => {
            player.playVideo();
            setIsPlayed(true);
            setWasPausedByTabSwitch(false);
          }, 500); // Small delay to ensure tab is fully focused
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    player,
    showVerification,
    isPlayed,
    wasPausedByTabSwitch,
    allowPlayPause,
    enableConcentrationScore,
  ]);

  // Get duration when player is ready
  useEffect(() => {
    if (!player) return;

    const getDuration = async () => {
      try {
        const dur = await safeGetNumber(player.getDuration());
        setDuration(dur);
        // Set the YouTube video length in the store
        setCurrentYoutubeVideoLength(dur);
      } catch (error) {
        console.error("Error getting duration:", error);
      }
    };

    getDuration();
  }, [player, setCurrentYoutubeVideoLength]);

  // Update current time periodically
  useEffect(() => {
    if (!player || !isPlayed) return;

    const updateTimeInterval = setInterval(async () => {
      try {
        const time = await safeGetNumber(player.getCurrentTime());
        setCurrentTime(time);

        // Check if user is behind live for live streams
        if (isLiveStream && liveTimestamp > 0) {
          const timeDifference = liveTimestamp - time;
          setIsBehindLive(timeDifference > 30); // Consider behind if more than 30 seconds
        }
      } catch (error) {
        console.error("Error getting current time:", error);
      }
    }, 1000);

    return () => clearInterval(updateTimeInterval);
  }, [player, isPlayed, isLiveStream, liveTimestamp]);

  // Activity tracking effect
  useEffect(() => {
    const endTime = videoEndTime.current || getEpochTimeInMillis();

    const newActivity = {
      id: activeItem?.id || "",
      activity_id: activityId.current,
      source: "VIDEO" as const,
      source_id: videoId,
      start_time: videoStartTime.current,
      end_time: endTime,
      duration: elapsedTime.toString(),
      timestamps: currentTimestamps.current,
      percentage_watched: calculatePercentageWatched(duration),
      sync_status: "STALE" as const,
      current_start_time: currentStartTimeRef.current,
      current_start_time_in_epoch: currentStartTimeInEpochRef.current,
      // answered_time: answeredTimeArray,
      ...(enableConcentrationScore && {
        concentration_score: {
          id: concentrationScoreId.current,
          concentration_score: concentrationScore,
          tab_switch_count: tabSwitchCount,
          pause_count: missedAnswerCount,
          wrong_answer_count: wrongAnswerCount,
          missed_answer_count: missedAnswerCount,
          answer_times_in_seconds: answerTimesInSeconds,
        },
      }),
      new_activity: true,
    };
    addActivity(newActivity, true);
  }, [
    elapsedTime,
    duration,
    videoId,
    tabSwitchCount,
    wrongAnswerCount,
    missedAnswerCount,
    answerTimesInSeconds,
    pauseCount,
    concentrationScore,
    addActivity,
    activeItem?.id,
    calculatePercentageWatched,
    enableConcentrationScore,
  ]);

  // Prevent right-click on the video
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const playerContainer = playerContainerRef.current;
    if (playerContainer) {
      playerContainer.addEventListener("contextmenu", handleContextMenu);
    }

    return () => {
      if (playerContainer) {
        playerContainer.removeEventListener("contextmenu", handleContextMenu);
      }
    };
  }, []);

  // Add CSS to hide YouTube elements when the video ends
  useEffect(() => {
    const handleVideoEnd = () => {
      // Add a style element to hide YouTube end screen elements
      const styleEl = document.createElement("style");
      styleEl.innerHTML = `
            .ytp-endscreen-content,
            .ytp-ce-element,
            .ytp-ce-covering-overlay,
            .ytp-ce-element-shadow,
            .ytp-ce-covering-image,
            .ytp-ce-expanding-image,
            .ytp-ce-element.ytp-ce-channel.ytp-ce-channel-this,
            .ytp-ce-element.ytp-ce-video.ytp-ce-element-show,
            .ytp-pause-overlay,
            .ytp-related-on-pause-container,
            .ytp-more-videos-overlay {
            display: none !important;
            }
        `;
      document.head.appendChild(styleEl);

      return () => {
        document.head.removeChild(styleEl);
      };
    };

    if (player) {
      handleVideoEnd();
    }

    return () => {
      const styleElements = document.querySelectorAll("style");
      styleElements.forEach((el) => {
        if (el.innerHTML.includes("ytp-endscreen-content")) {
          document.head.removeChild(el);
        }
      });
    };
  }, [player]);

  // Add an additional effect to handle iframe load and inject CSS
  useEffect(() => {
    if (!iframeRef.current) return;

    const injectCSS = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Try to access iframe content
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDocument) return;

        // Create a style element
        const style = iframeDocument.createElement("style");
        style.textContent = `
            .ytp-chrome-top,
            .ytp-chrome-bottom,
            .ytp-watermark,
            .ytp-show-cards-title,
            .ytp-youtube-button,
            .ytp-embed-title,
            .ytp-embed-owner,
            .ytp-share-button,
            .ytp-watch-later-button,
            .ytp-more-videos-overlay,
            .ytp-pause-overlay,
            .ytp-related-on-pause-container,
            .ytp-endscreen-content,
            .ytp-ce-element {
                display: none !important;
            }
            `;

        // Append style to iframe head
        iframeDocument.head.appendChild(style);
      } catch (error) {
        console.error("Error injecting CSS into iframe:", error);
      }
    };

    // Try to inject CSS after iframe is loaded
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener("load", injectCSS);

      // Also try immediately in case iframe is already loaded
      injectCSS();

      return () => {
        iframe.removeEventListener("load", injectCSS);
      };
    }
  }, [iframeRef.current]);

  const opts: YouTubeProps["opts"] = {
    height: "100%",
    width: "100%",
    playerVars: {
      controls: 0, // Disable YouTube controls
      disablekb: 1, // Disable keyboard controls
      fs: 0, // Disable fullscreen button
      iv_load_policy: 3, // Disable annotations
      modestbranding: 1, // Hide YouTube logo
      rel: 0, // Don't show related videos
      // showinfo: 0, // Hide video title and uploader
      autoplay: allowPlayPause ? 0 : 1, // Autoplay when pause control is disabled
      // cc_load_policy: 0, // Hide closed captions
      origin: window.location.origin, // Set origin for security
      enablejsapi: 1, // Enable JavaScript API
      playsinline: 1, // Play inline on iOS
      loop: 0, // Don't loop the video
      color: "white", // Use white progress bar
      hl: "en", // Set language to English
      start: 0, // Start from the beginning
      end: 0, // End at the natural end of the video
      // autohide: 1, // Hide controls after play begins
      widget_referrer: window.location.href, // Fix for error 153
    },
  };

  const togglePause = async () => {
    if (!allowPlayPause) return;
    setIsPlayed(false);

    await safePlayerOperation(() => player?.pauseVideo(), "togglePause");
  };

  // Direct pause function for question overlay - bypasses state management issues
  const forcePause = async () => {
    const success = await safePlayerOperation(() => {
      player?.pauseVideo();
      setIsPlayed(false);
      stopProgressTracking();
      stopTimer();
    }, "forcePause");

    if (success) {
      console.log("VideoQuestionOverlay: Video force paused successfully");
    } else {
      console.warn("VideoQuestionOverlay: Player not ready for force pause");
    }
  };

  const togglePlay = async () => {
    setIsPlayed(true);

    await safePlayerOperation(() => {
      try {
        player?.unMute();
      } catch (e) {
        console.warn("unMute failed (non-fatal)", e);
      }
      player?.playVideo();
    }, "togglePlay");
  };

  const onPlayerReady: YouTubeProps["onReady"] = async (
    event: YouTubeEvent
  ) => {
    setPlayer(event.target);
    setPlayerReady(true);
    try {
      const vol = await event.target.getVolume();
      setVolume(typeof vol === "number" ? vol : 100);
    } catch (err) {
      console.error("Error getting initial volume", err);
    }

      // Get the iframe element
    try {
      const iframe = await event.target.getIframe();
      iframeRef.current = iframe;

      // Try to hide YouTube elements by injecting CSS
      if (iframe) {
        try {
          iframe.setAttribute(
            "allow",
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          );
          iframe.setAttribute("allowfullscreen", "true");
          // Fix for YouTube error 153 on Windows Electron
          iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        } catch (e) {
          console.error("Error setting iframe attributes:", e);
        }
        try {
          const iframeDocument =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDocument) {
            const style = iframeDocument.createElement("style");
            style.textContent = `
                    .ytp-chrome-top,
                    .ytp-chrome-bottom,
                    .ytp-watermark,
                    .ytp-show-cards-title,
                    .ytp-youtube-button,
                    .ytp-embed-title,
                    .ytp-embed-owner,
                    .ytp-share-button,
                    .ytp-watch-later-button,
                    .ytp-more-videos-overlay,
                    .ytp-pause-overlay,
                    .ytp-related-on-pause-container,
                    .ytp-endscreen-content,
                    .ytp-ce-element {
                      display: none !important;
                    }
                  `;
            iframeDocument.head.appendChild(style);
          }
        } catch (error) {
          console.error("Error accessing iframe content:", error);
        }
      }
    } catch (error) {
      console.error("Error getting iframe:", error);
    }
  };

  // Handler for manual play button (for iOS/browsers that block autoplay)
  const handleManualPlay = async () => {
    if (!player || !playerReady) return;

    const success = await safePlayerOperation(() => {
      try {
        player.unMute();
      } catch (e) {
        console.warn("unMute failed during manual play", e);
      }
      player.playVideo();
    }, "manualPlay");

    if (success) {
      setIsPlayed(true);
      setShowManualPlayButton(false); // Hide the button permanently
    }
  };

  // Clean up fullscreen controls timeout
  useEffect(() => {
    return () => {
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
    };
  }, []);

  // Auto-play when player is ready and allowPlayPause is false
  useEffect(() => {
    if (
      !allowPlayPause &&
      player &&
      playerReady &&
      !hasAutoPlayAttempted.current
    ) {
      hasAutoPlayAttempted.current = true; // Mark that we've attempted autoplay

      // Small delay to ensure iframe is ready
      const autoplayTimeout = setTimeout(async () => {
        const success = await safePlayerOperation(() => {
          try {
            player.unMute(); // Unmute for autoplay
          } catch (e) {
            console.warn("unMute failed during autoplay", e);
          }
          player.playVideo();
        }, "autoplay");

        if (success) {
          // Verify that video actually started playing after a short delay
          setTimeout(async () => {
            try {
              const playerState = await player.getPlayerState();
              // PlayerState.PLAYING = 1, if not playing, show manual button
              if (playerState !== 1) {
                setShowManualPlayButton(true);
              } else {
                setIsPlayed(true);
                setShowManualPlayButton(false);
              }
            } catch (error) {
              console.warn("Error checking player state after autoplay", error);
              setShowManualPlayButton(true);
            }
          }, 1000);
        } else {
          console.warn("Autoplay failed, showing manual play button");
          setShowManualPlayButton(true);
        }
      }, 500);

      return () => clearTimeout(autoplayTimeout);
    }
  }, [allowPlayPause, player, playerReady]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      // Show controls briefly when entering/exiting fullscreen
      if (isNowFullscreen) {
        // Entering fullscreen - show fullscreen controls
        setShowFullscreenControls(true);

        // Hide controls after 3 seconds
        if (fullscreenControlsTimeoutRef.current) {
          clearTimeout(fullscreenControlsTimeoutRef.current);
        }

        fullscreenControlsTimeoutRef.current = setTimeout(() => {
          setShowFullscreenControls(false);
        }, 3000);
      } else {
        // Exiting fullscreen - show regular controls
        setShowFullscreenControls(false);
        setShowControls(true);

        // Hide regular controls after 3 seconds
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }

        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Control video playback based on isPlayed state
  useEffect(() => {
    if (!player || !playerReady) return;

    const controlPlayback = async () => {
      await safePlayerOperation(() => {
        if (isPlayed) {
          player.playVideo();
          startProgressTracking();
        } else {
          player.pauseVideo();
          setPauseCount((prev) => prev + 1);
          stopProgressTracking();
        }
      }, "controlPlayback");
    };

    controlPlayback();
  }, [
    isPlayed,
    player,
    playerReady,
    startProgressTracking,
    stopProgressTracking,
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearUpdateInterval();
      stopProgressTracking();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
      }
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [clearUpdateInterval, stopProgressTracking]);

  const onStateChange = async (event: YouTubeEvent) => {
    if (!player) return;

    const now = getEpochTimeInMillis();

    // Handle different state events without directly referencing YT.PlayerState
    const PLAYING_STATE = PlayerState.PLAYING;
    const PAUSED_STATE = PlayerState.PAUSED;
    const ENDED_STATE = PlayerState.ENDED;

    // Safely get the current time
    let currentTime = 0;
    try {
      currentTime = await safeGetNumber(player.getCurrentTime());
      setCurrentTime(currentTime); // Update state with current time
    } catch (error) {
      console.error("Error getting current time:", error);
    }

    if (event.data === PLAYING_STATE) {
      startTimer();
      startProgressTracking();

      if (!videoStartTime.current) {
        videoStartTime.current = now;
      }

      if (isFirstPlay) {
        syncVideoTrackingData();
        setIsFirstPlay(false);

        if (!updateIntervalRef.current) {
          updateIntervalRef.current = setInterval(() => {
            syncVideoTrackingData();
          }, 60 * 1000);
        }
      }

      currentStartTimeRef.current = formatVideoTime(currentTime);
      currentStartTimeInEpochRef.current =
        convertTimeToSeconds(currentStartTimeRef.current) * 1000;
      setIsPlayed(true);
    } else if (event.data === PAUSED_STATE || event.data === ENDED_STATE) {
      stopTimer();
      stopProgressTracking();
      videoEndTime.current = now;

      const currentStartTimeInSeconds = convertTimeToSeconds(
        currentStartTimeRef.current
      );
      const endTimeInSeconds =
        currentStartTimeInSeconds + timestampDurationRef.current;
      const endTimeStamp = formatVideoTime(endTimeInSeconds);

      currentTimestamps.current.push({
        id: uuidv4(),
        start_time: currentStartTimeRef.current,
        end_time: endTimeStamp,
        start: convertTimeToSeconds(currentStartTimeRef.current) * 1000,
        end: convertTimeToSeconds(endTimeStamp) * 1000,
      });

      currentStartTimeRef.current = formatVideoTime(currentTime);
      timestampDurationRef.current = 0;
      setIsPlayed(false);
    }
  };

  // Note: numeric input handler removed as this component does not expose manual time jump UI

  const seekToTimestamp = async (
    targetTimeInSeconds?: number,
    forceSeek = false
  ) => {
    if (!player || !playerReady) return false;

    // Block manual seeking if rewind is not allowed (unless it's a forced seek like initial ms prop)
    if (!forceSeek && !allowRewind) {
      return false;
    }

    // Verify iframe is ready
    const iframeReady = await isPlayerIframeReady(player);
    if (!iframeReady) {
      console.warn("Player iframe not ready yet, skipping seek");
      return false;
    }

    let totalSecondsToSeek: number;

    if (typeof targetTimeInSeconds === "number") {
      totalSecondsToSeek = targetTimeInSeconds;
    } else {
      const minutes = minutesInput === "" ? 0 : Number.parseInt(minutesInput);
      const seconds = secondsInput === "" ? 0 : Number.parseInt(secondsInput);
      totalSecondsToSeek = minutes * 60 + seconds;
    }

    // Check navigation restrictions unless forced (e.g., for initial seek with ms prop)
    if (!forceSeek && !canNavigateToTime(totalSecondsToSeek)) {
      // You could show a toast notification here
      return false;
    }

    try {
      const videoDuration = await safeGetNumber(player.getDuration());

      let finalSeekTime = totalSecondsToSeek;
      // Ensure timestamp is within valid range
      if (finalSeekTime <= 0) {
        finalSeekTime = 0;
      } else if (finalSeekTime >= videoDuration) {
        finalSeekTime = videoDuration;
      }

      const success = await safePlayerOperation(
        () => player.seekTo(finalSeekTime, true),
        "seekToTimestamp"
      );

      if (success) {
        // Update currentTime state to reflect new position
        setCurrentTime(finalSeekTime);
      }

      return success;
    } catch (error) {
      console.error("Error seeking to timestamp:", error);
      return false;
    }
  };

  useEffect(() => {
    // Only seek if ms is greater than 0 and player is ready
    if (ms > 0 && player && playerReady) {
      const totalSeconds = ms / 1000;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60); // Use Math.floor for whole seconds

      // Update input fields for display consistency
      setMinutesInput(minutes.toString());
      setSecondsInput(seconds.toString());

      // Add a small delay to ensure the player iframe is fully initialized
      const seekTimeout = setTimeout(() => {
        // Call seekToTimestamp with the calculated totalSeconds (force it for initial load)
        seekToTimestamp(totalSeconds, true);
      }, 500); // 500ms delay to ensure iframe is ready

      return () => clearTimeout(seekTimeout);
    }
  }, [ms, player, playerReady]);

  // Live class synchronization - automatically sync video to live class progress
  useEffect(() => {
    if (!liveClassStartTime || !player || !playerReady || !isLiveStream) return;

    const syncToLiveClassProgress = () => {
      try {
        // Parse the live class start time (ISO string)
        const startTime = new Date(liveClassStartTime).getTime();
        const currentTime = Date.now();

        // Calculate elapsed time in seconds since live class started
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

        // Only sync if elapsed time is positive (class has started)
        if (elapsedSeconds > 0) {
          // Add a small delay to ensure the player iframe is fully initialized
          setTimeout(() => {
            // Seek to the calculated position (force it to bypass restrictions)
            seekToTimestamp(elapsedSeconds, true);
          }, 500);
        } else {
          console.log("Live class hasn't started yet, waiting...");
        }
      } catch (error) {
        console.error("Error syncing to live class progress:", error);
      }
    };

    // Initial sync when player becomes ready with a delay
    const syncTimeout = setTimeout(() => {
      syncToLiveClassProgress();
    }, 500);

    return () => clearTimeout(syncTimeout);
  }, [liveClassStartTime, player, playerReady, isLiveStream]);

  const toggleFullscreen = useCallback(async () => {
    if (!playerContainerRef.current) {
      console.error("Player container not available");
      return;
    }

    try {
      const elem = playerContainerRef.current as any;
      const canNativeFullscreen =
        typeof document.fullscreenEnabled !== "undefined" &&
        document.fullscreenEnabled &&
        elem &&
        typeof elem.requestFullscreen === "function";

      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setShowFullscreenControls(false);
        return;
      }

      if (isPseudoFullscreen) {
        // Exit pseudo fullscreen
        setIsPseudoFullscreen(false);
        setShowFullscreenControls(false);
        return;
      }

      if (canNativeFullscreen) {
        await elem.requestFullscreen();
        setIsFullscreen(true);
        setShowFullscreenControls(true);
      } else {
        // Fallback to pseudo fullscreen for iOS Chrome/WebView
        setIsPseudoFullscreen(true);
        setShowFullscreenControls(true);
      }

      // Hide controls after 3 seconds
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }

      fullscreenControlsTimeoutRef.current = setTimeout(() => {
        setShowFullscreenControls(false);
      }, 3000);
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
      // As a last resort, toggle pseudo-fullscreen
      setIsPseudoFullscreen((prev) => !prev);
      setShowFullscreenControls(true);
    }
  }, []);

  // Function to change playback speed
  const changePlaybackSpeed = useCallback(
    (speed: number) => {
      // Block speed changes if rewind is not allowed
      if (!allowRewind) {
        return;
      }

      if (player && playerReady) {
        try {
          player.setPlaybackRate(speed);
          setPlaybackSpeed(speed);
          setShowSpeedOptions(false);
        } catch (error) {
          console.error("Error changing playback speed:", error);
        }
      }
    },
    [player, playerReady, allowRewind]
  );

  // Handle volume change
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseInt(e.target.value, 10);
      setVolume(newVolume);
      if (player) {
        try {
          player.setVolume(newVolume);
        } catch (err) {
          console.error("Error setting volume", err);
        }
      }
    },
    [player]
  );

  // Toggle speed options dropdown
  const toggleSpeedOptions = useCallback(() => {
    // Only allow toggling if rewind is allowed
    if (!allowRewind) {
      return;
    }
    setShowSpeedOptions((prev) => !prev);
  }, [allowRewind]);

  // Go to live timestamp (for live streams)
  const goToLive = useCallback(async () => {
    if (!player || !playerReady || !isLiveStream || liveTimestamp <= 0) return;

    const success = await safePlayerOperation(
      () => player.seekTo(liveTimestamp, true),
      "goToLive"
    );

    if (success) {
      setCurrentTime(liveTimestamp);
      setIsBehindLive(false);
    }
  }, [player, playerReady, isLiveStream, liveTimestamp]);

  // Close speed options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSpeedOptions && !target.closest(".speed-control-container") && !target.closest(".speed-dropdown")) {
        setShowSpeedOptions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSpeedOptions]);

  // Handle double-click to seek
  const handleDoubleClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (!player || !playerReady) return;

      // Block double-click seeking if rewind is not allowed
      if (!allowRewind) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const isRightSide = clickX > rect.width / 2;

      try {
        const currentTime = await safeGetNumber(player.getCurrentTime());
        const duration = await safeGetNumber(player.getDuration());

        let newTime: number;
        if (isRightSide) {
          // Forward 10 seconds
          newTime = Math.min(currentTime + 10, duration);
          setShowSeekAnimation({ side: "right", show: true });
        } else {
          // Backward 10 seconds
          newTime = Math.max(currentTime - 10, 0);
          setShowSeekAnimation({ side: "left", show: true });
        }

        // Check if navigation is allowed (only for forward seeks)
        if (isRightSide && !canNavigateToTime(newTime)) {
          setShowSeekAnimation({ side: "right", show: false });
          return;
        }

        const success = await safePlayerOperation(
          () => player.seekTo(newTime, true),
          "handleDoubleClick"
        );

        if (success) {
          setCurrentTime(newTime);
        }

        // Hide animation after 1 second
        setTimeout(() => {
          setShowSeekAnimation({
            side: isRightSide ? "right" : "left",
            show: false,
          });
        }, 1000);
      } catch (error) {
        console.error("Error seeking on double click:", error);
      }
    },
    [player, playerReady, canNavigateToTime, allowRewind]
  );

  // Toggle play / pause on SINGLE click anywhere on the video (but ignore clicks on inner controls)
  const handleSingleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Prevent toggle if the click originated from a descendant element (e.g.
      // the control buttons). We only want pure clicks on the video surface.
      if (event.target !== event.currentTarget) return;

      if (!player || !playerReady) return;

      // When pause control is disabled, allow only Play via single click
      if (!allowPlayPause) {
        if (!isPlayed) {
          togglePlay();
        }
        return; // Ignore pause when already playing
      }

      if (isPlayed) {
        togglePause();
      } else {
        togglePlay();
      }
    },
    [player, playerReady, isPlayed, togglePause, togglePlay, allowPlayPause]
  );

  // Handle mouse movement to show/hide controls
  const handleMouseMoveOnVideo = useCallback(() => {
    if (isFullscreen || isPseudoFullscreen) {
      // Handle fullscreen controls

      setShowFullscreenControls(true);

      // Clear existing fullscreen timeout
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }

      // Set timeout to hide fullscreen controls after 3 seconds of inactivity
      fullscreenControlsTimeoutRef.current = setTimeout(() => {
        if (!showSpeedOptions) {
          // Don't hide if speed menu is open
          setShowFullscreenControls(false);
        }
      }, 3000);
    } else {
      // Handle regular controls
      setShowControls(true);

      // Clear existing timeout
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      // Set timeout to hide controls after 3 seconds of inactivity
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSpeedOptions) {
          // Don't hide if speed menu is open
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isFullscreen, isPseudoFullscreen, showSpeedOptions]);

  // Show controls when speed menu opens
  useEffect(() => {
    if (showSpeedOptions) {
      setShowControls(true);
      setShowFullscreenControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
    }
  }, [showSpeedOptions]);

  // Handle progress bar click for seeking
  const handleProgressBarClick = async (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!player || !playerReady || duration <= 0) return;

    // Block seeking if rewind is not allowed
    if (!allowRewind) {
      return;
    }

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = clickPosition * duration;

    // Check if navigation is allowed
    if (!canNavigateToTime(seekTime)) {
      return;
    }

    const success = await safePlayerOperation(
      () => player.seekTo(seekTime, true),
      "handleProgressBarClick"
    );

    if (success) {
      setCurrentTime(seekTime);
    }
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden flex flex-col items-center gap-4">
      {/* Non-fullscreen verification overlay - shown outside the player */}
      {showVerification && !isFullscreen && enableConcentrationScore && (
        <div className="w-full mb-2 animate-in fade-in slide-in-from-top duration-300">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-3">
              <div className="mt-1">
                <p className="text-xs text-neutral-600">
                  Just ensuring that you are actively learning, please click the
                  number{" "}
                  <span className="text-primary-500 font-bold">
                    {verificationNumbers[1]}
                  </span>{" "}
                  within{" "}
                  <span className="text-primary-500 font-bold">
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
                    className="px-2 py-1 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white text-neutral-600 border border-gray-200 hover:bg-gray-50"
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video player container with verification overlay */}
      <div
        ref={playerContainerRef}
        className={`aspect-video w-full max-w-[100vw] relative min-h-[200px] sm:min-h-[250px] md:min-h-[300px] lg:h-full items-center flex justify-center overflow-hidden bg-black rounded-lg group ${
          isPseudoFullscreen
            ? "fixed inset-0 z-[10000] rounded-none overflow-hidden max-w-[100vw] max-h-[100vh]"
            : ""
        }`}
        onMouseMove={handleMouseMoveOnVideo}
        onMouseEnter={handleMouseMoveOnVideo}
        onDoubleClick={handleDoubleClick}
        onClick={handleSingleClick}
      >
        {/* Verification overlay - only shown in fullscreen */}
        {showVerification && (isFullscreen || isPseudoFullscreen) && enableConcentrationScore && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-full max-w-xs z-[10000] animate-in fade-in slide-in-from-top duration-300">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg overflow-hidden">
              <div className="p-3">
                <div className="mt-1">
                  <p className="text-xs text-neutral-600">
                    Just ensuring that you are actively learning, please click
                    the number{" "}
                    <span className="text-primary-500 font-bold">
                      {verificationNumbers[1]}
                    </span>{" "}
                    within{" "}
                    <span className="text-primary-500 font-bold">
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
                      className="px-2 py-1 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 bg-white text-neutral-600 border border-gray-200 hover:bg-gray-50"
                    >
                      {number}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invisible fullscreen mouse capture overlay */}
        {(isFullscreen || isPseudoFullscreen) && (
          <div
            className="absolute inset-0 z-[9998] pointer-events-auto"
            onMouseMove={handleMouseMoveOnVideo}
            onMouseEnter={handleMouseMoveOnVideo}
          />
        )}

        {/* Fullscreen controls overlay */}
        {(isFullscreen || isPseudoFullscreen) && showFullscreenControls && (
          <div className="absolute inset-0 z-[9999] flex flex-col justify-between animate-in fade-in duration-200 pointer-events-none">
            {/* Top controls - Exit fullscreen */}
            <div className="flex justify-end p-4 pointer-events-auto">
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                aria-label="Exit fullscreen"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            {/* Bottom controls - Complete controls like non-fullscreen */}
            <div className="p-4 pointer-events-auto">
              {/* Professional Video Controls Overlay */}
              <div className="flex items-center justify-between mb-4">
                {/* Left Controls */}
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  {isPlayed ? (
                    allowPlayPause ? (
                      <button
                        onClick={togglePause}
                        className="p-2 rounded-full text-white transition-all backdrop-blur-sm bg-white/20 hover:bg-white/30"
                      >
                        <Pause size={20} weight="fill" />
                      </button>
                    ) : null
                  ) : (
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full text-white transition-all backdrop-blur-sm bg-white/20 hover:bg-white/30"
                    >
                      <Play size={20} weight="fill" />
                    </button>
                  )}

                  {/* Rewind */}
                  <button
                    onClick={async () => {
                      if (!allowRewind) return;
                      if (player) {
                        const currentTime = await safeGetNumber(
                          player.getCurrentTime()
                        );
                        const newTime = Math.max(currentTime - 10, 0);
                        const success = await safePlayerOperation(
                          () => player.seekTo(newTime, true),
                          "fullscreenRewind"
                        );
                        if (success) {
                          setCurrentTime(newTime);
                        }
                      }
                    }}
                    disabled={!allowRewind}
                    className={`p-2 rounded-full text-white backdrop-blur-sm ${
                      allowRewind
                        ? "bg-white/20 hover:bg-white/30 transition-all hover:scale-105"
                        : "bg-white/10 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <Rewind size={18} weight="fill" />
                  </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                  {/* Go Live Button - Only show for live streams when behind */}
                  {isLiveStream && isBehindLive && (
                    <button
                      onClick={goToLive}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-all hover:scale-105 backdrop-blur-sm animate-pulse"
                      title="Go to live stream"
                    >
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      LIVE
                    </button>
                  )}

                  {/* Volume Slider */}
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="h-1 w-24 cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* Playback Speed Control */}
                  <div className="relative speed-control-container">
                    <button
                      onClick={toggleSpeedOptions}
                      className={`relative p-2 rounded-full text-white transition-all backdrop-blur-sm ${
                        allowRewind && playerReady
                          ? "bg-white/20 hover:bg-white/30 hover:scale-105"
                          : "bg-white/10 opacity-50 cursor-not-allowed"
                      }`}
                      disabled={!playerReady || !allowRewind}
                    >
                      <Gauge size={18} weight="fill" />
                      {playbackSpeed !== 1 && (
                        <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow-md border-2 border-white">
                          {playbackSpeed}x
                        </span>
                      )}
                    </button>

                    {/* Speed Options Dropdown - Inline in fullscreen controls */}
                    {showSpeedOptions && allowRewind && (
                      <div className="speed-dropdown absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 z-[20] min-w-[80px] max-h-[240px] overflow-y-auto">
                        <div className="px-3 py-1 text-xs font-medium text-white/70 border-b border-white/20 sticky top-0 bg-black/90">
                          Speed
                        </div>
                        <div className="py-2">
                          {speedOptions.map((speed) => (
                            <button
                              key={speed}
                              onClick={() => changePlaybackSpeed(speed)}
                              className={`w-full px-3 py-2 text-sm text-left hover:bg-white/20 transition-colors ${
                                playbackSpeed === speed
                                  ? "text-primary-400 bg-white/10 font-medium"
                                  : "text-white"
                              }`}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exit Fullscreen (alternative position) */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                  >
                    <X size={18} weight="fill" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {allowPlayPause && (
                <div className="relative w-full">
                  <div
                    className={`w-full h-1 bg-white/30 rounded-full group ${
                      allowRewind ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    onClick={handleProgressBarClick}
                  >
                    <div
                      className="h-full bg-white rounded-full transition-all duration-150 group-hover:h-1.5"
                      style={{
                        width: `${
                          duration > 0 ? (currentTime / duration) * 100 : 0
                        }%`,
                      }}
                    ></div>
                  </div>

                  {/* Question Markers */}
                  {timeToQuestionMap.map(({ time, question }, index) => {
                    const position =
                      duration > 0 ? (time / 1000 / duration) * 100 : 0;
                    const isAnswered = answeredQuestions[question.id]?.answered;
                    const canSkip = question.can_skip;

                    return (
                      <button
                        key={question.id}
                        className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1 top-0 border-2 border-white shadow-lg transition-all z-10 ${
                          isAnswered
                            ? "bg-green-500"
                            : canSkip
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        } ${
                          allowRewind
                            ? "hover:scale-125 cursor-pointer hover:bg-green-600"
                            : "cursor-not-allowed opacity-75"
                        }`}
                        style={{
                          left: `${Math.max(1.5, Math.min(98.5, position))}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allowRewind) {
                            handleQuestionMarkerClick(question);
                          }
                        }}
                        disabled={!allowRewind}
                        title={`Question ${index + 1}${
                          isAnswered
                            ? " (Answered)"
                            : canSkip
                            ? " (Skippable)"
                            : " (Required)"
                        }${!allowRewind ? " (Navigation disabled)" : ""}`}
                      >
                        {isAnswered ? (
                          <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">
                            ✓
                          </span>
                        ) : (
                          <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">
                            ?
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Time Display */}
              {allowPlayPause && (
                <div className="flex justify-between text-white text-xs mt-2 font-medium">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Seek animation overlays */}
        {showSeekAnimation.show && (
          <div
            className={`absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]`}
          >
            <div
              className={`flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white animate-in fade-in zoom-in duration-300 ${
                showSeekAnimation.side === "right"
                  ? "flex-row"
                  : "flex-row-reverse"
              }`}
            >
              <div className="flex gap-1">
                {[...Array(showSeekAnimation.side === "right" ? 2 : 2)].map(
                  (_, i) => (
                    <FastForward
                      key={i}
                      size={20}
                      weight="fill"
                      className={
                        showSeekAnimation.side === "right" ? "" : "rotate-180"
                      }
                    />
                  )
                )}
              </div>
              <span className="text-sm font-medium">10s</span>
            </div>
          </div>
        )}

        {/* Manual Play Button for iOS/browsers that block autoplay */}
        {showManualPlayButton && !allowPlayPause && (
          <div className="absolute inset-0 flex items-center justify-center z-[1001] bg-black/30 backdrop-blur-sm animate-in fade-in duration-500">
            <button
              onClick={handleManualPlay}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-primary-500/50 active:scale-95"
              aria-label="Start video"
            >
              <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
                <Play size={48} weight="fill" />
              </div>
              <span className="text-lg font-semibold">Tap to Start Video</span>
              <span className="text-sm text-white/80">
                Video will play automatically
              </span>
            </button>
          </div>
        )}

        {/* Bottom Controls Overlay (always visible when not fullscreen) */}
        {!(isFullscreen || isPseudoFullscreen) && (
          <div
            className={`absolute bottom-0 left-0 right-0 z-[9999] transition-all duration-300 ${
              showControls
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            }`}
          >
            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-8">
              {/* Professional Video Controls Overlay */}
              <div className="flex items-center justify-between mb-4">
                {/* Left Controls */}
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  {isPlayed ? (
                    allowPlayPause ? (
                      <button
                        onClick={togglePause}
                        className="p-2 rounded-full text-white transition-all backdrop-blur-sm bg-white/20 hover:bg-white/30"
                      >
                        <Pause size={20} weight="fill" />
                      </button>
                    ) : null
                  ) : (
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full text-white transition-all backdrop-blur-sm bg-white/20 hover:bg-white/30"
                    >
                      <Play size={20} weight="fill" />
                    </button>
                  )}

                  {/* Rewind */}
                  <button
                    onClick={async () => {
                      if (!allowRewind) return;
                      if (player) {
                        const currentTime = await safeGetNumber(
                          player.getCurrentTime()
                        );
                        const newTime = Math.max(currentTime - 10, 0);
                        const success = await safePlayerOperation(
                          () => player.seekTo(newTime, true),
                          "controlsRewind"
                        );
                        if (success) {
                          setCurrentTime(newTime);
                        }
                      }
                    }}
                    disabled={!allowRewind}
                    className={`p-2 rounded-full text-white backdrop-blur-sm ${
                      allowRewind
                        ? "bg-white/20 hover:bg-white/30 transition-all hover:scale-105"
                        : "bg-white/10 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <Rewind size={18} weight="fill" />
                  </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                  {/* Go Live Button - Only show for live streams when behind */}
                  {isLiveStream && isBehindLive && (
                    <button
                      onClick={goToLive}
                      className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-all hover:scale-105 backdrop-blur-sm animate-pulse"
                      title="Go to live stream"
                    >
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      LIVE
                    </button>
                  )}

                  {/* Volume Slider */}
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="h-1 w-24 cursor-pointer accent-primary-500"
                    />
                  </div>

                  {/* Playback Speed Control */}
                  <div className="relative speed-control-container">
                    <button
                      ref={speedButtonRef}
                      onClick={toggleSpeedOptions}
                      className={`relative p-2 rounded-full text-white transition-all backdrop-blur-sm ${
                        allowRewind && playerReady
                          ? "bg-white/20 hover:bg-white/30 hover:scale-105"
                          : "bg-white/10 opacity-50 cursor-not-allowed"
                      }`}
                      disabled={!playerReady || !allowRewind}
                    >
                      <Gauge size={18} weight="fill" />
                      {playbackSpeed !== 1 && (
                        <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow-md border-2 border-white">
                          {playbackSpeed}x
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                    disabled={!playerContainerRef.current}
                  >
                    <ArrowsOut size={18} weight="fill" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {allowPlayPause && (
                <div className="relative w-full">
                  <div
                    className={`w-full h-1 bg-white/30 rounded-full group ${
                      allowRewind ? "cursor-pointer" : "cursor-not-allowed"
                    }`}
                    onClick={handleProgressBarClick}
                  >
                    <div
                      className="h-full bg-white rounded-full transition-all duration-150 group-hover:h-1.5"
                      style={{
                        width: `${
                          duration > 0 ? (currentTime / duration) * 100 : 0
                        }%`,
                      }}
                    ></div>
                  </div>

                  {/* Question Markers */}
                  {timeToQuestionMap.map(({ time, question }, index) => {
                    const position =
                      duration > 0 ? (time / 1000 / duration) * 100 : 0;
                    const isAnswered = answeredQuestions[question.id]?.answered;
                    const canSkip = question.can_skip;

                    return (
                      <button
                        key={question.id}
                        className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1 top-0 border-2 border-white shadow-lg transition-all z-10 ${
                          isAnswered
                            ? "bg-green-500"
                            : canSkip
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        } ${
                          allowRewind
                            ? "hover:scale-125 cursor-pointer hover:bg-green-600"
                            : "cursor-not-allowed opacity-75"
                        }`}
                        style={{
                          left: `${Math.max(1.5, Math.min(98.5, position))}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allowRewind) {
                            handleQuestionMarkerClick(question);
                          }
                        }}
                        disabled={!allowRewind}
                        title={`Question ${index + 1}${
                          isAnswered
                            ? " (Answered)"
                            : canSkip
                            ? " (Skippable)"
                            : " (Required)"
                        }${!allowRewind ? " (Navigation disabled)" : ""}`}
                      >
                        {isAnswered ? (
                          <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">
                            ✓
                          </span>
                        ) : (
                          <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">
                            ?
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Time Display */}
              {allowPlayPause && (
                <div className="flex justify-between text-white text-xs mt-2 font-medium">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* YouTube player */}
        <div className="w-full h-full max-w-[100vw] overflow-hidden pointer-events-none">
          <YouTube
            videoId={videoId}
            opts={opts}
            onReady={onPlayerReady}
            className="h-full w-full"
            onStateChange={onStateChange}
          />
        </div>

        {/* Question Overlay */}
        {showQuestion && (
          <VideoQuestionOverlay
            question={currentQuestion}
            onSubmit={handleQuestionSubmit}
            onClose={handleQuestionClose}
            onPause={forcePause}
            previousAnswer={
              currentQuestion
                ? answeredQuestions[currentQuestion.id]?.selectedOptions
                : undefined
            }
          />
        )}
      </div>

      {/* Speed Options Dropdown - Non-fullscreen - Rendered outside video container with fixed positioning */}
      {showSpeedOptions && allowRewind && !isFullscreen && !isPseudoFullscreen && speedButtonRef.current && (
        <div
          className="speed-dropdown fixed bg-black/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 z-[10001] min-w-[80px] max-h-[240px] overflow-y-auto"
          style={{
            bottom: `${window.innerHeight - speedButtonRef.current.getBoundingClientRect().top + 8}px`,
            right: `${window.innerWidth - speedButtonRef.current.getBoundingClientRect().right}px`,
          }}
        >
          <div className="px-3 py-1 text-xs font-medium text-white/70 border-b border-white/20 sticky top-0 bg-black/90">
            Speed
          </div>
          <div className="py-2">
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => changePlaybackSpeed(speed)}
                className={`w-full px-3 py-2 text-sm text-left hover:bg-white/20 transition-colors ${
                  playbackSpeed === speed
                    ? "text-primary-400 bg-white/10 font-medium"
                    : "text-white"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface YouTubePlayerWrapperProps {
  videoId: string;
  onTimeUpdate?: (currentTime: number) => void;
  questions?: Array<{
    id: string;
    question_time_in_millis: number;
    text_data: {
      content: string;
    };
    parent_rich_text?: {
      content: string;
    };
    options: Array<{
      id: string;
      text: {
        content: string;
      };
    }>;
    can_skip?: boolean;
    question_type?: string;
    auto_evaluation_json?: string;
  }>;
  ms?: number;
  allowPlayPause?: boolean;
  allowRewind?: boolean;
  isLiveStream?: boolean;
  liveTimestamp?: number;
  liveClassStartTime?: string;
  enableConcentrationScore?: boolean;
}

// This is a wrapper component that exposes the YouTube player methods
const YouTubePlayerWrapper = forwardRef<any, YouTubePlayerWrapperProps>(
  (
    {
      videoId,
      onTimeUpdate,
      questions,
      ms,
      allowPlayPause,
      allowRewind,
      isLiveStream,
      liveTimestamp,
      liveClassStartTime,
      enableConcentrationScore,
    },
    ref
  ) => {
    const playerRef = useRef<any>(null);
    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      playVideo: () => {
        if (playerRef.current) {
          playerRef.current.playVideo();
        }
      },
      pauseVideo: () => {
        if (playerRef.current) {
          playerRef.current.pauseVideo();
        }
      },
      getCurrentTime: () => {
        if (playerRef.current) {
          return playerRef.current.getCurrentTime();
        }
        return 0;
      },
      getDuration: () => {
        if (playerRef.current) {
          return playerRef.current.getDuration();
        }
        return 0;
      },
      seekTo: (seconds: number, allowSeekAhead: boolean) => {
        if (playerRef.current) {
          playerRef.current.seekTo(seconds, allowSeekAhead);
        }
      },
    }));

    // Handle time updates to check for questions
    const handleTimeUpdate = (currentTime: number) => {
      if (onTimeUpdate) {
        onTimeUpdate(currentTime);
      }
    };
    return (
      <YouTubePlayerComp
        videoId={videoId}
        onTimeUpdate={handleTimeUpdate}
        questions={questions}
        ms={ms}
        allowPlayPause={allowPlayPause}
        allowRewind={allowRewind}
        isLiveStream={isLiveStream}
        liveTimestamp={liveTimestamp}
        liveClassStartTime={liveClassStartTime}
        enableConcentrationScore={enableConcentrationScore}
      />
    );
  }
);

YouTubePlayerWrapper.displayName = "YouTubePlayerWrapper";

export default YouTubePlayerWrapper;
