"use client";

import React, { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import { useTrackingStore } from "@/stores/study-library/pdf-tracking-store";
import { v4 as uuidv4 } from "uuid";
import { getISTTime, getEpochTimeInMillis } from "./utils";

interface VideoPlayerProps {
  videoUrl: string;
  videoId: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, videoId }) => {
  const { addActivity } = useTrackingStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<any>(null);
  const startTime = useRef(getISTTime());
  const startTimeInMillis = useRef(getEpochTimeInMillis());
  const activityId = useRef(uuidv4());
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Extract YouTube video ID from URL
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeId = getYouTubeId(videoUrl);

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

  const handleReady = (event: any) => {
    try {
      console.log('YouTube player ready');
      playerRef.current = event.target;
      const duration = event.target.getDuration();
      console.log('Video duration:', duration);
      setDuration(duration);
    } catch (error) {
      console.error('Error in handleReady:', error);
    }
  };

  const handleStateChange = (event: any) => {
    try {
      console.log('YouTube player state changed:', event.data);
      // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
      switch (event.data) {
        case 1: // Playing
          setIsPlaying(true);
          startTimer();
          break;
        case 2: // Paused
          setIsPlaying(false);
          stopTimer();
          break;
        case 0: // Ended
          setIsPlaying(false);
          stopTimer();
          break;
        case 3: // Buffering
          console.log('Video is buffering');
          break;
        case -1: // Unstarted
          console.log('Video is unstarted');
          break;
        case 5: // Video cued
          console.log('Video is cued');
          break;
      }
    } catch (error) {
      console.error('Error in handleStateChange:', error);
    }
  };

  const handleError = (event: any) => {
    console.error('YouTube player error:', event.data);
    // YouTube error codes: 2 (invalid parameter), 5 (HTML5 player error), 100 (video not found), 101/150 (embedding not allowed)
    switch (event.data) {
      case 2:
        console.error('Invalid parameter');
        break;
      case 5:
        console.error('HTML5 player error');
        break;
      case 100:
        console.error('Video not found');
        break;
      case 101:
      case 150:
        console.error('Embedding not allowed');
        break;
    }
  };

  const handleProgress = () => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      setCurrentTime(currentTime);
    }
  };

  // Update activity tracking
  useEffect(() => {
    if (isPlaying) {
      addActivity(
        {
          slide_id: videoId,
          activity_id: activityId.current,
          source: "VIDEO" as const,
          source_id: videoId,
          start_time: startTime.current,
          end_time: getISTTime(),
          start_time_in_millis: startTimeInMillis.current,
          end_time_in_millis: getEpochTimeInMillis(),
          duration: elapsedTime.toString(),
          page_views: [],
          total_pages_read: 0,
          sync_status: "STALE",
          current_page: Math.floor(currentTime),
          current_page_start_time_in_millis: startTimeInMillis.current,
          new_activity: true,
        }
      );
    }
  }, [elapsedTime, videoId, isPlaying, currentTime, addActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, []);

  if (!youtubeId) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <p className="text-red-500">Invalid video URL</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="w-full max-w-4xl aspect-video">
        <YouTube
          videoId={youtubeId}
          opts={{
            width: "100%",
            height: "100%",
            playerVars: {
              autoplay: 0,
              modestbranding: 1,
              rel: 0,
              origin: window.location.origin,
              enablejsapi: 1,
              widgetid: 1,
              forigin: window.location.origin,
              aoriginsup: 1,
              gporigin: window.location.origin,
              vf: 1
            },
          }}
          onReady={handleReady}
          onStateChange={handleStateChange}
          onError={handleError}
          onPlay={handleProgress}
          onPause={handleProgress}
          onEnd={handleProgress}
        />
      </div>
    </div>
  );
}; 