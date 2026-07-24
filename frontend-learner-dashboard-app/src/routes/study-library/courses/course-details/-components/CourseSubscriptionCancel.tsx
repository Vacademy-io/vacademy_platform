import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowsClockwise, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { MyButton } from "@/components/design-system/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SUBSCRIPTION_LIST_QUERY_KEY,
  fetchSubscriptions,
  cancelSubscription,
} from "@/components/common/user-profile/payment-billing/subscription-services";
import { shouldHidePaidPurchaseUI } from "@/utils/ios-iap-compliance";

interface CourseSubscriptionCancelProps {
  instituteId: string;
  packageSessionId?: string;
}

const formatDate = (value?: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Shows a "Cancel subscription" control on the course-details page when the
 * learner has an active autopay mandate for THIS course (package session).
 * Renders nothing otherwise, so it's safe to drop in unconditionally.
 */
export const CourseSubscriptionCancel = ({
  instituteId,
  packageSessionId,
}: CourseSubscriptionCancelProps) => {
  // Reader-mode (native iOS): "Cancel subscription" is a paid-subscription
  // surface Apple flags under Guideline 3.1.1. Constant per session.
  if (shouldHidePaidPurchaseUI()) return null;

  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: subscriptions } = useQuery({
    queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, instituteId],
    queryFn: () => fetchSubscriptions(instituteId),
    enabled: Boolean(instituteId && packageSessionId),
    staleTime: 60 * 1000,
  });

  const subscription = (subscriptions ?? []).find(
    (s) =>
      s.has_active_mandate &&
      Boolean(packageSessionId) &&
      (s.package_session_ids ?? []).includes(packageSessionId as string)
  );

  const cancelMutation = useMutation({
    mutationFn: (userPlanId: string) =>
      cancelSubscription(instituteId, userPlanId),
    onSuccess: () => {
      toast.success("Autopay cancelled", {
        description: "You keep access until the end of your current period.",
      });
      setConfirmOpen(false);
      queryClient.invalidateQueries({
        queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, instituteId],
      });
    },
    onError: () => {
      toast.error("Couldn't cancel autopay", {
        description: "Please try again in a moment.",
      });
    },
  });

  if (!subscription) return null;

  return (
    <div className="rounded-xl border border-catalogue-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ArrowsClockwise
            className="mt-0.5 size-5 text-primary-500"
            weight="duotone"
          />
          <div>
            <p className="text-sm font-medium text-catalogue-text-primary">
              Auto-renewing subscription
            </p>
            <p className="text-xs text-catalogue-text-muted">
              {formatDate(subscription.next_charge_at)
                ? `Renews on ${formatDate(subscription.next_charge_at)}`
                : "Recurring subscription active"}
            </p>
          </div>
        </div>
        <MyButton
          type="button"
          scale="small"
          buttonType="secondary"
          layoutVariant="default"
          onClick={() => setConfirmOpen(true)}
        >
          Cancel subscription
        </MyButton>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning className="size-5 text-danger-500" weight="fill" />
              Cancel this subscription?
            </DialogTitle>
            <DialogDescription>
              Auto-renewal will stop. You&apos;ll keep access until{" "}
              {formatDate(subscription.end_date) ??
                "the end of your current period"}
              , and won&apos;t be charged again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <MyButton
              type="button"
              scale="small"
              buttonType="secondary"
              layoutVariant="default"
              onClick={() => setConfirmOpen(false)}
              disable={cancelMutation.isPending}
            >
              Keep subscription
            </MyButton>
            <MyButton
              type="button"
              scale="small"
              buttonType="primary"
              layoutVariant="default"
              onClick={() => cancelMutation.mutate(subscription.user_plan_id)}
              disable={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel subscription"}
            </MyButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
