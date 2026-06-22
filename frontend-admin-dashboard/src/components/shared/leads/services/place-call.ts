import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_CONNECT_CALL } from '@/constants/urls';

export interface PlaceCallRequest {
    instituteId: string;
    responseId: string;
    userId?: string;
    /**
     * Optional: id of the ExoPhone the counsellor explicitly picked at the
     * runtime picker. When omitted, the backend's selector strategy decides.
     */
    preferredNumberId?: string;
}

export interface PlaceCallResponse {
    callLogId: string;
    status: string;
    callerId?: string;
    eventsStreamUrl: string;
    /**
     * True when the provider streams live call-progress events (Exotel). False
     * for post-call providers (Airtel) — there is no live feed, the outcome only
     * lands when the provider's CDR is imported minutes after hang-up. The call
     * hook uses this to show an honest "call placed, outcome later" flow instead
     * of a spinner that never advances. Absent → treat as true (legacy).
     */
    realtimeEvents?: boolean;
}

/**
 * POST /v1/telephony/calls/connect → server picks the right ExoPhone, dials
 * the counsellor's verified mobile first, bridges to the lead. Returns the
 * SSE stream URL so the caller can render a live status toast.
 */
export const placeCall = async (req: PlaceCallRequest): Promise<PlaceCallResponse> => {
    const { data } = await authenticatedAxiosInstance.post<PlaceCallResponse>(
        TELEPHONY_CONNECT_CALL,
        req
    );
    return data;
};
