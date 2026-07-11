import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_AI_CALL_CAMPAIGN } from '@/constants/urls';

export interface StartAiCampaignRequest {
    /** The audience/campaign id (a lead list). */
    audienceId: string;
    instituteId: string;
    /** true = just count eligible leads, don't place any calls (for the confirm dialog). */
    dryRun?: boolean;
    /** Optional chosen AI agent id; blank ⇒ institute's default. */
    campaignId?: string;
    /** Optional chosen caller-ID number id; blank ⇒ provider default. */
    preferredNumberId?: string;
}

export interface StartAiCampaignResult {
    /** All leads in the list. */
    total: number;
    /** Leads that will actually be called (have a saved contact / user). */
    eligible: number;
    /** false for a dry run; true once the calls have been queued. */
    dispatched: boolean;
    message: string;
}

/**
 * POST /v1/telephony/ai-call/campaign/{audienceId}?instituteId=&dryRun= — bulk AI
 * calls for a lead list. The backend counts synchronously (so we get total/eligible
 * back immediately) and then paces the per-lead calls on a background pool; each
 * lead's outcome + counsellor assignment arrives later via the end-of-call webhook.
 */
export const startAiCallCampaign = async (
    req: StartAiCampaignRequest
): Promise<StartAiCampaignResult> => {
    const { data } = await authenticatedAxiosInstance.post<StartAiCampaignResult>(
        TELEPHONY_AI_CALL_CAMPAIGN(req.audienceId),
        null,
        {
            params: {
                instituteId: req.instituteId,
                dryRun: req.dryRun ?? false,
                campaignId: req.campaignId || undefined,
                preferredNumberId: req.preferredNumberId || undefined,
            },
        }
    );
    return data;
};
