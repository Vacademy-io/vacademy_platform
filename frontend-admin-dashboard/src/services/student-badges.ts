import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { BASE_URL } from '@/constants/urls';

const BASE = `${BASE_URL}/admin-core-service/learner-badge`;

/** A badge manually awarded to a learner (server-persisted record). */
export interface LearnerBadgeAward {
    id: string;
    userId: string;
    instituteId: string;
    badgeId: string;
    badgeName?: string | null;
    badgeIcon?: string | null;
    badgeDescription?: string | null;
    reason?: string | null;
    status: 'ACTIVE' | 'REVOKED' | string;
    awardedByUserId?: string | null;
    awardedAt?: string | null;
}

export interface AwardBadgePayload {
    userIds: string[];
    badgeId: string;
    badgeName?: string;
    badgeIcon?: string;
    badgeDescription?: string;
    reason?: string;
}

/** List a learner's active awarded badges. */
export async function getStudentAwardedBadges(userId: string): Promise<LearnerBadgeAward[]> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<LearnerBadgeAward[]>({
        method: 'GET',
        url: `${BASE}/institutes/${instituteId}/users/${userId}`,
    });
    return data ?? [];
}

/** Award a configured badge to one or more learners. */
export async function awardBadge(payload: AwardBadgePayload): Promise<LearnerBadgeAward[]> {
    const instituteId = getCurrentInstituteId();
    const { data } = await authenticatedAxiosInstance<LearnerBadgeAward[]>({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/award`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
    });
    return data ?? [];
}

/** Revoke a learner's active award for a badge (kept for audit). */
export async function revokeBadge(userId: string, badgeId: string): Promise<void> {
    const instituteId = getCurrentInstituteId();
    const params = new URLSearchParams();
    params.set('userId', userId);
    params.set('badgeId', badgeId);
    await authenticatedAxiosInstance({
        method: 'POST',
        url: `${BASE}/institutes/${instituteId}/revoke?${params.toString()}`,
    });
}
