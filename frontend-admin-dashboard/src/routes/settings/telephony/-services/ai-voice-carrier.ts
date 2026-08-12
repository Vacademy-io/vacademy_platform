import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_AI_CARRIER } from '@/constants/urls';

/**
 * The line this institute's AI calls go out on.
 *
 * AI calling streams the live audio over Plivo, so it needs a Vacademy Voice line.
 * An institute already on Vacademy Voice shares the one its team calls on
 * (`PRIMARY`); an institute on Airtel or Exotel links a separate Plivo subaccount
 * used only by the AI (`DEDICATED`) and keeps its team's calling untouched.
 */
export type AiCarrierMode = 'PRIMARY' | 'DEDICATED';

export interface AiVoiceCarrierView {
    mode: AiCarrierMode;
    /** The provider the institute's humans call on, e.g. "AIRTEL". */
    primaryProviderType?: string | null;
    primaryProviderName?: string | null;
    /** True when that provider is Vacademy Voice and can therefore carry AI calls too. */
    primaryCanCarryAi: boolean;

    dedicatedConfigured: boolean;
    dedicatedEnabled: boolean;
    authId?: string | null;
    /** Secrets are never echoed — these only say whether one is stored. */
    authTokenSet: boolean;
    webhookTokenSet: boolean;
    callerId?: string | null;
    appId?: string | null;
    recordCalls?: boolean | null;
    updatedAt?: string | null;

    /** What an AI call would dial on right now. */
    effectiveProviderType?: string | null;
    ready: boolean;
    /** Plain-language reason AI calls can't be placed yet. Null when ready. */
    blockingReason?: string | null;
}

export interface AiVoiceCarrierInput {
    mode: AiCarrierMode;
    authId?: string;
    /** Blank leaves the stored token alone — the form never receives it back. */
    authToken?: string;
    callerId?: string;
    appId?: string;
    webhookToken?: string;
    recordCalls?: boolean;
    enabled?: boolean;
}

export const fetchAiVoiceCarrier = async (instituteId: string): Promise<AiVoiceCarrierView> => {
    const { data } = await authenticatedAxiosInstance.get<AiVoiceCarrierView>(
        TELEPHONY_AI_CARRIER(instituteId)
    );
    return data;
};

export const saveAiVoiceCarrier = async (
    instituteId: string,
    input: AiVoiceCarrierInput
): Promise<AiVoiceCarrierView> => {
    const { data } = await authenticatedAxiosInstance.put<AiVoiceCarrierView>(
        TELEPHONY_AI_CARRIER(instituteId),
        input
    );
    return data;
};

/** Remove the dedicated line — AI calls fall back to the primary provider. */
export const unlinkAiVoiceCarrier = async (instituteId: string): Promise<AiVoiceCarrierView> => {
    const { data } = await authenticatedAxiosInstance.delete<AiVoiceCarrierView>(
        TELEPHONY_AI_CARRIER(instituteId)
    );
    return data;
};
