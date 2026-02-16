import axios from "axios";
import {
  USER_PLAN_PAYMENT_URL,
  CASHFREE_PAYMENT_STATUS_URL,
} from "@/constants/urls";

export interface CashfreePaymentInitiationRequest {
  amount: number;
  currency: string;
  vendor: "CASHFREE";
  email: string;
  cashfree_request: {
    return_url: string;
  };
}

export interface CashfreePaymentResponseData {
  cf_order_id?: string;
  order_id?: string;
  payment_session_id?: string;
  paymentSessionId?: string;
  status?: string;
  payment_status?: string;
  paymentStatus?: string;
}

export interface CashfreePaymentResponse {
  orderId: string;
  message?: string;
  responseData?: CashfreePaymentResponseData;
}

/**
 * Initiate Cashfree payment via user-plan-payment API.
 * Returns paymentSessionId for Cashfree Web Checkout SDK.
 */
export const initiateCashfreePayment = async (
  instituteId: string,
  userPlanId: string,
  params: {
    amount: number;
    currency?: string;
    email: string;
    returnUrl: string;
    token: string;
  }
): Promise<CashfreePaymentResponse> => {
  const { amount, currency = "INR", email, returnUrl, token } = params;

  const payload: CashfreePaymentInitiationRequest = {
    amount,
    currency,
    vendor: "CASHFREE",
    email,
    cashfree_request: {
      return_url: returnUrl,
    },
  };

  const response = await axios.post<CashfreePaymentResponse>(
    `${USER_PLAN_PAYMENT_URL}?instituteId=${instituteId}&userPlanId=${userPlanId}`,
    payload,
    {
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

/**
 * Build the learner payment result URL for Cashfree return_url.
 * Uses current window origin so the user returns to the same app instance
 * (staging, localhost, or production) they started from.
 */
export const getCashfreeReturnUrl = (): string => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/payment-result`;
  }
  const baseUrl =
    import.meta.env.VITE_LEARNER_DASHBOARD_URL || "https://learner.vacademy.io";
  return `${baseUrl}/payment-result`;
};

/** Payment status API response – may include auth tokens for auto-login when PAID */
export interface CashfreePaymentStatusResponse {
  payment_status?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { email?: string; password?: string };
  [key: string]: unknown;
}

/**
 * Get Cashfree payment status (no auth required)
 */
export const getCashfreePaymentStatus = async (
  orderId: string,
  instituteId: string
): Promise<CashfreePaymentStatusResponse> => {
  const response = await axios.get(
    `${CASHFREE_PAYMENT_STATUS_URL}/${orderId}`,
    { params: { instituteId } }
  );
  return response.data;
};
