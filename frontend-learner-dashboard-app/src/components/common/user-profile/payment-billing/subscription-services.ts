import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  LEARNER_SUBSCRIPTION_LIST,
  LEARNER_SUBSCRIPTION_CANCEL,
  USER_PLAN_PAYMENT_URL,
} from "@/constants/urls";

/**
 * One subscription (a UserPlan) and its autopay mandate. Mirrors the backend
 * SubscriptionDTO (snake_case, like the other learner payment endpoints).
 */
export interface Subscription {
  user_plan_id: string;
  plan_name?: string | null;
  status: string; // ACTIVE | CANCELED | EXPIRED | PAYMENT_FAILED
  end_date?: string | null; // access valid until
  next_charge_at?: string | null;
  auto_renewal_enabled?: boolean | null;
  is_trial?: boolean | null;
  vendor?: string | null; // RAZORPAY | EWAY | ...
  mandate_status?: string | null; // ACTIVE | REVOKED | FAILED | null
  mandate_max_amount?: number | null;
  currency?: string | null;
  has_active_mandate: boolean;
  package_session_ids?: string[] | null;
  // Manual renewal ("pay to continue"): plan price + gateway coordinates for
  // building the RENEWAL payment; flag decides whether to offer the button.
  plan_price?: number | null;
  vendor_id?: string | null;
  can_renew_manually?: boolean;
}

export const SUBSCRIPTION_LIST_QUERY_KEY = "LEARNER_SUBSCRIPTION_LIST";

export const fetchSubscriptions = async (
  instituteId: string
): Promise<Subscription[]> => {
  const response = await authenticatedAxiosInstance.get(
    LEARNER_SUBSCRIPTION_LIST,
    { params: { instituteId } }
  );
  return response.data;
};

/** Cancel autopay for a subscription. Access is retained until end_date. */
export const cancelSubscription = async (
  instituteId: string,
  userPlanId: string
): Promise<Subscription> => {
  const response = await authenticatedAxiosInstance.post(
    LEARNER_SUBSCRIPTION_CANCEL(userPlanId),
    null,
    { params: { instituteId } }
  );
  return response.data;
};

/**
 * Start a MANUAL RENEWAL payment for an existing plan ("pay to continue").
 * Creates a plan-linked payment order with payment_type RENEWAL — on gateway
 * confirmation the backend reactivates the SAME membership (no new records).
 * Returns the gateway checkout payload (response_data.razorpayKeyId etc.).
 */
export const initiateRenewalPayment = async (
  instituteId: string,
  sub: Subscription,
  contact: { email?: string; mobile?: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  const payload = {
    amount: sub.plan_price,
    currency: sub.currency || "INR",
    description: `Membership renewal — ${sub.plan_name ?? "subscription"}`,
    order_id: "",
    institute_id: instituteId,
    email: contact.email ?? "",
    vendor: sub.vendor || "RAZORPAY",
    vendor_id: sub.vendor_id || sub.vendor || "RAZORPAY",
    payment_type: "RENEWAL",
    razorpay_request: {
      customer_id: "",
      contact: contact.mobile ?? "",
      email: contact.email ?? "",
    },
    stripe_request: {},
    pay_pal_request: {},
  };
  const response = await authenticatedAxiosInstance.post(
    USER_PLAN_PAYMENT_URL,
    payload,
    { params: { instituteId, userPlanId: sub.user_plan_id } }
  );
  return response.data;
};
