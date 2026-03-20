import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, CreditCard, Heart, DollarSign } from 'lucide-react';
import { PaymentPlans, PaymentPlanType } from '@/types/payment';
import { isFreePlanDisabled, getFreePlanRestrictionMessage, FreePlanInfo } from '../utils/utils';

interface PlanTypeSelectionProps {
    planName: string;
    planType: PaymentPlanType;
    existingFreePlans: FreePlanInfo[];
    onPlanNameChange: (name: string) => void;
    onPlanTypeChange: (type: PaymentPlanType) => void;
}

export const PlanTypeSelection: React.FC<PlanTypeSelectionProps> = ({
    planName,
    planType,
    existingFreePlans,
    onPlanNameChange,
    onPlanTypeChange,
}) => {
    const isFreeDisabled = isFreePlanDisabled(existingFreePlans);
    const restrictionMessage = getFreePlanRestrictionMessage(existingFreePlans);

    return (
        <div className="space-y-2">
            {/* Plan Name Input */}
            <div>
                <Label htmlFor="planName" className="text-sm font-medium">
                    Plan Name *
                </Label>
                <Input
                    id="planName"
                    value={planName}
                    onChange={(e) => onPlanNameChange(e.target.value)}
                    placeholder="Enter plan name"
                    className="mt-1"
                    required
                />
                <p className="mt-1 text-xs text-gray-500">
                    A unique name to identify this payment plan
                </p>
            </div>

            <RadioGroup
                value={planType}
                onValueChange={(value: PaymentPlanType) => onPlanTypeChange(value)}
                className="space-y-8"
            >
                <div>
                    <div className="mb-2 text-lg font-semibold text-primary-500">Free Options</div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Free Plan */}
                        <label
                            htmlFor="free"
                            className={`rounded-lg border-2 p-4 transition-all ${
                                isFreeDisabled
                                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                                    : planType === PaymentPlans.FREE
                                      ? 'cursor-pointer border-primary-500 bg-primary-50'
                                      : 'cursor-pointer border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem
                                    value={PaymentPlans.FREE}
                                    id="free"
                                    className="mt-1"
                                    disabled={isFreeDisabled}
                                />
                                <div className="flex-1">
                                    <div className="mb-2 flex items-center space-x-2">
                                        <Globe className="size-5 text-gray-600" />
                                        <Label
                                            htmlFor="free"
                                            className={`font-medium ${
                                                isFreeDisabled
                                                    ? 'cursor-not-allowed text-gray-500'
                                                    : 'cursor-pointer text-gray-900'
                                            }`}
                                        >
                                            Free Plan
                                        </Label>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Free plan with no payment required
                                    </p>
                                    <div className="mt-2 text-xs text-gray-500">
                                        ✓ Free access
                                        <br />
                                        ✓ No payment required
                                        <br />✓ Ideal for promotional purposes
                                    </div>

                                    {/* Show restriction message if any */}
                                    {restrictionMessage && (
                                        <div className="mt-3 rounded-md bg-amber-50 p-2">
                                            <p className="text-xs text-amber-800">
                                                <strong>Restriction:</strong> {restrictionMessage}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </label>

                        {/* Optional Donation */}
                        <label
                            htmlFor="donation"
                            className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${planType === PaymentPlans.DONATION ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem
                                    value={PaymentPlans.DONATION}
                                    id="donation"
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="mb-2 flex items-center space-x-2">
                                        <Heart className="size-5 text-red-600" />
                                        <Label
                                            htmlFor="donation"
                                            className="cursor-pointer font-medium text-gray-900"
                                        >
                                            Optional Donation
                                        </Label>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Allow students to make voluntary donations with suggested
                                        amounts
                                    </p>
                                    <div className="mt-2 text-xs text-gray-500">
                                        ✓ Free course access
                                        <br />
                                        ✓ Suggested donation amounts
                                        <br />✓ Support your institute
                                    </div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                <div>
                    <div className="mb-2 text-lg font-semibold text-primary-500">Paid Options</div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Subscription */}
                        <label
                            htmlFor="subscription"
                            className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${planType === PaymentPlans.SUBSCRIPTION ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem
                                    value={PaymentPlans.SUBSCRIPTION}
                                    id="subscription"
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="mb-2 flex items-center space-x-2">
                                        <CreditCard className="size-5 text-blue-600" />
                                        <Label
                                            htmlFor="subscription"
                                            className="cursor-pointer font-medium text-gray-900"
                                        >
                                            Subscription
                                        </Label>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Recurring payments with flexible intervals
                                    </p>
                                    <div className="mt-2 text-xs text-gray-500">
                                        ✓ Auto-renewal options
                                        <br />
                                        ✓ Multiple billing periods
                                        <br />✓ Recurring revenue
                                    </div>
                                </div>
                            </div>
                        </label>

                        {/* One-Time Payment */}
                        <label
                            className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${planType === PaymentPlans.UPFRONT ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem
                                    value={PaymentPlans.UPFRONT}
                                    id="upfront"
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="mb-2 flex items-center space-x-2">
                                        <DollarSign className="size-5 text-green-600" />
                                        <Label
                                            htmlFor="upfront"
                                            className="cursor-pointer font-medium text-gray-900"
                                        >
                                            One-Time Payment
                                        </Label>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Single upfront payment with optional installment plans
                                    </p>
                                    <div className="mt-2 text-xs text-gray-500">
                                        ✓ Lifetime access
                                        <br />
                                        ✓ Installment options
                                        <br />✓ No recurring charges
                                    </div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </RadioGroup>
        </div>
    );
};
