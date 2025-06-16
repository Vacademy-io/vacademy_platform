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
} from "@phosphor-icons/react";
import { Preferences } from "@capacitor/preferences";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import VideoQuestionOverlay from "./video-question-overlay";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

interface MediaRefs {
  video: HTMLVideoElement | null;
  [key: string]: any;
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

export const formatTime = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export const YouTubePlayer = ({ videoId }: YouTubePlayerProps) => {
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

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
          controls: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          fs: 1,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            console.log("YouTube player ready");
            setIsLoading(false);
            setError(null);
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              console.log("Video started playing");
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
    <div className="relative w-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      )}
      <div
        id={`youtube-player-${videoId}`}
        className="aspect-video w-full rounded-lg"
      />
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

// Helper function to extract video ID from various YouTube URL formats
const extractVideoId = (url: string): string | null => {
  if (!url) {
    console.error("No URL provided to extractVideoId");
    return null;
  }

  console.log("Extracting video ID from:", url);

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log("Found video ID:", match[1]);
      return match[1];
    }
  }

  // If the input is already a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    console.log("Input is already a valid video ID:", url);
    return url;
  }

  console.error("Could not extract video ID from URL:", url);
  return null;
};

const YouTubePlayerWrapper = forwardRef<any, YouTubePlayerWrapperProps>(
  ({ videoId: inputVideoId, onTimeUpdate, questions, ms }, ref) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { activeItem } = useContentStore();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;
    const playerId = `youtube-player-${inputVideoId}-${Math.random().toString(36).substr(2, 9)}`;
    const { setMediaRefs } = useMediaRefsStore();
    const apiLoadedRef = useRef(false);

    // Extract the actual video ID
    const videoId = extractVideoId(inputVideoId);

    const initializePlayer = () => {
      if (!videoId) {
        setError("No video ID provided");
        setIsLoading(false);
        return;
      }

      try {
        // Clear any existing player
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        // Create new player instance
        playerRef.current = new window.YT.Player(`youtube-player-${videoId}`, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 1,
            playsinline: 1,
            origin: window.location.origin,
            enablejsapi: 1,
            host: "https://www.youtube.com"
          },
          events: {
            onReady: (event: any) => {
              console.log("YouTube player ready");
              setIsLoading(false);
              setError(null);
              // Store the player reference
              setMediaRefs((prev: MediaRefs) => ({
                ...prev,
                video: event.target,
              }));
            },
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                console.log("Video started playing");
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

    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        console.log("YouTube API already loaded, initializing player");
        apiLoadedRef.current = true;
        initializePlayer();
        return;
      }

      if (apiLoadedRef.current) {
        console.log("API loading in progress, waiting for callback");
        return;
      }

      console.log("Loading YouTube API");
      apiLoadedRef.current = true;

      // Remove any existing script to prevent multiple loads
      const existingScript = document.getElementById('youtube-iframe-api');
      if (existingScript) {
        existingScript.remove();
      }

      const tag = document.createElement("script");
      tag.id = 'youtube-iframe-api';
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API ready callback");
        apiLoadedRef.current = false;
        initializePlayer();
      };
    };

    useEffect(() => {
      console.log("YouTube player effect triggered");
      setIsLoading(true);
      setError(null);
      loadYouTubeAPI();

      return () => {
        console.log("Cleaning up YouTube player");
        if (playerRef.current) {
          playerRef.current.destroy();
        }
        apiLoadedRef.current = false;
      };
    }, [videoId]);

    const handleRetry = () => {
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setError(null);
        setIsLoading(true);
        apiLoadedRef.current = false;
        loadYouTubeAPI();
      } else {
        setError("Maximum retry attempts reached. Please refresh the page.");
      }
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
      <div className="relative w-full h-full">
        <div ref={containerRef} className="w-full h-full rounded-lg"></div>
      </div>
    );
  }
);

YouTubePlayerWrapper.displayName = "YouTubePlayerWrapper";

export default YouTubePlayerWrapper;
