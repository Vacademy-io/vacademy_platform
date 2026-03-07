import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart, Trophy, Loader2, PieChart, Cloud, Activity, Users } from 'lucide-react';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LeaderboardModal } from './LeaderboardModal';
import { ResponseDistributionModal } from './ResponseDistributionModal';
import type { QuizSlideData } from '../utils/types';
import { WordCloudModal } from './WordCloudModal';

const RESPONSES_API_URL_BASE = `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/community-service/engage/admin/`;

interface ResponseData {
    username: string;
    time_to_response_millis: number;
    submitted_at: number;
    response_data: {
        type: string;
        selected_option_ids: string[];
        text_answer: string | null;
    };
    is_correct: boolean | null;
}

interface ResponseOverlayProps {
    sessionId: string;
    slideData: QuizSlideData;
    slideStartTimestamp: number | null;
    defaultSecondsForQuestion: number;
    addedQuestion?: any; // added_question from session API — has real DB option UUIDs
}

// Countdown Timer Component for Admin
const CountdownTimer: React.FC<{ secondsRemaining: number; totalSeconds: number; isExpired: boolean }> = ({
    secondsRemaining,
    totalSeconds,
    isExpired,
  }) => {
    const percentage = totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;
    const circumference = 2 * Math.PI * 18; // radius = 18
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const getColor = () => {
      if (isExpired) return 'text-red-500';
      if (secondsRemaining <= 5) return 'text-red-400';
      if (secondsRemaining <= 15) return 'text-amber-400';
      return 'text-emerald-400';
    };

    const getStrokeColor = () => {
      if (isExpired) return '#ef4444';
      if (secondsRemaining <= 5) return '#f87171';
      if (secondsRemaining <= 15) return '#fbbf24';
      return '#34d399';
    };

    return (
      <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl px-3 py-1.5 shadow-lg">
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke={getStrokeColor()}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getColor()}`}>
            {isExpired ? '0' : secondsRemaining}
          </div>
        </div>
        {isExpired ? (
          <span className="text-red-400 text-xs font-semibold animate-pulse">Time's up!</span>
        ) : (
          <span className={`text-xs font-medium ${getColor()}`}>
            Seconds
          </span>
        )}
      </div>
    );
  };

export const ResponseOverlay: React.FC<ResponseOverlayProps> = ({ sessionId, slideData, slideStartTimestamp, defaultSecondsForQuestion, addedQuestion }) => {
    const [responses, setResponses] = useState<ResponseData[]>([]);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [isDistributionOpen, setIsDistributionOpen] = useState(false);
    const [isWordCloudOpen, setIsWordCloudOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Timer state
    const [secondsRemaining, setSecondsRemaining] = useState(defaultSecondsForQuestion);
    const [isTimerExpired, setIsTimerExpired] = useState(false);

    useEffect(() => {
        if (defaultSecondsForQuestion > 0) {
            const startTs = slideStartTimestamp || Date.now();
            const timer = setInterval(() => {
                const elapsedMs = Date.now() - startTs;
                const elapsedSecs = Math.floor(elapsedMs / 1000);
                const remaining = Math.max(0, defaultSecondsForQuestion - elapsedSecs);

                setSecondsRemaining(remaining);
                if (remaining <= 0) {
                    setIsTimerExpired(true);
                    clearInterval(timer);
                } else {
                    setIsTimerExpired(false);
                }
            }, 1000);
            return () => clearInterval(timer);
        } else {
            setIsTimerExpired(false);
            setSecondsRemaining(0);
            return undefined;
        }
    }, [slideStartTimestamp, defaultSecondsForQuestion]);

    const isMcqQuestion = useMemo(() => {
        return (
            slideData?.elements?.singleChoiceOptions &&
            slideData.elements.singleChoiceOptions.length > 0
        );
    }, [slideData]);

    useEffect(() => {
        // Reset state for the new slide so stale data from the previous slide is cleared
        setIsLoading(true);
        setResponses([]);

        // Function to fetch responses
        const fetchResponses = async () => {
            if (!sessionId || !slideData.id) return;
            try {
                const response = await authenticatedAxiosInstance.get(
                    `${RESPONSES_API_URL_BASE}${sessionId}/slide/${slideData.id}/responses`
                );
                if (Array.isArray(response.data)) {
                    setResponses(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch slide responses:', error);
                // Don't show toast on interval, it would be annoying.
                // toast.error("Could not fetch latest responses.");
            } finally {
                setIsLoading(false);
            }
        };

        // Fetch immediately on mount, then set up polling
        fetchResponses();

        // Clear any existing interval before setting a new one
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(fetchResponses, 5000); // Poll every 5 seconds

        // Cleanup function
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [sessionId, slideData.id]);

    return (
        <>
            <div className="absolute bottom-20 left-1/2 z-[1005] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 ease-in-out pointer-events-auto">
                {/* Enhanced background effects */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-slate-900/20 via-transparent to-slate-900/20" />

                {/* Countdown Timer Display */}
                {defaultSecondsForQuestion > 0 && (
                    <div className="relative flex items-center pr-3 border-r border-white/20">
                        <CountdownTimer
                            secondsRemaining={secondsRemaining}
                            totalSeconds={defaultSecondsForQuestion}
                            isExpired={isTimerExpired}
                        />
                    </div>
                )}

                {/* Response counter section */}
                <div className="relative flex items-center gap-3 border-r border-white/20 pr-4 pl-1">
                    <div className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 p-2 shadow-lg">
                        <Activity size={20} className="text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-white/60">Live Responses</span>
                        <div className="flex items-center gap-2">
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin text-blue-400" />
                            ) : (
                                <span className="text-xl font-bold text-white">
                                    {responses.length}
                                </span>
                            )}
                            <Users size={16} className="text-white/60" />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="relative flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-xl border-orange-400/50 bg-orange-500/10 px-4 font-semibold text-orange-300 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 hover:border-orange-400 hover:bg-orange-500/20 hover:text-orange-200"
                        onClick={() => setIsLeaderboardOpen(true)}
                    >
                        <Trophy size={16} className="mr-2" />
                        <span className="hidden sm:inline">Leaderboard</span>
                    </Button>

                    {isMcqQuestion ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl border-blue-400/50 bg-blue-500/10 px-4 font-semibold text-blue-300 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 hover:border-blue-400 hover:bg-blue-500/20 hover:text-blue-200"
                            onClick={() => setIsDistributionOpen(true)}
                        >
                            <PieChart size={16} className="mr-2" />
                            <span className="hidden sm:inline">Distribution</span>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl border-teal-400/50 bg-teal-500/10 px-4 font-semibold text-teal-300 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 hover:border-teal-400 hover:bg-teal-500/20 hover:text-teal-200"
                            onClick={() => setIsWordCloudOpen(true)}
                        >
                            <Cloud size={16} className="mr-2" />
                            <span className="hidden sm:inline">Word Cloud</span>
                        </Button>
                    )}
                </div>
            </div>
            <LeaderboardModal
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
                responses={responses}
                slideData={slideData}
                isMcq={isMcqQuestion}
                addedQuestion={addedQuestion}
            />
            {isMcqQuestion ? (
                <ResponseDistributionModal
                    isOpen={isDistributionOpen}
                    onClose={() => setIsDistributionOpen(false)}
                    responses={responses}
                    slideData={slideData}
                    addedQuestion={addedQuestion}
                />
            ) : (
                <WordCloudModal
                    isOpen={isWordCloudOpen}
                    onClose={() => setIsWordCloudOpen(false)}
                    responses={responses}
                />
            )}
        </>
    );
};
