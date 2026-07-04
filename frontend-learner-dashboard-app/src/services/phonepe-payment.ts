import axios from "axios";
import {
  PHONEPE_PAYMENT_STATUS_URL,
  BASE_URL_LEARNER_DASHBOARD,
} from "@/constants/urls";

/**
 * PhonePe Standard Checkout is a full-page redirect flow (no inline SDK):
 *  1. Backend creates the enrollment + payment log and calls PhonePe `/pg/v1/pay`,
 *     returning a hosted `redirectUrl`.
 *  2. The learner is sent to PhonePe to pay.
 *  3. PhonePe redirects back to the URL we configured (the payment-result page,
 *     stamped server-side with `orderId` + `instituteId`) and also POSTs to the
 *     backend webhook.
 *  4. The result page polls {@link getPhonePePaymentStatus} until the order is
 *     COMPLETED / FAILED.
 */

/** Return URL PhonePe redirects the learner back to after checkout. */
export const getPhonePeReturnUrl = (instituteId: string): string => {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : BASE_URL_LEARNER_DASHBOARD;
  const params = new URLSearchParams({ vendor: "PHONEPE" });
  if (instituteId && instituteId !== "null" && instituteId.trim() !== "") {
    params.set("instituteId", instituteId);
  }
  return `${base}/payment-result?${params.toString()}`;
};

/** Active status-check response. `status` is PhonePe's state (COMPLETED/FAILED/PENDING). */
export interface PhonePePaymentStatusResponse {
  status?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Actively queries PhonePe for the order's state and updates the payment log
 * server-side. No auth required. Only sends instituteId when valid — omitting or
 * sending "null" triggers extra DB lookups on the backend.
 */
export const getPhonePePaymentStatus = async (
  orderId: string,
  instituteId: string,
): Promise<PhonePePaymentStatusResponse> => {
  const isValidInstitute =
    !!instituteId && instituteId !== "null" && instituteId.trim() !== "";
  const params = isValidInstitute ? { instituteId } : {};
  const response = await axios.get(`${PHONEPE_PAYMENT_STATUS_URL}/${orderId}`, {
    params,
  });
  return response.data;
};
