import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, SkipForward, SkipBack, Maximize, Minimize } from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { Check } from "@phosphor-icons/react";
import { useTrackingStore } from "@/stores/study-library/youtube-video-tracking-store";
import { getEpochTimeInMillis } from "./utils";
import { convertTimeToSeconds } from "@/utils/study-library/tracking/convertTimeToSeconds";
import { formatVideoTime } from "@/utils/study-library/tracking/formatVideoTime";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
import { Preferences } from "@capacitor/preferences";
import { MyButton } from "@/components/design-system/button";
import {
  ArrowsOut,
  FastForward,
  Rewind,
  X,
} from "@phosphor-icons/react";

interface YouTubePlayerProps {
    videoId: string;
    onNext?: () => void;
    onPrevious?: () => void;
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

declare global {
    interface Window {
        YT: {
            Player: any;
            PlayerState: {
                PLAYING: number;
                PAUSED: number;
                ENDED: number;
            };
        };
        onYouTubeIframeAPIReady: () => void;
    }
}

export const YouTubePlayer = ({ videoId, onNext, onPrevious, onTimeUpdate, questions = [] }: YouTubePlayerProps) => {
    const playerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [minutesInput, setMinutesInput] = useState("");
    const [secondsInput, setSecondsInput] = useState("");
    const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, boolean>>({});
    const maxRetries = 3;
    const { setCurrentUploadedVideoTime } = useMediaRefsStore();
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Format time for display
    const formatTime = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    };

    const togglePlay = () => {
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.pauseVideo();
            } else {
                playerRef.current.playVideo();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleFullscreen = () => {
        const container = document.getElementById(`youtube-player-${videoId}`);
        if (!container) return;

        if (!isFullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if ((container as any).webkitRequestFullscreen) {
                (container as any).webkitRequestFullscreen();
            } else if ((container as any).msRequestFullscreen) {
                (container as any).msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
            } else if ((document as any).msExitFullscreen) {
                (document as any).msExitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    };

    const seekToTimestamp = () => {
        if (!playerRef.current) return;

        const minutes = minutesInput === "" ? 0 : Number.parseInt(minutesInput);
        const seconds = secondsInput === "" ? 0 : Number.parseInt(secondsInput);
        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds <= 0) {
            playerRef.current.seekTo(0, true);
        } else if (totalSeconds >= duration) {
            playerRef.current.seekTo(duration, true);
        } else {
            playerRef.current.seekTo(totalSeconds, true);
        }
    };

    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!playerRef.current || duration <= 0) return;

        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const seekTime = clickPosition * duration;

        playerRef.current.seekTo(seekTime, true);
    };

    const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
        const value = e.target.value;
        if (value === "" || /^\d*$/.test(value)) {
            setter(value);
        }
    };

    // Load answered questions from storage
    useEffect(() => {
        const loadAnsweredQuestions = async () => {
            try {
                const { value } = await Preferences.get({
                    key: "video_answered_questions",
                });
                if (value) {
                    setAnsweredQuestions(JSON.parse(value));
                }
            } catch (error) {
                console.error("Error loading answered questions:", error);
            }
        };

        loadAnsweredQuestions();
    }, []);

    // Save answered question to storage
    const saveAnsweredQuestion = async (questionId: string) => {
        try {
            const newAnsweredQuestions = {
                ...answeredQuestions,
                [questionId]: true,
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

    const initializePlayer = () => {
        if (!videoId) {
            setError("No video ID provided");
            setIsLoading(false);
            return;
        }

        try {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }

            playerRef.current = new window.YT.Player(`youtube-player-${videoId}`, {
                videoId,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    fs: 0,
                    playsinline: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: () => {
                        console.log("YouTube player ready");
                        setIsLoading(false);
                        setError(null);
                        setDuration(playerRef.current.getDuration());
                    },
                    onStateChange: (event: any) => {
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            setIsPlaying(true);
                            startProgressTracking();
                        } else if (event.data === window.YT.PlayerState.PAUSED) {
                            setIsPlaying(false);
                            stopProgressTracking();
                        } else if (event.data === window.YT.PlayerState.ENDED) {
                            setIsPlaying(false);
                            stopProgressTracking();
                        }
                    },
                    onError: (event: any) => {
                        console.error("YouTube player error:", event);
                        setError("Failed to load video. Please try again.");
                        setIsLoading(false);
                    }
                }
            });
        } catch (err) {
            console.error("Error initializing YouTube player:", err);
            setError("Failed to initialize video player");
            setIsLoading(false);
        }
    };

    const startProgressTracking = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        progressIntervalRef.current = setInterval(() => {
            if (playerRef.current) {
                const currentTime = playerRef.current.getCurrentTime();
                setCurrentTime(currentTime);
                setCurrentUploadedVideoTime(currentTime);
                if (onTimeUpdate) {
                    onTimeUpdate(currentTime);
                }
            }
        }, 1000);
    };

    const stopProgressTracking = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    const loadYouTubeAPI = () => {
        if (window.YT && window.YT.Player) {
            console.log("YouTube API already loaded");
            initializePlayer();
            return;
        }

        console.log("Loading YouTube API");
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            console.log("YouTube API ready");
            initializePlayer();
        };
    };

    useEffect(() => {
        console.log("Initializing YouTube player");
        setIsLoading(true);
        setError(null);
        loadYouTubeAPI();

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }
            stopProgressTracking();
        };
    }, [videoId]);

    const handleRetry = () => {
        if (retryCount < maxRetries) {
            setRetryCount(prev => prev + 1);
            setError(null);
            setIsLoading(true);
            loadYouTubeAPI();
        } else {
            setError("Maximum retry attempts reached. Please refresh the page.");
        }
    };

    // Render question markers on progress bar
    const renderQuestionMarkers = () => {
        if (!questions || questions.length === 0 || duration <= 0) return null;

        return questions.map((question) => {
            const position = (question.question_time_in_millis / 1000 / duration) * 100;
            const isAnswered = answeredQuestions[question.id];

            return (
                <div
                    key={question.id}
                    className={`absolute h-3 w-3 rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 cursor-pointer ${
                        isAnswered ? "bg-green-500" : "bg-orange-500"
                    }`}
                    style={{ left: `${position}%` }}
                    title={`Question: ${question.text_data.content}`}
                />
            );
        });
    };

    if (error) {
        return (
            <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-8">
                <p className="text-sm text-neutral-600">{error}</p>
                {retryCount < maxRetries && (
                    <Button
                        variant="outline"
                        onClick={handleRetry}
                        className="flex items-center gap-2"
                    >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Retry
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div className="relative w-full group">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
                        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                    </div>
                )}
                <div
                    id={`youtube-player-${videoId}`}
                    className="aspect-video w-full rounded-lg"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={togglePlay}
                                className="text-white hover:text-white/80"
                            >
                                {isPlaying ? (
                                    <Pause className="h-5 w-5" />
                                ) : (
                                    <Play className="h-5 w-5" />
                                )}
                            </Button>
                            {onPrevious && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onPrevious}
                                    className="text-white hover:text-white/80"
                                >
                                    <SkipBack className="h-5 w-5" />
                                </Button>
                            )}
                            {onNext && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onNext}
                                    className="text-white hover:text-white/80"
                                >
                                    <SkipForward className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleFullscreen}
                            className="text-white hover:text-white/80"
                        >
                            {isFullscreen ? (
                                <Minimize className="h-5 w-5" />
                            ) : (
                                <Maximize className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Progress Bar and Time Display */}
            <div className="w-full flex flex-col gap-1">
                <div
                    className="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative"
                    onClick={handleProgressBarClick}
                >
                    <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{
                            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        }}
                    ></div>
                    {renderQuestionMarkers()}
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 justify-between items-center w-full">
                <div className="w-full flex gap-2 items-center justify-start">
                    {isPlaying ? (
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            layoutVariant="icon"
                            onClick={togglePlay}
                            disable={isLoading}
                        >
                            <Pause />
                        </MyButton>
                    ) : (
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            layoutVariant="icon"
                            onClick={togglePlay}
                            disable={isLoading}
                        >
                            <Play />
                        </MyButton>
                    )}
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="icon"
                        onClick={() => {
                            if (playerRef.current) {
                                const newTime = currentTime - 10;
                                playerRef.current.seekTo(Math.max(newTime, 0), true);
                            }
                        }}
                        disable={isLoading}
                    >
                        <Rewind />
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="icon"
                        onClick={() => {
                            if (playerRef.current) {
                                const newTime = currentTime + 10;
                                playerRef.current.seekTo(Math.min(newTime, duration), true);
                            }
                        }}
                        disable={isLoading}
                    >
                        <FastForward />
                    </MyButton>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="icon"
                        onClick={handleFullscreen}
                        disable={isLoading}
                    >
                        <ArrowsOut />
                    </MyButton>
                </div>
                <div className="flex items-center gap-1">
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Min"
                        input={minutesInput}
                        onChangeFunction={(e) => handleNumericInput(e, setMinutesInput)}
                        size="small"
                        className="w-12 h-full"
                    />
                    <span>:</span>
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Sec"
                        input={secondsInput}
                        onChangeFunction={(e) => handleNumericInput(e, setSecondsInput)}
                        size="small"
                        className="w-12 h-full"
                    />
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="icon"
                        onClick={seekToTimestamp}
                        disable={isLoading}
                    >
                        <Check />
                    </MyButton>
                </div>
            </div>
        </div>
    );
}; 