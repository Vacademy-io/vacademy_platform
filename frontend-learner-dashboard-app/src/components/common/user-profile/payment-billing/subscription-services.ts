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
