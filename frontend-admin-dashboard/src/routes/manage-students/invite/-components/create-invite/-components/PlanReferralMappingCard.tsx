import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { MyButton } from '@/components/design-system/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendUp, Gear, Plus, CheckCircle, Clock } from '@phosphor-icons/react';
import { getAllPlanIdsFromSelectedPlan, getPlanDisplayName } from '../-utils/helper';

interface PlanReferralMappingCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const PlanReferralMappingCard = ({ form }: PlanReferralMappingCardProps) => {
    const selectedPlan = form.watch('selectedPlan');
    const planReferralMappings = form.watch('planReferralMappings');
    const referralPrograms = form.watch('referralPrograms');

    // Get all plan IDs from the selected plan
    const planIds = getAllPlanIdsFromSelectedPlan(selectedPlan || null);

    // Helper function to get referral name by ID
    const getReferralNameById = (referralId: string) => {
        const referral = referralPrograms?.find((r) => r.id === referralId);
        return referral?.name || 'Unknown Referral';
    };

    // Helper function to check if all plans have referral configured
    const getConfigurationStatus = () => {
        const configuredCount = planIds.filter((planId) => planReferralMappings[planId]).length;
        return { configured: configuredCount, total: planIds.length };
    };

    const { configured, total } = getConfigurationStatus();

    // Function to apply same referral to all plans
    const handleApplyToAllPlans = () => {
        if (planIds.length === 0) return;

        // Find the first configured plan's referral or use default
        const firstConfiguredPlan = planIds.find((planId) => planReferralMappings[planId]);
        const referralIdToApply = firstConfiguredPlan
            ? planReferralMappings[firstConfiguredPlan]
            : referralPrograms?.[0]?.id || '';

        if (!referralIdToApply) return;

        // Apply the same referral to all plans
        const newMappings = { ...planReferralMappings };
        planIds.forEach((planId) => {
            newMappings[planId] = referralIdToApply;
        });

        form.setValue('planReferralMappings', newMappings);
    };

    return (
        <>
            <div className="flex flex-col">
                <div className="flex flex-col">
                    <span className="font-medium">Referral Settings</span>
                    <span className="text-sm">
                        Configure referral programs for each payment plan in your invite link
                    </span>
                </div>
            </div>

            <Card className="mb-4">
                <CardHeader className="-mb-5 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-2 text-lg font-semibold">
                            <TrendUp size={20} />
                            <span>Plan Referral Configuration</span>
                        </span>
                        <Badge
                            variant={configured === total && total > 0 ? 'default' : 'secondary'}
                            className="ml-2"
                        >
                            {configured}/{total} Configured
                        </Badge>
                    </div>
                    <div className="flex gap-2">
                        {planIds.length > 1 && (
                            <MyButton
                                type="button"
                                scale="small"
                                buttonType="secondary"
                                className="p-4"
                                onClick={handleApplyToAllPlans}
                                disable={planIds.length === 0}
                            >
                                Apply to all
                            </MyButton>
                        )}
                        <MyButton
                            type="button"
                            scale="small"
                            buttonType="secondary"
                            className="p-4"
                            onClick={() => form.setValue('showPlanReferralDialog', true)}
                            disable={!selectedPlan}
                        >
                            Configure Referrals
                        </MyButton>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {!selectedPlan ? (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            <div className="text-center">
                                <Gear size={32} className="mx-auto mb-2 opacity-50" />
                                <p>Please select a payment plan first</p>
                            </div>
                        </div>
                    ) : planIds.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            <div className="text-center">
                                <Gear size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No payment options available for configuration</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-gray-700">Payment Plans:</div>
                            {planIds.map((planId) => {
                                const planName = getPlanDisplayName(selectedPlan, planId);
                                const referralId = planReferralMappings[planId];
                                const isConfigured = !!referralId;

                                return (
                                    <div
                                        key={planId}
                                        className="flex items-center justify-between rounded-lg border p-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="shrink-0">
                                                {isConfigured ? (
                                                    <CheckCircle
                                                        size={20}
                                                        className="text-green-600"
                                                    />
                                                ) : (
                                                    <Clock size={20} className="text-gray-400" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium">{planName}</div>
                                                {isConfigured ? (
                                                    <div className="text-sm text-gray-600">
                                                        Referral: {getReferralNameById(referralId)}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-400">
                                                        No referral configured
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <MyButton
                                            type="button"
                                            scale="small"
                                            buttonType={isConfigured ? 'secondary' : 'primary'}
                                            className="p-2"
                                            onClick={() => {
                                                form.setValue('selectedPlanForReferral', planId);
                                                form.setValue('showPlanReferralDialog', true);
                                            }}
                                        >
                                            {isConfigured ? <Gear size={16} /> : <Plus size={16} />}
                                        </MyButton>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
};

export default PlanReferralMappingCard;
