/**
 * Time-Driven Navigation Hook
 * For VIDEO content - Audio controls the timeline
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Entry, TimelineMeta } from '../types';

interface UseTimeDrivenNavigationProps {
    entries: Entry[];
    meta: TimelineMeta;
    audioRef: React.RefObject<HTMLAudioElement>;
    onTimeUpdate?: (time: number) => void;
    onComplete?: () => void;
}

interface UseTimeDrivenNavigationReturn {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    activeEntries: Entry[];
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    reset: () => void;
    handleTimeUpdate: () => void;
    handleLoadedMetadata: () => void;
    handleAudioEnded: () => void;
}

export function useTimeDrivenNavigation({
    entries,
    meta,
    audioRef,
    onTimeUpdate,
    onComplete,
}: UseTimeDrivenNavigationProps): UseTimeDrivenNavigationReturn {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(meta.total_duration || 0);
    const [isPlaying, setIsPlaying] = useState(false);

    const audioStartedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const playStartTimeRef = useRef(0);
    const introStartTimeRef = useRef(0);

    // Get active entries at current time
    const activeEntries = entries.filter((entry) => {
        const start = entry.inTime ?? entry.start ?? 0;
        const end = entry.exitTime ?? entry.end ?? Infinity;
        return currentTime >= start && currentTime < end;
    });

    // Animate intro (before audio starts)
    const animateIntro = useCallback(() => {
        if (!isPlaying) return;

        const elapsed = (performance.now() - playStartTimeRef.current) / 1000;
        const newTime = introStartTimeRef.current + elapsed;

        if (newTime >= meta.audio_start_at && !audioStartedRef.current) {
            // Start audio
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(console.error);
                audioStartedRef.current = true;
            }
            setCurrentTime(newTime);
        } else if (!audioStartedRef.current) {
            setCurrentTime(newTime);
            animationFrameRef.current = requestAnimationFrame(animateIntro);
        }
    }, [isPlaying, meta.audio_start_at, audioRef]);

    const play = useCallback(() => {
        setIsPlaying(true);

        if (currentTime >= meta.audio_start_at) {
            // Past intro, start audio
            if (audioRef.current) {
                const audioTime = currentTime - meta.audio_start_at;
                audioRef.current.currentTime = Math.max(0, audioTime);
                audioRef.current.play().catch(console.error);
                audioStartedRef.current = true;
            }
        } else {
            // In intro, start animation
            audioStartedRef.current = false;
            playStartTimeRef.current = performance.now();
            introStartTimeRef.current = currentTime;
            animationFrameRef.current = requestAnimationFrame(animateIntro);
        }
    }, [currentTime, meta.audio_start_at, audioRef, animateIntro]);

    const pause = useCallback(() => {
        if (audioStartedRef.current && audioRef.current) {
            audioRef.current.pause();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsPlaying(false);
    }, [audioRef]);

    const seek = useCallback(
        (time: number) => {
            setCurrentTime(time);

            if (time >= meta.audio_start_at) {
                const audioTime = time - meta.audio_start_at;
                if (audioRef.current) {
                    audioRef.current.currentTime = audioTime;
                    audioStartedRef.current = true;
                    if (isPlaying) {
                        audioRef.current.play().catch(console.error);
                    }
                }
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
            } else {
                audioStartedRef.current = false;
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                }
                if (isPlaying) {
                    playStartTimeRef.current = performance.now();
                    introStartTimeRef.current = time;
                    if (animationFrameRef.current) {
                        cancelAnimationFrame(animationFrameRef.current);
                    }
                    animationFrameRef.current = requestAnimationFrame(animateIntro);
                }
            }
        },
        [meta.audio_start_at, audioRef, isPlaying, animateIntro]
    );

    const reset = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.pause();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        audioStartedRef.current = false;
        setCurrentTime(0);
        setIsPlaying(false);
    }, [audioRef]);

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current && audioStartedRef.current) {
            const time = audioRef.current.currentTime + meta.audio_start_at;
            setCurrentTime(time);
            onTimeUpdate?.(time);
        }
    }, [audioRef, meta.audio_start_at, onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
        if (audioRef.current && (!meta.total_duration || meta.total_duration === 0)) {
            setDuration(audioRef.current.duration);
        }
    }, [audioRef, meta.total_duration]);

    const handleAudioEnded = useCallback(() => {
        if (meta.total_duration && currentTime < meta.total_duration) {
            // Continue for outro
            audioStartedRef.current = false;
            playStartTimeRef.current = performance.now();
            introStartTimeRef.current = currentTime;

            const animateOutro = () => {
                if (!isPlaying) return;

                const elapsed = (performance.now() - playStartTimeRef.current) / 1000;
                const newTime = introStartTimeRef.current + elapsed;

                if (newTime >= meta.total_duration!) {
                    setCurrentTime(meta.total_duration!);
                    setIsPlaying(false);
                    onComplete?.();
                } else {
                    setCurrentTime(newTime);
                    requestAnimationFrame(animateOutro);
                }
            };
            requestAnimationFrame(animateOutro);
        } else {
            setIsPlaying(false);
            onComplete?.();
        }
    }, [meta.total_duration, currentTime, isPlaying, onComplete]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return {
        currentTime,
        duration,
        isPlaying,
        activeEntries,
        play,
        pause,
        seek,
        reset,
        handleTimeUpdate,
        handleLoadedMetadata,
        handleAudioEnded,
    };
}
