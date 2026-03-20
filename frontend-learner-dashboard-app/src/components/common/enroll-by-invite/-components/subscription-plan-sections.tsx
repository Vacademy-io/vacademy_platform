import { Card } from "@/components/ui/card";
import { Check, X } from "@phosphor-icons/react";
import { PaymentPlan } from "../-utils/helper";
import { cn } from "@/lib/utils";
import { SelectedPayment } from "./types";

export const SubscriptionPlanSection = ({
  payment_options,
  currency,
  features,
  discount_json,
  selectedPayment,
  onSelect,
}: {
  payment_options: PaymentPlan[];
  currency: string;
  features: string[];
  discount_json: Record<string, { type: string; amount: string }> | null;
  selectedPayment: SelectedPayment | null;
  onSelect: (payment: SelectedPayment) => void;
}) => {
  const getDiscountForInterval = (
    intervalIndex: number
  ): { type: string; amount: string } | null => {
    if (!discount_json) return null;
    const intervalKey = `interval_${intervalIndex}`;
    return discount_json[intervalKey] || null;
  };

  const calculateDiscountedPrice = (
    originalPrice: number,
    discount: { type: string; amount: string } | null
  ): number => {
    if (!discount) return originalPrice;

    if (discount.type === "percentage") {
      return (
        originalPrice - (originalPrice * parseFloat(discount.amount)) / 100
      );
    } else if (discount.type === "fixed") {
      return originalPrice - parseFloat(discount.amount);
    }
    return originalPrice;
  };

  const renderDiscount = (
    discount: { type: string; amount: string } | null
  ): string | null => {
    if (!discount) return null;

    if (discount.type === "percentage") {
      return `${discount.amount}% off`;
    } else if (discount.type === "fixed") {
      return `${currency}${discount.amount} off`;
    }
    return null;
  };

  return (
    <div className="flex w-full flex-wrap gap-4">
      {payment_options.map((payment, idx) => {
        const discount = getDiscountForInterval(idx);
        const originalPrice = payment.elevated_price || payment.actual_price;
        const discountedPrice = calculateDiscountedPrice(
          originalPrice,
          discount
        );
        const hasDiscount = discount && discountedPrice !== originalPrice;

        return (
          <Card
            key={idx}
            className={cn(
              "w-full border border-gray-200 p-8 py-6 transition-colors hover:border-gray-300 cursor-pointer",
              selectedPayment?.id === payment.id
                ? "ring-2 ring-blue-500 bg-blue-50"
                : "hover:bg-gray-50"
            )}
            onClick={() => {
              const paymentPlan: SelectedPayment = {
                ...payment,
                type: "SUBSCRIPTION",
              };
              onSelect(paymentPlan);
            }}
          >
            <div className="flex flex-col gap-3">
              {/* Title */}
              <h4 className="text-xl font-bold text-gray-900">
                {payment.name}
              </h4>

              {/* Price display */}
              <div className="flex flex-col gap-1">
                {hasDiscount ? (
                  <>
                    <div className="text-sm text-gray-500 line-through">
                      {currency}
                      {originalPrice.toFixed(2)}
                    </div>
                    <div className="text-xl font-bold text-primary-500">
                      {currency}
                      {discountedPrice.toFixed(2)}
                      {payment.validity_in_days && (
                        <span className="text-sm font-normal text-gray-500 ml-1">
                          /
                          {payment.validity_in_days % 30 === 0
                            ? payment.validity_in_days / 30
                            : payment.validity_in_days}{" "}
                          {payment.validity_in_days % 30 === 0
                            ? "month"
                            : "days"}
                        </span>
                      )}
                      {discount && (
                        <div className="text-sm text-green-600 font-semibold mt-1">
                          {renderDiscount(discount)}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-primary-500">
                    {currency}
                    {payment.actual_price}
                    {payment.validity_in_days && (
                      <span className="text-sm font-normal text-gray-500 ml-1">
                        /
                        {payment.validity_in_days % 30 === 0
                          ? payment.validity_in_days / 30
                          : payment.validity_in_days}{" "}
                        {payment.validity_in_days % 30 === 0 ? "month" : "days"}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {features.length > 0 && (
                <div className="space-y-2">
                  {features.map((feature, featureIdx) => {
                    const paymentFeatures = JSON.parse(
                      payment.feature_json || "[]"
                    ) as string[];
                    const isIncluded = paymentFeatures?.includes(feature);
                    return (
                      <div
                        key={featureIdx}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        {isIncluded ? (
                          <Check className="size-3 shrink-0 text-emerald-500" />
                        ) : (
                          <X className="size-3 shrink-0 text-gray-400" />
                        )}
                        <span
                          className={`${
                            isIncluded
                              ? "text-gray-700"
                              : "text-gray-400 line-through"
                          } leading-tight`}
                        >
                          {feature}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
