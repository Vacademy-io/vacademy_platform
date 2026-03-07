import React, { useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Trophy,
    CheckCircle,
    XCircle,
    Clock,
    Medal,
    User,
    MessageSquare,
    MinusCircle,
    Crown,
    Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizSlideData } from '../utils/types';

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

interface LeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    responses: ResponseData[];
    slideData: QuizSlideData;
    isMcq: boolean;
    addedQuestion?: any; // added_question from session API — has real DB option UUIDs
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
    isOpen,
    onClose,
    responses,
    slideData,
    isMcq,
    addedQuestion,
}) => {
    useEffect(() => {
        if (isOpen) {
            console.log(
                '[Leaderboard] Modal opened. Received slideData with options:',
                JSON.stringify(slideData?.elements?.singleChoiceOptions, null, 2)
            );
            console.log(
                '[Leaderboard] Modal opened. Received responses:',
                JSON.stringify(responses, null, 2)
            );
        }
    }, [isOpen, slideData, responses]);

    const sortedResponses = useMemo(() => {
        if (!responses) return [];

        const getCorrectnessScore = (isCorrect: boolean | null) => {
            if (isCorrect === true) return 2;
            if (isCorrect === null) return 1;
            return 0; // false
        };

        return [...responses].sort((a, b) => {
            const scoreA = getCorrectnessScore(a.is_correct);
            const scoreB = getCorrectnessScore(b.is_correct);

            if (scoreA !== scoreB) {
                return scoreB - scoreA; // Sort descending by score (true > null > false)
            }

            // If scores are the same, sort by time (faster on top)
            return a.time_to_response_millis - b.time_to_response_millis;
        });
    }, [responses]);

    const formatTime = (millis: number) => {
        return `${(millis / 1000).toFixed(2)}s`;
    };

    const getRankIcon = (rank: number) => {
        if (rank === 0) return <Crown className="text-yellow-500" size={20} />;
        if (rank === 1) return <Medal className="text-gray-400" size={20} />;
        if (rank === 2) return <Medal className="text-amber-700" size={20} />;
        return (
            <div className="flex size-6 items-center justify-center rounded-full bg-slate-200">
                <span className="text-xs font-bold text-slate-600">{rank + 1}</span>
            </div>
        );
    };

    const getResponseText = (response: ResponseData) => {
        if (!isMcq) {
            return (
                <span className="font-normal text-slate-800">
                    {response.response_data?.text_answer || (
                        <span className="italic text-slate-500">No answer submitted</span>
                    )}
                </span>
            );
        }

        const selectedId = response.response_data?.selected_option_ids?.[0];

        if (!selectedId) {
            return <span className="italic text-slate-500">No answer submitted</span>;
        }

        // Prefer addedQuestion.options (real DB UUIDs from session API) for matching.
        // Fall back to slideData.elements.singleChoiceOptions (may have local temp IDs).
        const dbOptions: Array<{ id: string; text?: { content?: string } }> =
            addedQuestion?.options || [];
        const slideOptions: Array<{ id: string; name: string }> =
            slideData?.elements?.singleChoiceOptions || [];

        // Try exact UUID match against DB options first
        const dbOptionIndex = dbOptions.findIndex((opt) => opt.id === selectedId);
        if (dbOptionIndex >= 0) {
            const dbOpt = dbOptions[dbOptionIndex];
            // Use the corresponding slide option for display text (preserves HTML), else DB text
            const displayName =
                slideOptions[dbOptionIndex]?.name ||
                dbOpt?.text?.content ||
                selectedId;
            const optionLetter = String.fromCharCode(65 + dbOptionIndex);
            return (
                <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-xs font-bold text-white shadow-sm">
                        {optionLetter}
                    </div>
                    <div
                        className="prose prose-sm max-w-none flex-1"
                        dangerouslySetInnerHTML={{ __html: displayName }}
                    />
                </div>
            );
        }

        // Fall back to exact match against slideOptions (works when IDs already match)
        const slideOptionIndex = slideOptions.findIndex((opt) => opt.id === selectedId);
        if (slideOptionIndex >= 0) {
            const optionLetter = String.fromCharCode(65 + slideOptionIndex);
            return (
                <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-xs font-bold text-white shadow-sm">
                        {optionLetter}
                    </div>
                    <div
                        className="prose prose-sm max-w-none flex-1"
                        dangerouslySetInnerHTML={{ __html: slideOptions[slideOptionIndex]?.name || '' }}
                    />
                </div>
            );
        }

        return (
            <div className="text-sm italic text-red-500">
                Option not found (ID: {selectedId.substring(0, 8)}...)
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-3xl overflow-hidden rounded-2xl border-white/20 bg-white/95 p-0 shadow-2xl backdrop-blur-xl sm:w-full">
                {/* Enhanced background effects */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-50/50 via-white to-yellow-50/50" />
                <div className="absolute right-1/4 top-0 size-48 rounded-full bg-orange-500/5 blur-3xl" />
                <div className="absolute bottom-0 left-1/4 size-48 rounded-full bg-yellow-500/5 blur-3xl" />

                <DialogHeader className="relative z-10 border-b border-slate-200/50 bg-white/80 p-6 pb-4 backdrop-blur-sm">
                    <DialogTitle className="flex items-center text-2xl font-bold text-slate-800 lg:text-3xl">
                        <div className="mr-3 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 p-2 shadow-lg">
                            <Trophy className="text-white" size={24} />
                        </div>
                        <span className="bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                            Live Leaderboard
                        </span>
                    </DialogTitle>
                    <DialogDescription className="mt-2 text-slate-600">
                        Responses sorted by correctness and speed.
                        <span className="ml-2 inline-flex items-center gap-1 rounded-lg border border-orange-200/50 bg-orange-100/80 px-2 py-1 backdrop-blur-sm">
                            <Target size={14} className="text-orange-600" />
                            <span className="font-semibold text-orange-700">
                                {responses.length}
                            </span>
                            <span className="text-orange-600">participants</span>
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="relative z-10 max-h-[60vh]">
                    <div className="space-y-3 p-6">
                        {sortedResponses.length > 0 ? (
                            sortedResponses.map((res, index) => (
                                <div
                                    key={res.username + res.submitted_at}
                                    className={cn(
                                        'group relative flex flex-col rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.01] hover:shadow-lg',
                                        res.is_correct === true
                                            ? 'border-green-200/50 bg-green-50/80 hover:border-green-300/50'
                                            : res.is_correct === false
                                              ? 'border-red-200/50 bg-red-50/80 hover:border-red-300/50'
                                              : 'border-slate-200/50 bg-slate-50/80 hover:border-slate-300/50'
                                    )}
                                >
                                    {/* Subtle gradient overlay */}
                                    <div
                                        className={cn(
                                            'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                                            res.is_correct === true
                                                ? 'bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5'
                                                : res.is_correct === false
                                                  ? 'bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5'
                                                  : 'bg-gradient-to-r from-slate-500/5 via-transparent to-slate-500/5'
                                        )}
                                    />

                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex w-8 items-center justify-center">
                                                {getRankIcon(index)}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-lg border border-slate-200/50 bg-slate-100/80 p-2 backdrop-blur-sm">
                                                    <User className="text-slate-500" size={16} />
                                                </div>
                                                <span className="font-semibold text-slate-700 transition-colors duration-200 group-hover:text-slate-800">
                                                    {res.username}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 sm:gap-6">
                                            <div
                                                className={cn(
                                                    'rounded-lg border p-2 backdrop-blur-sm',
                                                    res.is_correct === true
                                                        ? 'border-green-200/50 bg-green-100/80'
                                                        : res.is_correct === false
                                                          ? 'border-red-200/50 bg-red-100/80'
                                                          : 'border-slate-200/50 bg-slate-100/80'
                                                )}
                                            >
                                                {res.is_correct === true ? (
                                                    <CheckCircle
                                                        className="text-green-600"
                                                        size={18}
                                                    />
                                                ) : res.is_correct === false ? (
                                                    <XCircle className="text-red-600" size={18} />
                                                ) : (
                                                    <MinusCircle
                                                        className="text-slate-600"
                                                        size={18}
                                                    />
                                                )}
                                            </div>
                                            <div
                                                className="flex items-center gap-2 rounded-lg border border-slate-200/50 bg-slate-100/80 px-3 py-2 backdrop-blur-sm"
                                                title="Response Time"
                                            >
                                                <Clock className="text-slate-500" size={16} />
                                                <span className="font-mono text-sm font-semibold text-slate-700">
                                                    {formatTime(res.time_to_response_millis)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative mt-3 border-t border-dashed border-slate-300/60 pl-12 pt-3">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-lg border border-slate-200/50 bg-slate-100/80 p-1.5 backdrop-blur-sm">
                                                <MessageSquare
                                                    size={14}
                                                    className="text-slate-500"
                                                />
                                            </div>
                                            <div className="flex-1 text-sm text-slate-800">
                                                {getResponseText(res)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-16 text-center">
                                <div className="mb-6">
                                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-r from-slate-300 to-slate-400 shadow-lg">
                                        <Trophy className="text-white" size={32} />
                                    </div>
                                </div>
                                <p className="mb-2 text-lg font-medium text-slate-500">
                                    No responses yet
                                </p>
                                <p className="text-sm text-slate-400">
                                    The leaderboard will update as participants submit their
                                    answers.
                                </p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="relative z-10 rounded-b-2xl border-t border-slate-200/50 bg-white/80 p-4 backdrop-blur-sm">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="rounded-xl border-slate-300 bg-white/80 font-semibold text-slate-700 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-orange-400 hover:bg-white hover:text-orange-700"
                    >
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
