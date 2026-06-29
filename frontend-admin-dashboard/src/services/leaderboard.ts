import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { BASE_URL } from '@/constants/urls';

const BASE = `${BASE_URL}/admin-core-service/leaderboard/v1`;

export interface LeaderboardEntry {
    rank: number | null;
    userId: string | null;
    name: string;
    points: number;
    badgeCount: number;
    currentUser: boolean;
}

export interface LeaderboardData {
    totalLearners: number;
    entries: LeaderboardEntry[];
    currentUser: LeaderboardEntry | null;
}

export interface BadgeStat {
    badgeId: string;
    badgeName: string;
    badgeIcon: string;
    count: number;
}

export interface BadgeStatsData {
    totalAwarded: number;
    learnersWithBadge: number;
    badges: BadgeStat[];
}

/** Admin course/batch leaderboard (real names + badge counts), ranked by activity. */
export async function getCourseLeaderboardAdmin(packageSessionId: string): Promise<LeaderboardData> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance.get<LeaderboardData>(`${BASE}/course/admin`, {
        params: { packageSessionId, instituteId },
    });
    return data;
}

/** Institute-wide badge award stats for the admin badges overview. */
export async function getBadgeStats(): Promise<BadgeStatsData> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance.get<BadgeStatsData>(`${BASE}/badge-stats`, {
        params: { instituteId },
    });
    return data;
}
