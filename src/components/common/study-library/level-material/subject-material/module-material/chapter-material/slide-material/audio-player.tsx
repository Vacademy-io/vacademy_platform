"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAudioTrackingStore } from "@/stores/study-library/audio-tracking-store";
import { useAudioSync } from "@/hooks/study-library/useAudioSync";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { getPublicUrl } from "@/services/upload_file";
import {
    Play,
    Pause,
    Rewind,
    FastForward,
    SpeakerHigh,
    SpeakerX,
    FileText,
    Spinner,
} from "@phosphor-icons/react";
import * as Slider from "@radix-ui/react-slider";

interface AudioPlayerProps {
    audioSlide: {
        id: string;
        source_type: "FILE" | "URL";
        published_audio_file_id: string;
        published_audio_length_in_millis: number;
        thumbnail_file_id?: string;
        transcript?: string;
        external_url?: string | null;
    };
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioSlide }) => {
    const { activeItem } = useContentStore();
    const addActivity = useAudioTrackingStore((state) => state.addActivity);
    const { syncAudioTrackingData } = useAudioSync();
    
    // Refs
    const audioRef = useRef<HTMLAudioElement>(null);
    const activityId = useRef(uuidv4());
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastSyncTimeRef = useRef<number>(0);
    const isSyncingRef = useRef<boolean>(false);
    
    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showTranscript, setShowTranscript] = useState(false);

    // Tracking State - track the segment being listened
    const currentSegmentStart = useRef<number>(0);
    const accumulatedTimestamps = useRef<Array<{
        id: string;
        start: number;
        end: number;
        speed: number;
    }>>([]);

    // Load Resources
    useEffect(() => {
        const loadResources = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Get Audio URL
                let url = audioSlide.external_url;
                if (audioSlide.source_type === "FILE" || !url) {
                    url = await getPublicUrl(audioSlide.published_audio_file_id);
                }
                
                if (!url) throw new Error("Could not load audio source.");
                setAudioUrl(url);

                // Get Thumbnail URL
                if (audioSlide.thumbnail_file_id) {
                    const img = await getPublicUrl(audioSlide.thumbnail_file_id);
                    setImageUrl(img);
                }
            } catch (err) {
                console.error("Failed to load audio resources:", err);
                setError("Failed to load audio.");
            } finally {
                setIsLoading(false);
            }
        };

        loadResources();
        
        return () => {
             if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [audioSlide]);

    // Debounced sync function to prevent rapid API calls
    const debouncedSync = useCallback(async () => {
        const now = Date.now();
        // Prevent syncing more than once every 10 seconds
        if (now - lastSyncTimeRef.current < 10000) {
            console.log("[AudioPlayer] Skipping sync - too soon since last sync");
            return;
        }
        
        // Prevent concurrent syncs
        if (isSyncingRef.current) {
            console.log("[AudioPlayer] Skipping sync - already syncing");
            return;
        }
        
        // Only sync if we have accumulated timestamps
        if (accumulatedTimestamps.current.length === 0) {
            console.log("[AudioPlayer] Skipping sync - no timestamps to sync");
            return;
        }
        
        isSyncingRef.current = true;
        lastSyncTimeRef.current = now;
        
        try {
            await syncAudioTrackingData();
        } finally {
            isSyncingRef.current = false;
        }
    }, [syncAudioTrackingData]);

    // Initialize Interval Sync (every 15 seconds)
    useEffect(() => {
        syncIntervalRef.current = setInterval(() => {
            if (isPlaying) {
                debouncedSync();
            }
        }, 15000);
        
        return () => {
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [debouncedSync, isPlaying]);

    // Sync on unmount (but don't block)
    useEffect(() => {
        return () => {
            // Fire and forget - don't await
            if (accumulatedTimestamps.current.length > 0) {
                syncAudioTrackingData().catch(console.error);
            }
        };
    }, []); // Empty deps - only on unmount

    // Save current segment to accumulated timestamps
    const saveCurrentSegment = useCallback((endTime: number) => {
        if (!activeItem) return;
        
        const start = currentSegmentStart.current * 1000;
        const end = endTime * 1000;
        
        // Only save if we have meaningful progress (at least 500ms)
        if (end - start < 500) return;
        
        const newTimestamp = {
            id: uuidv4(),
            start: start,
            end: end,
            speed: playbackRate
        };
        
        accumulatedTimestamps.current.push(newTimestamp);
        
        // Update store with accumulated timestamps
        addActivity({
            id: activeItem.id,
            activity_id: activityId.current,
            source: "AUDIO",
            source_id: audioSlide.published_audio_file_id,
            start_time: Date.now(),
            end_time: Date.now(),
            percentage_watched: (end / (audioSlide.published_audio_length_in_millis || (duration * 1000))) * 100,
            timestamps: accumulatedTimestamps.current,
            sync_status: 'STALE',
            new_activity: accumulatedTimestamps.current.length === 1, // First segment = new activity
            current_start_time_in_epoch: Date.now()
        }, true);
        
        // Move start pointer for next segment
        currentSegmentStart.current = endTime;
    }, [activeItem, audioSlide, duration, playbackRate, addActivity]);

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const now = audioRef.current.currentTime;
        setCurrentTime(now);
        setDuration(audioRef.current.duration || 0);
        // NOTE: We do NOT call updateTracking here anymore
        // Tracking happens only on: pause, seek, speed change, end
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        
        if (isPlaying) {
            // Pausing - save current segment and sync
            saveCurrentSegment(audioRef.current.currentTime);
            audioRef.current.pause();
            debouncedSync();
        } else {
            // Starting playback - set segment start
            currentSegmentStart.current = audioRef.current.currentTime;
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (time: number) => {
        if (!audioRef.current) return;
        
        // If playing, save current segment before seeking
        if (isPlaying && audioRef.current.currentTime !== time) {
            saveCurrentSegment(audioRef.current.currentTime);
        }
        
        audioRef.current.currentTime = time;
        setCurrentTime(time);
        
        // Reset segment start to new position
        currentSegmentStart.current = time;
    };

    const changeSpeed = (speed: number) => {
        if (!audioRef.current) return;
        
        // Save current segment with old speed
        if (isPlaying) {
            saveCurrentSegment(audioRef.current.currentTime);
        }
        
        audioRef.current.playbackRate = speed;
        setPlaybackRate(speed);
        
        // Reset segment start for new speed
        currentSegmentStart.current = audioRef.current.currentTime;
    };

    const handleAudioEnded = () => {
        if (audioRef.current) {
            saveCurrentSegment(audioRef.current.currentTime);
        }
        setIsPlaying(false);
        debouncedSync();
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full bg-neutral-50 rounded-xl">
                <Spinner className="animate-spin text-primary-500 mb-4" size={32} />
                <p className="text-neutral-500 font-medium">Loading Audio...</p>
            </div>
        );
    }

    if (error || !audioUrl) {
        return (
            <div className="flex flex-col items-center justify-center p-12 h-full bg-neutral-50 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4">
                    <SpeakerX size={24} />
                </div>
                <p className="text-red-500 font-medium">{error || "Audio source unavailable"}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto p-4 sm:p-6">
            {/* Main Player Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                    {/* Cover Art Area */}
                    <div className="w-full md:w-64 h-64 md:h-auto bg-neutral-100 flex-shrink-0 relative">
                        {imageUrl ? (
                            <img 
                                src={imageUrl} 
                                alt="Audio Cover" 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
                                <SpeakerHigh size={64} weight="duotone" />
                            </div>
                        )}
                        {/* Overlay Gradient on Mobile */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent md:hidden" />
                    </div>

                    {/* Controls Area */}
                    <div className="flex-1 p-6 flex flex-col justify-center">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-neutral-900 line-clamp-2">
                                {activeItem?.title || "Audio Track"}
                            </h2>
                            <p className="text-sm text-neutral-500 mt-1 line-clamp-1">
                                {activeItem?.description || "Listen to this audio lesson"}
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4 group">
                            <Slider.Root
                                className="relative flex items-center select-none touch-none w-full h-5"
                                value={[currentTime]}
                                max={duration}
                                step={1}
                                onValueChange={(val) => handleSeek(val[0])}
                            >
                                <Slider.Track className="bg-neutral-200 relative grow rounded-full h-1.5 overflow-hidden group-hover:h-2 transition-all">
                                    <Slider.Range className="absolute bg-primary-500 rounded-full h-full" />
                                </Slider.Track>
                                <Slider.Thumb 
                                    className="block w-4 h-4 bg-white border border-neutral-300 shadow-md rounded-full hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-transform" 
                                    aria-label="Seek"
                                />
                            </Slider.Root>
                            <div className="flex justify-between mt-1 text-xs font-medium text-neutral-400">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Playback Controls */}
                        <div className="flex items-center justify-between gap-4">
                             {/* Speed Control */}
                             <div className="flex items-center gap-2">
                                <select 
                                    value={playbackRate} 
                                    onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                                    className="bg-neutral-50 border border-neutral-200 text-neutral-700 text-xs font-semibold rounded px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                >
                                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                                        <option key={rate} value={rate}>{rate}x</option>
                                    ))}
                                </select>
                            </div>

                            {/* Main Buttons */}
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => handleSeek(Math.max(0, currentTime - 10))}
                                    className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                                    aria-label="Rewind 10s"
                                >
                                    <Rewind size={24} weight="fill" />
                                </button>
                                
                                <button 
                                    onClick={togglePlay}
                                    className="w-14 h-14 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-700 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                                    aria-label={isPlaying ? "Pause" : "Play"}
                                >
                                    {isPlaying ? (
                                        <Pause size={28} weight="fill" />
                                    ) : (
                                        <Play size={28} weight="fill" className="ml-1" />
                                    )}
                                </button>
                                
                                <button 
                                    onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
                                    className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                                    aria-label="Forward 10s"
                                >
                                    <FastForward size={24} weight="fill" />
                                </button>
                            </div>

                            {/* Volume Control */}
                            <div className="flex items-center gap-2 w-24">
                                <button 
                                    onClick={() => {
                                        const newVol = volume === 0 ? 1 : 0;
                                        setVolume(newVol);
                                        if (audioRef.current) audioRef.current.volume = newVol;
                                    }}
                                    className="text-neutral-400 hover:text-neutral-600"
                                >
                                    {volume === 0 ? <SpeakerX size={20} /> : <SpeakerHigh size={20} />}
                                </button>
                                <Slider.Root
                                    className="relative flex items-center select-none touch-none w-full h-5"
                                    value={[volume]}
                                    max={1}
                                    step={0.1}
                                    onValueChange={(val) => {
                                        setVolume(val[0]);
                                        if (audioRef.current) audioRef.current.volume = val[0];
                                    }}
                                >
                                    <Slider.Track className="bg-neutral-200 relative grow rounded-full h-1 overflow-hidden">
                                        <Slider.Range className="absolute bg-neutral-400 rounded-full h-full" />
                                    </Slider.Track>
                                    <Slider.Thumb className="block w-3 h-3 bg-white border border-neutral-300 shadow-sm rounded-full hover:scale-110 focus:outline-none" />
                                </Slider.Root>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audio Element */}
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleAudioEnded}
                    onError={(e) => {
                         console.error("Audio error", e); 
                         setError("Playback error");
                    }}
                />
            </div>

            {/* Transcript Section */}
            {audioSlide.transcript && (
                <div className="mt-6 bg-white rounded-xl border border-neutral-200 overflow-hidden">
                    <button 
                        onClick={() => setShowTranscript(!showTranscript)}
                        className="w-full px-6 py-4 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors"
                    >
                        <div className="flex items-center gap-2 font-semibold text-neutral-700">
                            <FileText size={20} className="text-primary-500" />
                            <span>Transcript</span>
                        </div>
                        <span className="text-xs font-medium text-neutral-400 uppercase">
                            {showTranscript ? "Hide" : "Show"}
                        </span>
                    </button>
                    
                    {showTranscript && (
                         <div className="p-6 text-neutral-600 leading-relaxed text-sm h-64 overflow-y-auto custom-scrollbar border-t border-neutral-100">
                             {audioSlide.transcript.split('\n').map((para, i) => (
                                 <p key={i} className="mb-3 last:mb-0">{para}</p>
                             ))}
                         </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AudioPlayer;
