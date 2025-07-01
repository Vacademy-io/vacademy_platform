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

import {
  ArrowsOut,
  Check,
  FastForward,
  Pause,
  Play,
  Rewind,
  X,
} from "@phosphor-icons/react";
import { Preferences } from "@capacitor/preferences";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import VideoQuestionOverlay from "./video-question-overlay";
import { getPublicUrl } from "@/services/upload_file";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
// import { getPublicUrl } from "@/utils/study-library/storage/get-public-url";

interface CustomVideoPlayerProps {
  videoUrl: string;
  sourceType?: "FILE_ID" | "URL";
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
  }>;
}

const CustomVideoPlayer = forwardRef<any, CustomVideoPlayerProps>(
  ({ videoUrl, sourceType = "URL", onTimeUpdate, questions = [] }, ref) => {
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

    const [isPlayed, setIsPlayed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [minutesInput, setMinutesInput] = useState("");
    const [secondsInput, setSecondsInput] = useState("");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const concentrationScoreId = useRef(uuidv4());
    const [showFullscreenControls, setShowFullscreenControls] = useState(false);
    const fullscreenControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    // Question mapping for time-based lookup
    const [timeToQuestionMap, setTimeToQuestionMap] = useState<
      Array<{
        time: number;
        question: NonNullable<CustomVideoPlayerProps["questions"]>[number];
      }>
    >([]);

    // Verification state
    const [showVerification, setShowVerification] = useState(false);
    const [verificationCountdown, setVerificationCountdown] = useState(59);
    const [verificationNumbers, setVerificationNumbers] = useState<number[]>(
      []
    );
    const [verificationInterval] = useState(180);
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
    const [actualVideoUrl, setActualVideoUrl] = useState<string | null>(null);

    const {setCurrentUploadedVideoTime} = useMediaRefsStore();

    useEffect(()=>{
      setCurrentUploadedVideoTime(currentTime);
    }, [currentTime])

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      playVideo: () => {
        if (videoRef.current) {
          videoRef.current.play();
          setIsPlayed(true);
        }
      },
      pauseVideo: () => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlayed(false);
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
      seekTo: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          setCurrentTime(seconds);
        }
      },
    }));

    // Load answered questions from storage
    useEffect(() => {
      const loadAnsweredQuestions = async () => {
        try {
          const { value } = await Preferences.get({
            key: "video_answered_questions",
          });
          if (value) {
            const stored = JSON.parse(value);
            // Handle both old and new format
            const converted: Record<string, {
              answered: boolean;
              selectedOptions: string | string[];
              isCorrect?: boolean;
              timestamp: number;
            }> = {};
            
            Object.entries(stored).forEach(([key, val]) => {
              if (typeof val === 'boolean') {
                // Old format
                converted[key] = {
                  answered: val,
                  selectedOptions: [],
                  isCorrect: true,
                  timestamp: Date.now()
                };
              } else {
                // New format
                converted[key] = val as any;
              }
            });
            
            setAnsweredQuestions(converted);
          }
        } catch (error) {
          console.error("Error loading answered questions:", error);
        }
      };

      loadAnsweredQuestions();
    }, []);

    // Map questions for time-based lookup
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
    }, [videoUrl]);

    // Save answered question to storage
    const saveAnsweredQuestion = async (questionId: string, selectedOptions: string | string[] = [], isCorrect: boolean = true) => {
      try {
        const newAnsweredQuestions = {
          ...answeredQuestions,
          [questionId]: {
            answered: true,
            selectedOptions,
            isCorrect,
            timestamp: Date.now()
          },
        };
        await Preferences.set({
          key: "video_answered_questions",
          value: JSON.stringify(newAnsweredQuestions),
        });
        setAnsweredQuestions(newAnsweredQuestions);
      } catch (error) {
        console.error("Error saving answered question:", error);
      }
    };

    // Check for questions at current timestamp
    const checkForQuestions = useCallback(() => {
      if (!questions || questions.length === 0 || !videoRef.current) return;

      const currentTimeMs = videoRef.current.currentTime * 1000;

      // Find a question that should be shown at the current time
      const questionToShow = questions.find((q) => {
        // Skip already answered questions
        if (answeredQuestions[q.id]?.answered) return false;

        // Check if we're within 500ms of the question time
        const questionTime = q.question_time_in_millis;
        return Math.abs(currentTimeMs - questionTime) < 500;
      });

      if (questionToShow && !showQuestion) {
        // Pause the video
        videoRef.current.pause();
        setIsPlayed(false);

        // Show the question
        setCurrentQuestion(questionToShow);
        setShowQuestion(true);
      }
    }, [questions, showQuestion, answeredQuestions]);

    // Handle question submission
    const handleQuestionSubmit = async (selectedOption: string | string[]) => {
      if (!currentQuestion) return { success: false };

      // Evaluate the answer (you can enhance this logic)
      const isCorrect = true; // This should be based on actual evaluation logic

      // Mark question as answered with detailed info
      await saveAnsweredQuestion(currentQuestion.id, selectedOption, isCorrect);

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
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlayed(true);
      }
    };

    // Load the actual video URL if it's a FILE_ID
    useEffect(() => {
      const loadVideoUrl = async () => {
        try {
          if (sourceType === "FILE_ID") {
            setIsLoading(true);
            const url = await getPublicUrl(videoUrl);
            setActualVideoUrl(url);
          } else {
            setActualVideoUrl(videoUrl);
          }
        } catch (error) {
          console.error("Error loading video URL:", error);
          setError("Failed to load video. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };

      loadVideoUrl();
    }, [videoUrl, sourceType]);

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
            if (videoRef.current) {
              videoRef.current.pause();
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
    }, []);

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
        saveVerificationTime(currentTimeInSeconds);

        // Hide verification
        setShowVerification(false);
      } else {
        // Wrong number clicked, increment wrong answer count
        setWrongAnswerCount((prev) => prev + 1);

        // Pause the video
        if (videoRef.current) {
          videoRef.current.pause();
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

    // Start progress tracking interval when video is playing
    const startProgressTracking = useCallback(() => {
      if (progressIntervalRef.current) return;
      progressIntervalRef.current = setInterval(() => {
        if (videoRef.current) {
          const time = videoRef.current.currentTime;
          setCurrentTime(time);

          // Check for questions at current timestamp
          checkForQuestions();

          if (onTimeUpdate) {
            onTimeUpdate(time);
          }
        }
      }, 250); // Update 4 times per second for smoother progress
    }, [onTimeUpdate, checkForQuestions]);

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
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlayed(false);
        stopProgressTracking();
        stopTimer();
      }
    }, [canNavigateToTime, stopProgressTracking, stopTimer]);

    // Pause video when tab is switched
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Tab switched away
          setTabSwitchCount((prev) => prev + 1);

          if (videoRef.current) {
            videoRef.current.pause();
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
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    }, [showVerification]);

    // Activity tracking effect
    useEffect(() => {
      const endTime = videoEndTime.current || getEpochTimeInMillis();

      const newActivity = {
        id: activeItem?.id || "",
        activity_id: activityId.current,
        source: "VIDEO" as const,
        source_id: videoUrl,
        start_time: videoStartTime.current,
        end_time: endTime,
        duration: elapsedTime.toString(),
        timestamps: currentTimestamps.current,
        percentage_watched: calculatePercentageWatched(duration),
        sync_status: "STALE" as const,
        current_start_time: currentStartTimeRef.current,
        current_start_time_in_epoch: currentStartTimeInEpochRef.current,
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
    }, [
      elapsedTime,
      duration,
      videoUrl,
      tabSwitchCount,
      wrongAnswerCount,
      missedAnswerCount,
      answerTimesInSeconds,
      pauseCount,
      concentrationScore,
      addActivity,
      activeItem,
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

    // Show/hide fullscreen controls on mouse movement
    const handleMouseMove = useCallback(() => {
      if (isFullscreen) {
        setShowFullscreenControls(true);

        // Clear any existing timeout
        if (fullscreenControlsTimeoutRef.current) {
          clearTimeout(fullscreenControlsTimeoutRef.current);
        }

        // Set a new timeout to hide controls after 3 seconds
        fullscreenControlsTimeoutRef.current = setTimeout(() => {
          setShowFullscreenControls(false);
        }, 3000);
      }
    }, [isFullscreen]);

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
        setIsFullscreen(!!document.fullscreenElement);

        // Show controls briefly when entering/exiting fullscreen
        if (!document.fullscreenElement) {
          setShowFullscreenControls(true);

          // Hide controls after 3 seconds
          if (fullscreenControlsTimeoutRef.current) {
            clearTimeout(fullscreenControlsTimeoutRef.current);
          }

          fullscreenControlsTimeoutRef.current = setTimeout(() => {
            setShowFullscreenControls(false);
          }, 3000);
        }
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);

      return () => {
        document.removeEventListener(
          "fullscreenchange",
          handleFullscreenChange
        );
      };
    }, []);

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
      };
    }, [clearUpdateInterval, stopProgressTracking]);

    const togglePlay = () => {
      if (videoRef.current) {
        if (isPlayed) {
          videoRef.current.pause();
          setIsPlayed(false);
          stopTimer();
          stopProgressTracking();

          // Record timestamp for pausing
          const now = getEpochTimeInMillis();
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
          setPauseCount((prev) => prev + 1);
        } else {
          videoRef.current.play();
          setIsPlayed(true);
          startTimer();
          startProgressTracking();

          // Record timestamp for playing
          const now = getEpochTimeInMillis();
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
                2 * 60 * 1000
              );
            }
          }

          currentStartTimeRef.current = formatVideoTime(currentTime);
          currentStartTimeInEpochRef.current =
            convertTimeToSeconds(currentStartTimeRef.current) * 1000;
        }
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

    const seekToTimestamp = () => {
      if (!videoRef.current) return;

      // Convert inputs to numbers
      const minutes = minutesInput === "" ? 0 : Number.parseInt(minutesInput);
      const seconds = secondsInput === "" ? 0 : Number.parseInt(secondsInput);

      // Calculate total seconds
      const totalSeconds = minutes * 60 + seconds;

      // Check navigation restrictions for forward seeks
      if (totalSeconds > currentTime && !canNavigateToTime(totalSeconds)) {
        console.log("Navigation blocked: Please answer previous required questions first");
        return;
      }

      // Get video duration
      const videoDuration = videoRef.current.duration;

      // Ensure timestamp is within valid range
      if (totalSeconds <= 0) {
        videoRef.current.currentTime = 0;
      } else if (totalSeconds >= videoDuration) {
        videoRef.current.currentTime = videoDuration;
      } else {
        videoRef.current.currentTime = totalSeconds;
      }

      // Update currentTime state to reflect new position
      setCurrentTime(videoRef.current.currentTime);
    };

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

    // Format time for display
    const formatTime = (timeInSeconds: number) => {
      const minutes = Math.floor(timeInSeconds / 60);
      const seconds = Math.floor(timeInSeconds % 60);
      return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    // Handle progress bar click for seeking
    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!videoRef.current || duration <= 0) return;

      const progressBar = e.currentTarget;
      const rect = progressBar.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const seekTime = clickPosition * duration;

      // Check navigation restrictions for forward seeks
      if (seekTime > currentTime && !canNavigateToTime(seekTime)) {
        console.log("Navigation blocked: Please answer previous required questions first");
        return;
      }

      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    };

    // Handle video events
    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
        setIsLoading(false);
        // Set the custom video length in the store
        const { setCurrentCustomVideoLength } = useMediaRefsStore.getState();
        setCurrentCustomVideoLength(videoRef.current.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        if (onTimeUpdate) {
          onTimeUpdate(videoRef.current.currentTime);
        }
      }
    };

    const handleVideoError = () => {
      setError("Error loading video. Please try again.");
      setIsLoading(false);
    };

    const handleVideoEnded = () => {
      setIsPlayed(false);
      stopTimer();
      stopProgressTracking();

      // Record timestamp for ending
      const now = getEpochTimeInMillis();
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
    };

    const handleVideoPlay = () => {
      setIsPlayed(true);
      startTimer();
      startProgressTracking();

      // Record timestamp for playing
      const now = getEpochTimeInMillis();
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
            2 * 60 * 1000
          );
        }
      }

      currentStartTimeRef.current = formatVideoTime(currentTime);
      currentStartTimeInEpochRef.current =
        convertTimeToSeconds(currentStartTimeRef.current) * 1000;
    };

    const handleVideoPause = () => {
      setIsPlayed(false);
      stopTimer();
      stopProgressTracking();

      // Record timestamp for pausing
      const now = getEpochTimeInMillis();
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
      setPauseCount((prev) => prev + 1);
    };

    // Render question markers on progress bar
    const renderQuestionMarkers = () => {
      if (!timeToQuestionMap || timeToQuestionMap.length === 0 || duration <= 0) return null;

      return timeToQuestionMap.map(({ time, question }, index) => {
        const position = (time / 1000 / duration) * 100;
        const isAnswered = answeredQuestions[question.id]?.answered;
        const canSkip = question.can_skip;

        return (
          <button
            key={question.id}
            className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 top-1/2 border-2 border-white shadow-lg transition-all hover:scale-125 z-10 ${
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
            title={`Question ${index + 1}${isAnswered ? " (Answered)" : canSkip ? " (Skippable)" : " (Required)"}: ${question.text_data.content}`}
          >
            {isAnswered ? (
              <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">✓</span>
            ) : (
              <span className="text-white text-xs font-bold flex items-center justify-center w-full h-full">?</span>
            )}
          </button>
        );
      });
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

        {/* Video player container with verification overlay */}
        <div
          ref={playerContainerRef}
          className="aspect-video w-full relative h-full items-center flex justify-center overflow-hidden"
          onMouseMove={handleMouseMove}
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

          {/* Top Controls Overlay - Video controls moved to top */}
          {!isFullscreen && (
            <div className="absolute top-0 left-0 right-0 z-[999] bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pb-8">
              {/* Video Controls */}
              <div className="flex gap-2 justify-between items-center w-full mb-4">
                <div className="w-full flex gap-2 items-center justify-start">
                  {isPlayed ? (
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                      disabled={!actualVideoUrl || isLoading}
                    >
                      <Pause size={20} weight="fill" />
                    </button>
                  ) : (
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                      disabled={!actualVideoUrl || isLoading}
                    >
                      <Play size={20} weight="fill" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        const newTime = videoRef.current.currentTime - 10;
                        videoRef.current.currentTime = Math.max(newTime, 0);
                        setCurrentTime(Math.max(newTime, 0));
                      }
                    }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                    disabled={!actualVideoUrl || isLoading}
                  >
                    <Rewind size={18} weight="fill" />
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        const newTime = videoRef.current.currentTime + 10;
                        const duration = videoRef.current.duration;
                        const finalTime = Math.min(newTime, duration);
                        
                        // Check if forward navigation is allowed
                        if (!canNavigateToTime(finalTime)) {
                          console.log("Navigation blocked: Please answer previous required questions first");
                          return;
                        }
                        
                        videoRef.current.currentTime = finalTime;
                        setCurrentTime(finalTime);
                      }
                    }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                    disabled={!actualVideoUrl || isLoading}
                  >
                    <FastForward size={18} weight="fill" />
                  </button>
                  
                  <button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                    disabled={
                      !actualVideoUrl || isLoading || !playerContainerRef.current
                    }
                  >
                    <ArrowsOut size={18} weight="fill" />
                  </button>
                </div>
                
                {/* Time Jump Controls */}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Min"
                    value={minutesInput}
                    onChange={(e) => handleNumericInput(e, setMinutesInput)}
                    className="w-12 h-8 text-center text-xs bg-white/20 border border-white/30 rounded text-white placeholder-white/70 backdrop-blur-sm"
                  />
                  <span className="text-white text-xs">:</span>
                  <input
                    type="text"
                    placeholder="Sec"
                    value={secondsInput}
                    onChange={(e) => handleNumericInput(e, setSecondsInput)}
                    className="w-12 h-8 text-center text-xs bg-white/20 border border-white/30 rounded text-white placeholder-white/70 backdrop-blur-sm"
                  />
                  <button
                    onClick={seekToTimestamp}
                    className="p-1.5 rounded bg-white/20 hover:bg-white/30 text-white transition-all hover:scale-105 backdrop-blur-sm"
                    disabled={!actualVideoUrl || isLoading}
                  >
                    <Check size={14} weight="fill" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full flex flex-col gap-1">
                <div
                  className="w-full h-2 bg-white/30 rounded-full cursor-pointer relative"
                  onClick={handleProgressBarClick}
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-150"
                    style={{
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    }}
                  ></div>
                  {/* Question markers */}
                  {renderQuestionMarkers()}
                </div>
                <div className="flex justify-between text-xs text-white font-medium">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
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
                    if (videoRef.current) {
                      const newTime = videoRef.current.currentTime - 10;
                      videoRef.current.currentTime = Math.max(newTime, 0);
                      setCurrentTime(Math.max(newTime, 0));
                    }
                  }}
                  className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all hover:scale-105 shadow-lg backdrop-blur-sm border border-white/10"
                  aria-label="Rewind 10 seconds"
                >
                  <Rewind size={22} weight="bold" />
                </button>

                {isPlayed ? (
                  <button
                    onClick={togglePlay}
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
                    if (videoRef.current) {
                      const newTime = videoRef.current.currentTime + 10;
                      const duration = videoRef.current.duration;
                      const finalTime = Math.min(newTime, duration);
                      
                      // Check if forward navigation is allowed
                      if (!canNavigateToTime(finalTime)) {
                        console.log("Navigation blocked: Please answer previous required questions first");
                        return;
                      }
                      
                      videoRef.current.currentTime = finalTime;
                      setCurrentTime(finalTime);
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

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="bg-white p-4 rounded-lg shadow-lg">
                <p className="text-red-500">{error}</p>
              </div>
            </div>
          )}

          {/* Video element */}
          {actualVideoUrl && (
            <video
              ref={videoRef}
              className="w-full h-full"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onError={handleVideoError}
              onEnded={handleVideoEnded}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              playsInline
              preload="metadata"
              controlsList="nodownload"
            >
              <source src={actualVideoUrl} type="video/mp4" />
              <source src={actualVideoUrl} type="video/webm" />
              <source src={actualVideoUrl} type="video/ogg" />
              Your browser does not support the video tag or the video format.
            </video>
          )}

          {/* Question overlay */}
          {showQuestion && currentQuestion && (
            <VideoQuestionOverlay
              question={currentQuestion}
              onSubmit={handleQuestionSubmit}
              onClose={handleQuestionClose}
              onPause={() => {
                if (videoRef.current) {
                  videoRef.current.pause();
                  setIsPlayed(false);
                }
              }}
              previousAnswer={currentQuestion ? answeredQuestions[currentQuestion.id]?.selectedOptions : undefined}
            />
          )}
        </div>
      </div>
    );
  }
);

CustomVideoPlayer.displayName = "CustomVideoPlayer";

export default CustomVideoPlayer;
