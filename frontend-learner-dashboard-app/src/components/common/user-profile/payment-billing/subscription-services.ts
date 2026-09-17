import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  LEARNER_SUBSCRIPTION_LIST,
  LEARNER_SUBSCRIPTION_CANCEL,
  LEARNER_PLAN_CHANGE_OPTIONS,
  LEARNER_PLAN_CHANGE,
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
  /**
   * At least one other plan is flagged switchable for this membership. Gates the
   * "Change plan" entry point so we never open an empty picker.
   */
  can_change_plan?: boolean;
  /** A downgrade already booked for the end of the cycle, if any. */
  scheduled_plan_change?: ScheduledPlanChange | null;
}

/**
 * A downgrade the learner booked but which has not landed yet. Shown on the card because
 * otherwise "you're on Monthly" quietly stops being true at the next renewal.
 */
export interface ScheduledPlanChange {
  change_request_id: string;
  to_plan_id: string;
  to_plan_name?: string | null;
  to_plan_price?: number | null;
  currency?: string | null;
  effective_from?: string | null;
}

/**
 * One plan the learner may switch to, already priced for them right now — mirrors the
 * backend PlanChangeTargetDTO.
 */
export interface PlanChangeTarget {
  plan_id: string;
  plan_name?: string | null;
  payment_option_id: string;
  option_name?: string | null;
  option_type?: string | null;
  enroll_invite_id?: string | null;
  price?: number | null;
  currency?: string | null;
  validity_in_days?: number | null;
  feature_json?: string | null;
  description?: string | null;
  /** UPGRADE | DOWNGRADE | LATERAL */
  direction: string;
  /** IMMEDIATE | END_OF_CYCLE */
  effective_type: string;
  /** Unused value of the current plan, credited against this plan's price. */
  proration_credit?: number | null;
  /** What the learner pays now. 0 for a scheduled downgrade. */
  amount_due_now?: number | null;
  effective_from?: string | null;
  /**
   * Taking this target invalidates the existing auto-pay mandate (price above its
   * max_amount, or a different gateway), so the checkout must re-register the mandate.
   */
  requires_mandate_reauth?: boolean;
  /** Also moves the learner to a different payment option + enroll invite. */
  cross_option?: boolean;
}

export interface PlanChangeOptions {
  user_plan_id: string;
  current_plan_id?: string | null;
  current_plan_name?: string | null;
  current_plan_price?: number | null;
  current_payment_option_id?: string | null;
  current_option_name?: string | null;
  currency?: string | null;
  current_validity_in_days?: number | null;
  current_end_date?: string | null;
  targets: PlanChangeTarget[];
  scheduled_change?: ScheduledPlanChange | null;
  can_change_plan: boolean;
  /** Populated when can_change_plan is false, so the UI can say why. */
  blocked_reason?: string | null;
}

export interface PlanChangeResult {
  /** PENDING_PAYMENT | SCHEDULED | APPLIED — branch on this, not on which fields are set. */
  status: string;
  change_request_id: string;
  direction: string;
  to_plan_id: string;
  to_plan_name?: string | null;
  effective_from?: string | null;
  amount_due_now?: number | null;
  proration_credit?: number | null;
  currency?: string | null;
  requires_mandate_reauth?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payment_response?: any;
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

export const PLAN_CHANGE_OPTIONS_QUERY_KEY = "LEARNER_PLAN_CHANGE_OPTIONS";

/** The plans this learner may switch to, priced for them right now. */
export const fetchPlanChangeOptions = async (
  instituteId: string,
  userPlanId: string
): Promise<PlanChangeOptions> => {
  const response = await authenticatedAxiosInstance.get(
    LEARNER_PLAN_CHANGE_OPTIONS(userPlanId),
    { params: { instituteId } }
  );
  return response.data;
};

/**
 * Book a plan change. Sends only the target plan id — the price, the proration and whether
 * the target is even allowed are all derived server-side, never trusted from here.
 *
 * An upgrade comes back PENDING_PAYMENT with a gateway checkout payload; a downgrade comes
 * back SCHEDULED with the date it takes effect and nothing to pay.
 */
export const requestPlanChange = async (
  instituteId: string,
  userPlanId: string,
  targetPlanId: string,
  withAutopay: boolean
): Promise<PlanChangeResult> => {
  const response = await authenticatedAxiosInstance.post(
    LEARNER_PLAN_CHANGE(userPlanId),
    { target_plan_id: targetPlanId, with_autopay: withAutopay },
    { params: { instituteId } }
  );
  return response.data;
};

/** Call off a downgrade booked for the end of the cycle. */
export const cancelScheduledPlanChange = async (
  instituteId: string,
  userPlanId: string
): Promise<void> => {
  await authenticatedAxiosInstance.delete(LEARNER_PLAN_CHANGE(userPlanId), {
    params: { instituteId },
  });
};
