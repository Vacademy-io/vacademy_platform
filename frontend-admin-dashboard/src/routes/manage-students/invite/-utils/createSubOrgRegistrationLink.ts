import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

/**
 * Builds the public open-registration URL for a sub-org registration template.
 * Mirrors createInviteLink's base-url resolution: prefer the institute's
 * white-label learner domain (`learner_portal_base_url`, possibly stored as a
 * bare host with no scheme) and fall back to the global learner dashboard.
 */
export default function createSubOrgRegistrationLink(
    inviteCode: string,
    learnerDashboardUrl?: string | null
) {
    const INSTITUTE_ID = getCurrentInstituteId();
    const rawBase = learnerDashboardUrl || BASE_URL_LEARNER_DASHBOARD;
    const base =
        rawBase.startsWith('http://') || rawBase.startsWith('https://')
            ? rawBase
            : `https://${rawBase}`;
    return `${base}/sub-org-registration?instituteId=${INSTITUTE_ID}&code=${inviteCode}`;
}
