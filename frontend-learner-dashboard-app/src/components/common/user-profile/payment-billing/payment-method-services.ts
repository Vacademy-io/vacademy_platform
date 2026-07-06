import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  LEARNER_PAYMENT_METHOD_SUMMARY,
  LEARNER_PAYMENT_METHOD_SETUP_INTENT,
  LEARNER_PAYMENT_METHOD_CONFIRM_CARD,
  LEARNER_PAYMENT_METHOD_BILLING_DETAILS,
} from "@/constants/urls";

export interface BillingDetails {
  name?: string | null;
  email?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface PaymentMethodSummary {
  vendor: string | null;
  update_supported: boolean;
  has_saved_payment_method: boolean;
  card_brand?: string | null;
  card_last4?: string | null;
  card_expiry_month?: number | null;
  card_expiry_year?: number | null;
  billing_details?: BillingDetails | null;
  reason?: "GATEWAY_NOT_CONFIGURED" | "NO_CUSTOMER" | "UNSUPPORTED_GATEWAY" | null;
}

export interface StripeSetupIntentResponse {
  client_secret: string;
  publishable_key: string;
  customer_id: string;
}

export const PAYMENT_METHOD_SUMMARY_QUERY_KEY = "LEARNER_PAYMENT_METHOD_SUMMARY";

export const fetchPaymentMethodSummary = async (
  instituteId: string
): Promise<PaymentMethodSummary> => {
  const response = await authenticatedAxiosInstance.get(
    LEARNER_PAYMENT_METHOD_SUMMARY,
    { params: { instituteId } }
  );
  return response.data;
};

export const createStripeSetupIntent = async (
  instituteId: string
): Promise<StripeSetupIntentResponse> => {
  const response = await authenticatedAxiosInstance.post(
    LEARNER_PAYMENT_METHOD_SETUP_INTENT,
    null,
    { params: { instituteId } }
  );
  return response.data;
};

export const confirmStripeCardUpdate = async (
  instituteId: string,
  paymentMethodId: string
): Promise<PaymentMethodSummary> => {
  const response = await authenticatedAxiosInstance.post(
    LEARNER_PAYMENT_METHOD_CONFIRM_CARD,
    { vendor: "STRIPE", stripe: { payment_method_id: paymentMethodId } },
    { params: { instituteId } }
  );
  return response.data;
};

export const confirmEwayCardUpdate = async (
  instituteId: string,
  card: {
    cardName: string;
    expiryMonth: string;
    expiryYear: string;
    encryptedCardNumber: string;
    encryptedCvn: string;
  }
): Promise<PaymentMethodSummary> => {
  const response = await authenticatedAxiosInstance.post(
    LEARNER_PAYMENT_METHOD_CONFIRM_CARD,
    {
      vendor: "EWAY",
      eway: {
        card_name: card.cardName,
        expiry_month: card.expiryMonth,
        expiry_year: card.expiryYear,
        encrypted_card_number: card.encryptedCardNumber,
        encrypted_cvn: card.encryptedCvn,
      },
    },
    { params: { instituteId } }
  );
  return response.data;
};

export const updateBillingDetails = async (
  instituteId: string,
  billing: BillingDetails
): Promise<PaymentMethodSummary> => {
  const response = await authenticatedAxiosInstance.put(
    LEARNER_PAYMENT_METHOD_BILLING_DETAILS,
    billing,
    { params: { instituteId } }
  );
  return response.data;
};
