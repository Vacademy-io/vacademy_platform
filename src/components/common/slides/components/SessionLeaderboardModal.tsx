// components/SessionLeaderboardModal.tsx
/* eslint-disable */
// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, Trophy, Download, Medal } from 'lucide-react';
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

interface SessionLeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
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

export const SessionLeaderboardModal: React.FC<SessionLeaderboardModalProps> = ({
    isOpen,
    onClose,
    sessionId,
}) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && sessionId) {
            fetchLeaderboard();
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

    const downloadCsv = async () => {
        try {
            const response = await authenticatedAxiosInstance.get(
                `${BACKEND_URL}/community-service/engage/admin/${sessionId}/leaderboard/csv`,
                { responseType: 'blob' }
            );
            const url = URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `leaderboard_${sessionId}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('CSV downloaded!');
        } catch (err) {
            toast.error('Failed to download CSV');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                        <Trophy className="size-6 text-amber-500" />
                        Session Leaderboard
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadCsv}
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

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
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
                            {/* Table Header */}
                            <div className="grid grid-cols-[50px_1fr_80px_80px_80px_80px_90px] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <span>Rank</span>
                                <span>Participant</span>
                                <span className="text-center">Score</span>
                                <span className="text-center">✓</span>
                                <span className="text-center">✗</span>
                                <span className="text-center">-</span>
                                <span className="text-right">Time</span>
                            </div>

                            {/* Rows */}
                            {leaderboard.map((entry, idx) => (
                                <div
                                    key={entry.username}
                                    className={`grid grid-cols-[50px_1fr_80px_80px_80px_80px_90px] gap-2 items-center rounded-lg px-3 py-2.5 transition-colors ${
                                        entry.rank <= 3
                                            ? 'bg-amber-50 border border-amber-200'
                                            : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center justify-center">
                                        {getRankBadge(entry.rank)}
                                    </div>
                                    <span className="text-sm font-medium text-slate-800 truncate" title={entry.username}>
                                        {entry.username}
                                    </span>
                                    <span className="text-center text-sm font-bold text-slate-800">
                                        {entry.total_score}
                                    </span>
                                    <span className="text-center text-sm text-green-600 font-medium">
                                        {entry.correct_count}
                                    </span>
                                    <span className="text-center text-sm text-red-500 font-medium">
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
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-6 py-3 flex justify-between items-center">
                    <p className="text-xs text-slate-400">
                        {leaderboard.length > 0 && `${leaderboard.length} participants · ${leaderboard[0]?.total_mcq_questions || 0} MCQ questions`}
                    </p>
                    <Button onClick={onClose} variant="outline" size="sm">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};
