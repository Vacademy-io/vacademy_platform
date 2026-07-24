import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  LIVE_SESSION_PAYMENT_STATUS_AUTH,
  LIVE_SESSION_REGISTER_AND_PAY_AUTH,
} from "@/constants/urls";

// Snake_case response of the authenticated live-session payment endpoints.
export interface LiveSessionPaymentStatus {
  registration_id: string | null;
  payment_required: boolean;
  payment_status: "PENDING" | "PAID" | null;
  invoice_id: string | null;
  total_amount: number | null;
  price: number | null;
  currency: string | null;
  institute_id: string | null;
}

/** Is this live session paid, and has the current learner settled the fee? */
export const fetchLiveSessionPaymentStatus = async (
  sessionId: string
): Promise<LiveSessionPaymentStatus> => {
  const response = await authenticatedAxiosInstance.get<LiveSessionPaymentStatus>(
    LIVE_SESSION_PAYMENT_STATUS_AUTH,
    { params: { sessionId } }
  );
  return response.data;
};

/** Registers the learner for the paid session and raises/reuses its fee invoice. */
export const registerAndPayForLiveSession = async (
  sessionId: string
): Promise<LiveSessionPaymentStatus> => {
  const response = await authenticatedAxiosInstance.post<LiveSessionPaymentStatus>(
    LIVE_SESSION_REGISTER_AND_PAY_AUTH,
    null,
    { params: { sessionId } }
  );
  return response.data;
};
