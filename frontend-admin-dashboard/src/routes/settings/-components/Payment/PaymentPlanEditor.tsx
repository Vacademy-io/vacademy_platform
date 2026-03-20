import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Info } from 'lucide-react';
import { currencyOptions } from '../../-constants/payments';
import { PaymentPlan, PaymentPlans } from '@/types/payment';
import { getCurrencySymbol } from './utils/utils';
import { DAYS_IN_MONTH } from '@/routes/settings/-constants/terms';

interface CustomInterval {
    value: number | string;
    unit: 'days' | 'months';
    price: number | string;
    features?: string[];
    newFeature?: string;
    title?: string;
}

interface PaymentPlanEditorProps {
    editingPlan: PaymentPlan;
    featuresGlobal: string[];
    setFeaturesGlobal: (features: string[]) => void;
    onSave: (plan: PaymentPlan) => void;
    onCancel: () => void;
    isSaving: boolean;
}

export const PaymentPlanEditor: React.FC<PaymentPlanEditorProps> = ({
    editingPlan,
    featuresGlobal,
    setFeaturesGlobal,
    onSave,
    onCancel,
    isSaving,
}) => {
    const [planData, setPlanData] = useState<PaymentPlan>(editingPlan);
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedUnit, setSelectedUnit] = useState<'days' | 'months'>('months');

    // Initialize form data when editing
    useEffect(() => {
        // Extract all features from the plan (both plan-level and interval-level)
        const planFeatures = editingPlan.features || [];
        const intervalFeatures =
            editingPlan.config?.subscription?.customIntervals?.flatMap(
                (interval: CustomInterval) => interval.features || []
            ) || [];
        const allFeatures = [...new Set([...planFeatures, ...intervalFeatures, ...featuresGlobal])];

        // Update global features if we found new ones
        if (allFeatures.length > featuresGlobal.length) {
            setFeaturesGlobal(allFeatures);
        }

        // Initialize plan data with proper feature handling
        const processedPlanData = {
            ...editingPlan,
            config: {
                unit: editingPlan.config?.unit || 'months',
                subscription: {
                    customIntervals:
                        editingPlan.config?.subscription?.customIntervals?.map(
                            (interval: CustomInterval) => {
                                const processedInterval = {
                                    ...interval,
                                    value: typeof interval.value === 'number' ? interval.value : 1,
                                    unit: interval.unit || 'months', // Ensure unit is preserved
                                    title: interval.title || '',
                                    features: interval.features || [],
                                    price:
                                        typeof interval.price === 'number'
                                            ? interval.price.toString()
                                            : interval.price || '',
                                };
                                return processedInterval;
                            }
                        ) || [],
                },
                upfront: {
                    fullPrice: editingPlan.config?.upfront?.fullPrice || '',
                },
                donation: {
                    suggestedAmounts: editingPlan.config?.donation?.suggestedAmounts || '',
                    allowCustomAmount: editingPlan.config?.donation?.allowCustomAmount !== false,
                    minimumAmount: editingPlan.config?.donation?.minimumAmount || '0',
                },
                free: {
                    validityDays: editingPlan.config?.free?.validityDays || DAYS_IN_MONTH,
                },
                planDiscounts: editingPlan.config?.planDiscounts || {},
            },
        };

        // Set the selected unit based on existing intervals or top-level unit
        let detectedUnit: 'days' | 'months' = 'months';
        if (editingPlan.config?.unit) {
            detectedUnit = editingPlan.config.unit;
            setSelectedUnit(editingPlan.config.unit);
        } else if (editingPlan.config?.subscription?.unit) {
            detectedUnit = editingPlan.config.subscription.unit;
            setSelectedUnit(editingPlan.config.subscription.unit);
        } else if (editingPlan.config?.subscription?.customIntervals?.length > 0) {
            const firstInterval = editingPlan.config.subscription.customIntervals[0];
            if (firstInterval.unit) {
                detectedUnit = firstInterval.unit;
                setSelectedUnit(firstInterval.unit);
            }
        }

        // Convert stored days to display values based on detected unit
        if (editingPlan.config?.subscription?.customIntervals) {
            const updatedIntervals = editingPlan.config.subscription.customIntervals.map(
                (interval: CustomInterval) => {
                    // If interval has a stored days value (validity_in_days), convert it to display value
                    const numericValue =
                        typeof interval.value === 'string'
                            ? parseFloat(interval.value) || 0
                            : interval.value;
                    const storedDays =
                        numericValue * (interval.unit === 'months' ? DAYS_IN_MONTH : 1);
                    const displayValue = convertDaysToDisplayValue(storedDays, detectedUnit);

                    return {
                        ...interval,
                        value: displayValue,
                        unit: detectedUnit,
                    };
                }
            );

            // Update the processed plan data with converted values
            const updatedProcessedPlanData = {
                ...processedPlanData,
                config: {
                    ...processedPlanData.config,
                    subscription: {
                        ...processedPlanData.config.subscription,
                        customIntervals: updatedIntervals,
                    },
                },
            };

            setPlanData(updatedProcessedPlanData);
        } else {
            setPlanData(processedPlanData);
        }
    }, [editingPlan, featuresGlobal, setFeaturesGlobal]);

    const updateConfig = (newConfig: Record<string, unknown>) => {
        setPlanData({
            ...planData,
            config: {
                ...planData.config,
                ...newConfig,
            },
        });
    };

    // Helper function to convert unit and value to days
    const convertToDays = (value: number, unit: 'days' | 'months'): number => {
        if (unit === 'days') {
            return value;
        } else if (unit === 'months') {
            return value * DAYS_IN_MONTH;
        }
        return value;
    };

    // Helper function to convert days to display value based on unit
    const convertDaysToDisplayValue = (days: number, unit: 'days' | 'months'): number => {
        if (unit === 'days') {
            return days;
        } else if (unit === 'months') {
            return Math.round(days / DAYS_IN_MONTH);
        }
        return days;
    };

    const handleSave = () => {
        if (!planData.name || !planData.type) {
            return;
        }
        if (
            planData.type === PaymentPlans.FREE &&
            (!planData.config?.free?.validityDays || planData.config.free.validityDays <= 0)
        ) {
            return;
        }

        let updatedPlanData = { ...planData };
        if (planData.type === PaymentPlans.SUBSCRIPTION) {
            const intervals = planData.config?.subscription?.customIntervals || [];
            if (intervals.length > 0) {
                // Use the first interval's validity as the base
                const firstInterval = intervals[0];
                const numericValue =
                    typeof firstInterval.value === 'string'
                        ? parseFloat(firstInterval.value) || 0
                        : firstInterval.value;
                const validityDays = convertToDays(numericValue, selectedUnit);

                // Add unit to the top level of config
                const updatedConfig = {
                    ...planData.config,
                    unit: selectedUnit,
                    subscription: {
                        ...planData.config?.subscription,
                        unit: selectedUnit,
                    },
                };

                updatedPlanData = {
                    ...updatedPlanData,
                    validityDays,
                    config: updatedConfig,
                };
            }
        }

        onSave(updatedPlanData);
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

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const getTotalSteps = () => {
        if (planData.type === PaymentPlans.FREE) return 1;
        if (planData.type === PaymentPlans.DONATION) return 2;
        return 3;
    };

    return (
        <div className="mt-4 space-y-6">
            {/* Step 1: Basic Plan Information */}
            {currentStep === 1 && (
                <div className="space-y-6">
                    <div>
                        <Label htmlFor="planName" className="text-sm font-medium">
                            Plan Name *
                        </Label>
                        <Input
                            id="planName"
                            value={planData.name}
                            onChange={(e) => setPlanData({ ...planData, name: e.target.value })}
                            placeholder="Enter plan name"
                            className="mt-1"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="planCurrency" className="text-sm font-medium">
                            Plan Currency
                        </Label>
                        <Select
                            value={planData.currency}
                            onValueChange={(value) => setPlanData({ ...planData, currency: value })}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {currencyOptions.map((currency) => (
                                    <SelectItem key={currency.code} value={currency.code}>
                                        {currency.symbol} {currency.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="isDefault"
                            checked={planData.isDefault}
                            onCheckedChange={(checked) =>
                                setPlanData({ ...planData, isDefault: !!checked })
                            }
                        />
                        <Label htmlFor="isDefault">Set as default plan</Label>
                    </div>
                </div>
            )}

            {/* Step 2: Plan Configuration */}
            {currentStep === 2 && (
                <div className="space-y-6">
                    {planData.type === PaymentPlans.SUBSCRIPTION && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Subscription Plan Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Global Unit Selection */}
                                <div className="mb-4">
                                    <Label className="text-sm font-medium">Duration Unit</Label>
                                    <Select
                                        value={selectedUnit}
                                        onValueChange={(value: 'days' | 'months') => {
                                            setSelectedUnit(value);
                                            // Update all intervals to use the new unit and convert values
                                            const customIntervals =
                                                planData.config?.subscription?.customIntervals ||
                                                [];
                                            const updatedIntervals = customIntervals.map(
                                                (interval: CustomInterval) => {
                                                    // Convert current value to days first (handle string values)
                                                    const numericValue =
                                                        typeof interval.value === 'string'
                                                            ? parseFloat(interval.value) || 0
                                                            : interval.value;
                                                    const currentDays = convertToDays(
                                                        numericValue,
                                                        selectedUnit
                                                    );
                                                    // Then convert to new unit's display value
                                                    const newDisplayValue =
                                                        convertDaysToDisplayValue(
                                                            currentDays,
                                                            value
                                                        );

                                                    return {
                                                        ...interval,
                                                        value: newDisplayValue,
                                                        unit: value,
                                                    };
                                                }
                                            );
                                            updateConfig({
                                                subscription: {
                                                    ...planData.config?.subscription,
                                                    customIntervals: updatedIntervals,
                                                },
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="mt-1 w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="days">Days</SelectItem>
                                            <SelectItem value="months">Months</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        This unit will apply to all pricing intervals
                                    </p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium">Pricing Intervals</h3>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const customIntervals =
                                                planData.config?.subscription?.customIntervals ||
                                                [];
                                            const newInterval = {
                                                value: 1,
                                                unit: selectedUnit,
                                                price: '',
                                                features: [...featuresGlobal],
                                            };
                                            updateConfig({
                                                subscription: {
                                                    ...planData.config?.subscription,
                                                    customIntervals: [
                                                        ...customIntervals,
                                                        newInterval,
                                                    ],
                                                },
                                            });
                                        }}
                                    >
                                        <Plus className="mr-2 size-4" />
                                        Add Interval
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {(planData.config?.subscription?.customIntervals || []).map(
                                        (interval: CustomInterval, idx: number) => (
                                            <div
                                                key={`interval-${idx}-${interval.value}-${interval.unit}`}
                                                className="space-y-4 rounded-lg border p-4"
                                            >
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <Label className="text-xs">Title</Label>
                                                        <Input
                                                            value={interval.title || ''}
                                                            onChange={(e) => {
                                                                const customIntervals = [
                                                                    ...(planData.config
                                                                        ?.subscription
                                                                        ?.customIntervals || []),
                                                                ];
                                                                customIntervals[idx] = {
                                                                    ...customIntervals[idx],
                                                                    title: e.target.value,
                                                                };
                                                                updateConfig({
                                                                    subscription: {
                                                                        ...planData.config
                                                                            ?.subscription,
                                                                        customIntervals,
                                                                    },
                                                                });
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">
                                                            Duration ({selectedUnit})
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            value={interval.value}
                                                            onChange={(e) => {
                                                                const customIntervals = [
                                                                    ...(planData.config
                                                                        ?.subscription
                                                                        ?.customIntervals || []),
                                                                ];
                                                                const inputValue = e.target.value;
                                                                customIntervals[idx] = {
                                                                    ...customIntervals[idx],
                                                                    value:
                                                                        inputValue === ''
                                                                            ? ''
                                                                            : parseInt(
                                                                                  inputValue
                                                                              ) || 1,
                                                                };
                                                                updateConfig({
                                                                    subscription: {
                                                                        ...planData.config
                                                                            ?.subscription,
                                                                        customIntervals,
                                                                    },
                                                                });
                                                            }}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs">Price</Label>
                                                        <div className="mt-1 flex items-center space-x-2">
                                                            <span className="text-sm">
                                                                {getCurrencySymbol(
                                                                    planData.currency
                                                                )}
                                                            </span>
                                                            <Input
                                                                type="number"
                                                                value={interval.price}
                                                                onChange={(e) => {
                                                                    const customIntervals = [
                                                                        ...(planData.config
                                                                            ?.subscription
                                                                            ?.customIntervals ||
                                                                            []),
                                                                    ];
                                                                    customIntervals[idx] = {
                                                                        ...customIntervals[idx],
                                                                        price: e.target.value,
                                                                    };
                                                                    updateConfig({
                                                                        subscription: {
                                                                            ...planData.config
                                                                                ?.subscription,
                                                                            customIntervals,
                                                                        },
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Features for this interval */}
                                                <div>
                                                    <h4 className="mb-2 text-xs font-semibold">
                                                        Features
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {featuresGlobal.map((feature, fidx) => (
                                                            <div
                                                                key={fidx}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Checkbox
                                                                    checked={
                                                                        interval.features?.includes(
                                                                            feature
                                                                        ) || false
                                                                    }
                                                                    onCheckedChange={(checked) => {
                                                                        const customIntervals = [
                                                                            ...(planData.config
                                                                                ?.subscription
                                                                                ?.customIntervals ||
                                                                                []),
                                                                        ];
                                                                        let newFeatures =
                                                                            interval.features
                                                                                ? [
                                                                                      ...interval.features,
                                                                                  ]
                                                                                : [];

                                                                        if (checked) {
                                                                            newFeatures.push(
                                                                                feature
                                                                            );
                                                                        } else {
                                                                            newFeatures =
                                                                                newFeatures.filter(
                                                                                    (f) =>
                                                                                        f !==
                                                                                        feature
                                                                                );
                                                                        }

                                                                        customIntervals[idx] = {
                                                                            ...customIntervals[idx],
                                                                            features: newFeatures,
                                                                        };

                                                                        updateConfig({
                                                                            subscription: {
                                                                                ...planData.config
                                                                                    ?.subscription,
                                                                                customIntervals,
                                                                            },
                                                                        });
                                                                    }}
                                                                />
                                                                <span className="text-sm">
                                                                    {feature}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const customIntervals = [
                                                            ...(planData.config?.subscription
                                                                ?.customIntervals || []),
                                                        ];
                                                        customIntervals.splice(idx, 1);
                                                        updateConfig({
                                                            subscription: {
                                                                ...planData.config?.subscription,
                                                                customIntervals,
                                                            },
                                                        });
                                                    }}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="mr-2 size-4" />
                                                    Remove Interval
                                                </Button>
                                            </div>
                                        )
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {planData.type === PaymentPlans.UPFRONT && (
                        <Card>
                            <CardHeader>
                                <CardTitle>One-Time Payment Configuration</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <Label>
                                        Full Price ({getCurrencySymbol(planData.currency)}) *
                                    </Label>
                                    <Input
                                        type="number"
                                        value={planData.config?.upfront?.fullPrice || ''}
                                        onChange={(e) =>
                                            updateConfig({
                                                upfront: {
                                                    ...planData.config?.upfront,
                                                    fullPrice: e.target.value,
                                                },
                                            })
                                        }
                                        className="mt-1"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {planData.type === PaymentPlans.DONATION && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Donation Configuration</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>
                                        Suggested Amounts ({getCurrencySymbol(planData.currency)})
                                    </Label>
                                    <Input
                                        value={planData.config?.donation?.suggestedAmounts || ''}
                                        onChange={(e) =>
                                            updateConfig({
                                                donation: {
                                                    ...planData.config?.donation,
                                                    suggestedAmounts: e.target.value,
                                                },
                                            })
                                        }
                                        className="mt-1"
                                        placeholder="10, 25, 50, 100"
                                    />
                                </div>
                                <div>
                                    <Label>
                                        Minimum Amount ({getCurrencySymbol(planData.currency)})
                                    </Label>
                                    <Input
                                        type="number"
                                        value={planData.config?.donation?.minimumAmount || '0'}
                                        onChange={(e) =>
                                            updateConfig({
                                                donation: {
                                                    ...planData.config?.donation,
                                                    minimumAmount: e.target.value,
                                                },
                                            })
                                        }
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={
                                            planData.config?.donation?.allowCustomAmount !== false
                                        }
                                        onCheckedChange={(checked) =>
                                            updateConfig({
                                                donation: {
                                                    ...planData.config?.donation,
                                                    allowCustomAmount: checked,
                                                },
                                            })
                                        }
                                    />
                                    <Label>Allow custom amounts</Label>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Step 3: Plan Discounts */}
            {currentStep === 3 && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Apply Discounts to Plan</CardTitle>
                            <p className="text-sm text-gray-600">
                                Set discounts for each plan interval or price tier
                            </p>
                        </CardHeader>
                        <CardContent>
                            {planData.type === PaymentPlans.SUBSCRIPTION &&
                            planData.config?.subscription?.customIntervals ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse border border-gray-200">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Subscription Interval
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Original Price
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Discount Type
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Discount Amount
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Final Price
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {planData.config.subscription.customIntervals.map(
                                                (interval: CustomInterval, idx: number) => {
                                                    const originalPrice = parseFloat(
                                                        String(interval.price || '0')
                                                    );
                                                    const discountType =
                                                        planData.config?.planDiscounts?.[
                                                            `interval_${idx}`
                                                        ]?.type || 'none';
                                                    const discountAmount =
                                                        planData.config?.planDiscounts?.[
                                                            `interval_${idx}`
                                                        ]?.amount || '';

                                                    let finalPrice = originalPrice;
                                                    if (
                                                        discountType === 'percentage' &&
                                                        discountAmount
                                                    ) {
                                                        finalPrice =
                                                            originalPrice *
                                                            (1 - parseFloat(discountAmount) / 100);
                                                    } else if (
                                                        discountType === 'fixed' &&
                                                        discountAmount
                                                    ) {
                                                        finalPrice = Math.max(
                                                            0,
                                                            originalPrice -
                                                                parseFloat(discountAmount)
                                                        );
                                                    }

                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="border border-gray-200 px-4 py-2">
                                                                <span className="font-medium">
                                                                    {interval.title ||
                                                                        `${interval.value} ${interval.unit} Plan`}
                                                                </span>
                                                            </td>
                                                            <td className="border border-gray-200 px-4 py-2">
                                                                <span className="font-medium">
                                                                    {getCurrencySymbol(
                                                                        planData.currency
                                                                    )}
                                                                    {originalPrice.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="border border-gray-200 px-4 py-2">
                                                                <Select
                                                                    value={discountType}
                                                                    onValueChange={(value) => {
                                                                        const planDiscounts = {
                                                                            ...planData.config
                                                                                ?.planDiscounts,
                                                                            [`interval_${idx}`]: {
                                                                                type: value,
                                                                                amount:
                                                                                    value === 'none'
                                                                                        ? ''
                                                                                        : discountAmount,
                                                                            },
                                                                        };
                                                                        updateConfig({
                                                                            planDiscounts,
                                                                        });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-32">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="none">
                                                                            No Discount
                                                                        </SelectItem>
                                                                        <SelectItem value="percentage">
                                                                            % Off
                                                                        </SelectItem>
                                                                        <SelectItem value="fixed">
                                                                            Flat Off
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                            <td className="border border-gray-200 px-4 py-2">
                                                                {discountType !== 'none' ? (
                                                                    <div className="flex items-center space-x-2">
                                                                        {discountType ===
                                                                            'fixed' && (
                                                                            <span className="text-sm">
                                                                                {getCurrencySymbol(
                                                                                    planData.currency
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            max={
                                                                                discountType ===
                                                                                'percentage'
                                                                                    ? 100
                                                                                    : originalPrice
                                                                            }
                                                                            placeholder={
                                                                                discountType ===
                                                                                'percentage'
                                                                                    ? '10'
                                                                                    : '50'
                                                                            }
                                                                            value={discountAmount}
                                                                            onChange={(e) => {
                                                                                const planDiscounts =
                                                                                    {
                                                                                        ...planData
                                                                                            .config
                                                                                            ?.planDiscounts,
                                                                                        [`interval_${idx}`]:
                                                                                            {
                                                                                                type: discountType,
                                                                                                amount: e
                                                                                                    .target
                                                                                                    .value,
                                                                                            },
                                                                                    };
                                                                                updateConfig({
                                                                                    planDiscounts,
                                                                                });
                                                                            }}
                                                                            className="w-20"
                                                                        />
                                                                        {discountType ===
                                                                            'percentage' && (
                                                                            <span className="text-sm">
                                                                                %
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        -
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="border border-gray-200 px-4 py-2">
                                                                <span
                                                                    className={`font-medium ${finalPrice < originalPrice ? 'text-green-600' : 'text-gray-900'}`}
                                                                >
                                                                    {getCurrencySymbol(
                                                                        planData.currency
                                                                    )}
                                                                    {finalPrice.toLocaleString()}
                                                                </span>
                                                                {finalPrice < originalPrice && (
                                                                    <div className="text-xs text-gray-500">
                                                                        Save{' '}
                                                                        {getCurrencySymbol(
                                                                            planData.currency
                                                                        )}
                                                                        {(
                                                                            originalPrice -
                                                                            finalPrice
                                                                        ).toLocaleString()}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : planData.type === PaymentPlans.UPFRONT ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse border border-gray-200">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Plan Type
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Original Price
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Discount Type
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Discount Amount
                                                </th>
                                                <th className="border border-gray-200 px-4 py-2 text-left font-medium">
                                                    Final Price
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-gray-50">
                                                <td className="border border-gray-200 px-4 py-2">
                                                    <span className="font-medium">
                                                        One-Time Payment
                                                    </span>
                                                </td>
                                                <td className="border border-gray-200 px-4 py-2">
                                                    <span className="font-medium">
                                                        {getCurrencySymbol(planData.currency)}
                                                        {parseFloat(
                                                            planData.config?.upfront?.fullPrice ||
                                                                '0'
                                                        ).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="border border-gray-200 px-4 py-2">
                                                    <Select
                                                        value={
                                                            planData.config?.planDiscounts?.upfront
                                                                ?.type || 'none'
                                                        }
                                                        onValueChange={(value) => {
                                                            const planDiscounts = {
                                                                ...planData.config?.planDiscounts,
                                                                upfront: {
                                                                    type: value,
                                                                    amount:
                                                                        value === 'none'
                                                                            ? ''
                                                                            : planData.config
                                                                                  ?.planDiscounts
                                                                                  ?.upfront
                                                                                  ?.amount || '',
                                                                },
                                                            };
                                                            updateConfig({ planDiscounts });
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">
                                                                No Discount
                                                            </SelectItem>
                                                            <SelectItem value="percentage">
                                                                % Off
                                                            </SelectItem>
                                                            <SelectItem value="fixed">
                                                                Flat Off
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="border border-gray-200 px-4 py-2">
                                                    {planData.config?.planDiscounts?.upfront
                                                        ?.type !== 'none' ? (
                                                        <div className="flex items-center space-x-2">
                                                            {planData.config?.planDiscounts?.upfront
                                                                ?.type === 'fixed' && (
                                                                <span className="text-sm">
                                                                    {getCurrencySymbol(
                                                                        planData.currency
                                                                    )}
                                                                </span>
                                                            )}
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                max={
                                                                    planData.config?.planDiscounts
                                                                        ?.upfront?.type ===
                                                                    'percentage'
                                                                        ? 100
                                                                        : parseFloat(
                                                                              planData.config
                                                                                  ?.upfront
                                                                                  ?.fullPrice || '0'
                                                                          )
                                                                }
                                                                placeholder={
                                                                    planData.config?.planDiscounts
                                                                        ?.upfront?.type ===
                                                                    'percentage'
                                                                        ? '10'
                                                                        : '50'
                                                                }
                                                                value={
                                                                    planData.config?.planDiscounts
                                                                        ?.upfront?.amount || ''
                                                                }
                                                                onChange={(e) => {
                                                                    const planDiscounts = {
                                                                        ...planData.config
                                                                            ?.planDiscounts,
                                                                        upfront: {
                                                                            type:
                                                                                planData.config
                                                                                    ?.planDiscounts
                                                                                    ?.upfront
                                                                                    ?.type ||
                                                                                'percentage',
                                                                            amount: e.target.value,
                                                                        },
                                                                    };
                                                                    updateConfig({
                                                                        planDiscounts,
                                                                    });
                                                                }}
                                                                className="w-20"
                                                            />
                                                            {planData.config?.planDiscounts?.upfront
                                                                ?.type === 'percentage' && (
                                                                <span className="text-sm">%</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="border border-gray-200 px-4 py-2">
                                                    {(() => {
                                                        const originalPrice = parseFloat(
                                                            planData.config?.upfront?.fullPrice ||
                                                                '0'
                                                        );
                                                        const discountType =
                                                            planData.config?.planDiscounts?.upfront
                                                                ?.type || 'none';
                                                        const discountAmount =
                                                            planData.config?.planDiscounts?.upfront
                                                                ?.amount || '';

                                                        let finalPrice = originalPrice;
                                                        if (
                                                            discountType === 'percentage' &&
                                                            discountAmount
                                                        ) {
                                                            finalPrice =
                                                                originalPrice *
                                                                (1 -
                                                                    parseFloat(discountAmount) /
                                                                        100);
                                                        } else if (
                                                            discountType === 'fixed' &&
                                                            discountAmount
                                                        ) {
                                                            finalPrice = Math.max(
                                                                0,
                                                                originalPrice -
                                                                    parseFloat(discountAmount)
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                <span
                                                                    className={`font-medium ${finalPrice < originalPrice ? 'text-green-600' : 'text-gray-900'}`}
                                                                >
                                                                    {getCurrencySymbol(
                                                                        planData.currency
                                                                    )}
                                                                    {finalPrice.toLocaleString()}
                                                                </span>
                                                                {finalPrice < originalPrice && (
                                                                    <div className="text-xs text-gray-500">
                                                                        Save{' '}
                                                                        {getCurrencySymbol(
                                                                            planData.currency
                                                                        )}
                                                                        {(
                                                                            originalPrice -
                                                                            finalPrice
                                                                        ).toLocaleString()}
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Alert>
                                    <Info className="size-4" />
                                    <AlertDescription>
                                        No pricing information available for this plan type.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between border-t pt-4">
                <div>
                    {currentStep > 1 && (
                        <Button variant="outline" onClick={handleBack}>
                            Back
                        </Button>
                    )}
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" onClick={onCancel} disabled={isSaving}>
                        Cancel
                    </Button>
                    {currentStep < getTotalSteps() ||
                    (currentStep === 2 &&
                        (planData.type === PaymentPlans.FREE ||
                            planData.type === PaymentPlans.DONATION)) ? (
                        <Button
                            onClick={handleNext}
                            disabled={
                                (currentStep === 1 && (!planData.name || !planData.type)) ||
                                (currentStep === 2 &&
                                    planData.type === PaymentPlans.FREE &&
                                    (!planData.config?.free?.validityDays ||
                                        planData.config.free.validityDays <= 0)) ||
                                isSaving
                            }
                            className="bg-primary-400 text-white hover:bg-primary-500"
                        >
                            {isSaving ? (
                                <>
                                    <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-white"></div>
                                    Saving...
                                </>
                            ) : (planData.type === PaymentPlans.FREE && currentStep === 2) ||
                              (planData.type === PaymentPlans.DONATION && currentStep === 2) ? (
                                'Update Plan'
                            ) : (
                                'Next'
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSave}
                            className="bg-primary-400 text-white hover:bg-primary-500"
                            disabled={!planData.name || !planData.type || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-white"></div>
                                    Saving...
                                </>
                            ) : (
                                'Update Payment Plan'
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
