import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

export default function createInviteLink(
    inviteCode: string,
    learnerDashboardUrl = BASE_URL_LEARNER_DASHBOARD
) {
    const INSTITUTE_ID = getCurrentInstituteId();
    const url = `${learnerDashboardUrl}/learner-invitation-response?instituteId=${INSTITUTE_ID}&inviteCode=${inviteCode}`;
    return url;
}
