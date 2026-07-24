import { savePaymentOption, transformLocalPlanToApiFormatArray } from '@/services/payment-options';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { PaymentPlan, PaymentPlans } from '@/types/payment';
import { InviteLinkFormValues } from './GenerateInviteLinkSchema';
import { UseFormReturn } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { PaymentPlanCreator } from '@/routes/settings/-components/Payment/PaymentPlanCreator';
import { useQueryClient } from '@tanstack/react-query';
import { buildCreateCPOPayload } from '@/routes/financial-management/fee-plans/-components/CreateCPODialog';
import { useCreateCPO } from '@/routes/financial-management/fee-plans/-services/cpo-service';

interface PaymentPlansDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const AddPaymentPlanDialog = ({ form }: PaymentPlansDialogProps) => {
    const queryClient = useQueryClient();
    const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null);
    const [showPaymentPlanCreator, setShowPaymentPlanCreator] = useState(
        form.watch('showAddPlanDialog')
    );
    const [featuresGlobal, setFeaturesGlobal] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [requireApproval, setRequireApproval] = useState(false);
    const instituteId = getInstituteId();
    const createCPOMutation = useCreateCPO();

    const handleError = (error: unknown, operation: string) => {
        console.error(`Error in ${operation}:`, error);
        toast.error(`Error in ${operation}`);
    };

    const handleClosePaymentPlanCreator = () => {
        form.setValue('showAddPlanDialog', false);
        setShowPaymentPlanCreator(false);
        setEditingPlan(null);
        setRequireApproval(false);
    };

    const handleSavePaymentPlan = async (plan: PaymentPlan) => {
        setIsSaving(true);
        try {
            // CPO plans are created via the dedicated CREATE_CPO endpoint (which also mints the
            // mirror payment_option). Sending them through savePaymentOption would drop the fee
            // structure. The approval toggle is carried inside cpoForm → require_approval.
            if (plan.type === PaymentPlans.CPO) {
                const cpoForm = plan.config?.cpoForm;
                if (!cpoForm) throw new Error('Missing CPO form data');
                const payload = buildCreateCPOPayload(
                    { ...cpoForm, requireApproval: requireApproval || !!cpoForm.requireApproval },
                    []
                );
                await createCPOMutation.mutateAsync(payload);
                // Refetch the invite's payment-option list so the new CPO mirror appears and
                // can be selected for this invite.
                await queryClient.invalidateQueries({ queryKey: ['GET_PAYMENT_DETAILS'] });
                toast.success('Fee plan created — select it from the plans list');
                form.setValue('showAddPlanDialog', false);
                setEditingPlan(null);
                setShowPaymentPlanCreator(false);
                setRequireApproval(false);
                return;
            }

            const apiPlans = transformLocalPlanToApiFormatArray(plan);
            const paymentOptionRequest = {
                id: plan.id, // Use the plan ID directly (either existing or new)
                name: plan.name,
                status: 'ACTIVE',
                source: 'INSTITUTE',
                source_id: instituteId ?? '',
                type: plan.type,
                require_approval: requireApproval,
                payment_plans: apiPlans,
                payment_option_metadata_json: JSON.stringify({
                    currency: plan.currency,
                    features: plan.features || [],
                    config: plan.config,
                    subscriptionData:
                        plan.type === 'SUBSCRIPTION'
                            ? {
                                  customIntervals: plan.config?.subscription?.customIntervals || [],
                                  planDiscounts: plan.config?.planDiscounts || {},
                              }
                            : undefined,
                    upfrontData:
                        plan.type === 'ONE_TIME'
                            ? {
                                  fullPrice: plan.config?.upfront?.fullPrice,
                                  planDiscounts: plan.config?.planDiscounts || {},
                              }
                            : undefined,
                    donationData:
                        plan.type === 'DONATION'
                            ? {
                                  suggestedAmounts: plan.config?.donation?.suggestedAmounts,
                                  minimumAmount: plan.config?.donation?.minimumAmount,
                                  allowCustomAmount: plan.config?.donation?.allowCustomAmount,
                              }
                            : undefined,
                    freeData:
                        plan.type === 'FREE'
                            ? {
                                  validityDays: plan.config?.free?.validityDays,
                              }
                            : undefined,
                }),
            };

            await savePaymentOption(paymentOptionRequest);
            if (plan.type === 'FREE') {
                const freePlans = form.getValues('freePlans');
                form.setValue('freePlans', [...freePlans, paymentOptionRequest]);
            } else {
                const paidPlans = form.getValues('paidPlans');
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                form.setValue('paidPlans', [...paidPlans, paymentOptionRequest]);
            }
            form.setValue('showAddPlanDialog', false);
            setEditingPlan(null);
            setShowPaymentPlanCreator(false);
            setRequireApproval(false);
            queryClient.invalidateQueries({ queryKey: ['GET_PAYMENT_DETAILS'] });
        } catch (error) {
            handleError(error, 'save payment plan');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        setShowPaymentPlanCreator(form.watch('showAddPlanDialog'));
    }, [form.watch('showAddPlanDialog')]);

    return (
        <>
            <PaymentPlanCreator
                key={editingPlan?.id}
                isOpen={showPaymentPlanCreator}
                onClose={handleClosePaymentPlanCreator}
                onSave={(plan) => handleSavePaymentPlan(plan)}
                editingPlan={editingPlan}
                featuresGlobal={featuresGlobal}
                setFeaturesGlobal={setFeaturesGlobal}
                defaultCurrency={'GBP'}
                isSaving={isSaving}
                requireApproval={requireApproval}
                setRequireApproval={setRequireApproval}
            />
        </>
    );
};

export default AddPaymentPlanDialog;
