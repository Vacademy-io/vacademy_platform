"use client";

import type React from "react";
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
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
import { MyButton } from "@/components/design-system/button";
import { MyInput } from "@/components/design-system/input";
import {
  ArrowsOut,
  Check,
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
}) => {
  const { activeItem } = useContentStore();
  const { addActivity } = useTrackingStore();
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

  const [isPlayed, setIsPlayed] = useState(true);
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

  // Playback speed state
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  // UI control states
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showSeekAnimation, setShowSeekAnimation] = useState<{ side: 'left' | 'right', show: boolean }>({ side: 'left', show: false });

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<
    Record<string, {
      answered: boolean;
      selectedOptions: string | string[];
      isCorrect?: boolean;
      timestamp: number;
    }>
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

  const [timeToQuestionMap, setTimeToQuestionMap] = useState<
    Array<{
      time: number;
      question: NonNullable<YouTubePlayerProps["questions"]>[number];
    }>
  >([]);
  
  const {setCurrentYoutubeTime, setCurrentYoutubeVideoLength} = useMediaRefsStore();
  
  useEffect(()=>{
      setCurrentYoutubeTime(currentTime);
  }, [currentTime])

  useEffect(() => {
    if (questions && questions.length > 0) {
      const mapped = questions.map((q) => ({
        time: q.question_time_in_millis,
        question: q,
      }));
      setTimeToQuestionMap(mapped);
      console.log("Mapped questions:", mapped);
    }
    // Reset answered questions when questions change (new video/slide)
    setAnsweredQuestions({});
  }, [questions]);

  // Reset answered questions when video changes
  useEffect(() => {
    setAnsweredQuestions({});
  }, [videoId]);

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

  const checkForQuestions = useCallback(async () => {
    if (!timeToQuestionMap || timeToQuestionMap.length === 0 || !player) return;

    try {
      const currentTime = await player.getCurrentTime();
      if (typeof currentTime !== "number" || isNaN(currentTime)) return;
      const currentTimeMs = currentTime * 1000;

      const questionToShow = timeToQuestionMap.find(({ time, question }) => {
        if (answeredQuestions && answeredQuestions[question.id]?.answered) return false;
        return Math.abs(currentTimeMs - time) < 500;
      });

      if (questionToShow && !showQuestion) {
        console.log("Question detected at time:", currentTimeMs, "- Force pausing video");
        // Use the force pause function for immediate pause
        player.pauseVideo();
        setIsPlayed(false);
        stopProgressTracking();
        stopTimer();
        setCurrentQuestion(questionToShow.question);
        setShowQuestion(true);
        console.log("Question overlay shown and video paused");
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
    setAnsweredQuestions(prev => ({
      ...prev,
      [currentQuestion.id]: {
        answered: true,
        selectedOptions: selectedOption,
        isCorrect,
        timestamp: Date.now()
      }
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
      setAnsweredQuestions(prev => ({
        ...prev,
        [currentQuestion.id]: {
          answered: true,
          selectedOptions: [],
          isCorrect: false,
          timestamp: Date.now()
        }
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
          console.log(lastVerificationTime);
        }
      } catch (error) {
        console.error("Error loading saved concentration metrics:", error);
      }
    };

    loadSavedData();
  }, []);

  // Save concentration metrics to Capacitor preferences
  const saveConcentrationMetrics = async () => {
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
  };
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
  }, [tabSwitchCount, wrongAnswerCount, missedAnswerCount, pauseCount]);

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
    if (
      isPlayed &&
      elapsedTime > 0 &&
      elapsedTime % verificationInterval === 0
    ) {
      // Show verification without pausing the video
      setShowVerification(true);
      generateVerificationNumbers();
      startVerificationTimer();
    }
  }, [
    elapsedTime,
    verificationInterval,
    isPlayed,
    generateVerificationNumbers,
    startVerificationTimer,
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
  const canNavigateToTime = useCallback((targetTimeSeconds: number) => {
    const targetTimeMs = targetTimeSeconds * 1000;
    
    // Find all questions that come before or at the target time
    const previousQuestions = timeToQuestionMap.filter(({ time }) => time <= targetTimeMs);
    
    // Check if all previous questions that cannot be skipped are answered
    for (const { question } of previousQuestions) {
      if (!question.can_skip && !answeredQuestions[question.id]?.answered) {
        return false; // Cannot navigate forward past unanswered required questions
      }
    }
    
    return true;
  }, [timeToQuestionMap, answeredQuestions]);

  // Function to handle question marker click
  const handleQuestionMarkerClick = useCallback((questionData: any) => {
    // Check if we can navigate to this question's time
    const questionTimeSeconds = questionData.question_time_in_millis / 1000;
    
    if (!canNavigateToTime(questionTimeSeconds)) {
      // Show a message that they need to answer previous questions first
      console.log("Cannot navigate: Please answer previous required questions first");
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
  }, [canNavigateToTime, player, stopProgressTracking, stopTimer]);
  // Pause video when tab is switched
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switched away
        setTabSwitchCount((prev) => prev + 1);

        if (player) {
          player.pauseVideo();
          setIsPlayed(false);
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
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [player, showVerification]);

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
      } catch (error) {
        console.error("Error getting current time:", error);
      }
    }, 1000);

    return () => clearInterval(updateTimeInterval);
  }, [player, isPlayed]);

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
      concentration_score: {
        id: concentrationScoreId.current,
        concentration_score: concentrationScore,
        tab_switch_count: tabSwitchCount,
        pause_count: missedAnswerCount,
        wrong_answer_count: wrongAnswerCount,
        missed_answer_count: missedAnswerCount,
        answer_times_in_seconds: answerTimesInSeconds,
      },
      new_activity: true,
    };
    addActivity(newActivity, true);
    // }, [elapsedTime, duration, videoId, addActivity]);
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
    iframe.addEventListener("load", injectCSS);

    // Also try immediately in case iframe is already loaded
    injectCSS();

    return () => {
      iframe.removeEventListener("load", injectCSS);
    };
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
      autoplay: 0, // Don't autoplay
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
    },
  };

  const togglePause = () => {
    setIsPlayed(false);
    console.log("video is paused");
    if (player) {
      player.pauseVideo();
    }
  };

  // Direct pause function for question overlay - bypasses state management issues
  const forcePause = () => {
    console.log("VideoQuestionOverlay: Force pausing video");
    if (player && playerReady) {
      try {
        player.pauseVideo();
        setIsPlayed(false);
        stopProgressTracking();
        stopTimer();
        console.log("VideoQuestionOverlay: Video force paused successfully");
      } catch (error) {
        console.error("VideoQuestionOverlay: Error force pausing video:", error);
      }
    } else {
      console.warn("VideoQuestionOverlay: Player not ready for force pause");
    }
  };

  const togglePlay = () => {
    setIsPlayed(true);
    console.log("Video is played");
    if (player) player.playVideo();
  };

  const onPlayerReady: YouTubeProps["onReady"] = async (
    event: YouTubeEvent
  ) => {
    console.log("Player ready");
    setPlayer(event.target);
    setPlayerReady(true);

    // Get the iframe element
    try {
      const iframe = await event.target.getIframe();
      iframeRef.current = iframe;

      // Try to hide YouTube elements by injecting CSS
      if (iframe) {
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

  // Clean up fullscreen controls timeout
  useEffect(() => {
    return () => {
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      console.log("fullscreen change", isNowFullscreen);

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

    try {
      if (isPlayed) {
        player.playVideo();
        startProgressTracking();
      } else {
        player.pauseVideo();
        setPauseCount((prev) => prev + 1);
        stopProgressTracking();
      }
    } catch (error) {
      console.error("Error controlling video playback:", error);
    }
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
        console.log("integrate add video activity api now");
        syncVideoTrackingData();
        setIsFirstPlay(false);

        if (!updateIntervalRef.current) {
          updateIntervalRef.current = setInterval(
            () => {
              console.log("integrate update video activity api now");
              syncVideoTrackingData();
            },
            60 * 1000
          );
        }
      }

      currentStartTimeRef.current = formatVideoTime(currentTime);
      currentStartTimeInEpochRef.current =
        convertTimeToSeconds(currentStartTimeRef.current) * 1000;
      setIsPlayed(true);
      console.log("play state");
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

  const handleNumericInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === "" || /^\d+$/.test(value)) {
      setter(value);
    }
  };

  const seekToTimestamp = async (targetTimeInSeconds?: number, forceSeek = false) => {
    if (!player || !playerReady) return false;

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
      console.log("Navigation blocked: Please answer previous required questions first");
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

      player.seekTo(finalSeekTime, true);

      // Update currentTime state to reflect new position
      setCurrentTime(finalSeekTime);

      return true;
    } catch (error) {
      console.error("Error seeking to timestamp:", error);
      return false;
    }
  };

  useEffect(() => {
    // Only seek if ms is greater than 0 and player is ready
    console.log("ms: ", ms);
    if (ms > 0 && player && playerReady) {
      const totalSeconds = ms / 1000;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60); // Use Math.floor for whole seconds

      // Update input fields for display consistency
      setMinutesInput(minutes.toString());
      setSecondsInput(seconds.toString());

      // Call seekToTimestamp with the calculated totalSeconds (force it for initial load)
      seekToTimestamp(totalSeconds, true);
    }
  }, [ms, player, playerReady]);

  const toggleFullscreen = useCallback(async () => {
    if (!playerContainerRef.current) {
      console.error("Player container not available");
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await playerContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
        setShowFullscreenControls(true);

        // Hide controls after 3 seconds
        if (fullscreenControlsTimeoutRef.current) {
          clearTimeout(fullscreenControlsTimeoutRef.current);
        }

        fullscreenControlsTimeoutRef.current = setTimeout(() => {
          setShowFullscreenControls(false);
        }, 3000);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setShowFullscreenControls(false);
      }
    } catch (error) {
      console.error("Error toggling fullscreen:", error);
    }
  }, []);

  // Function to change playback speed
  const changePlaybackSpeed = useCallback((speed: number) => {
    if (player && playerReady) {
      try {
        player.setPlaybackRate(speed);
        setPlaybackSpeed(speed);
        setShowSpeedOptions(false);
        console.log(`Playback speed changed to ${speed}x`);
      } catch (error) {
        console.error("Error changing playback speed:", error);
      }
    }
  }, [player, playerReady]);

  // Toggle speed options dropdown
  const toggleSpeedOptions = useCallback(() => {
    setShowSpeedOptions(prev => !prev);
  }, []);

  // Close speed options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSpeedOptions && !target.closest('.speed-control-container')) {
        setShowSpeedOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedOptions]);

  // Handle double-click to seek
  const handleDoubleClick = useCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!player || !playerReady) return;

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
        setShowSeekAnimation({ side: 'right', show: true });
      } else {
        // Backward 10 seconds
        newTime = Math.max(currentTime - 10, 0);
        setShowSeekAnimation({ side: 'left', show: true });
      }

      // Check if navigation is allowed (only for forward seeks)
      if (isRightSide && !canNavigateToTime(newTime)) {
        console.log("Navigation blocked: Please answer previous required questions first");
        setShowSeekAnimation({ side: 'right', show: false });
        return;
      }

      player.seekTo(newTime, true);
      setCurrentTime(newTime);

      // Hide animation after 1 second
      setTimeout(() => {
        setShowSeekAnimation({ side: isRightSide ? 'right' : 'left', show: false });
      }, 1000);
    } catch (error) {
      console.error("Error seeking on double click:", error);
    }
  }, [player, playerReady]);

  // Handle mouse movement to show/hide controls
  const handleMouseMoveOnVideo = useCallback(() => {
    console.log("Mouse move detected, isFullscreen:", isFullscreen);
    
    if (isFullscreen) {
      // Handle fullscreen controls
      console.log("Showing fullscreen controls");
      setShowFullscreenControls(true);
      
      // Clear existing fullscreen timeout
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }

      // Set timeout to hide fullscreen controls after 3 seconds of inactivity
      fullscreenControlsTimeoutRef.current = setTimeout(() => {
        console.log("Hiding fullscreen controls after timeout");
        setShowFullscreenControls(false);
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
        if (!showSpeedOptions) { // Don't hide if speed menu is open
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isFullscreen, showSpeedOptions]);

  // Show controls when speed menu opens
  useEffect(() => {
    if (showSpeedOptions) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [showSpeedOptions]);

  // Debug effect to track fullscreen controls state
  useEffect(() => {
    console.log("Fullscreen controls state changed:", {
      isFullscreen,
      showFullscreenControls,
      showControls
    });
  }, [isFullscreen, showFullscreenControls, showControls]);

  // Format time for display

  // Handle progress bar click for seeking
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!player || !playerReady || duration <= 0) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const seekTime = clickPosition * duration;

    // Check if navigation is allowed
    if (!canNavigateToTime(seekTime)) {
      console.log("Navigation blocked: Please answer previous required questions first");
      return;
    }

    player.seekTo(seekTime, true);
    setCurrentTime(seekTime);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* Non-fullscreen verification overlay - shown outside the player */}
      {showVerification && !isFullscreen && (
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
        className="aspect-video w-full relative h-full items-center flex justify-center overflow-hidden bg-black rounded-lg group"
        onMouseMove={handleMouseMoveOnVideo}
        onMouseEnter={handleMouseMoveOnVideo}
        onDoubleClick={handleDoubleClick}
      >
        {/* Verification overlay - only shown in fullscreen */}
        {showVerification && isFullscreen && (
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
        {isFullscreen && (
          <div 
            className="absolute inset-0 z-[9998] pointer-events-auto"
            onMouseMove={handleMouseMoveOnVideo}
            onMouseEnter={handleMouseMoveOnVideo}
          />
        )}

        {/* Fullscreen controls overlay */}
        {isFullscreen && showFullscreenControls && (
          <div className="absolute inset-0 z-[9999] flex flex-col justify-between p-4 bg-gradient-to-b from-black/50 via-transparent to-black/50 animate-in fade-in duration-200">
            {/* Top controls - Exit fullscreen */}
            <div className="flex justify-end">
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                aria-label="Exit fullscreen"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            {/* Bottom controls - Play/Pause */}
            <div className="flex items-center justify-center gap-6 mb-4">
              <button
                onClick={() => {
                  if (player) {
                    safeGetNumber(player.getCurrentTime()).then(
                      (currentTime) => {
                        const newTime = currentTime - 10;
                        player.seekTo(Math.max(newTime, 0), true);
                        setCurrentTime(Math.max(newTime, 0));
                      }
                    );
                  }
                }}
                className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                aria-label="Rewind 10 seconds"
              >
                <Rewind size={22} weight="bold" />
              </button>

              {isPlayed ? (
                <button
                  onClick={togglePause}
                  className="p-4 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                  aria-label="Pause"
                >
                  <Pause size={28} weight="bold" />
                </button>
              ) : (
                <button
                  onClick={togglePlay}
                  className="p-4 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                  aria-label="Play"
                >
                  <Play size={28} weight="bold" />
                </button>
              )}

              <button
                onClick={() => {
                  if (player) {
                    safeGetNumber(player.getCurrentTime()).then((currentTime) => {
                      const newTime = currentTime + 10;
                      safeGetNumber(player.getDuration()).then((duration) => {
                        player.seekTo(Math.min(newTime, duration), true);
                        setCurrentTime(Math.min(newTime, duration));
                      });
                    });
                  }
                }}
                className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                aria-label="Forward 10 seconds"
              >
                <FastForward size={22} weight="bold" />
              </button>
            </div>
          </div>
        )}

        {/* Seek animation overlays */}
        {showSeekAnimation.show && (
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]`}>
            <div className={`flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white animate-in fade-in zoom-in duration-300 ${
              showSeekAnimation.side === 'right' ? 'flex-row' : 'flex-row-reverse'
            }`}>
              <div className="flex gap-1">
                {[...Array(showSeekAnimation.side === 'right' ? 2 : 2)].map((_, i) => (
                  <FastForward key={i} size={20} weight="fill" className={showSeekAnimation.side === 'right' ? '' : 'rotate-180'} />
                ))}
              </div>
              <span className="text-sm font-medium">10s</span>
            </div>
          </div>
        )}

        {/* Top Progress Bar */}
        {!isFullscreen && (
          <div className={`absolute top-0 left-0 right-0 z-[999] transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}>
            <div className="bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pb-8">
              {/* Professional Video Controls Overlay */}
              <div className="flex items-center justify-between mb-4">
                {/* Left Controls */}
                <div className="flex items-center gap-3">
                  {/* Play/Pause */}
                  {isPlayed ? (
                    <button
                      onClick={togglePause}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                      disabled={!playerReady}
                    >
                      <Pause size={20} weight="fill" />
                    </button>
                  ) : (
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                      disabled={!playerReady}
                    >
                      <Play size={20} weight="fill" />
                    </button>
                  )}

                  {/* Rewind */}
                  <button
                    onClick={() => {
                      if (player) {
                        safeGetNumber(player.getCurrentTime()).then((currentTime) => {
                          const newTime = Math.max(currentTime - 10, 0);
                          // Always allow backward navigation
                          player.seekTo(newTime, true);
                          setCurrentTime(newTime);
                        });
                      }
                    }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                  >
                    <Rewind size={18} weight="fill" />
                  </button>

                  {/* Fast Forward */}
                  <button
                    onClick={() => {
                      if (player) {
                        safeGetNumber(player.getCurrentTime()).then((currentTime) => {
                          const newTime = currentTime + 10;
                          safeGetNumber(player.getDuration()).then((duration) => {
                            const finalTime = Math.min(newTime, duration);
                            
                            // Check if forward navigation is allowed
                            if (!canNavigateToTime(finalTime)) {
                              console.log("Navigation blocked: Please answer previous required questions first");
                              return;
                            }
                            
                            player.seekTo(finalTime, true);
                            setCurrentTime(finalTime);
                          });
                        });
                      }
                    }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                  >
                    <FastForward size={18} weight="fill" />
                  </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                  {/* Playback Speed Control */}
                  <div className="relative speed-control-container">
                    <button
                      onClick={toggleSpeedOptions}
                      className="relative p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                      disabled={!playerReady}
                    >
                      <Gauge size={18} weight="fill" />
                      {playbackSpeed !== 1 && (
                        <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow-md border-2 border-white">
                          {playbackSpeed}x
                        </span>
                      )}
                    </button>
                    
                    {/* Speed Options Dropdown */}
                    {showSpeedOptions && (
                      <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 py-2 z-50 min-w-[80px]">
                        <div className="px-3 py-1 text-xs font-medium text-white/70 border-b border-white/20 mb-1">
                          Speed
                        </div>
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
                    )}
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
              <div className="relative w-full">
                <div
                  className="w-full h-1 bg-white/30 rounded-full cursor-pointer group"
                  onClick={handleProgressBarClick}
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-150 group-hover:h-1.5"
                    style={{
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                
                {/* Question Markers */}
                {timeToQuestionMap.map(({ time, question }, index) => {
                  const position = duration > 0 ? (time / 1000 / duration) * 100 : 0;
                  const isAnswered = answeredQuestions[question.id]?.answered;
                  const canSkip = question.can_skip;
                  
                  return (
                    <button
                      key={question.id}
                      className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1 top-0 border-2 border-white shadow-lg transition-all hover:scale-125 z-10 ${
                        isAnswered
                          ? "bg-green-500 hover:bg-green-600"
                          : canSkip
                            ? "bg-yellow-500 hover:bg-yellow-600"
                            : "bg-red-500 hover:bg-red-600"
                      }`}
                      style={{ left: `${Math.max(1.5, Math.min(98.5, position))}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuestionMarkerClick(question);
                      }}
                      title={`Question ${index + 1}${isAnswered ? " (Answered)" : canSkip ? " (Skippable)" : " (Required)"}`}
                    >
                      {isAnswered ? (
                        <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">✓</span>
                      ) : (
                        <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">?</span>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Time Display */}
              <div className="flex justify-between text-white text-xs mt-2 font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}

        {/* YouTube player */}
        <div className="w-full h-full pointer-events-none">
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
            previousAnswer={currentQuestion ? answeredQuestions[currentQuestion.id]?.selectedOptions : undefined}
          />
        )}
      </div>

      {/* Custom Time Jump Input - Compact Design */}
      {!isFullscreen && (
        <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-sm text-gray-600 font-medium">Jump to:</span>
          <MyInput
            inputType="text"
            inputPlaceholder="Min"
            input={minutesInput}
            onChangeFunction={(e) => handleNumericInput(e, setMinutesInput)}
            size="small"
            className="w-14 h-8 text-center"
          />
          <span className="text-gray-500">:</span>
          <MyInput
            inputType="text"
            inputPlaceholder="Sec"
            input={secondsInput}
            onChangeFunction={(e) => handleNumericInput(e, setSecondsInput)}
            size="small"
            className="w-14 h-8 text-center"
          />
          <MyButton
            buttonType="primary"
            scale="small"
            layoutVariant="icon"
            onClick={() => seekToTimestamp()}
            disable={!playerReady}
          >
            <Check size={16} />
          </MyButton>
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
}

// This is a wrapper component that exposes the YouTube player methods
const YouTubePlayerWrapper = forwardRef<any, YouTubePlayerWrapperProps>(
  ({ videoId, onTimeUpdate, questions, ms }, ref) => {
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
      />
    );
  }
);

YouTubePlayerWrapper.displayName = "YouTubePlayerWrapper";

export default YouTubePlayerWrapper;
