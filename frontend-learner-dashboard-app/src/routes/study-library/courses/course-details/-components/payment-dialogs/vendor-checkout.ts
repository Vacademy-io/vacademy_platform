/**
 * Shared, non-UI checkout orchestration for the in-course (study-library
 * course-details) enrollment dialogs, for the vendors that need more than a
 * simple inline charge:
 *
 *  - EWAY     — synchronous card charge. Card is eCrypt-encrypted client-side
 *               (EwayCardForm), sent in one enroll call; the response carries the
 *               final PAID/FAILED status.
 *  - PHONEPE  — Standard Checkout full-page redirect. Enroll creates the
 *               enrollment (payment pending) + returns a hosted redirectUrl; we
 *               send the learner there. `/payment-result` polls + confirms.
 *  - CASHFREE — enroll creates a UserPlan (payment pending); a second
 *               user-plan-payment call yields a paymentSessionId that the Cashfree
 *               Web Checkout SDK opens (redirects to `/payment-result`).
 *
 * STRIPE and RAZORPAY stay inline in the dialogs (Elements / hosted modal).
 * The learner here is already authenticated, so — unlike the enroll-by-invite
 * flow — no account creation / auto-login credentials are involved.
 */
import { load as loadCashfree } from "@cashfreepayments/cashfree-js";
import {
  handlePaymentForEnrollment,
  extractUserPlanId,
  extractPhonePeRedirectUrl,
  extractOrderId,
  extractEwayPaymentStatus,
  type EnrollmentResponse,
  type PaymentOption,
  type PaymentPlan,
  type PaymentGatewayDetails,
} from "../../-services/enrollment-api";
import {
  initiateCashfreePayment,
  getCashfreeReturnUrl,
} from "@/services/cashfree-payment";
import { getPhonePeReturnUrl } from "@/services/phonepe-payment";

export interface VendorCheckoutUserData {
  email: string;
  username: string;
  full_name: string;
  mobile_number: string;
  date_of_birth: string;
  gender: string;
  address_line: string;
  city: string;
  region: string;
  pin_code: string;
  profile_pic_file_id: string;
  country: string;
}

export interface VendorCheckoutParams {
  instituteId: string;
  packageSessionId: string;
  enrollmentData: EnrollmentResponse;
  selectedPaymentPlan: PaymentPlan;
  selectedPaymentOption: PaymentOption;
  /** Amount after any applied coupon (major currency units). */
  amount: number;
  currency: string;
  description: string;
  paymentType: "donation" | "subscription" | "one-time" | "free";
  /** Receipt / profile email. */
  email: string;
  /** Learner mobile number. */
  contact: string;
  userData?: VendorCheckoutUserData;
  couponCode?: string | null;
  token: string;
}

// Cashfree / PhonePe enroll calls don't read gateway keys client-side, so we pass
// an empty gateway object purely to satisfy handlePaymentForEnrollment's non-null
// guard (its Stripe card block is gated on vendor === "STRIPE").
const EMPTY_GATEWAY = {} as PaymentGatewayDetails;

const commonEnrollArgs = (p: VendorCheckoutParams) => ({
  userEmail: p.email,
  receiptEmail: p.email,
  instituteId: p.instituteId,
  packageSessionId: p.packageSessionId,
  enrollmentData: p.enrollmentData,
  selectedPaymentPlan: p.selectedPaymentPlan,
  selectedPaymentOption: p.selectedPaymentOption,
  amount: p.amount,
  currency: p.currency,
  description: p.description,
  paymentType: p.paymentType,
  contact: p.contact,
  couponCode: p.couponCode ?? null,
  token: p.token,
  userData: p.userData,
});

/**
 * PhonePe: create the enrollment + get the hosted redirectUrl, then hand off to
 * PhonePe's page (full-page navigation — this function does not return on success).
 */
export const runPhonePeCheckout = async (
  p: VendorCheckoutParams
): Promise<void> => {
  const phonePeRedirectUrl = getPhonePeReturnUrl(p.instituteId);
  const result = await handlePaymentForEnrollment({
    ...commonEnrollArgs(p),
    vendor: "PHONEPE",
    phonePeRedirectUrl,
    paymentGatewayData: EMPTY_GATEWAY,
  });

  const redirectUrl = extractPhonePeRedirectUrl(result);
  if (!redirectUrl) {
    throw new Error(
      "Could not start PhonePe checkout. Please try again or contact support."
    );
  }

  // Stash the order id so `/payment-result` can resolve it even if PhonePe drops
  // the query params on the way back.
  const orderId = extractOrderId(result);
  if (orderId && typeof window !== "undefined") {
    try {
      localStorage.setItem(
        "phonepe_pending_order",
        JSON.stringify({ orderId, instituteId: p.instituteId })
      );
    } catch {
      /* ignore */
    }
  }

  window.location.href = redirectUrl;
};

/**
 * Cashfree: create the enrollment (→ UserPlan), fetch a paymentSessionId, then
 * open the Cashfree Web Checkout SDK (which redirects to `/payment-result`).
 * Does not return on success.
 */
export const runCashfreeCheckout = async (
  p: VendorCheckoutParams
): Promise<void> => {
  const result = await handlePaymentForEnrollment({
    ...commonEnrollArgs(p),
    vendor: "CASHFREE",
    paymentGatewayData: EMPTY_GATEWAY,
  });

  const userPlanId = extractUserPlanId(result);
  if (!userPlanId) {
    throw new Error(
      "Enrollment created but user plan ID not received. Please contact support."
    );
  }

  const returnUrl = getCashfreeReturnUrl();
  const cfResponse = await initiateCashfreePayment(p.instituteId, userPlanId, {
    amount: p.amount,
    currency: p.currency || "INR",
    email: p.email,
    returnUrl,
    token: p.token,
  });

  const paymentSessionId =
    cfResponse?.responseData?.paymentSessionId ??
    cfResponse?.responseData?.payment_session_id;
  if (!paymentSessionId) {
    throw new Error(
      "Failed to initialize payment. Please try again or contact support."
    );
  }

  // Sandbox by default until real prod keys are in place (mirrors enroll-by-invite).
  const isSandbox = import.meta.env.VITE_CASHFREE_SANDBOX !== "false";
  const cashfree = await loadCashfree({
    mode: isSandbox ? "sandbox" : "production",
  });
  if (!cashfree) {
    throw new Error("Failed to load Cashfree payment gateway.");
  }

  const checkoutResult = await cashfree.checkout({
    paymentSessionId,
    returnUrl: `${returnUrl}?orderId=${cfResponse.orderId}&instituteId=${p.instituteId}`,
  });
  if (checkoutResult?.error) {
    throw new Error(
      checkoutResult.error.message || "Payment initialization failed."
    );
  }
  // On success Cashfree redirects to returnUrl — nothing more to do here.
};

export interface EwayCheckoutResult {
  /** PAID / FAILED / … (upper-cased) as reported synchronously by the enroll call. */
  status?: string;
  response: any;
}

export interface EwayEncryptedData {
  encryptedNumber: string;
  encryptedCVN: string;
  cardData: { name: string; expiryMonth: string; expiryYear: string };
}

/**
 * Eway: single synchronous charge with the eCrypt-encrypted card. Returns the
 * final status so the caller can route to success / polling / error.
 */
export const runEwayCheckout = async (
  p: VendorCheckoutParams & { ewayPaymentData: EwayEncryptedData }
): Promise<EwayCheckoutResult> => {
  const result = await handlePaymentForEnrollment({
    ...commonEnrollArgs(p),
    vendor: "EWAY",
    ewayPaymentData: p.ewayPaymentData,
    paymentGatewayData: EMPTY_GATEWAY,
  });
  return { status: extractEwayPaymentStatus(result), response: result };
};
