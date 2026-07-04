import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_VOICE_CONFIG } from '@/constants/urls';

export interface VoiceComplianceConfig {
    dndScrubEnabled?: boolean;
    nightCutoffEnabled?: boolean;
    cutoffHour?: number;
    startHour?: number;
    disclosureEnabled?: boolean;
    dltApproved?: boolean;
}

export interface VoiceBillingConfig {
    perMinuteCreditOverride?: number | null;
    perChannelDayCreditOverride?: number | null;
    purchasedChannels?: number | null;
    planName?: string | null;
    notes?: string | null;
}

/** Mirrors the backend VoiceCallingSettingsPojo (VOICE_CALLING_SETTING envelope). */
export interface VoiceCallingSettings {
    enabled?: boolean;
    plivoSubaccountId?: string | null;
    appId?: string | null;
    defaultCallerId?: string | null;
    numbers?: string[];
    recordCalls?: boolean;
    timezone?: string;
    billing?: VoiceBillingConfig;
    compliance?: VoiceComplianceConfig;
}

export interface VoiceConfigView {
    instituteId: string;
    config: VoiceCallingSettings;
    /** Server's public webhook base — used to render the inbound answer-URL guide. */
    webhookCallbackBase?: string | null;
}

export const fetchVoiceConfig = async (instituteId: string): Promise<VoiceConfigView> => {
    const { data } = await authenticatedAxiosInstance.get<VoiceConfigView>(
        TELEPHONY_VOICE_CONFIG(instituteId)
    );
    return data;
};

export const saveVoiceConfig = async (
    instituteId: string,
    config: VoiceCallingSettings
): Promise<VoiceConfigView> => {
    const { data } = await authenticatedAxiosInstance.put<VoiceConfigView>(
        TELEPHONY_VOICE_CONFIG(instituteId),
        config
    );
    return data;
};
