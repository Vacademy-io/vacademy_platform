import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

const DEFAULT_LEARNER_PORTAL_URL = BASE_URL_LEARNER_DASHBOARD;

/**
 * Build a shareable campaign link that learners can open.
 * Assumes learner portal handles `audience-campaign-response` route.
 */
export const createCampaignLink = (
    campaignId: string,
    learnerPortalBaseUrl?: string,
    isEnquiry?: boolean
): string => {
    if (!campaignId) return '';

    const instituteId = getCurrentInstituteId();

    const portalBase = learnerPortalBaseUrl || DEFAULT_LEARNER_PORTAL_URL;
    const encodedInstitute = encodeURIComponent(instituteId || '');
    const encodedCampaign = encodeURIComponent(campaignId);

    if (isEnquiry) {
        return `${portalBase}/enquiry-response?instituteId=${encodedInstitute}&enquiryId=${encodedCampaign}`;
    }

    return `${portalBase}/audience-response?instituteId=${encodedInstitute}&audienceId=${encodedCampaign}`;
};

export default createCampaignLink;
