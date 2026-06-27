import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";

/**
 * Badges manually awarded to this learner by an admin/institute. These are
 * server-persisted recognitions (distinct from the client-computed auto-unlock
 * badges) and are merged into the badge display as unlocked + "Awarded by your
 * institute".
 */
export interface AwardedBadge {
  id: string;
  userId: string;
  instituteId: string;
  badgeId: string;
  badgeName?: string | null;
  badgeIcon?: string | null;
  badgeDescription?: string | null;
  reason?: string | null;
  status: string;
  awardedAt?: string | null;
}

/** Fetch the authenticated learner's active awarded badges (empty on any failure). */
export async function fetchAwardedBadges(): Promise<AwardedBadge[]> {
  try {
    const instituteId = await getInstituteId();
    if (!instituteId) return [];
    const { data } = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/learner-badge/learner/v1/my-badges`,
      { params: { instituteId } }
    );
    return Array.isArray(data) ? (data as AwardedBadge[]) : [];
  } catch (error) {
    console.error("[awarded-badges] fetch failed:", error);
    return [];
  }
}
