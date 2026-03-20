import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Globe, Plus } from '@phosphor-icons/react';
import { useState, useEffect, useRef } from 'react';
import { PaymentPlanList } from './PaymentPlanList';
import { MyButton } from '@/components/design-system/button';
import { SubscriptionPlanPreview } from './SubscriptionPlanPreview';
import { DonationPlanPreview } from './DonationPlanPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Loader2 } from 'lucide-react';
import {
    savePaymentOption,
    getPaymentOptions,
    transformApiPlanToLocalFormat,
    makeDefaultPaymentOption,
    transformLocalPlanToApiFormatArray,
} from '@/services/payment-options';
import { DeletePaymentOptionDialog } from './DeletePaymentOptionDialog';
import { toast } from 'sonner';
import { currencyOptions } from '../../-constants/payments';
import { getInstituteId } from '@/constants/helper';
import { PaymentPlan, PaymentPlans, PaymentPlanTag, PaymentPlanType } from '@/types/payment';
import { PaymentPlanCreator } from './PaymentPlanCreator/index';
import { getCurrencySymbol } from './utils/utils';
import { DAYS_IN_MONTH } from '../../-constants/terms';

interface Interval {
    price: string;
    originalPrice: string;
    title?: string;
    value: number;
    unit: string;
    features?: string[];
}

interface DiscountCoupon {
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
}

const PaymentSettings = () => {
    const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null);
    const [currency, setCurrency] = useState<string>('GBP');
    const [showPaymentPlanCreator, setShowPaymentPlanCreator] = useState(false);
    const [showPlanPreview, setShowPlanPreview] = useState(false);
    const [previewingPlan, setPreviewingPlan] = useState<PaymentPlan | null>(null);
    const [featuresGlobal, setFeaturesGlobal] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<PaymentPlan | null>(null);
    const previewDialogRef = useRef<HTMLDivElement>(null);
    const [requireApproval, setRequireApproval] = useState(false);

    const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
    const instituteId = getInstituteId();

    // Helper functions for plan transformations
    const transformIntervalsToSubscriptionPlans = (intervals: Interval[] = []) => {
        return intervals.reduce(
            (acc, interval, idx) => ({
                ...acc,
                [`custom${idx}`]: {
                    enabled: true,
                    price: interval.originalPrice || '0',
                    interval: 'custom',
                    title: interval.title || `${interval.value} ${interval.unit} Plan`,
                    features: interval.features || [],
                    customInterval: {
                        value: interval.value,
                        unit: interval.unit,
                    },
                    originalPrice: interval.price || '0',
                },
            }),
            {}
        );
    };

    const getAllFeatures = (plan: PaymentPlan): string[] => {
        const planFeatures = plan.features || [];
        const globalFeatures = featuresGlobal || [];
        const intervalFeatures =
            plan.config?.subscription?.customIntervals?.flatMap(
                (interval: Interval) => interval.features || []
            ) || [];

        return [...new Set([...planFeatures, ...globalFeatures, ...intervalFeatures])];
    };

    const createDiscountCoupons = (plan: PaymentPlan): DiscountCoupon[] => {
        const planDiscounts = plan.config?.planDiscounts || {};
        const intervals = plan.config?.subscription?.customIntervals || [];
        const currencySymbol = getCurrencySymbol(plan.currency);

        return intervals
            .map((interval: Interval, idx: number) => {
                const discount = planDiscounts[`interval_${idx}`];
                if (!discount || discount.type === 'none' || !discount.amount) return null;

                return {
                    id: `plan-discount-${idx}`,
                    code: `${discount.type === 'percentage' ? 'PERCENT' : 'FLAT'}_${discount.amount}_${idx}`,
                    name: `${discount.type === 'percentage' ? `${discount.amount}% Off` : `${currencySymbol}${discount.amount} Off`} - ${interval.title || `${interval.value} ${interval.unit} Plan`}`,
                    type: discount.type,
                    value: parseFloat(discount.amount),
                    currency: plan.currency,
                    isActive: true,
                    usageLimit: undefined,
                    usedCount: 0,
                    expiryDate: undefined,
                    applicablePlans: [`custom${idx}`],
                };
            })
            .filter(Boolean) as DiscountCoupon[];
    };

    // Load payment options from API
    const loadPaymentOptions = async () => {
        setIsLoading(true);
        try {
            const request = {
                types: [
                    PaymentPlans.SUBSCRIPTION,
                    PaymentPlans.UPFRONT,
                    PaymentPlans.DONATION,
                    PaymentPlans.FREE,
                ],
                source: 'INSTITUTE',
                source_id: instituteId ?? '',
                require_approval: true,
                not_require_approval: true,
            };

            const response = await getPaymentOptions(request);
            const transformedPlans =
                response
                    ?.map((paymentOption) => {
                        if (paymentOption.type === PaymentPlans.SUBSCRIPTION) {
                            // Aggregate all intervals
                            const intervals = paymentOption.payment_plans.map((plan) => ({
                                price: plan.actual_price, // discounted price
                                originalPrice: plan.elevated_price, // original price
                                title: plan.name || '',
                                value: plan.validity_in_days,
                                unit: 'days', // or 'months', depending on your logic
                                features: JSON.parse(plan.feature_json || '[]'),
                            }));
                            // Use the first plan for other fields
                            const basePlan = paymentOption.payment_plans[0];
                            if (!basePlan)
                                return {
                                    id: paymentOption.id || '',
                                    tag: paymentOption.tag as PaymentPlanTag,
                                    type: paymentOption.type as PaymentPlanType,
                                    name: paymentOption.name || '',
                                    config: {
                                        subscription: {
                                            customIntervals: [],
                                        },
                                        free: {
                                            validityDays: 320,
                                        },
                                    },
                                };

                            const localPlan = transformApiPlanToLocalFormat({
                                ...basePlan,
                                name: basePlan.name || '',
                                currency: basePlan.currency || '',
                                feature_json: basePlan.feature_json || '[]',
                                payment_option_metadata_json:
                                    paymentOption.payment_option_metadata_json,
                                type: paymentOption.type,
                            });
                            // Set all intervals in config
                            return {
                                ...localPlan,
                                id: paymentOption.id || '',
                                tag: paymentOption.tag as PaymentPlanTag,
                                type: localPlan.type as PaymentPlanType,
                                name: paymentOption.name || '',
                                currency: localPlan.currency || '',
                                config: {
                                    ...localPlan.config,
                                    subscription: {
                                        ...((localPlan.config && localPlan.config.subscription) ||
                                            {}),
                                        customIntervals: intervals,
                                    },
                                },
                                requireApproval: paymentOption.require_approval,
                            } as PaymentPlan;
                        } else if (paymentOption.type === PaymentPlans.FREE) {
                            // For FREE plans, we can create a plan even without payment_plans
                            const metadata = paymentOption.payment_option_metadata_json
                                ? JSON.parse(paymentOption.payment_option_metadata_json)
                                : {};

                            return {
                                id: paymentOption.id || '',
                                tag: paymentOption.tag as PaymentPlanTag,
                                type: PaymentPlans.FREE as PaymentPlanType,
                                name: paymentOption.name || '',
                                currency: metadata.currency || 'GBP',
                                features: metadata.features || [],
                                config: {
                                    ...metadata.config,
                                    free: {
                                        validityDays:
                                            metadata.freeData?.validityDays || DAYS_IN_MONTH,
                                    },
                                },
                                isDefault: false,
                                requireApproval: paymentOption.require_approval,
                            } as PaymentPlan;
                        } else if (paymentOption.payment_plans?.length > 0) {
                            // For other non-subscription plans, just use the first plan
                            const plan = paymentOption.payment_plans[0];
                            if (!plan) return null;
                            const localPlan = transformApiPlanToLocalFormat({
                                ...plan,
                                name: paymentOption.name || '',
                                currency: plan.currency || '',
                                feature_json: plan.feature_json || '[]',
                                payment_option_metadata_json:
                                    paymentOption.payment_option_metadata_json,
                                type: paymentOption.type,
                            });
                            return {
                                ...localPlan,
                                id: paymentOption.id || '',
                                tag: paymentOption.tag as PaymentPlanTag,
                                type: localPlan.type as PaymentPlanType,
                                name: paymentOption.name || '',
                                currency: localPlan.currency || '',
                                requireApproval: paymentOption.require_approval,
                            } as PaymentPlan;
                        }
                        return null;
                    })
                    .filter((plan): plan is PaymentPlan => plan !== null) || [];

            setPaymentPlans(
                transformedPlans.map((plan) => ({
                    ...plan,
                    id: plan.id || '',
                    isDefault: !!plan.isDefault,
                    config: plan.config || {},
                    tag: plan.tag as PaymentPlanTag,
                    type: plan.type as PaymentPlanType,
                    name: plan.name || '',
                    currency: plan.currency || '',
                }))
            );

            if (transformedPlans.length === 0) {
                toast.info('No payment options found. Create your first payment plan!');
            }
        } catch (error) {
            console.error('Error loading payment options:', error);
            toast.error('Failed to load payment options');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPaymentOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleError = (error: unknown, operation: string) => {
        console.error(`Error in ${operation}:`, error);
        toast.error(`Error in ${operation}`);
    };

    const handleSetDefaultPlan = async (planId: string) => {
        try {
            // Find the plan and get its paymentOptionId (assuming plan.id is paymentOptionId)
            const paymentOptionId = planId;
            await makeDefaultPaymentOption({
                source: 'INSTITUTE',
                sourceId: instituteId ?? '',
                paymentOptionId,
            });
            await loadPaymentOptions(); // Refresh the list from the API
            toast.success('Default payment plan updated successfully');
        } catch (error) {
            handleError(error, 'set default plan');
        }
    };

    const handleDeletePlan = (planId: string) => {
        const planToDelete = paymentPlans.find((plan) => plan.id === planId);
        if (planToDelete) {
            setPlanToDelete(planToDelete);
            setShowDeleteDialog(true);
        }
    };

    const handleDeleteConfirmed = () => {
        if (planToDelete?.id) {
            setPaymentPlans((plans) => plans.filter((plan) => plan.id !== planToDelete.id));
        }
        setShowDeleteDialog(false);
        setPlanToDelete(null);
    };

    const handleEditPlan = (plan: PaymentPlan) => {
        try {
            // Clear any previous editing state and set the new plan to edit
            setEditingPlan(plan);
            setShowPaymentPlanCreator(true);
        } catch (error) {
            handleError(error, 'edit plan');
        }
    };

    const handleClosePaymentPlanCreator = () => {
        setShowPaymentPlanCreator(false);
        setEditingPlan(null);
        setRequireApproval(false);
    };

    // Helper function to calculate discounted prices for intervals
    const calculateDiscountedIntervals = (plan: PaymentPlan) => {
        if (
            plan.type !== PaymentPlans.SUBSCRIPTION ||
            !plan.config?.subscription?.customIntervals
        ) {
            return plan.config?.subscription?.customIntervals || [];
        }

        const planDiscounts = plan.config?.planDiscounts || {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return plan.config.subscription.customIntervals.map((interval: any, idx: number) => {
            const originalPrice = parseFloat(String(interval.price || '0'));
            let discountedPrice = originalPrice;
            const discount = planDiscounts[`interval_${idx}`];

            if (discount && discount.type !== 'none' && discount.amount) {
                if (discount.type === 'percentage') {
                    discountedPrice = originalPrice * (1 - parseFloat(discount.amount) / 100);
                } else if (discount.type === 'fixed') {
                    discountedPrice = originalPrice - parseFloat(discount.amount);
                }
                if (discountedPrice < 0) discountedPrice = 0;
            }

            return {
                ...interval,
                price: discountedPrice, // Use discounted price instead of original
            };
        });
    };

    const handleSavePaymentPlan = async (plan: PaymentPlan) => {
        setIsSaving(true);
        try {
            const apiPlans = transformLocalPlanToApiFormatArray(plan);
            const discountedIntervals = calculateDiscountedIntervals(plan);

            const paymentOptionRequest = {
                id: editingPlan?.id || undefined,
                name: plan.name,
                status: 'ACTIVE',
                source: 'INSTITUTE',
                source_id: instituteId ?? '',
                type: plan.type.toUpperCase(),
                require_approval: requireApproval,
                payment_plans: apiPlans,
                payment_option_metadata_json: JSON.stringify({
                    currency: plan.currency,
                    features: plan.features || [],
                    unit: plan.config?.subscription?.customIntervals?.[0]?.unit || 'months',
                    config:
                        plan.type === PaymentPlans.SUBSCRIPTION
                            ? {
                                  ...plan.config,
                                  subscription: {
                                      ...plan.config?.subscription,
                                      customIntervals: discountedIntervals,
                                  },
                              }
                            : plan.config,
                    subscriptionData:
                        plan.type === PaymentPlans.SUBSCRIPTION
                            ? {
                                  customIntervals: discountedIntervals,
                                  planDiscounts: plan.config?.planDiscounts || {},
                              }
                            : undefined,
                    upfrontData:
                        plan.type === PaymentPlans.UPFRONT
                            ? {
                                  fullPrice: plan.config?.upfront?.fullPrice,
                                  planDiscounts: plan.config?.planDiscounts || {},
                              }
                            : undefined,
                    donationData:
                        plan.type === PaymentPlans.DONATION
                            ? {
                                  suggestedAmounts: plan.config?.donation?.suggestedAmounts,
                                  minimumAmount: plan.config?.donation?.minimumAmount,
                                  allowCustomAmount: plan.config?.donation?.allowCustomAmount,
                              }
                            : undefined,
                    freeData:
                        plan.type === PaymentPlans.FREE
                            ? {
                                  validityDays: plan.config?.free?.validityDays,
                              }
                            : undefined,
                }),
            };

            const savedPaymentOption = await savePaymentOption(paymentOptionRequest);

            if (editingPlan) {
                // Update existing plan in the list
                setPaymentPlans((plans) => plans.map((p) => (p.id === editingPlan.id ? plan : p)));
                toast.success('Payment plan updated successfully');
            } else {
                // Add new plan to the list
                const savedPlan = savedPaymentOption?.payment_plans?.[0];
                if (savedPlan) {
                    const transformedPlan = transformApiPlanToLocalFormat(savedPlan);
                    setPaymentPlans((plans) => [
                        ...plans,
                        {
                            ...transformedPlan,
                            tag:
                                transformedPlan.type === PaymentPlans.FREE
                                    ? 'free'
                                    : transformedPlan.type === PaymentPlans.DONATION
                                      ? 'donation'
                                      : 'default',
                        } as PaymentPlan,
                    ]);
                } else {
                    setPaymentPlans((plans) => [...plans, plan]);
                }
                toast.success('Payment plan created successfully');
                // Refresh the list from the API after creating a new plan
                await loadPaymentOptions();
            }

            setEditingPlan(null);
            setShowPaymentPlanCreator(false);
            setRequireApproval(false);
            // Clear features after successfully creating/updating a plan
            setFeaturesGlobal([]);
        } catch (error) {
            handleError(error, 'save payment plan');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePreviewPlan = (plan: PaymentPlan) => {
        try {
            setPreviewingPlan(plan);
            setShowPlanPreview(true);
            setTimeout(() => {
                if (previewDialogRef.current) {
                    previewDialogRef.current.scrollTo({
                        top: 0,
                        behavior: 'smooth',
                    });
                }
            }, 100);
        } catch (error) {
            handleError(error, 'preview plan');
        }
    };

    // Filtering: use only type, never tag
    const getFreePlans = () =>
        paymentPlans.filter(
            (plan) => plan.type === PaymentPlans.FREE || plan.type === PaymentPlans.DONATION
        );
    const getPaidPlans = () =>
        paymentPlans.filter(
            (plan) => plan.type === PaymentPlans.SUBSCRIPTION || plan.type === PaymentPlans.UPFRONT
        );

    const renderPlanPreview = () => {
        if (!previewingPlan) return null;

        if (previewingPlan.type === PaymentPlans.SUBSCRIPTION) {
            return (
                <SubscriptionPlanPreview
                    currency={previewingPlan.currency}
                    subscriptionPlans={transformIntervalsToSubscriptionPlans(
                        previewingPlan.config?.subscription?.customIntervals
                    )}
                    features={getAllFeatures(previewingPlan)}
                    discountCoupons={createDiscountCoupons(previewingPlan)}
                />
            );
        }

        if (previewingPlan.type === PaymentPlans.DONATION) {
            return (
                <DonationPlanPreview
                    currency={previewingPlan.currency}
                    suggestedAmounts={previewingPlan.config?.donation?.suggestedAmounts || ''}
                    minimumAmount={previewingPlan.config?.donation?.minimumAmount || '0'}
                    allowCustomAmount={previewingPlan.config?.donation?.allowCustomAmount !== false}
                    onSelectAmount={(amount) => console.log('Selected donation amount:', amount)}
                />
            );
        }

        return null;
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="size-5" />
                            Payment Configuration
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <MyButton
                                onClick={() => setShowPaymentPlanCreator(true)}
                                className="flex items-center gap-2"
                                disabled={isLoading || isSaving}
                            >
                                <Plus className="size-4" />
                                Add Payment Plan
                            </MyButton>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Default Currency</Label>
                            <Select value={currency} onValueChange={(value) => setCurrency(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
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
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900">
                                <Globe className="size-5 text-green-600" />
                                Free Options
                            </h3>
                            <Badge variant="outline" className="border-green-200 text-green-600">
                                {getFreePlans().length} plans
                            </Badge>
                        </div>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="size-8 animate-spin text-primary-400" />
                            </div>
                        ) : (
                            <PaymentPlanList
                                plans={getFreePlans()}
                                onEdit={handleEditPlan}
                                onDelete={handleDeletePlan}
                                onSetDefault={handleSetDefaultPlan}
                                onPreview={handlePreviewPlan}
                            />
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900">
                                <CreditCard className="size-5 text-blue-600" />
                                Paid Options
                            </h3>
                            <Badge variant="outline" className="border-blue-200 text-blue-600">
                                {getPaidPlans().length} plans
                            </Badge>
                        </div>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="size-8 animate-spin text-primary-400" />
                            </div>
                        ) : (
                            <PaymentPlanList
                                plans={getPaidPlans()}
                                onEdit={handleEditPlan}
                                onDelete={handleDeletePlan}
                                onSetDefault={handleSetDefaultPlan}
                                onPreview={handlePreviewPlan}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            <PaymentPlanCreator
                key={editingPlan?.id}
                isOpen={showPaymentPlanCreator}
                onClose={handleClosePaymentPlanCreator}
                onSave={handleSavePaymentPlan}
                editingPlan={editingPlan}
                featuresGlobal={featuresGlobal}
                setFeaturesGlobal={setFeaturesGlobal}
                defaultCurrency={currency}
                isSaving={isSaving}
                existingFreePlans={getFreePlans().map((plan) => ({
                    id: plan.id,
                    requireApproval: plan.requireApproval || false,
                }))}
                requireApproval={requireApproval}
                setRequireApproval={setRequireApproval}
            />

            <Dialog open={showPlanPreview} onOpenChange={setShowPlanPreview}>
                <DialogContent
                    ref={previewDialogRef}
                    className="max-h-[90vh] min-w-fit overflow-y-auto"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="size-5" />
                            Plan Preview - {previewingPlan?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">{renderPlanPreview()}</div>
                </DialogContent>
            </Dialog>

            <DeletePaymentOptionDialog
                isOpen={showDeleteDialog}
                onClose={() => {
                    setShowDeleteDialog(false);
                    setPlanToDelete(null);
                }}
                paymentOption={planToDelete}
                allPaymentOptions={paymentPlans}
                onDeleted={handleDeleteConfirmed}
            />
        </>
    );
};

export default PaymentSettings;
