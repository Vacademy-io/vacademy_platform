import type { PaymentVendor } from "@/components/common/enroll-by-invite/-utils/payment-vendor-helper";

/** Encrypted card payload produced by the shared Eway card form. */
export interface EwayEncryptedCardData {
  encryptedNumber: string;
  encryptedCVN: string;
  cardData: {
    name: string;
    expiryMonth: string;
    expiryYear: string;
  };
}

/**
 * `payment_initiation_request` body for POST /complete — the SAME shape the
 * enroll-by-invite flow builds (see enroll-invite-services.ts,
 * handleEnrollLearnerForPayment).
 */
export interface PaymentInitiationRequest {
  vendor: string;
  amount: number;
  currency: string;
  description: string;
  charge_automatically: boolean;
  institute_id: string;
  stripe_request: Record<string, unknown>;
  razorpay_request: Record<string, unknown>;
  cashfree_request: Record<string, unknown>;
  phonepe_request: Record<string, unknown>;
  pay_pal_request: Record<string, unknown>;
  eway_request: Record<string, unknown>;
  include_pending_items: boolean;
}

interface BuildPaymentInitiationRequestParams {
  vendor: PaymentVendor;
  /** Selected plan's actual_price (the backend re-derives authoritatively). */
  amount: number;
  currency: string;
  instituteId: string;
  email: string;
  contact?: string | null;
  /** STRIPE only — payment method id produced by Stripe Elements. */
  paymentMethodId?: string;
  /** STRIPE/CASHFREE return_url / PHONEPE redirect_url, depending on the vendor. */
  returnUrl?: string;
  /** EWAY only — client-side encrypted card data from the Eway card form. */
  ewayPaymentData?: EwayEncryptedCardData | null;
}

/**
 * Pure helper that assembles the per-vendor gateway sub-requests. The Razorpay
 * request is always the create-order variant ({ customer_id, contact, email })
 * — in this flow the payment id/signature never round-trip through /complete;
 * the webhook is authoritative and the UI polls the payment log instead.
 */
export const buildPaymentInitiationRequest = ({
  vendor,
  amount,
  currency,
  instituteId,
  email,
  contact,
  paymentMethodId,
  returnUrl,
  ewayPaymentData,
}: BuildPaymentInitiationRequestParams): PaymentInitiationRequest => {
  const stripe_request =
    vendor === "STRIPE"
      ? {
          payment_method_id: paymentMethodId ?? null,
          card_last4: null,
          customer_id: null,
          return_url: returnUrl || "",
        }
      : {};

  const eway_request =
    vendor === "EWAY" && ewayPaymentData
      ? {
          customer_id: null,
          card_name: ewayPaymentData.cardData.name,
          expiry_month: ewayPaymentData.cardData.expiryMonth,
          expiry_year: ewayPaymentData.cardData.expiryYear,
          card_number: ewayPaymentData.encryptedNumber, // Already has "eCrypted:" prefix
          cvn: ewayPaymentData.encryptedCVN, // Already has "eCrypted:" prefix
          country_code: "au",
        }
      : {};

  const razorpay_request =
    vendor === "RAZORPAY"
      ? {
          customer_id: null,
          contact: contact || "",
          email,
        }
      : {};

  // Stamp the return_url on the ORDER itself — an empty value makes the
  // backend fall back to its default (https://vacademy.io), leaving the order
  // pointing at a domain that isn't Cashfree-whitelisted until the SDK's
  // checkout() call patches it.
  const cashfree_request =
    vendor === "CASHFREE" ? { return_url: returnUrl || "" } : {};

  // PhonePe Standard Checkout: redirect_url is where PhonePe sends the user
  // back; the backend stamps orderId + instituteId onto it.
  const phonepe_request =
    vendor === "PHONEPE"
      ? {
          contact: contact || "",
          email,
          redirect_url: returnUrl || "",
        }
      : {};

  return {
    vendor,
    amount: Math.max(0, amount),
    currency: vendor === "EWAY" ? "aud" : currency,
    description: "",
    charge_automatically: true,
    institute_id: instituteId,
    stripe_request,
    razorpay_request,
    cashfree_request,
    phonepe_request,
    pay_pal_request: {},
    eway_request,
    include_pending_items: true,
  };
};
