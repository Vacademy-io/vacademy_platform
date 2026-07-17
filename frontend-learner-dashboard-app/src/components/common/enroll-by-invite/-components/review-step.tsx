import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle } from "@phosphor-icons/react";
import { getCurrencySymbol } from "./payment-selection-step";
import { SelectedPayment } from "./types";
import { ReferralCodeComponent, ReferralBenefit } from "./apply-referral";
import { useCouponsEnabled } from "@/components/common/coupon/use-coupons-enabled";
import { useCheckoutCoupon } from "@/components/common/coupon/use-checkout-coupon";
import { CouponInput } from "@/components/common/coupon/CouponInput";
import { useEffect, useState } from "react";
import { safeJsonParse } from "../-utils/helper";
import { ReferRequest } from "../-services/enroll-invite-services";
interface ReviewStepProps {
  courseData: {
    course: string;
    courseBanner?: string;
  };
  selectedPayment: SelectedPayment | null;
  paymentType?: string;
  package_session_id: string;
  setReferRequest: (referRequest: ReferRequest | null) => void;
  refCode: string | null;
  onUnappliedCodeChange?: (hasUnappliedCode: boolean) => void;
  onReferralApplied?: () => void;
  // Discount-coupon plumbing (§6). Required only to surface the coupon input;
  // payload wiring lives in enroll-form.tsx via onCouponChange.
  instituteId: string;
  enrollInviteId: string;
  userEmail?: string;
  onCouponChange?: (appliedCode: string | null, discount: number) => void;
  // Restored from the parent on remount so the discount survives a
  // Review → Pay → Back round-trip. PaidPlanReview re-runs validate once
  // the plan is loaded.
  initialCouponCode?: string | null;
}

const ReviewStep = ({
  courseData,
  selectedPayment,
  paymentType,
  package_session_id,
  setReferRequest,
  refCode,
  onUnappliedCodeChange,
  onReferralApplied,
  instituteId,
  enrollInviteId,
  userEmail,
  onCouponChange,
  initialCouponCode,
}: ReviewStepProps) => {
  return (
    <div className="space-y-6">
      {/* Order Summary Card */}
      <Card className="shadow-lg">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3 mb-4">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-title-lg font-semibold text-gray-900 leading-tight">
                Order Summary
              </h2>
              <p className="text-caption text-muted-foreground mt-1">
                Review your order before proceeding to payment
              </p>
            </div>
          </div>

          <div className="space-y-0">
            {/* Course Banner and Name */}
            <div className="flex flex-col items-center gap-4 pb-5">
              {courseData.courseBanner && (
                <div className="rounded-lg relative h-32 sm:h-56 lg:h-72 w-full overflow-hidden">
                  <img
                    src={courseData.courseBanner}
                    alt="Course Banner"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="text-subtitle font-medium">
                <span>{courseData.course}</span>
              </div>
            </div>

            <Separator />
            {paymentType === "ONE_TIME" || paymentType === "SUBSCRIPTION" ? (
              <PaidPlanReview
                plan={selectedPayment}
                package_session_id={package_session_id}
                setReferRequest={setReferRequest}
                refCode={refCode}
                onUnappliedCodeChange={onUnappliedCodeChange}
                onReferralApplied={onReferralApplied}
                instituteId={instituteId}
                enrollInviteId={enrollInviteId}
                userEmail={userEmail}
                onCouponChange={onCouponChange}
                initialCouponCode={initialCouponCode}
              />
            ) : (
              <FreePlanReview
                plan={selectedPayment}
                package_session_id={package_session_id}
                setReferRequest={setReferRequest}
                refCode={refCode}
                onUnappliedCodeChange={onUnappliedCodeChange}
                onReferralApplied={onReferralApplied}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewStep;

// Helper functions for referral benefits
const getReferralDiscountAmount = (
  benefit: ReferralBenefit,
  basePrice: number
): number => {
  if (!benefit) return 0;

  switch (benefit.benefitType) {
    case "PERCENTAGE_DISCOUNT": {
      const discountAmount =
        (basePrice * benefit.benefitValue.percentage) / 100;
      const maxDiscount = benefit.benefitValue.applyMaximumDiscountAmount
        ? benefit.benefitValue.maxDiscountAmount
        : basePrice;
      return Math.min(discountAmount, maxDiscount);
    }
    case "FLAT_DISCOUNT": {
      return benefit.benefitValue.amount;
    }
    default:
      return 0;
  }
};

const isPricingBenefit = (benefit: ReferralBenefit): boolean => {
  return (
    benefit?.benefitType === "PERCENTAGE_DISCOUNT" ||
    benefit?.benefitType === "FLAT_DISCOUNT"
  );
};

const formatNonPricingBenefits = (benefit: ReferralBenefit): string | null => {
  if (!benefit) return null;

  switch (benefit.benefitType) {
    case "FREE_MEMBERSHIP_DAYS":
      return `${benefit.benefitValue.days} Free Membership Days 🎉`;
    case "CONTENT": {
      const deliveryText = formatDeliveryMediums(
        benefit.benefitValue.deliveryMediums
      );
      return `You will get bonus content ${deliveryText} after enrolling in the course. 🎉`;
    }
    case "POINTS":
      return `Earn ${benefit.benefitValue.points} reward points ⭐️ after enrolling in the course. 🎉` ;
    default:
      console.log("Unknown benefit type:", benefit.benefitType);
      return null;
  }
};

// Helper function to format delivery mediums
const formatDeliveryMediums = (mediums: string[]) => {
  if (!mediums || mediums.length === 0) return "";

  const formattedMediums = mediums.map((medium) => {
    switch (medium.toUpperCase()) {
      case "EMAIL":
        return "Email";
      case "WHATSAPP":
        return "WhatsApp";
      default:
        return medium.toLowerCase();
    }
  });

  if (formattedMediums.length === 1) {
    return ` on ${formattedMediums[0]}`;
  } else if (formattedMediums.length === 2) {
    return ` on ${formattedMediums[0]} and ${formattedMediums[1]}`;
  }
};

const PaidPlanReview = ({
  plan,
  package_session_id,
  setReferRequest,
  refCode,
  onUnappliedCodeChange,
  onReferralApplied,
  instituteId,
  enrollInviteId,
  userEmail,
  onCouponChange,
  initialCouponCode,
}: {
  plan: SelectedPayment | null;
  package_session_id: string;
  setReferRequest: (referRequest: ReferRequest | null) => void;
  refCode: string | null;
  onUnappliedCodeChange?: (hasUnappliedCode: boolean) => void;
  onReferralApplied?: () => void;
  instituteId: string;
  enrollInviteId: string;
  userEmail?: string;
  onCouponChange?: (appliedCode: string | null, discount: number) => void;
  initialCouponCode?: string | null;
}) => {
  const [couponVerified, setCouponVerified] = useState(false);
  const couponsEnabled = useCouponsEnabled();
  const couponCtx = useCheckoutCoupon({
    buildRequest: (code) => {
      // Mirror the pricing-display fallback chain (actual_price → amount → 0).
      // Some SelectedPayment construction paths only set `amount`, not
      // `actual_price`; without the fallback the validate call sends
      // total_amount=0 and the BE percentage discount comes back as 0.
      const totalAmount =
        typeof plan?.actual_price === "number"
          ? plan.actual_price
          : typeof plan?.amount === "number"
          ? plan.amount
          : 0;
      return {
        couponCode: code,
        instituteId,
        enrollInviteId,
        packageSessionId: package_session_id || null,
        paymentPlanId: plan?.id ?? null,
        userEmail: userEmail || null,
        totalAmount,
      };
    },
  });
  // Bubble the applied code + discount up so enroll-form can both include
  // the code in the payload AND subtract the discount from the gateway
  // amount. Without the discount the BE records the coupon but the gateway
  // charges the full price.
  useEffect(() => {
    onCouponChange?.(
      couponCtx.state.appliedCode,
      couponCtx.state.appliedCode ? couponCtx.state.discount : 0
    );
  }, [couponCtx.state.appliedCode, couponCtx.state.discount, onCouponChange]);

  // Restore a previously-applied coupon after a Review → Pay → Back round-trip.
  // The parent persists the code; we re-run validate once the plan is loaded
  // so the discount and IDs are re-derived. Guarded so we don't loop on
  // failures (e.g. coupon expired since the original apply).
  const [restoreAttempted, setRestoreAttempted] = useState(false);
  useEffect(() => {
    if (restoreAttempted) return;
    if (!initialCouponCode) return;
    if (!plan) return; // wait until the price source exists
    if (couponCtx.state.appliedCode || couponCtx.state.isApplying) return;
    setRestoreAttempted(true);
    couponCtx.setCode(initialCouponCode);
    void couponCtx.apply(initialCouponCode);
  }, [initialCouponCode, plan, couponCtx, restoreAttempted]);

  // If the restore validate fails (coupon got expired / exhausted / scope
  // changed since we last saw it), drop it from the parent so the enroll
  // payload doesn't carry a stale code that the BE would also reject.
  useEffect(() => {
    if (!restoreAttempted) return;
    if (!initialCouponCode) return;
    if (couponCtx.state.isApplying) return;
    if (couponCtx.state.appliedCode) return; // restore succeeded
    if (!couponCtx.state.error) return; // hasn't resolved yet
    onCouponChange?.(null, 0);
  }, [
    restoreAttempted,
    initialCouponCode,
    couponCtx.state.isApplying,
    couponCtx.state.appliedCode,
    couponCtx.state.error,
    onCouponChange,
  ]);

  if (!plan) return null;

  const formatValidity = (validityInDays: number) => {
    if (validityInDays === 365) {
      return "12 months";
    } else if (validityInDays % 30 === 0 && validityInDays >= 30) {
      const months = validityInDays / 30;
      return `${months} ${months === 1 ? "month" : "months"}`;
    } else {
      return `${validityInDays} days`;
    }
  };

  const hasDiscount =
    plan.elevated_price &&
    plan.actual_price &&
    plan.elevated_price > plan.actual_price;
  const discountAmount = hasDiscount
    ? plan.elevated_price - plan.actual_price
    : 0;

  // Check if referral option is available
  const hasReferralOption =
    plan.referral_option && plan.referral_option !== null;

  // Parse the referral benefit from the nested tier structure
  const getReferralBenefit = (): ReferralBenefit | null => {
    if (!plan.referral_option?.referee_discount_json) return null;

    const parsed = safeJsonParse(
      plan.referral_option.referee_discount_json,
      null
    );

    if (
      !parsed ||
      !parsed.tiers ||
      !Array.isArray(parsed.tiers) ||
      parsed.tiers.length === 0
    ) {
      console.log("No valid tiers found");
      return null;
    }

    const firstTier = parsed.tiers[0];

    if (
      !firstTier.benefits ||
      !Array.isArray(firstTier.benefits) ||
      firstTier.benefits.length === 0
    ) {
      console.log("No valid benefits found");
      return null;
    }

    const benefit = firstTier.benefits[0];

    // Map the API format to our internal format
    const mappedBenefit = {
      benefitType: benefit.type,
      benefitValue: benefit.value,
      description: benefit.description,
    };

    return mappedBenefit;
  };

  const refereeDiscount: ReferralBenefit | null = getReferralBenefit();

  return (
    <div className="py-4 space-y-4">
      {/* Plan Details Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-subtitle font-semibold text-gray-900 mb-3">
          Plan Details
        </h3>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan:</span>
            <div className="font-medium text-gray-900">{plan.name}</div>
          </div>

          {plan.validity_in_days != null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Validity:</span>
              <div className="font-medium text-gray-900">
                {formatValidity(plan.validity_in_days)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Referral Code Section - Only show if referral option is available */}
      {hasReferralOption && (
        <ReferralCodeComponent
          referralOptionId={plan.referral_option.id}
          setCouponVerified={setCouponVerified}
          package_session_id={package_session_id || ""}
          setReferRequest={setReferRequest}
          refCode={refCode}
          onUnappliedCodeChange={onUnappliedCodeChange}
          onReferralApplied={onReferralApplied}
        />
      )}

      {/* Discount Coupon Section — sibling to Referral. Gated by the
          institute-level toggle (admin Settings → Coupons). */}
      {couponsEnabled && (
        <CouponInput
          state={couponCtx.state}
          onChange={couponCtx.setCode}
          onApply={couponCtx.apply}
          onClear={couponCtx.clear}
          currencySymbol={getCurrencySymbol(plan.currency || "")}
        />
      )}

      {/* Pricing Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-subtitle font-semibold text-gray-900 mb-3">Pricing</h3>

        <div className="space-y-2">
          {hasDiscount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Price:</span>
              <span className="line-through text-gray-500">
                {getCurrencySymbol(plan.currency || "")}
                {plan.elevated_price?.toFixed(2)}
              </span>
            </div>
          )}

          {hasDiscount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Discount:</span>
              <span className="text-green-600 font-medium">
                -{getCurrencySymbol(plan.currency || "")}
                {discountAmount.toFixed(2)}
              </span>
            </div>
          )}

          {/* Referral/Coupon Discount - Only show if coupon is verified and it's a pricing benefit */}
          {couponVerified &&
            refereeDiscount &&
            isPricingBenefit(refereeDiscount) && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Referral Discount:</span>
                <span className="text-green-600 font-medium">
                  -{getCurrencySymbol(plan.currency || "")}
                  {getReferralDiscountAmount(
                    refereeDiscount,
                    plan.actual_price
                  ).toFixed(2)}
                  {refereeDiscount.benefitType === "PERCENTAGE_DISCOUNT" &&
                    ` (${refereeDiscount.benefitValue.percentage}%)`}
                </span>
              </div>
            )}

          {/* Discount Coupon line — appears when learner has applied a coupon
              in the section above. The discount value comes from the BE's
              validate response (CouponDiscountUtil math). */}
          {couponCtx.state.appliedCode && couponCtx.state.discount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                Coupon ({couponCtx.state.appliedCode}):
              </span>
              <span className="text-green-600 font-medium">
                -{getCurrencySymbol(plan.currency || "")}
                {couponCtx.state.discount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-gray-600">Total Price:</span>
            <span className="font-bold text-subtitle text-primary-600">
              {getCurrencySymbol(plan.currency || "")}
              {(() => {
                let finalPrice =
                  typeof plan.actual_price === "number"
                    ? plan.actual_price
                    : typeof plan.amount === "number"
                    ? plan.amount
                    : 0;

                // Apply referral discount if coupon is verified and it's a pricing benefit
                if (
                  couponVerified &&
                  refereeDiscount &&
                  isPricingBenefit(refereeDiscount)
                ) {
                  const discountAmount = getReferralDiscountAmount(
                    refereeDiscount,
                    finalPrice
                  );
                  finalPrice = finalPrice - discountAmount;
                }

                // Subtract applied coupon discount (BE-validated value).
                if (couponCtx.state.appliedCode) {
                  finalPrice = finalPrice - couponCtx.state.discount;
                }

                return Math.max(0, finalPrice).toFixed(2);
              })()}
            </span>
          </div>
        </div>

        {/* Currency note */}
        {plan.currency && (
          <p className="text-xs text-gray-400 mt-3 text-end">
            All prices in {plan.currency.toUpperCase()}
          </p>
        )}
      </div>

      {/* Additional Benefits Section - Only show if coupon is verified and there are non-pricing benefits */}
      {couponVerified &&
        refereeDiscount &&
        !isPricingBenefit(refereeDiscount) && (
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-subtitle font-semibold text-gray-900 mb-3">
              Referral Benefits
            </h3>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-900 font-medium">
                  {formatNonPricingBenefits(refereeDiscount)}
                </span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

const FreePlanReview = ({
  plan,
  package_session_id,
  setReferRequest,
  refCode,
  onUnappliedCodeChange,
  onReferralApplied,
}: {
  plan: SelectedPayment | null;
  package_session_id: string;
  setReferRequest: (referRequest: ReferRequest | null) => void;
  refCode: string | null;
  onUnappliedCodeChange?: (hasUnappliedCode: boolean) => void;
  onReferralApplied?: () => void;
}) => {
  const [couponVerified, setCouponVerified] = useState(false);
  if (!plan) return null;

  // Check if referral option is available
  const hasReferralOption =
    plan.referral_option && plan.referral_option !== null;

  // Parse the referral benefit from the nested tier structure
  const getReferralBenefit = (): ReferralBenefit | null => {
    if (!plan.referral_option?.referee_discount_json) return null;

    const parsed = safeJsonParse(
      plan.referral_option.referee_discount_json,
      null
    );

    if (
      !parsed ||
      !parsed.tiers ||
      !Array.isArray(parsed.tiers) ||
      parsed.tiers.length === 0
    ) {
      console.error("No valid tiers found");
      return null;
    }

    const firstTier = parsed.tiers[0];

    if (
      !firstTier.benefits ||
      !Array.isArray(firstTier.benefits) ||
      firstTier.benefits.length === 0
    ) {
      console.error("No valid benefits found");
      return null;
    }

    const benefit = firstTier.benefits[0];

    // Map the API format to our internal format
    const mappedBenefit = {
      benefitType: benefit.type,
      benefitValue: benefit.value,
      description: benefit.description,
    };

    return mappedBenefit;
  };

  const refereeDiscount: ReferralBenefit | null = getReferralBenefit();
  return (
    <div className="py-4 space-y-4">
      {/* Plan Details Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-lg">
          Plan Details
        </h3>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan:</span>
            <div className="font-medium text-gray-900">{plan.name}</div>
          </div>

          {plan.validity_in_days != null && (
            <div className="flex justify-between">
              <span className="text-gray-600">Validity:</span>
              <div className="font-medium text-gray-900">
                {plan.duration || `${plan.validity_in_days} days`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Referral Code Section - Only show if referral option is available */}
      {hasReferralOption && (
        <ReferralCodeComponent
          referralOptionId={plan.referral_option.id}
          setCouponVerified={setCouponVerified}
          package_session_id={package_session_id || ""}
          setReferRequest={setReferRequest}
          refCode={refCode}
          onUnappliedCodeChange={onUnappliedCodeChange}
          onReferralApplied={onReferralApplied}
        />
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-lg">Pricing</h3>

        <div className="space-y-2">
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-gray-600">Total Price:</span>
            {plan.amount === 0 ? (
              <span className="font-bold text-lg text-primary-600">Free</span>
            ) : (
              <span className="font-bold text-lg text-primary-600">
                {getCurrencySymbol(plan.currency || "")}
                {plan.amount}
              </span>
            )}
          </div>
        </div>

        {/* Currency note */}
        {plan.currency && plan.amount !== 0 && (
          <p className="text-xs text-gray-400 mt-3 text-end">
            All prices in {plan.currency.toUpperCase()}
          </p>
        )}
      </div>

      {/* Additional Benefits Section - Only show if coupon is verified and there are non-pricing benefits */}
      {couponVerified &&
        refereeDiscount &&
        !isPricingBenefit(refereeDiscount) && (
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-lg">
              Referral Benefits
            </h3>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-900 font-medium">
                  {formatNonPricingBenefits(refereeDiscount)}
                </span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
