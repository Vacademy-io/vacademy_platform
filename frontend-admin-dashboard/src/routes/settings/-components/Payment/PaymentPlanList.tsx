import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Calendar, DollarSign, Edit, Trash2, Globe, Eye } from 'lucide-react';
import { PaymentPlan, PaymentPlans } from '@/types/payment';
import { getCurrencySymbol } from './utils/utils';

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'subscription':
            return <Calendar className="size-5" />;
        case 'upfront':
            return <DollarSign className="size-5" />;
        case 'free':
            return <Globe className="size-5" />;
        default:
            return <CreditCard className="size-5" />;
    }
};

const getPlanPriceDetails = (plan: PaymentPlan) => {
    const symbol = getCurrencySymbol(plan.currency);
    const details = [];

    // Handle case where config is undefined
    if (!plan.config) {
        details.push('No configuration available');
        return details;
    }

    switch (plan.type) {
        case PaymentPlans.SUBSCRIPTION: {
            if (plan.config?.subscription?.customIntervals?.length > 0) {
                plan.config.subscription.customIntervals.forEach(
                    (
                        interval: {
                            price: string;
                            originalPrice?: string;
                            title?: string;
                            value: number;
                            unit: string;
                        },
                        idx: number
                    ) => {
                        const originalPrice =
                            interval.originalPrice !== undefined
                                ? parseFloat(interval.originalPrice)
                                : parseFloat(interval.price || '0');
                        let discountedPrice = parseFloat(interval.price || '0');
                        const discount = plan.config?.planDiscounts?.[`interval_${idx}`];

                        if (discount && discount.type !== 'none' && discount.amount) {
                            let discountText = '';

                            if (discount.type === 'percentage') {
                                discountedPrice =
                                    originalPrice * (1 - parseFloat(discount.amount) / 100);
                                discountText = `${discount.amount}% off`;
                            } else if (discount.type === 'fixed') {
                                discountedPrice = Math.max(
                                    0,
                                    originalPrice - parseFloat(discount.amount)
                                );
                                discountText = `${symbol}${discount.amount} off`;
                            }

                            const intervalTitle =
                                interval.title || `${interval.value} ${interval.unit}`;
                            details.push(
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{intervalTitle}:</span>
                                    <span className="text-sm font-medium text-gray-400 line-through">
                                        {symbol}
                                        {originalPrice.toFixed(2)}
                                    </span>
                                    <span className="text-sm font-bold text-green-600">
                                        {symbol}
                                        {discountedPrice.toFixed(2)}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="border-green-200 text-xs text-green-600"
                                    >
                                        {discountText}
                                    </Badge>
                                </div>
                            );
                        } else {
                            const intervalTitle =
                                interval.title || `${interval.value} ${interval.unit}`;
                            details.push(
                                <div key={idx} className="text-sm text-gray-600">
                                    {intervalTitle}: {symbol}
                                    {originalPrice.toFixed(2)}
                                </div>
                            );
                        }
                    }
                );
            }
            break;
        }

        case PaymentPlans.UPFRONT: {
            const originalPrice = parseFloat(plan.config?.upfront?.fullPrice || '0');
            const upfrontDiscount = plan.config?.planDiscounts?.upfront;

            if (upfrontDiscount && upfrontDiscount.type !== 'none' && upfrontDiscount.amount) {
                let discountedPrice = originalPrice;
                let discountText = '';

                if (upfrontDiscount.type === 'percentage') {
                    discountedPrice =
                        originalPrice * (1 - parseFloat(upfrontDiscount.amount) / 100);
                    discountText = `${upfrontDiscount.amount}% off`;
                } else if (upfrontDiscount.type === 'fixed') {
                    discountedPrice = Math.max(
                        0,
                        originalPrice - parseFloat(upfrontDiscount.amount)
                    );
                    discountText = `${symbol}${upfrontDiscount.amount} off`;
                }

                details.push(
                    <div key="upfront-discounted" className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Full Price:</span>
                        <span className="text-sm font-medium text-gray-400 line-through">
                            {symbol}
                            {originalPrice.toFixed(2)}
                        </span>
                        <span className="text-sm font-bold text-green-600">
                            {symbol}
                            {discountedPrice.toFixed(2)}
                        </span>
                        <Badge
                            variant="outline"
                            className="border-green-200 text-xs text-green-600"
                        >
                            {discountText}
                        </Badge>
                    </div>
                );
            } else {
                details.push(`Full Price: ${symbol}${originalPrice.toFixed(2)}`);
            }
            break;
        }

        case PaymentPlans.DONATION: {
            if (plan.config?.donation?.suggestedAmounts) {
                details.push(
                    `Suggested Amounts: ${symbol}${plan.config.donation.suggestedAmounts}`
                );
            }
            if (plan.config?.donation?.minimumAmount) {
                details.push(`Minimum Amount: ${symbol}${plan.config.donation.minimumAmount}`);
            }
            break;
        }
    }

    return details;
};

interface PaymentPlanListProps {
    plans: PaymentPlan[];
    onEdit?: (plan: PaymentPlan) => void;
    onDelete?: (planId: string) => void;
    onSetDefault?: (planId: string) => void;
    onPreview?: (plan: PaymentPlan) => void;
}

export const PaymentPlanList: React.FC<PaymentPlanListProps> = ({
    plans,
    onEdit,
    onDelete,
    onSetDefault,
    onPreview,
}) => {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-5" />
                    Payment Options
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {plans.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">
                            <CreditCard className="mx-auto mb-4 size-12 text-gray-300" />
                            <p>No payment options created yet</p>
                            <p className="text-sm">
                                Create your first payment option to start accepting payments
                            </p>
                        </div>
                    ) : (
                        plans.map((plan, index) => (
                            <React.Fragment key={plan.id}>
                                {index > 0 && <Separator className="my-4" />}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {getTypeIcon(plan.type)}
                                            <h3 className="text-lg font-medium">{plan.name}</h3>
                                            {plan.tag === 'DEFAULT' && (
                                                <Badge
                                                    variant="default"
                                                    className="bg-green-100 text-green-800"
                                                >
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="capitalize">
                                                {plan.type}
                                            </Badge>
                                            {onPreview &&
                                                (plan.type === PaymentPlans.SUBSCRIPTION ||
                                                    plan.type === PaymentPlans.DONATION) && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => onPreview(plan)}
                                                        className="text-blue-600 hover:text-blue-700"
                                                    >
                                                        <Eye className="size-4" />
                                                    </Button>
                                                )}
                                            {onEdit && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onEdit(plan)}
                                                >
                                                    <Edit className="size-4" />
                                                </Button>
                                            )}
                                            {onSetDefault && plan.tag !== 'DEFAULT' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        onSetDefault(plan.id);
                                                    }}
                                                >
                                                    Make Default
                                                </Button>
                                            )}
                                            {onDelete && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onDelete(plan.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="ml-7 space-y-1">
                                        {getPlanPriceDetails(plan).map((detail, idx) => (
                                            <p key={idx} className="text-sm text-gray-600">
                                                {detail}
                                            </p>
                                        ))}
                                        {plan.type !== PaymentPlans.FREE && (
                                            <p className="mt-2 text-xs text-gray-500">
                                                Currency: {plan.currency}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
