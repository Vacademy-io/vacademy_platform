import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowsClockwise, Info, SpinnerGap, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
  type Subscription,
} from "./subscription-services";
import { shouldHidePaidPurchaseUI } from "@/utils/ios-iap-compliance";

interface SubscriptionMandateListProps {
  instituteId: string;
}

const formatDate = (value?: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // UTC-anchored to match the renewal sweep's charge day (see subscriptions page).
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

/**
 * Lists the learner's autopay subscriptions next to their billing details and
 * lets them cancel autopay per plan. Cancelling stops future charges but keeps
 * access until the plan's end date (handled server-side).
 */
export const SubscriptionMandateList = ({
  instituteId,
}: SubscriptionMandateListProps) => {
  // Reader-mode (native iOS): autopay/subscription management is a paid-
  // subscription surface Apple flags under Guideline 3.1.1. Constant per session.
  if (shouldHidePaidPurchaseUI()) return null;

  const { t } = useTranslation("userProfileExtra");
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState<Subscription | null>(null);

  const {
    data: subscriptions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, instituteId],
    queryFn: () => fetchSubscriptions(instituteId),
    enabled: Boolean(instituteId),
    staleTime: 60 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: (userPlanId: string) =>
      cancelSubscription(instituteId, userPlanId),
    onSuccess: () => {
      toast.success(t("subscriptionMandate.toast.cancelSuccessTitle"), {
        description: t("subscriptionMandate.toast.cancelSuccessDescription"),
      });
      setToCancel(null);
      queryClient.invalidateQueries({
        queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, instituteId],
      });
    },
    onError: () => {
      toast.error(t("subscriptionMandate.toast.cancelErrorTitle"), {
        description: t("subscriptionMandate.toast.cancelErrorDescription"),
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
        <SpinnerGap className="size-4 animate-spin" />
        {t("subscriptionMandate.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <Info className="size-4 shrink-0" />
        {t("subscriptionMandate.error")}
      </div>
    );
  }

  const autopaySubs = (subscriptions ?? []).filter(
    (s) => s.has_active_mandate || s.auto_renewal_enabled
  );

  if (autopaySubs.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <Info className="size-4 shrink-0" />
        {t("subscriptionMandate.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {autopaySubs.map((sub) => {
        const nextCharge = formatDate(sub.next_charge_at);
        const accessUntil = formatDate(sub.end_date);
        const cancellable = sub.has_active_mandate;
        return (
          <div
            key={sub.user_plan_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-start gap-3">
              <ArrowsClockwise
                className="mt-0.5 size-5 text-primary-500"
                weight="duotone"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-700">
                    {sub.plan_name ?? t("subscriptionMandate.defaultPlanName")}
                  </p>
                  {sub.is_trial && (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-500">
                      {t("subscriptionMandate.trial")}
                    </span>
                  )}
                  {!cancellable && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {t("subscriptionMandate.autopayOff")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {cancellable && nextCharge
                    ? t("subscriptionMandate.autoRenewsOn", { date: nextCharge })
                    : accessUntil
                      ? t("subscriptionMandate.accessUntil", { date: accessUntil })
                      : t("subscriptionMandate.recurringSubscription")}
                </p>
              </div>
            </div>
            {cancellable && (
              <MyButton
                type="button"
                scale="small"
                buttonType="secondary"
                layoutVariant="default"
                onClick={() => setToCancel(sub)}
              >
                {t("subscriptionMandate.cancelAutopay")}
              </MyButton>
            )}
          </div>
        );
      })}

      <Dialog
        open={Boolean(toCancel)}
        onOpenChange={(open) => {
          if (!open) setToCancel(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning className="size-5 text-danger-500" weight="fill" />
              {t("subscriptionMandate.dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("subscriptionMandate.dialog.descriptionPrefix")}{" "}
              <span className="font-medium text-gray-700">
                {toCancel?.plan_name ?? t("subscriptionMandate.dialog.defaultPlanName")}
              </span>{" "}
              {t("subscriptionMandate.dialog.descriptionSuffix", {
                endDate:
                  formatDate(toCancel?.end_date) ??
                  t("subscriptionMandate.dialog.defaultEndDate"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <MyButton
              type="button"
              scale="small"
              buttonType="secondary"
              layoutVariant="default"
              onClick={() => setToCancel(null)}
              disable={cancelMutation.isPending}
            >
              {t("subscriptionMandate.dialog.keepAutopay")}
            </MyButton>
            <MyButton
              type="button"
              scale="small"
              buttonType="primary"
              layoutVariant="default"
              onClick={() =>
                toCancel && cancelMutation.mutate(toCancel.user_plan_id)
              }
              disable={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? t("subscriptionMandate.dialog.cancelling")
                : t("subscriptionMandate.cancelAutopay")}
            </MyButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
