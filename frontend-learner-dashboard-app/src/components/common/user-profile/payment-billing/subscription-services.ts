import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  LEARNER_SUBSCRIPTION_LIST,
  LEARNER_SUBSCRIPTION_CANCEL,
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
  /** Invite has autopay configured — gates the "enable auto-pay" option. */
  autopay_available?: boolean;
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
 * The backend derives amount/vendor from the plan itself and creates a
 * plan-linked RENEWAL order — on gateway confirmation the SAME membership
 * reactivates (no new records). With withAutopay the checkout opens in
 * mandate mode: one approval pays AND re-registers auto-pay.
 * Returns the gateway checkout payload (response_data.razorpayKeyId etc.).
 */
export const initiateRenewalPayment = async (
  instituteId: string,
  sub: Subscription,
  withAutopay: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  const response = await authenticatedAxiosInstance.post(
    `${LEARNER_SUBSCRIPTION_LIST}/${sub.user_plan_id}/renew-payment`,
    null,
    { params: { instituteId, withAutopay } }
  );
  return response.data;
};
