import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle } from "lucide-react";
import { getCurrencySymbol } from "./payment-selection-step";
import { SelectedPayment } from "./types";
import {
  FlatBenefit,
  PercentageDiscountBenefit,
  ReferralCodeComponent,
} from "./apply-referral";
import { useState } from "react";
import { safeJsonParse } from "../-utils/helper";
interface ReviewStepProps {
  courseData: {
    course: string;
    courseBanner?: string;
  };
  selectedPayment: SelectedPayment | null;
  paymentType?: string;
  package_session_id: string;
}

const ReviewStep = ({
  courseData,
  selectedPayment,
  paymentType,
  package_session_id,
}: ReviewStepProps) => {
  console.log("review payment", selectedPayment);
  return (
    <div className="space-y-6">
      {/* Order Summary Card */}
      <Card className="shadow-lg border bg-white">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3 mb-4">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                Order Summary
              </h2>
              <p className="text-gray-600 text-sm mt-1">
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

              <div className="text-lg font-medium">
                <span>{courseData.course}</span>
              </div>
            </div>

            <Separator />
            {paymentType === "ONE_TIME" || paymentType === "SUBSCRIPTION" ? (
              <PaidPlanReview
                plan={selectedPayment}
                package_session_id={package_session_id}
              />
            ) : (
              // @ts-expect-error : //TODO: create interface for this
              <FreePlanReview plan={selectedPayment} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewStep;

const PaidPlanReview = ({
  plan,
  package_session_id,
}: {
  plan: SelectedPayment | null;
  package_session_id: string;
}) => {
  const [couponVerified, setCouponVerified] = useState(false);
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

  const refereeDiscount: FlatBenefit | PercentageDiscountBenefit =
    safeJsonParse(plan.referral_option?.referee_discount_json, null);

  return (
    <div className="py-4 space-y-4">
      {/* Plan Details Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-lg">
          Plan Details
        </h3>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Name:</span>
            <div className="font-medium text-gray-900">{plan.name}</div>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Validity:</span>
            <div className="font-medium text-gray-900">
              {plan.validity_in_days
                ? formatValidity(plan.validity_in_days)
                : "Lifetime"}
            </div>
          </div>
        </div>
      </div>

      {/* Referral Code Section - Only show if referral option is available */}
      {hasReferralOption && (
        <ReferralCodeComponent
          referralOptionId={plan.referral_option.id}
          setCouponVerified={setCouponVerified}
          package_session_id={package_session_id || ""}
        />
      )}

      {/* Pricing Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-lg">Pricing</h3>

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

          {/* Referral/Coupon Discount - Only show if coupon is verified */}
          {couponVerified && refereeDiscount && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Referral Discount:</span>
              <span className="text-green-600 font-medium">
                -{getCurrencySymbol(plan.currency || "")}
                {refereeDiscount.benefitType === "PERCENTAGE_DISCOUNT"
                  ? (
                      (plan.actual_price *
                        refereeDiscount.benefitValue.percentage) /
                      100
                    ).toFixed(2)
                  : refereeDiscount.benefitValue.amount.toFixed(2)}
                {refereeDiscount.benefitType === "PERCENTAGE_DISCOUNT" &&
                  ` (${refereeDiscount.benefitValue.percentage}%)`}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-gray-600">Total Price:</span>
            <span className="font-bold text-lg text-primary-600">
              {getCurrencySymbol(plan.currency || "")}
              {(() => {
                let finalPrice = plan.actual_price;

                // Apply referral discount if coupon is verified
                if (couponVerified && refereeDiscount) {
                  if (refereeDiscount.benefitType === "PERCENTAGE_DISCOUNT") {
                    const discountAmount =
                      (finalPrice * refereeDiscount.benefitValue.percentage) /
                      100;
                    const maxDiscount = refereeDiscount.benefitValue
                      .applyMaximumDiscountAmount
                      ? refereeDiscount.benefitValue.maxDiscountAmount
                      : finalPrice;
                    finalPrice =
                      finalPrice - Math.min(discountAmount, maxDiscount);
                  } else if (refereeDiscount.benefitType === "FLAT") {
                    finalPrice =
                      finalPrice - refereeDiscount.benefitValue.amount;
                  }
                }

                return Math.max(0, finalPrice).toFixed(2);
              })()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const FreePlanReview = ({
  plan,
}: {
  plan: (SelectedPayment & { duration: string; amount: number }) | null;
}) => {
  if (!plan) return null;
  return (
    <div className="py-4 space-y-4">
      {/* Plan Details Section */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3 text-lg">
          Plan Details
        </h3>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Name:</span>
            <div className="font-medium text-gray-900">{plan.name}</div>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Validity:</span>
            <div className="font-medium text-gray-900">{plan.duration}</div>
          </div>
        </div>
      </div>

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
      </div>
    </div>
  );
};
