import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";
import {
  SUBSCRIPTION_LIST_QUERY_KEY,
  cancelSubscription,
  fetchSubscriptions,
  initiateRenewalPayment,
  type Subscription,
} from "@/components/common/user-profile/payment-billing/subscription-services";

/**
 * Gateway checkout payload handed to the host's <RazorpayCheckoutForm> ref.
 * Shaped by the backend's renew-payment response, not by us.
 */
export interface RenewalCheckoutPayload {
  razorpayKeyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  contact: string;
  email: string;
  /** Present only when the backend registered a recurring (mandate) order. */
  recurring?: number;
  customerId?: string;
}

interface UseSubscriptionManagerArgs {
  instituteId: string | null | undefined;
  /**
   * Cache scope so two surfaces listing the same learner's subscriptions
   * (e.g. the public /subscriptions page and a dashboard card) don't fight
   * over one query key.
   */
  scope: string;
  /** Opens the gateway checkout — the caller owns the checkout component. */
  onCheckout: (payload: RenewalCheckoutPayload) => void;
}

/**
 * The learner-facing subscription actions in one place: list the plans, stop
 * auto-deduction (access is always retained until end_date), and start a
 * manual "pay to continue" renewal.
 *
 * Cancelling never cuts access early and renewing never creates a new plan —
 * the backend reactivates the SAME user_plan on gateway confirmation, which is
 * why `refetchSoon` re-polls instead of optimistically flipping the status.
 */
export function useSubscriptionManager({
  instituteId,
  scope,
  onCheckout,
}: UseSubscriptionManagerArgs) {
  const queryClient = useQueryClient();
  const [renewingPlanId, setRenewingPlanId] = useState<string | null>(null);
  const queryKey = [SUBSCRIPTION_LIST_QUERY_KEY, scope, instituteId];
  // Guards against stacking timers when a learner retries a payment.
  const refetchTimers = useRef<number[]>([]);

  const {
    data: subscriptions,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchSubscriptions(instituteId as string),
    enabled: Boolean(instituteId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  /**
   * The gateway webhook reactivates the plan asynchronously — re-poll a few
   * times so the card flips to "active" without a manual reload.
   */
  const refetchSoon = () => {
    refetchTimers.current.forEach((id) => window.clearTimeout(id));
    refetchTimers.current = [3000, 8000, 15000].map((ms) =>
      window.setTimeout(invalidate, ms)
    );
  };

  const cancelMutation = useMutation({
    mutationFn: (userPlanId: string) =>
      cancelSubscription(instituteId as string, userPlanId),
    onSuccess: () => invalidate(),
  });

  const startRenewal = async (sub: Subscription, withAutopay: boolean) => {
    if (!instituteId) return;
    try {
      setRenewingPlanId(sub.user_plan_id);
      let email = "";
      let mobile = "";
      try {
        const stored = await Preferences.get({ key: "StudentDetails" });
        if (stored.value) {
          const details = JSON.parse(stored.value);
          email = details?.email ?? "";
          mobile = details?.mobile_number ?? details?.mobileNumber ?? "";
        }
      } catch {
        // best effort — the backend resolves the customer from the JWT anyway
      }
      const response = await initiateRenewalPayment(
        instituteId,
        sub,
        withAutopay
      );
      const orderDetails =
        response?.payment_response?.response_data || response?.response_data;
      if (!orderDetails?.razorpayKeyId || !orderDetails?.razorpayOrderId) {
        throw new Error("Could not create the payment order");
      }
      onCheckout({
        razorpayKeyId: orderDetails.razorpayKeyId,
        razorpayOrderId: orderDetails.razorpayOrderId,
        amount: orderDetails.amount,
        currency: orderDetails.currency || sub.currency || "INR",
        contact: mobile,
        email,
        recurring: orderDetails.recurring,
        customerId: orderDetails.customerId,
      });
    } catch (e) {
      toast.error("Couldn't start the payment", {
        description:
          e instanceof Error ? e.message : "Please try again in a moment.",
      });
    } finally {
      setRenewingPlanId(null);
    }
  };

  return {
    subscriptions: subscriptions ?? [],
    isLoading,
    isError,
    cancel: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    startRenewal,
    renewingPlanId,
    refetchSoon,
  };
}

export type { Subscription };
