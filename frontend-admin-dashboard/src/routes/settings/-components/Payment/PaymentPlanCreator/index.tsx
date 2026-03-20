import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CreditCard } from 'lucide-react';
import { SubscriptionPlanPreview } from '../SubscriptionPlanPreview';
import { DonationPlanPreview } from '../DonationPlanPreview';
import { PaymentPlanEditor } from '../PaymentPlanEditor';
import { currencyOptions } from '../../../-constants/payments';
import { PaymentPlan, PaymentPlans, PaymentPlanType } from '@/types/payment';
import {
    getTotalSteps,
    getRequiredApprovalStatus,
    FreePlanInfo,
    getCurrencySymbol,
} from '../utils/utils';
import { PlanTypeSelection } from './PlanTypeSelection';
import { ApprovalToggle } from './ApprovalToggle';
import { DonationPlanConfiguration } from './DonationPlanConfiguration';
import { SubscriptionPlanConfiguration } from './SubscriptionPlanConfiguration';
import { UpfrontPlanConfiguration } from './UpfrontPlanConfiguration';
import { PlanDiscountsConfiguration } from './PlanDiscountsConfiguration';
import { PlanNavigation } from './PlanNavigation';
import { DAYS_IN_MONTH } from '@/routes/settings/-constants/terms';

interface CustomInterval {
    value: number | string;
    unit: 'days' | 'months';
    price: number | string;
    features?: string[];
    newFeature?: string;
    title?: string;
}

interface PaymentPlanCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (plan: PaymentPlan) => void;
    editingPlan?: PaymentPlan | null;
    featuresGlobal: string[];
    setFeaturesGlobal: (features: string[]) => void;
    defaultCurrency?: string;
    isSaving?: boolean;
    existingFreePlans?: FreePlanInfo[];
    requireApproval: boolean;
    setRequireApproval: (value: boolean) => void;
}

export const PaymentPlanCreator: React.FC<PaymentPlanCreatorProps> = ({
    isOpen,
    onClose,
    onSave,
    editingPlan,
    featuresGlobal,
    setFeaturesGlobal,
    defaultCurrency = 'INR',
    isSaving = false,
    existingFreePlans = [],
    requireApproval = false,
    setRequireApproval,
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [planData, setPlanData] = useState<Partial<PaymentPlan>>({});
    const [showPreview, setShowPreview] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<'days' | 'months'>('months');
    const previewRef = useRef<HTMLDivElement>(null);
    const onApprovalChange = (value: boolean) => {
        setRequireApproval(value);
    };

    // Initialize form data when creating new plan
    useEffect(() => {
        if (isOpen && !editingPlan) {
            setPlanData({
                name: '',
                type: PaymentPlans.SUBSCRIPTION,
                currency: defaultCurrency,
                isDefault: false,
                features: featuresGlobal,
                requireApproval: requireApproval || false,
                config: {
                    subscription: {
                        customIntervals: [] as CustomInterval[],
                    },
                    upfront: {
                        fullPrice: '',
                    },
                    donation: {
                        suggestedAmounts: '',
                        allowCustomAmount: true,
                        minimumAmount: '',
                        newAmount: '',
                    },
                    free: {
                        validityDays: DAYS_IN_MONTH,
                    },
                    planDiscounts: {},
                },
            });
            setCurrentStep(1);
            setShowPreview(false);
        }
    }, [isOpen, editingPlan, defaultCurrency]);

    // Auto-set approval status based on free plan restrictions
    useEffect(() => {
        if (planData.type === PaymentPlans.FREE && setRequireApproval) {
            const requiredStatus = getRequiredApprovalStatus(existingFreePlans);
            setRequireApproval(requiredStatus);
        }
    }, [planData.type, existingFreePlans, setRequireApproval]);

    // Helper function to convert unit and value to days
    const convertToDays = (value: number, unit: 'days' | 'months'): number => {
        if (unit === 'days') {
            return value;
        } else if (unit === 'months') {
            return value * DAYS_IN_MONTH;
        }
        return value;
    };

    const handleSave = () => {
        if (!planData.name || !planData.type) {
            return;
        }

        // Calculate validity_in_days for subscription plans
        let validityDays: number | undefined;
        let updatedConfig = planData.config || {};

        if (planData.type === PaymentPlans.SUBSCRIPTION) {
            const intervals = planData.config?.subscription?.customIntervals || [];
            if (intervals.length > 0) {
                // Use the first interval's validity as the base
                const firstInterval = intervals[0];
                const numericValue =
                    typeof firstInterval.value === 'string'
                        ? parseFloat(firstInterval.value) || 0
                        : firstInterval.value;
                validityDays = convertToDays(numericValue, selectedUnit);

                // Add unit to the top level of config
                updatedConfig = {
                    ...updatedConfig,
                    unit: selectedUnit,
                    subscription: {
                        ...updatedConfig.subscription,
                        unit: selectedUnit,
                    },
                };
            }
        } else if (planData.type === PaymentPlans.FREE) {
            validityDays = planData.config?.free?.validityDays;
        }

        const newPlan: PaymentPlan = {
            id: `plan_${Date.now()}`,
            name: planData.name,
            type: planData.type.toUpperCase() as PaymentPlanType,
            tag: planData.tag || 'free',
            currency: planData.currency || 'INR',
            isDefault: planData.isDefault || false,
            config: updatedConfig,
            features: planData.features,
            validityDays,
            requireApproval: planData.requireApproval || false,
        };

        // For free plans, we need to determine the approval status based on existing plans
        if (planData.type === PaymentPlans.FREE) {
            const requiredStatus = getRequiredApprovalStatus(existingFreePlans);
            newPlan.requireApproval = requiredStatus;
        }

        onSave(newPlan);
        onClose();
    };

    const updateConfig = (newConfig: Record<string, unknown>) => {
        setPlanData({
            ...planData,
            type: planData.type?.toUpperCase() as PaymentPlanType,
            config: {
                ...planData.config,
                ...newConfig,
            },
        });
    };

    const handleNext = () => {
        if (currentStep === 1 && planData.type && planData.name) {
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (planData.type === PaymentPlans.FREE || planData.type === PaymentPlans.DONATION) {
                handleSave();
            } else {
                setCurrentStep(3);
            }
        }
    };

    const handlePreviewToggle = () => {
        setShowPreview((prev) => !prev);
        setTimeout(() => {
            if (previewRef.current) {
                previewRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        }, 100);
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const renderPreview = () => {
        const hasCustomIntervals =
            planData.type === PaymentPlans.SUBSCRIPTION &&
            planData.config?.subscription?.customIntervals?.length > 0;

        if (!showPreview || !(hasCustomIntervals || planData.type === PaymentPlans.DONATION)) {
            return null;
        }

        // Convert plan discounts to coupon format for preview
        const planDiscounts = planData.config?.planDiscounts || {};
        const discountCoupons: Array<{
            id: string;
            code: string;
            name: string;
            type: 'percentage' | 'fixed';
            value: number;
            currency: string;
            isActive: boolean;
            usageLimit?: number;
            usedCount: number;
            expiryDate?: string;
            applicablePlans: string[];
        }> = [];

        // Handle plan discounts based on type
        switch (planData.type) {
            case PaymentPlans.SUBSCRIPTION:
                if (planData.config?.subscription?.customIntervals) {
                    planData.config.subscription.customIntervals.forEach(
                        (interval: CustomInterval, idx: number) => {
                            const discount = planDiscounts[`interval_${idx}`];
                            if (discount && discount.type !== 'none' && discount.amount) {
                                discountCoupons.push({
                                    id: `plan-discount-${idx}`,
                                    code: `${discount.type === 'percentage' ? 'PERCENT' : 'FLAT'}_${discount.amount}_${idx}`,
                                    name: `${discount.type === 'percentage' ? `${discount.amount}% Off` : `${getCurrencySymbol(planData.currency!)}${discount.amount} Off`} - ${interval.title || `${interval.value} ${interval.unit} Plan`}`,
                                    type: discount.type,
                                    value: parseFloat(discount.amount),
                                    currency: planData.currency || 'INR',
                                    isActive: true,
                                    usageLimit: undefined,
                                    usedCount: 0,
                                    expiryDate: undefined,
                                    applicablePlans: [`custom${idx}`],
                                });
                            }
                        }
                    );
                }
                break;
            case PaymentPlans.UPFRONT:
                if (planDiscounts.upfront && typeof planDiscounts.upfront === 'object') {
                    const discount = planDiscounts.upfront;
                    if (discount.type !== 'none' && discount.amount) {
                        discountCoupons.push({
                            id: 'plan-discount-upfront',
                            code: `${discount.type === 'percentage' ? 'PERCENT' : 'FLAT'}_${discount.amount}`,
                            name: `${discount.type === 'percentage' ? `${discount.amount}% Off` : `${getCurrencySymbol(planData.currency!)}${discount.amount} Off`}`,
                            type: discount.type,
                            value: parseFloat(discount.amount),
                            currency: planData.currency || 'INR',
                            isActive: true,
                            usageLimit: undefined,
                            usedCount: 0,
                            expiryDate: undefined,
                            applicablePlans: ['upfront'],
                        });
                    }
                }
                break;
        }

        return (
            <div ref={previewRef} className="mt-8 space-y-6">
                {planData.type === PaymentPlans.SUBSCRIPTION && hasCustomIntervals ? (
                    <SubscriptionPlanPreview
                        currency={planData.currency || 'INR'}
                        subscriptionPlans={{
                            ...(planData.type === PaymentPlans.SUBSCRIPTION &&
                                planData.config?.subscription?.customIntervals
                                    ?.map((interval: CustomInterval, idx: number) => ({
                                        [`custom${idx}`]: {
                                            enabled: true,
                                            price: interval.price || '0',
                                            interval: 'custom',
                                            title:
                                                interval.title ||
                                                `${interval.value} ${interval.unit} Plan`,
                                            features: interval.features || [],
                                            customInterval: {
                                                value: interval.value,
                                                unit: interval.unit,
                                            },
                                        },
                                    }))
                                    .reduce(
                                        (
                                            acc: Record<string, unknown>,
                                            curr: Record<string, unknown>
                                        ) => ({ ...acc, ...curr }),
                                        {}
                                    )),
                        }}
                        features={featuresGlobal}
                        discountCoupons={discountCoupons}
                        onSelectPlan={(planType) => {
                            console.log('Selected plan:', planType);
                        }}
                    />
                ) : planData.type === PaymentPlans.DONATION ? (
                    <DonationPlanPreview
                        currency={planData.currency || 'INR'}
                        suggestedAmounts={planData.config?.donation?.suggestedAmounts || ''}
                        minimumAmount={planData.config?.donation?.minimumAmount || '0'}
                        allowCustomAmount={planData.config?.donation?.allowCustomAmount !== false}
                        onSelectAmount={(amount) => {
                            console.log('Selected donation amount:', amount);
                        }}
                    />
                ) : null}
            </div>
        );
    };

    if (!isOpen) return null;

    if (editingPlan) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-h-[90vh] min-w-[800px] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="size-5" />
                            Edit Payment Plan
                        </DialogTitle>
                    </DialogHeader>
                    <PaymentPlanEditor
                        editingPlan={editingPlan}
                        featuresGlobal={featuresGlobal}
                        setFeaturesGlobal={setFeaturesGlobal}
                        onSave={onSave}
                        onCancel={onClose}
                        isSaving={isSaving}
                    />
                </DialogContent>
            </Dialog>
        );
    }

    const hasCustomIntervals =
        planData.type === PaymentPlans.SUBSCRIPTION &&
        planData.config?.subscription?.customIntervals?.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] min-w-[800px] overflow-y-auto">
                <div>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="size-5" />
                            Create Payment Plan
                        </DialogTitle>
                    </div>
                </div>

                <div className="mt-4 space-y-6">
                    {/* Step 1: Payment Type Selection */}
                    {currentStep === 1 && (
                        <PlanTypeSelection
                            planName={planData.name || ''}
                            planType={planData.type as PaymentPlanType}
                            existingFreePlans={existingFreePlans}
                            onPlanNameChange={(name) => setPlanData({ ...planData, name })}
                            onPlanTypeChange={(type) =>
                                setPlanData({ ...planData, type, config: {} })
                            }
                        />
                    )}

                    {/* Step 2: Plan Configuration */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            {!editingPlan && (
                                <ApprovalToggle
                                    planType={planData.type as PaymentPlanType}
                                    requireApproval={requireApproval}
                                    existingFreePlans={existingFreePlans}
                                    onApprovalChange={onApprovalChange}
                                />
                            )}

                            {planData.type !== PaymentPlans.FREE && (
                                <div className="mb-4">
                                    <Label htmlFor="planCurrency" className="text-sm font-medium">
                                        Plan Currency
                                    </Label>
                                    <Select
                                        value={planData.currency}
                                        onValueChange={(value) =>
                                            setPlanData({ ...planData, currency: value })
                                        }
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currencyOptions.map((currency) => (
                                                <SelectItem
                                                    key={currency.code}
                                                    value={currency.code}
                                                >
                                                    {currency.symbol} {currency.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Default: {defaultCurrency} (
                                        {getCurrencySymbol(defaultCurrency)})
                                    </p>
                                </div>
                            )}

                            {planData.type === PaymentPlans.DONATION && (
                                <DonationPlanConfiguration
                                    currency={planData.currency || 'INR'}
                                    suggestedAmounts={
                                        planData.config?.donation?.suggestedAmounts || ''
                                    }
                                    minimumAmount={planData.config?.donation?.minimumAmount || ''}
                                    allowCustomAmount={
                                        planData.config?.donation?.allowCustomAmount !== false
                                    }
                                    newAmount={planData.config?.donation?.newAmount || ''}
                                    onMinimumAmountChange={(amount) =>
                                        updateConfig({
                                            donation: {
                                                ...planData.config?.donation,
                                                minimumAmount: amount,
                                            },
                                        })
                                    }
                                    onAllowCustomAmountChange={(allow) =>
                                        updateConfig({
                                            donation: {
                                                ...planData.config?.donation,
                                                allowCustomAmount: allow,
                                            },
                                        })
                                    }
                                    onNewAmountChange={(amount) =>
                                        updateConfig({
                                            donation: {
                                                ...planData.config?.donation,
                                                newAmount: amount,
                                            },
                                        })
                                    }
                                    onAddAmount={() => {
                                        const newAmount =
                                            planData.config?.donation?.newAmount?.trim();
                                        if (newAmount && !isNaN(Number(newAmount))) {
                                            const currentAmounts =
                                                planData.config?.donation?.suggestedAmounts || '';
                                            const amountsList = currentAmounts
                                                ? currentAmounts
                                                      .split(',')
                                                      .map((a: string) => a.trim())
                                                : [];

                                            if (!amountsList.includes(newAmount)) {
                                                const updatedAmounts =
                                                    amountsList.length > 0
                                                        ? `${currentAmounts}, ${newAmount}`
                                                        : newAmount;

                                                updateConfig({
                                                    donation: {
                                                        ...planData.config?.donation,
                                                        suggestedAmounts: updatedAmounts,
                                                        newAmount: '',
                                                    },
                                                });
                                            }
                                        }
                                    }}
                                    onRemoveAmount={(index) => {
                                        const amountsList =
                                            planData.config?.donation?.suggestedAmounts
                                                ?.split(',')
                                                .map((a: string) => a.trim()) || [];
                                        const updatedAmounts = amountsList
                                            .filter((_: string, i: number) => i !== index)
                                            .join(', ');

                                        updateConfig({
                                            donation: {
                                                ...planData.config?.donation,
                                                suggestedAmounts: updatedAmounts,
                                            },
                                        });
                                    }}
                                />
                            )}

                            {planData.type === PaymentPlans.SUBSCRIPTION && (
                                <SubscriptionPlanConfiguration
                                    currency={planData.currency || 'INR'}
                                    customIntervals={
                                        planData.config?.subscription?.customIntervals || []
                                    }
                                    featuresGlobal={featuresGlobal}
                                    setFeaturesGlobal={setFeaturesGlobal}
                                    selectedUnit={selectedUnit}
                                    onUnitChange={setSelectedUnit}
                                    onCustomIntervalsChange={(intervals) =>
                                        updateConfig({
                                            subscription: {
                                                ...planData.config?.subscription,
                                                customIntervals: intervals,
                                            },
                                        })
                                    }
                                />
                            )}

                            {planData.type === PaymentPlans.UPFRONT && (
                                <UpfrontPlanConfiguration
                                    currency={planData.currency || 'INR'}
                                    fullPrice={planData.config?.upfront?.fullPrice || ''}
                                    onFullPriceChange={(price) =>
                                        updateConfig({
                                            upfront: {
                                                ...planData.config?.upfront,
                                                fullPrice: price,
                                            },
                                        })
                                    }
                                />
                            )}
                        </div>
                    )}

                    {/* Step 3: Plan Discounts */}
                    {currentStep === 3 &&
                        planData.type !== PaymentPlans.FREE &&
                        planData.type !== PaymentPlans.DONATION && (
                            <div className="space-y-6">
                                <PlanDiscountsConfiguration
                                    planType={planData.type || ''}
                                    currency={planData.currency || 'INR'}
                                    customIntervals={
                                        planData.config?.subscription?.customIntervals || []
                                    }
                                    upfrontPrice={planData.config?.upfront?.fullPrice || ''}
                                    planDiscounts={planData.config?.planDiscounts || {}}
                                    onPlanDiscountsChange={(discounts) =>
                                        updateConfig({
                                            planDiscounts: discounts,
                                        })
                                    }
                                    getCurrencySymbol={getCurrencySymbol}
                                />
                            </div>
                        )}

                    {/* Navigation Buttons */}
                    <PlanNavigation
                        currentStep={currentStep}
                        totalSteps={getTotalSteps(planData.type || '')}
                        planType={planData.type || ''}
                        planName={planData.name || ''}
                        isSaving={isSaving}
                        showPreview={showPreview}
                        hasCustomIntervals={hasCustomIntervals}
                        onBack={handleBack}
                        onNext={handleNext}
                        onSave={handleSave}
                        onClose={onClose}
                        onPreviewToggle={handlePreviewToggle}
                    />

                    {currentStep !== 1 && renderPreview()}
                </div>
            </DialogContent>
        </Dialog>
    );
};
