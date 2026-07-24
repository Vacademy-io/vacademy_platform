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
    /** Optional: call ONLY these audience responses (the checked rows). */
    responseIds?: string[];
    /** Calls in parallel (1..3). 1 = strictly one at a time, next starts when one ends. */
    parallel?: number;
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
        {
            responseIds: req.responseIds?.length ? req.responseIds : undefined,
            parallel: req.parallel,
        },
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

export interface AiCampaignCallStatus {
    callLogId: string;
    responseId: string;
    /** CallStatus name: INITIATED/QUEUED/COUNSELLOR_RINGING/ANSWERED/IN_PROGRESS/COMPLETED/NO_ANSWER/BUSY/FAILED/CANCELLED */
    status: string;
    durationSeconds: number | null;
    createdAt: string | null;
    disposition: string | null;
}

/** Live per-lead statuses for the campaign progress dialog (poll every few seconds). */
export const fetchAiCampaignStatus = async (
    audienceId: string,
    instituteId: string,
    sinceEpochMs: number
): Promise<AiCampaignCallStatus[]> => {
    const { data } = await authenticatedAxiosInstance.get<AiCampaignCallStatus[]>(
        `${TELEPHONY_AI_CALL_CAMPAIGN(audienceId)}/status`,
        { params: { instituteId, sinceEpochMs } }
    );
    return data ?? [];
};
