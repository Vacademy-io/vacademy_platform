import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";

/**
 * Server-side points (points_ledger). This is the authoritative figure.
 *
 * The older number in play-gamification.ts is computed in the browser from activity
 * logs and cached in localStorage, so it can never agree with a leaderboard or be
 * compared between learners. Prefer this wherever both are available.
 */

export interface PointsBreakdownItem {
  key: string;
  label: string;
  points: number;
}

export interface PointsSummary {
  totalPoints: number;
  weekPoints: number;
  todayPoints: number;
  level: number;
  pointsToNextLevel: number;
  breakdown: PointsBreakdownItem[];
}

/** Fetch the learner's own points summary; null on any failure so callers can fall back. */
export async function fetchPointsSummary(): Promise<PointsSummary | null> {
  try {
    const instituteId = await getInstituteId();
    if (!instituteId) return null;
    const { data } = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/points/v1/me/summary`,
      { params: { instituteId } }
    );
    if (!data || typeof data.totalPoints !== "number") return null;
    return data as PointsSummary;
  } catch (error) {
    console.error("[points] summary fetch failed:", error);
    return null;
  }
}
