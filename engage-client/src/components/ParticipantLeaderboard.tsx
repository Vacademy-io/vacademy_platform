// src/components/ParticipantLeaderboard.tsx
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trophy, Medal, Crown } from 'lucide-react';

const BASE_URL = 'https://backend-stage.vacademy.io';

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

interface ParticipantLeaderboardProps {
  sessionId: string;
  username: string;
  sessionTitle: string;
}

const formatTime = (millis: number): string => {
  if (millis < 1000) return `${millis}ms`;
  const secs = millis / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = (secs % 60).toFixed(0);
  return `${mins}m ${remainingSecs}s`;
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400 drop-shadow-lg" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-white/50">#{rank}</span>;
};

export const ParticipantLeaderboard: React.FC<ParticipantLeaderboardProps> = ({
  sessionId,
  username,
  sessionTitle,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [sessionId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BASE_URL}/community-service/engage/learner/${sessionId}/leaderboard`
      );
      if (!response.ok) throw new Error('Failed to load leaderboard');
      const data = await response.json();
      setLeaderboard(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const myEntry = leaderboard.find(e => e.username === username);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
        <p className="text-white/70 text-sm">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchLeaderboard}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        </div>
        <p className="text-white/60 text-sm">{sessionTitle}</p>
      </div>

      {/* Your Rank Highlight */}
      {myEntry && (
        <Card className="glassmorphism-container relative overflow-hidden border-orange-400/30">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-900/40 to-amber-900/30 rounded-2xl pointer-events-none" />
          <CardContent className="p-4 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-400/20 border border-orange-300/30">
                  {getRankIcon(myEntry.rank)}
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Your Rank: #{myEntry.rank}</p>
                  <p className="text-white/60 text-sm">out of {leaderboard.length} participants</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-400">{myEntry.total_score}</p>
                <p className="text-white/50 text-xs">points</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-green-400 font-bold">{myEntry.correct_count}</p>
                <p className="text-white/40 text-xs">Correct</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-red-400 font-bold">{myEntry.wrong_count}</p>
                <p className="text-white/40 text-xs">Wrong</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-white/60 font-bold">{myEntry.unanswered_count}</p>
                <p className="text-white/40 text-xs">Skipped</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-blue-400 font-bold">{formatTime(myEntry.total_time_millis)}</p>
                <p className="text-white/40 text-xs">Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Leaderboard */}
      <div className="space-y-1.5">
        {/* Top 3 podium */}
        {leaderboard.slice(0, 3).map((entry) => (
          <div
            key={entry.username}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
              entry.username === username
                ? 'bg-orange-500/20 border border-orange-400/40 ring-1 ring-orange-400/20'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-center w-8 h-8">
              {getRankIcon(entry.rank)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${entry.username === username ? 'text-orange-300' : 'text-white'}`}>
                {entry.username}
                {entry.username === username && <span className="text-xs ml-1 text-orange-400">(You)</span>}
              </p>
              <p className="text-xs text-white/40">
                {entry.correct_count}/{entry.total_mcq_questions} correct · {formatTime(entry.total_time_millis)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${entry.username === username ? 'text-orange-400' : 'text-white'}`}>
                {entry.total_score}
              </p>
              <p className="text-xs text-white/40">pts</p>
            </div>
          </div>
        ))}

        {/* Separator */}
        {leaderboard.length > 3 && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/30">Other participants</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        )}

        {/* Rest of leaderboard */}
        {leaderboard.slice(3).map((entry) => (
          <div
            key={entry.username}
            className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-300 ${
              entry.username === username
                ? 'bg-orange-500/20 border border-orange-400/40'
                : 'bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-center w-8 h-8">
              <span className="text-xs font-bold text-white/40">#{entry.rank}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${entry.username === username ? 'text-orange-300 font-semibold' : 'text-white/80'}`}>
                {entry.username}
                {entry.username === username && <span className="text-xs ml-1 text-orange-400">(You)</span>}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${entry.username === username ? 'text-orange-400' : 'text-white/60'}`}>
                {entry.total_score} pts
              </p>
            </div>
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/50">No results available.</p>
        </div>
      )}
    </div>
  );
};
