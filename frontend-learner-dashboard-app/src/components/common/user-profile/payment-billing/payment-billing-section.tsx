import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  CalendarBlank,
  Info,
  SpinnerGap,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { PaymentGatewayWrapper } from "@/components/common/enroll-by-invite/-components/payment-gateway-wrapper";
import type { PaymentVendor } from "@/components/common/enroll-by-invite/-utils/payment-vendor-helper";
import {
  PAYMENT_METHOD_SUMMARY_QUERY_KEY,
  fetchPaymentMethodSummary,
} from "./payment-method-services";
import { StripeCardUpdate } from "./stripe-card-update";
import { EwayCardUpdate } from "./eway-card-update";
import { BillingDetailsForm } from "./billing-details-form";
import { EnrollmentExpiryList } from "./enrollment-expiry-list";
import { SubscriptionMandateList } from "./subscription-mandate-list";

interface PaymentBillingSectionProps {
  instituteId: string;
  userId: string;
}

/**
 * "Payment & Billing" section on the learner edit-profile page: shows the
 * saved card charged by subscription renewals (update supported for Stripe
 * and eWay), editable billing details, and each enrollment's access expiry.
 */
export const PaymentBillingSection = ({
  instituteId,
  userId,
}: PaymentBillingSectionProps) => {
  const [isEditingCard, setIsEditingCard] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: summary,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [PAYMENT_METHOD_SUMMARY_QUERY_KEY, instituteId],
    queryFn: () => fetchPaymentMethodSummary(instituteId),
    enabled: Boolean(instituteId),
    staleTime: 60 * 1000,
  });

  const refreshSummary = () => {
    setIsEditingCard(false);
    queryClient.invalidateQueries({
      queryKey: [PAYMENT_METHOD_SUMMARY_QUERY_KEY, instituteId],
    });
  };

  const renderCardArea = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <SpinnerGap className="size-4 animate-spin" />
          Loading payment details...
        </div>
      );
    }

    if (isError || !summary) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <Info className="size-4 shrink-0" />
          Payment details are unavailable right now. Please try again later.
        </div>
      );
    }

    if (!summary.update_supported) {
      const message =
        summary.reason === "NO_CUSTOMER"
          ? "No saved payment method on file yet. It will appear here after your first card payment."
          : summary.reason === "GATEWAY_NOT_CONFIGURED"
            ? "Online payments are not configured for your institute."
            : "Your payment method is managed at checkout and cannot be changed here.";
      return (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <Info className="size-4 shrink-0" />
          {message}
        </div>
      );
    }

    const cardLabel = summary.has_saved_payment_method
      ? `${summary.card_brand ? summary.card_brand.toUpperCase() : "Card"} •••• ${summary.card_last4 ?? "????"}`
      : "No card on file";
    const expiryLabel =
      summary.card_expiry_month && summary.card_expiry_year
        ? `Expires ${String(summary.card_expiry_month).padStart(2, "0")}/${summary.card_expiry_year}`
        : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="size-6 text-primary-500" weight="duotone" />
            <div>
              <p className="text-sm font-medium text-gray-700">{cardLabel}</p>
              <p className="text-xs text-gray-500">
                {expiryLabel ?? "Used for subscription renewals"}
              </p>
            </div>
          </div>
          {!isEditingCard && (
            <MyButton
              type="button"
              scale="small"
              buttonType="secondary"
              layoutVariant="default"
              onClick={() => setIsEditingCard(true)}
            >
              {summary.has_saved_payment_method ? "Update Card" : "Add Card"}
            </MyButton>
          )}
        </div>

        {isEditingCard && (
          <Suspense fallback={<DashboardLoader />}>
            <PaymentGatewayWrapper
              vendor={summary.vendor as PaymentVendor}
              instituteId={instituteId}
            >
              {summary.vendor === "STRIPE" ? (
                <StripeCardUpdate
                  instituteId={instituteId}
                  onUpdated={refreshSummary}
                  onCancel={() => setIsEditingCard(false)}
                />
              ) : (
                <EwayCardUpdate
                  instituteId={instituteId}
                  onUpdated={refreshSummary}
                  onCancel={() => setIsEditingCard(false)}
                />
              )}
            </PaymentGatewayWrapper>
          </Suspense>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-3 text-sm font-medium text-gray-700">
            Billing Details
          </p>
          <BillingDetailsForm
            instituteId={instituteId}
            billingDetails={summary.billing_details}
            onUpdated={refreshSummary}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Payment method + billing */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold text-gray-900">
          <CreditCard size={20} className="text-primary-500" weight="bold" />
          <h3>Payment &amp; Billing</h3>
        </div>
        {renderCardArea()}
      </div>

      {/* Auto-renewing subscriptions (cancel autopay per plan) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold text-gray-900">
          <ArrowsClockwise
            size={20}
            className="text-primary-500"
            weight="bold"
          />
          <h3>Subscriptions &amp; Autopay</h3>
        </div>
        <SubscriptionMandateList instituteId={instituteId} />
      </div>

      {/* Enrollment expiry */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2 text-lg font-semibold text-gray-900">
          <CalendarBlank
            size={20}
            className="text-secondary-500"
            weight="bold"
          />
          <h3>Membership &amp; Access</h3>
        </div>
        <EnrollmentExpiryList instituteId={instituteId} userId={userId} />
      </div>
    </div>
  );
};
