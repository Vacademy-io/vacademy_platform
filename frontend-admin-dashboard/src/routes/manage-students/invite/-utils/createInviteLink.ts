import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

export default function createInviteLink(
    inviteCode: string,
    learnerDashboardUrl?: string | null
) {
    const INSTITUTE_ID = getCurrentInstituteId();
    // The institute's white-label learner domain (`learner_portal_base_url`) may be
    // stored as a bare host (e.g. `learn.acme.com`) with no scheme. Normalize it so
    // the generated link is absolute; fall back to the global default when unset.
    const rawBase = learnerDashboardUrl || BASE_URL_LEARNER_DASHBOARD;
    const base =
        rawBase.startsWith('http://') || rawBase.startsWith('https://')
            ? rawBase
            : `https://${rawBase}`;
    const url = `${base}/learner-invitation-response?instituteId=${INSTITUTE_ID}&inviteCode=${inviteCode}`;
    return url;
}
