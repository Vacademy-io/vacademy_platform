import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import {
  ArrowsClockwise,
  CheckCircle,
  CreditCard,
  Info,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import {
  RazorpayCheckoutForm,
  type RazorpayCheckoutFormRef,
} from "@/components/common/enroll-by-invite/-components/razorpay-checkout-form";

import { AuthPageBranding } from "@/components/common/institute-branding";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { MyButton } from "@/components/design-system/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionLoginForm } from "@/routes/study-library/live-class/$username/components/SessionLoginForm";
import {
  SUBSCRIPTION_LIST_QUERY_KEY,
  cancelSubscription,
  fetchSubscriptions,
  initiateRenewalPayment,
  type Subscription,
} from "@/components/common/user-profile/payment-billing/subscription-services";

const formatPrice = (amount?: number | null, currency?: string | null): string => {
  if (amount == null) return "";
  const symbol = (currency ?? "INR").toUpperCase() === "INR" ? "₹" : `${currency} `;
  return `${symbol}${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
};

/**
 * Public per-learner subscription management page, linked from WhatsApp
 * ("tomorrow we auto-deduct — click here to stop"). Same trusted-login flow as
 * the unique live-class link: /subscriptions/<username> logs the learner in
 * passwordlessly on branded domains, then lists their subscriptions with a
 * stop-auto-deduction action. Cancelling never cuts access early — the page
 * always states the exact end date after which no further deduction happens.
 */
export const Route = createFileRoute("/subscriptions/$username/")({
  component: RouteComponent,
});

const formatDate = (value?: string | null): string | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // UTC-anchored: charge/end timestamps are stored UTC and the renewal sweep
  // charges on the UTC date. Local-tz rendering shifted late-evening charges to
  // the next day (message said 11 Aug, page said 12 Aug).
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

function RouteComponent() {
  const params = Route.useParams();
  const domainRouting = useDomainRouting();

  // Params can be momentarily undefined during SPA navigation — fall back to
  // parsing the URL, same as the live-class username route.
  let username = params.username || "";
  if (!username) {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === "subscriptions") {
      username = pathParts[1] || "";
    }
  }

  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getTokenFromStorage(TokenKey.accessToken);
        const studentDetails = await Preferences.get({ key: "StudentDetails" });
        const instituteDetails = await Preferences.get({
          key: "InstituteDetails",
        });
        if (
          !isNullOrEmptyOrUndefined(token) &&
          !isNullOrEmptyOrUndefined(studentDetails.value) &&
          !isNullOrEmptyOrUndefined(instituteDetails.value)
        ) {
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setAuthState("unauthenticated");
      }
    };
    if (!domainRouting.isLoading) {
      checkAuth();
    }
  }, [domainRouting.isLoading, domainRouting]);

  if (domainRouting.isLoading || authState === "loading") {
    return <DashboardLoader />;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-50">
      {domainRouting.instituteId && (
        <div className="w-full bg-white shadow-sm">
          <div className="mx-auto px-4 py-4">
            <AuthPageBranding
              branding={{
                instituteId: domainRouting.instituteId,
                instituteName: domainRouting.instituteName,
                instituteLogoFileId: domainRouting.instituteLogoFileId,
                instituteThemeCode: domainRouting.instituteThemeCode,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          {authState === "authenticated" ? (
            domainRouting.instituteId ? (
              <ManageSubscriptions instituteId={domainRouting.instituteId} />
            ) : (
              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Unable to Load Subscriptions
                </h2>
                <p className="text-gray-600">
                  Could not determine the institute for this page. Please open
                  the exact link you received, or contact support.
                </p>
              </div>
            )
          ) : domainRouting.instituteId ? (
            <SessionLoginForm
              username={username}
              instituteId={domainRouting.instituteId}
              onLoginSuccess={() => setAuthState("authenticated")}
              onNavigate={() => {}}
              successToastDescription="Loading your subscriptions"
            />
          ) : (
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-semibold text-gray-900">
                Unable to Load Subscriptions
              </h2>
              <p className="text-gray-600">
                Could not determine the institute for this page. Please open the
                exact link you received, or contact support.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-white">
        <div className="mx-auto px-4 py-4">
          <p className="text-center text-sm text-gray-500">
            Need help? Contact support for assistance with your subscription.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Subscription list + stop-auto-deduction flow. Three states per plan:
 * - auto-deduction ON  → next charge date + "Stop auto-deduction" button
 * - auto-deduction OFF → notice with the exact end date it stops after
 * - payment failed     → warning notice
 */
function ManageSubscriptions({ instituteId }: { instituteId: string }) {
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState<Subscription | null>(null);
  const [renewingPlanId, setRenewingPlanId] = useState<string | null>(null);
  // Per-plan "also enable auto-pay" choice (offered only when the invite has
  // autopay configured). Default off: the learner cancelled it deliberately.
  const [autopayChoice, setAutopayChoice] = useState<Record<string, boolean>>({});
  const razorpayRef = useRef<RazorpayCheckoutFormRef>(null);

  const refetchSoon = () => {
    // The gateway webhook reactivates the plan asynchronously — refetch a few
    // times so the page flips to "active" without a manual reload.
    [3000, 8000, 15000].forEach((ms) =>
      setTimeout(
        () =>
          queryClient.invalidateQueries({
            queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, "public-manage", instituteId],
          }),
        ms
      )
    );
  };

  const startRenewal = async (sub: Subscription) => {
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
      const withAutopay = Boolean(
        sub.autopay_available && autopayChoice[sub.user_plan_id]
      );
      const response = await initiateRenewalPayment(instituteId, sub, withAutopay);
      const orderDetails =
        response?.payment_response?.response_data || response?.response_data;
      if (!orderDetails?.razorpayKeyId || !orderDetails?.razorpayOrderId) {
        throw new Error("Could not create the payment order");
      }
      razorpayRef.current?.openPayment({
        razorpayKeyId: orderDetails.razorpayKeyId,
        razorpayOrderId: orderDetails.razorpayOrderId,
        amount: orderDetails.amount,
        currency: orderDetails.currency || sub.currency || "INR",
        contact: mobile,
        email,
        // Mandate mode: present when the backend registered a recurring order —
        // the same approval pays and re-authorizes auto-pay.
        recurring: orderDetails.recurring,
        customerId: orderDetails.customerId,
      });
    } catch (e) {
      toast.error("Couldn't start the payment", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    } finally {
      setRenewingPlanId(null);
    }
  };

  const {
    data: subscriptions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, "public-manage", instituteId],
    queryFn: () => fetchSubscriptions(instituteId),
    enabled: Boolean(instituteId),
  });

  const cancelMutation = useMutation({
    mutationFn: (userPlanId: string) =>
      cancelSubscription(instituteId, userPlanId),
    onSuccess: (updated) => {
      const until = formatDate(updated.end_date);
      toast.success("Auto-deduction stopped", {
        description: until
          ? `Your plan stays active until ${until}. You won't be charged again.`
          : "You won't be charged again.",
      });
      setToCancel(null);
      queryClient.invalidateQueries({
        queryKey: [SUBSCRIPTION_LIST_QUERY_KEY, "public-manage", instituteId],
      });
    },
    onError: () => {
      toast.error("Couldn't stop auto-deduction", {
        description: "Please try again in a moment.",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
        <SpinnerGap className="size-4 animate-spin" />
        Loading your subscriptions...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <Info className="size-4 shrink-0" />
        Subscriptions are unavailable right now. Please try again later.
      </div>
    );
  }

  const subs = subscriptions ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900">
          Manage your subscription
        </h2>
        <p className="text-sm text-gray-600">
          Stop auto-deduction anytime — you keep full access until the end of
          the period you&apos;ve already got.
        </p>
      </div>

      {subs.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <Info className="size-4 shrink-0" />
          No subscriptions found for this account.
        </div>
      )}

      {subs.map((sub) => {
        const nextCharge = formatDate(sub.next_charge_at);
        const accessUntil = formatDate(sub.end_date);
        const autopayOn =
          sub.has_active_mandate && sub.status !== "CANCELED";
        const paymentFailed = sub.status === "PAYMENT_FAILED";
        return (
          <div
            key={sub.user_plan_id}
            className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ArrowsClockwise
                  className="mt-0.5 size-5 text-primary-500"
                  weight="duotone"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-700">
                      {sub.plan_name ?? "Subscription"}
                    </p>
                    {sub.is_trial && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-500">
                        Trial
                      </span>
                    )}
                  </div>
                  {autopayOn && (
                    <p className="text-xs text-gray-500">
                      {nextCharge
                        ? `Next auto-deduction on ${nextCharge}`
                        : "Auto-deduction is on"}
                    </p>
                  )}
                </div>
              </div>
              {autopayOn && (
                <MyButton
                  type="button"
                  scale="small"
                  buttonType="secondary"
                  layoutVariant="default"
                  onClick={() => setToCancel(sub)}
                >
                  Stop auto-deduction
                </MyButton>
              )}
            </div>

            {!autopayOn && !paymentFailed && (
              <div className="flex items-start gap-2 rounded-lg bg-success-50 p-3 text-sm text-success-600">
                <CheckCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
                <span>
                  Auto-deduction is off for this plan.{" "}
                  {accessUntil
                    ? `Your plan stays active until ${accessUntil} — after that date it stops and you won't be charged.`
                    : "It stops at the end of your current period and you won't be charged."}
                </span>
              </div>
            )}

            {paymentFailed && (
              <div className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-sm text-warning-600">
                <Warning className="mt-0.5 size-4 shrink-0" weight="fill" />
                <span>
                  The last auto-deduction for this plan failed.
                  {accessUntil ? ` Access is valid until ${accessUntil}.` : ""}
                </span>
              </div>
            )}

            {sub.can_renew_manually && sub.plan_price != null && (
              <div className="space-y-3 rounded-lg border border-primary-100 bg-primary-50 p-3">
                <div className="text-sm text-gray-700">
                  {sub.status === "EXPIRED" || sub.status === "PAYMENT_FAILED" ? (
                    <span>
                      Reactivate this membership — same plan, same courses, no
                      re-enrollment needed.
                    </span>
                  ) : (
                    <span>
                      Want to continue after{" "}
                      {accessUntil ?? "your current period"}? Pay once and your
                      membership carries on.
                    </span>
                  )}
                </div>
                {sub.autopay_available && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-primary-500"
                      checked={Boolean(autopayChoice[sub.user_plan_id])}
                      onChange={(e) =>
                        setAutopayChoice((prev) => ({
                          ...prev,
                          [sub.user_plan_id]: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      Also enable auto-pay for future renewals — one approval
                      pays now and sets up automatic deduction, no more manual
                      payments.
                    </span>
                  </label>
                )}
                <div className="flex justify-end">
                  <MyButton
                    type="button"
                    scale="small"
                    buttonType="primary"
                    layoutVariant="default"
                    onClick={() => startRenewal(sub)}
                    disable={renewingPlanId === sub.user_plan_id}
                  >
                    <CreditCard className="me-1.5 size-4" />
                    {renewingPlanId === sub.user_plan_id
                      ? "Starting payment..."
                      : `Pay ${formatPrice(sub.plan_price, sub.currency)} to continue`}
                  </MyButton>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Gateway checkout host — visually hidden (its built-in card UI shows a
          placeholder amount); the SDK's payment modal attaches to document.body,
          so hiding this wrapper doesn't affect the checkout itself. */}
      <div className="hidden">
      <RazorpayCheckoutForm
        ref={razorpayRef}
        error={null}
        amount={0}
        currency="INR"
        onPaymentReady={() => {
          toast.success("Payment received!", {
            description:
              "Your membership is being reactivated — this takes a few seconds.",
          });
          refetchSoon();
        }}
        onError={(message) =>
          toast.error("Payment not completed", { description: message })
        }
      />
      </div>

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
              Stop auto-deduction?
            </DialogTitle>
            <DialogDescription>
              Auto-deduction for{" "}
              <span className="font-medium text-gray-700">
                {toCancel?.plan_name ?? "this subscription"}
              </span>{" "}
              will stop after{" "}
              {formatDate(toCancel?.end_date) ??
                "the end of your current period"}
              . You keep full access until then and won&apos;t be charged
              again.
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
              Keep it on
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
                ? "Stopping..."
                : "Stop auto-deduction"}
            </MyButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
