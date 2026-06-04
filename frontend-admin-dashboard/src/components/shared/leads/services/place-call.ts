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
