import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_AI_CALL_CONNECT } from '@/constants/urls';

export interface PlaceAiCallRequest {
    instituteId: string;
    /** The lead's audience_response id — the backend resolves phone + user id from it. */
    responseId: string;
    userId?: string;
    /** Optional — chosen AI agent id; blank ⇒ institute's default AI campaign. */
    campaignId?: string;
    /** Optional — chosen caller-ID number id; blank ⇒ provider default. */
    preferredNumberId?: string;
}

export interface PlaceAiCallResponse {
    callLogId: string;
    status: string;
    dispatched: boolean;
    providerMessage?: string;
}

/**
 * POST /v1/telephony/ai-call/connect → triggers an Aavtaar AI voice-agent call.
 * Fire-and-forget: the AI talks to the lead, and the outcome (which decides
 * whether a counsellor is assigned) lands later via the end-of-call webhook.
 */
export const placeAiCall = async (req: PlaceAiCallRequest): Promise<PlaceAiCallResponse> => {
    const { data } = await authenticatedAxiosInstance.post<PlaceAiCallResponse>(
        TELEPHONY_AI_CALL_CONNECT,
        req
    );
    return data;
};
