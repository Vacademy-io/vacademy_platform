import axios from "axios";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";

/**
 * Course/batch leaderboard for the learner. Ranks peers by learning activity
 * (engagement minutes) and shows each learner's badge count. The learner-facing
 * endpoint returns anonymized names (initials) with the caller's own row marked.
 */
export interface LeaderboardBadge {
  name: string;
  icon: string;
}

export interface LeaderboardEntry {
  rank: number | null;
  userId: string | null;
  name: string;
  points: number;
  badgeCount: number;
  badges: LeaderboardBadge[];
  currentUser: boolean;
}

export interface CourseLeaderboardData {
  totalLearners: number;
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  /** Course/batch name — present on the public shareable response. */
  courseName?: string | null;
}

/** The learner's own gamification summary for their profile. */
export interface LearnerSummary {
  totalBadges: number;
  bestRank: number | null;
  badges: LeaderboardBadge[];
}

export async function fetchCourseLeaderboard(
  packageSessionId: string
): Promise<CourseLeaderboardData | null> {
  try {
    const instituteId = await getInstituteId();
    if (!instituteId || !packageSessionId) return null;
    const { data } = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/leaderboard/v1/course/me`,
      { params: { packageSessionId, instituteId } }
    );
    return (data as CourseLeaderboardData) ?? null;
  } catch (error) {
    console.error("[course-leaderboard] fetch failed:", error);
    return null;
  }
}

/**
 * PUBLIC, no-auth course leaderboard for the shareable page. Uses plain axios
 * (no token) and returns fully-anonymized data + the course name.
 */
export async function fetchPublicCourseLeaderboard(
  packageSessionId: string,
  instituteId: string
): Promise<CourseLeaderboardData | null> {
  try {
    if (!packageSessionId || !instituteId) return null;
    const { data } = await axios.get(
      `${BASE_URL}/admin-core-service/public/leaderboard/v1/course/${packageSessionId}`,
      { params: { instituteId } }
    );
    return (data as CourseLeaderboardData) ?? null;
  } catch (error) {
    console.error("[public-leaderboard] fetch failed:", error);
    return null;
  }
}

/** The authenticated learner's own badges + best rank (for the profile). */
export async function fetchLearnerSummary(): Promise<LearnerSummary | null> {
  try {
    const instituteId = await getInstituteId();
    if (!instituteId) return null;
    const { data } = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/leaderboard/v1/my-summary`,
      { params: { instituteId } }
    );
    return (data as LearnerSummary) ?? null;
  } catch (error) {
    console.error("[learner-summary] fetch failed:", error);
    return null;
  }
}
