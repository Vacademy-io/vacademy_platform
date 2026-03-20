import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Calendar } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { getCurrencySymbol } from './utils/utils';

interface SubscriptionPlan {
    enabled: boolean;
    price: string;
    interval: string;
    title?: string;
    features?: string[];
    customInterval?: {
        value: number;
        unit: 'days' | 'weeks' | 'months' | 'years';
    };
}

interface SubscriptionPlansConfig {
    [key: string]: SubscriptionPlan; // Only custom intervals
}

interface SubscriptionPlanPreviewProps {
    currency: string;
    subscriptionPlans: SubscriptionPlansConfig;
    features: string[];
    onSelectPlan?: (planType: string) => void;
    discountCoupons?: DiscountCoupon[];
}

interface DiscountCoupon {
    id: string;
    code: string;
    name: string;
    type: 'percentage' | 'fixed';
    value: number;
    currency?: string;
    isActive: boolean;
    usageLimit?: number;
    usedCount: number;
    expiryDate?: string;
    applicablePlans: string[];
}

const formatCustomInterval = (value: number, unit: string) => {
    const unitStr = value === 1 ? unit.slice(0, -1) : unit; // Remove 's' for singular
    return `${value} ${unitStr}`;
};

const getPlanTitle = (plan: SubscriptionPlan) => {
    if (plan.title) {
        return plan.title;
    }
    if (plan.customInterval) {
        return `${formatCustomInterval(plan.customInterval.value, plan.customInterval.unit)} Plan`;
    }
    return 'Custom Plan';
};

const getIncludedFeatures = (features: string[], planFeatures?: string[]) => {
    if (planFeatures && planFeatures.length > 0) {
        return features.map((feature) => ({
            name: feature,
            included: planFeatures.includes(feature),
        }));
    }

    // All other plans include all features
    return features.map((feature) => ({
        name: feature,
        included: true,
    }));
};

const calculateDiscountedPrice = (
    originalPrice: number,
    discountCoupons: DiscountCoupon[],
    planType: string
) => {
    if (!discountCoupons || discountCoupons.length === 0) {
        return { discountedPrice: originalPrice, appliedDiscount: null };
    }

    // Find the best discount that applies to this specific plan
    let bestDiscount = null;
    let bestDiscountedPrice = originalPrice;

    for (const coupon of discountCoupons) {
        if (!coupon.isActive) continue;

        // Check if this discount applies to the current plan
        const isApplicable =
            coupon.applicablePlans && coupon.applicablePlans.length > 0
                ? coupon.applicablePlans.includes(planType)
                : true; // If no applicablePlans specified, apply to all (fallback)

        if (!isApplicable) {
            continue;
        }

        let discountedPrice = originalPrice;

        if (coupon.type === 'percentage') {
            discountedPrice = originalPrice * (1 - coupon.value / 100);
        } else if (coupon.type === 'fixed') {
            discountedPrice = Math.max(0, originalPrice - coupon.value);
        }

        if (discountedPrice < bestDiscountedPrice) {
            bestDiscountedPrice = discountedPrice;
            bestDiscount = coupon;
        }
    }

    return {
        discountedPrice: bestDiscountedPrice.toFixed(2),
        appliedDiscount: bestDiscount,
    };
};

export const SubscriptionPlanPreview: React.FC<SubscriptionPlanPreviewProps> = ({
    currency,
    subscriptionPlans,
    features,
    onSelectPlan,
    discountCoupons = [],
}) => {
    if (!subscriptionPlans) {
        console.error('subscriptionPlans prop is required');
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="size-5" />
                        Subscription Intervals Preview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="py-8 text-center text-gray-500">
                        <Calendar className="mx-auto mb-4 size-12 text-gray-300" />
                        <p>Error: Subscription plans data is missing</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!currency) {
        console.error('currency prop is required');
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="size-5" />
                        Subscription Intervals Preview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="py-8 text-center text-gray-500">
                        <Calendar className="mx-auto mb-4 size-12 text-gray-300" />
                        <p>Error: Currency is not selected</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const enabledPlans = Object.entries(subscriptionPlans)
        .filter(([, plan]) => {
            const isEnabled = plan.enabled;
            const hasValidPrice =
                plan.price && !isNaN(parseFloat(plan.price)) && parseFloat(plan.price) > 0;

            return isEnabled && hasValidPrice;
        })
        .map(([type, plan]) => ({
            type,
            ...plan,
        }));

    if (enabledPlans.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="size-5" />
                        Subscription Intervals Preview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="py-8 text-center text-gray-500">
                        <Calendar className="mx-auto mb-4 size-12 text-gray-300" />
                        <p>No subscription intervals enabled yet</p>
                        <p className="text-sm">
                            Enable intervals and set prices in the settings to see the preview cards
                        </p>
                        <div className="mt-4 text-xs text-gray-400">
                            <p>To show a plan:</p>
                            <ol className="mt-2 list-inside list-decimal">
                                <li>Enable the plan using the switch</li>
                                <li>Set a valid price greater than 0</li>
                            </ol>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full min-w-fit">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="size-5" />
                    Subscription Intervals Preview
                </CardTitle>
                <p className="text-sm text-gray-600">
                    Live preview of your subscription intervals with feature comparison
                </p>
            </CardHeader>
            <CardContent className="">
                <div className="flex gap-4">
                    {enabledPlans.map((plan) => {
                        const planFeatures = getIncludedFeatures(features || [], plan.features);

                        return (
                            <Card
                                key={plan.type}
                                className={`relative w-64 cursor-pointer overflow-hidden border-2 transition-all hover:border-primary-300 hover:shadow-lg`}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-lg font-bold text-gray-900">
                                            {getPlanTitle(plan)}
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            {(() => {
                                                const originalPrice = parseFloat(plan.price);
                                                const { discountedPrice, appliedDiscount } =
                                                    calculateDiscountedPrice(
                                                        originalPrice,
                                                        discountCoupons,
                                                        plan.type
                                                    );

                                                return (
                                                    <>
                                                        {appliedDiscount ? (
                                                            <div className="flex flex-col">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-lg font-bold text-gray-400 line-through">
                                                                        {getCurrencySymbol(
                                                                            currency
                                                                        )}
                                                                        {originalPrice.toLocaleString()}
                                                                    </span>
                                                                    <span className="text-2xl font-bold text-green-600">
                                                                        {getCurrencySymbol(
                                                                            currency
                                                                        )}
                                                                        {discountedPrice.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs font-medium text-green-600">
                                                                    {appliedDiscount.type ===
                                                                    'percentage'
                                                                        ? `${appliedDiscount.value}% off`
                                                                        : `${getCurrencySymbol(currency)}${appliedDiscount.value} off`}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-2xl font-bold text-blue-600">
                                                                {getCurrencySymbol(currency)}
                                                                {originalPrice.toLocaleString()}
                                                            </span>
                                                        )}
                                                        <span className="mr-2 text-nowrap text-sm text-gray-500">
                                                            /
                                                            {formatCustomInterval(
                                                                plan.customInterval?.value || 0,
                                                                plan.customInterval?.unit || ''
                                                            )}
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            {planFeatures.map((feature, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-2"
                                                >
                                                    {feature.included ? (
                                                        <Check className="size-4 text-green-500" />
                                                    ) : (
                                                        <X className="size-4 text-red-500" />
                                                    )}
                                                    <span
                                                        className={`text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400 line-through'}`}
                                                    >
                                                        {feature.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <MyButton
                                            className="w-full"
                                            onClick={() => onSelectPlan?.(plan.type)}
                                            buttonType="secondary"
                                        >
                                            Select Plan
                                        </MyButton>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
