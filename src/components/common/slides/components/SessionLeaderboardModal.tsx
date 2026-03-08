// components/SessionLeaderboardModal.tsx
/* eslint-disable */
// @ts-nocheck
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, Trophy, Download, Medal, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { toast } from 'sonner';

interface LeaderboardEntry {
    rank: number;
    username: string;
    total_score: number;
    total_time_millis: number;
    correct_count: number;
    wrong_count: number;
    unanswered_count: number;
    total_mcq_questions: number;
}

interface SlideResponse {
    username: string;
    time_to_response_millis: number;
    response_data: {
        type: string;
        selected_option_ids: string[];
        text_answer: string | null;
    };
    is_correct: boolean | null;
}

interface SessionLeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    slides?: any[]; // slides from the store (have .type and .id)
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';

const formatTime = (millis: number): string => {
    if (millis < 1000) return `${millis}ms`;
    const secs = millis / 1000;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(0);
    return `${mins}m ${remainingSecs}s`;
};

const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="size-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="size-5 text-gray-400" />;
    if (rank === 3) return <Medal className="size-5 text-amber-700" />;
    return <span className="text-sm font-bold text-slate-500">#{rank}</span>;
};

const escapeCsvCell = (value: string | number): string => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export const SessionLeaderboardModal: React.FC<SessionLeaderboardModalProps> = ({
    isOpen,
    onClose,
    sessionId,
    slides = [],
}) => {
    const PAGE_SIZE = 20;

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'scores' | 'feedback'>('scores');
    const [currentPage, setCurrentPage] = useState(1);

    // { [slideId]: SlideResponse[] }
    const [feedbackResponses, setFeedbackResponses] = useState<Record<string, SlideResponse[]>>({});
    const [loadingFeedback, setLoadingFeedback] = useState(false);

    const feedbackSlides = useMemo(
        () => slides.filter((s) => s.type === 'feedback'),
        [slides]
    );

    const totalPages = Math.max(1, Math.ceil(leaderboard.length / PAGE_SIZE));
    const paginatedLeaderboard = leaderboard.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );

    useEffect(() => {
        if (isOpen && sessionId) {
            setCurrentPage(1);
            fetchLeaderboard();
            if (feedbackSlides.length > 0) {
                fetchFeedbackResponses();
            }
        }
    }, [isOpen, sessionId]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await authenticatedAxiosInstance.get(
                `${BACKEND_URL}/community-service/engage/admin/${sessionId}/leaderboard`
            );
            setLeaderboard(response.data || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load leaderboard');
            toast.error('Failed to load leaderboard');
        } finally {
            setLoading(false);
        }
    };

    const fetchFeedbackResponses = async () => {
        setLoadingFeedback(true);
        const results: Record<string, SlideResponse[]> = {};
        for (const slide of feedbackSlides) {
            try {
                const res = await authenticatedAxiosInstance.get(
                    `${BACKEND_URL}/community-service/engage/admin/${sessionId}/slide/${slide.id}/responses`
                );
                results[slide.id] = res.data || [];
            } catch {
                results[slide.id] = [];
            }
        }
        setFeedbackResponses(results);
        setLoadingFeedback(false);
    };

    const downloadCsv = () => {
        // Build header row
        const feedbackHeaders = feedbackSlides.map((_, i) => `Feedback Q${i + 1}`);
        const headers = [
            'Rank', 'Username', 'Score', 'Correct', 'Wrong', 'Unanswered', 'Time(ms)',
            ...feedbackHeaders,
        ];

        // Build username → { slideId → textAnswer } map from feedback responses
        const userFeedback: Record<string, Record<string, string>> = {};
        for (const slide of feedbackSlides) {
            for (const r of (feedbackResponses[slide.id] || [])) {
                if (!userFeedback[r.username]) userFeedback[r.username] = {};
                userFeedback[r.username][slide.id] = r.response_data?.text_answer || '';
            }
        }

        const rows = leaderboard.map((entry) => {
            const feedbackCols = feedbackSlides.map((s) =>
                escapeCsvCell(userFeedback[entry.username]?.[s.id] || '')
            );
            return [
                escapeCsvCell(entry.rank),
                escapeCsvCell(entry.username),
                escapeCsvCell(entry.total_score),
                escapeCsvCell(entry.correct_count),
                escapeCsvCell(entry.wrong_count),
                escapeCsvCell(entry.unanswered_count),
                escapeCsvCell(entry.total_time_millis),
                ...feedbackCols,
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `session_results_${sessionId}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('CSV downloaded!');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                        <Trophy className="size-6 text-amber-500" />
                        Session Results
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadCsv}
                            disabled={loading || leaderboard.length === 0}
                            className="flex items-center gap-1.5 text-sm"
                        >
                            <Download className="size-4" />
                            CSV
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="rounded-full text-slate-500 hover:bg-slate-100"
                        >
                            <X className="size-5" />
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6">
                    <button
                        onClick={() => setActiveTab('scores')}
                        className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'scores'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Trophy className="mr-1.5 inline size-4" />
                        Scores
                    </button>
                    {feedbackSlides.length > 0 && (
                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'feedback'
                                    ? 'border-orange-500 text-orange-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <MessageSquare className="mr-1.5 inline size-4" />
                            Feedback
                            {feedbackSlides.length > 1 && (
                                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                    {feedbackSlides.length}
                                </span>
                            )}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {activeTab === 'scores' && (
                        <>
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="size-8 animate-spin text-orange-500" />
                                    <p className="mt-3 text-sm text-slate-500">Loading leaderboard...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-sm text-red-500">{error}</p>
                                    <Button onClick={fetchLeaderboard} variant="outline" size="sm" className="mt-3">
                                        Retry
                                    </Button>
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-sm text-slate-500">No responses recorded yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="grid grid-cols-[50px_1fr_80px_80px_80px_80px_90px] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        <span>Rank</span>
                                        <span>Participant</span>
                                        <span className="text-center">Score</span>
                                        <span className="text-center">✓</span>
                                        <span className="text-center">✗</span>
                                        <span className="text-center">-</span>
                                        <span className="text-right">Time</span>
                                    </div>
                                    {paginatedLeaderboard.map((entry) => (
                                        <div
                                            key={entry.username}
                                            className={`grid grid-cols-[50px_1fr_80px_80px_80px_80px_90px] gap-2 items-center rounded-lg px-3 py-2.5 transition-colors ${
                                                entry.rank <= 3
                                                    ? 'border border-amber-200 bg-amber-50'
                                                    : 'border border-transparent hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center">
                                                {getRankBadge(entry.rank)}
                                            </div>
                                            <span className="truncate text-sm font-medium text-slate-800" title={entry.username}>
                                                {entry.username}
                                            </span>
                                            <span className="text-center text-sm font-bold text-slate-800">
                                                {entry.total_score}
                                            </span>
                                            <span className="text-center text-sm font-medium text-green-600">
                                                {entry.correct_count}
                                            </span>
                                            <span className="text-center text-sm font-medium text-red-500">
                                                {entry.wrong_count}
                                            </span>
                                            <span className="text-center text-sm text-slate-400">
                                                {entry.unanswered_count}
                                            </span>
                                            <span className="text-right text-xs text-slate-500">
                                                {formatTime(entry.total_time_millis)}
                                            </span>
                                        </div>
                                    ))}
                                    {/* Pagination controls */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="flex items-center gap-1 text-slate-500"
                                            >
                                                <ChevronLeft className="size-4" />
                                                Prev
                                            </Button>
                                            <span className="text-xs text-slate-500">
                                                Page {currentPage} of {totalPages}
                                                <span className="ml-1 text-slate-400">
                                                    ({leaderboard.length} total)
                                                </span>
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="flex items-center gap-1 text-slate-500"
                                            >
                                                Next
                                                <ChevronRight className="size-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'feedback' && (
                        <>
                            {loadingFeedback ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="size-8 animate-spin text-orange-500" />
                                    <p className="mt-3 text-sm text-slate-500">Loading feedback responses...</p>
                                </div>
                            ) : feedbackSlides.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <p className="text-sm text-slate-500">No feedback questions in this session.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {feedbackSlides.map((slide, qIdx) => {
                                        const responses = feedbackResponses[slide.id] || [];
                                        const answered = responses.filter(
                                            (r) => r.response_data?.text_answer?.trim()
                                        );
                                        return (
                                            <div key={slide.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-slate-700">
                                                        Feedback Q{qIdx + 1}
                                                        {slide.elements?.questionData?.question && (
                                                            <span className="ml-2 font-normal text-slate-500">
                                                                — <span
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: slide.elements.questionData.question,
                                                                    }}
                                                                />
                                                            </span>
                                                        )}
                                                    </h3>
                                                    <span className="text-xs text-slate-400">
                                                        {answered.length} / {responses.length} responded
                                                    </span>
                                                </div>
                                                {answered.length === 0 ? (
                                                    <p className="text-xs italic text-slate-400">No responses submitted.</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {answered.map((r, rIdx) => (
                                                            <div
                                                                key={`${r.username}-${rIdx}`}
                                                                className="flex items-start gap-3 rounded-md bg-white px-3 py-2 shadow-sm"
                                                            >
                                                                <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400">
                                                                    {r.username}
                                                                </span>
                                                                <p className="text-sm text-slate-700">
                                                                    {r.response_data.text_answer}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
                    <p className="text-xs text-slate-400">
                        {leaderboard.length > 0 &&
                            `${leaderboard.length} participants · ${leaderboard[0]?.total_mcq_questions || 0} MCQ questions`}
                        {feedbackSlides.length > 0 &&
                            ` · ${feedbackSlides.length} feedback question${feedbackSlides.length > 1 ? 's' : ''}`}
                    </p>
                    <Button onClick={onClose} variant="outline" size="sm">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};
