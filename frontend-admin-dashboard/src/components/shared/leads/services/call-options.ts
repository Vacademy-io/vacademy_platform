import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_CALL_OPTIONS } from '@/constants/urls';

export interface NumberChoice {
    id: string;
    phoneNumber: string;
    label?: string | null;
    region?: string | null;
    priority?: number | null;
}

export interface CallOptionsResponse {
    numbers: NumberChoice[];
    recommendedNumberId?: string | null;
    strategyKey?: string | null;
    /** The active provider type (e.g. EXOTEL / AIRTEL). */
    providerType?: string | null;
    /** False for no-pool providers (Airtel): there is no caller-ID number to
     *  pick — the call dials from the counsellor's own extension. `numbers` is
     *  empty and the picker just confirms the dial. Defaults to true (Exotel). */
    usesNumberPool?: boolean;
}

/**
 * GET /v1/telephony/calls/options — enumerates the institute's enabled
 * ExoPhones plus the one the configured strategy would auto-pick for this
 * specific lead. The runtime picker uses this to pre-select the recommended
 * choice and let the counsellor override if needed.
 */
export const fetchCallOptions = async (
    instituteId: string,
    userId?: string | null
): Promise<CallOptionsResponse> => {
    const url = TELEPHONY_CALL_OPTIONS(instituteId, userId ?? undefined);
    const { data } = await authenticatedAxiosInstance.get<CallOptionsResponse>(url);
    return data;
};
