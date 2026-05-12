import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
    DialogDescription as ShadDialogDescription,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Calendar, CreditCard, Globe, Receipt } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from './GenerateInviteLinkSchema';
import { useSuspenseQuery } from '@tanstack/react-query';
import { handleGetPaymentDetails } from './-services/get-payments';
import { useEffect, useMemo } from 'react';
import { getDefaultPlanFromPaymentsData, splitPlansByType } from './-utils/helper';
import { DollarSign } from 'lucide-react';
import { useCPOFullDetails } from '@/routes/financial-management/fee-plans/-services/cpo-service';
import type { CPOFeeType } from '@/routes/financial-management/fee-plans/-types/cpo-types';

interface PaymentPlansDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const currencySymbols: { [key: string]: string } = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
};

export const getCurrencySymbol = (currencyCode: string) => {
    return currencySymbols[currencyCode] || currencyCode;
};

export const getPaymentPlanIcon = (type: string) => {
    switch (type) {
        case 'subscription':
            return <Calendar className="size-5" />;
        case 'upfront':
            return <DollarSign className="size-5" />;
        case 'free':
            return <Globe className="size-5" />;
        case 'cpo':
            return <Receipt className="size-5" />;
        default:
            return <CreditCard className="size-5" />;
    }
};

const countCpoInstallments = (feeTypes: CPOFeeType[] | undefined): number => {
    if (!Array.isArray(feeTypes)) return 0;
    let count = 0;
    for (const ft of feeTypes) {
        const afv = ft.assigned_fee_value;
        if (!afv) continue;
        const installments = afv.installments ?? [];
        // Single-bill CPO (no installments configured) → counts as one row.
        count += installments.length === 0 ? 1 : installments.length;
    }
    return count;
};

interface CpoPlanCardProps {
    plan: {
        id: string;
        name: string;
        price?: string;
        currency?: string;
        cpoId?: string;
    };
    isSelected: boolean;
    onSelect: () => void;
}

const CpoPlanCard = ({ plan, isSelected, onSelect }: CpoPlanCardProps) => {
    const { data, isLoading } = useCPOFullDetails(plan.cpoId ?? null, !!plan.cpoId);
    const installmentCount = useMemo(() => countCpoInstallments(data?.fee_types), [data]);
    const currencySymbol = getCurrencySymbol(plan.currency || 'INR');

    return (
        <Card
            className={`cursor-pointer border-2 ${
                isSelected ? 'border-primary' : 'border-gray-200'
            } transition-all`}
            onClick={onSelect}
        >
            <div className="flex flex-col items-start gap-3 p-4">
                <div className="flex w-full items-center gap-3">
                    {getPaymentPlanIcon('cpo')}
                    <div className="flex flex-1 flex-col">
                        <span className="font-semibold">{plan.name}</span>
                    </div>
                    <Badge
                        variant="secondary"
                        className="bg-amber-100 text-[10px] font-semibold text-amber-800"
                    >
                        CPO
                    </Badge>
                    {isSelected && (
                        <Badge variant="default" className="ml-auto">
                            Default
                        </Badge>
                    )}
                </div>
                <div className="flex flex-col gap-1 pl-8 text-xs text-neutral-600">
                    <span>
                        Total Amount: {currencySymbol}
                        {plan.price || '—'}
                    </span>
                    <span>
                        Installments:{' '}
                        {isLoading ? (
                            <span className="text-neutral-400">loading…</span>
                        ) : installmentCount > 0 ? (
                            installmentCount
                        ) : (
                            '—'
                        )}
                    </span>
                    <span>Currency: {plan.currency || 'INR'}</span>
                </div>
            </div>
        </Card>
    );
};

export function PaymentPlansDialog({ form }: PaymentPlansDialogProps) {
    const { data: paymentsData } = useSuspenseQuery(handleGetPaymentDetails());

    useEffect(() => {
        form.reset({
            ...form.getValues(),
            freePlans: splitPlansByType(paymentsData).freePlans,
            paidPlans: splitPlansByType(paymentsData).paidPlans,
            selectedPlan: getDefaultPlanFromPaymentsData(paymentsData),
        });
    }, [paymentsData]);

    return (
        <ShadDialog
            open={form.watch('showPlansDialog')}
            onOpenChange={(open) => form.setValue('showPlansDialog', open)}
        >
            <ShadDialogContent className="flex h-[80vh] min-w-[60vw] max-w-lg flex-col overflow-auto">
                <ShadDialogHeader>
                    <ShadDialogTitle className="font-bold">Select a Payment Plan</ShadDialogTitle>
                    <ShadDialogDescription className="mt-1">
                        Choose a payment plan for this course
                    </ShadDialogDescription>
                </ShadDialogHeader>
                <div className="flex-1 overflow-auto">
                    <div className="mb-4">
                        <div className="mb-2 mt-4 font-semibold">Free Plans</div>
                        <div className="flex flex-col gap-4">
                            {form.getValues('freePlans')?.map((plan) => (
                                <Card
                                    key={plan.id}
                                    className={`cursor-pointer border-2 ${form.watch('selectedPlan')?.id === plan.id ? 'border-primary' : 'border-gray-200'} transition-all`}
                                    onClick={() => {
                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-expect-error
                                        form.setValue('selectedPlan', plan);
                                        form.setValue('showPlansDialog', false);
                                    }}
                                >
                                    <div className="flex flex-col items-start gap-3 p-4">
                                        <div className="flex items-center gap-3">
                                            {getPaymentPlanIcon(plan.type?.toLowerCase() || '')}
                                            <div className="flex flex-1 flex-col font-semibold">
                                                <span>{plan.name}</span>
                                            </div>
                                            {form.watch('selectedPlan')?.id === plan.id && (
                                                <Badge variant="default" className="ml-auto">
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
                                        {plan.type?.toLowerCase() === 'donation' ? (
                                            <div className="flex flex-col gap-2 pl-8 text-xs text-neutral-600">
                                                <span>
                                                    Suggested Amounts:{' '}
                                                    {getCurrencySymbol(plan.currency || '')}
                                                    {plan.suggestedAmount?.join(',')}
                                                </span>
                                                <span>
                                                    Minimum Amount:{' '}
                                                    {getCurrencySymbol(plan.currency || '')}
                                                    {plan.minAmount}
                                                </span>
                                                <span>Currency: {plan.currency}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 pl-8 text-xs text-neutral-600">
                                                <span>Free for {plan.days} days</span>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="mb-2 font-semibold">Paid Plans</div>
                        <div className="flex flex-col gap-4">
                            {form.getValues('paidPlans')?.map((plan) => {
                                if (plan.type?.toLowerCase() === 'cpo') {
                                    return (
                                        <CpoPlanCard
                                            key={plan.id}
                                            plan={plan}
                                            isSelected={form.watch('selectedPlan')?.id === plan.id}
                                            onSelect={() => {
                                                form.setValue('selectedPlan', plan);
                                                form.setValue('showPlansDialog', false);
                                            }}
                                        />
                                    );
                                }
                                return (
                                <Card
                                    key={plan.id}
                                    className={`cursor-pointer border-2 ${form.watch('selectedPlan')?.id === plan.id ? 'border-primary' : 'border-gray-200'} transition-all`}
                                    onClick={() => {
                                        form.setValue('selectedPlan', plan);
                                        form.setValue('showPlansDialog', false);
                                    }}
                                >
                                    <div className="flex flex-col items-start gap-3 p-4">
                                        <div className="flex items-center gap-3">
                                            {getPaymentPlanIcon(plan.type?.toLowerCase() || '')}
                                            <div className="flex flex-1 flex-col">
                                                <span>{plan.name}</span>
                                            </div>
                                            {form.watch('selectedPlan')?.id === plan.id && (
                                                <Badge variant="default" className="ml-auto">
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
                                        {plan.type?.toLowerCase() === 'upfront' ||
                                        plan.type?.toLowerCase() === 'one_time' ? (
                                            <div className="flex flex-col gap-2 pl-8 text-xs text-neutral-600">
                                                <span>
                                                    Full Price:{' '}
                                                    {getCurrencySymbol(plan.currency || '')}
                                                    {plan.price}
                                                </span>
                                                <span>Currency: {plan.currency}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 pl-8 text-xs text-neutral-600">
                                                {plan.paymentOption?.map((payment, idx) => {
                                                    return (
                                                        <div key={idx} className="flex">
                                                            <span>
                                                                {payment.title}:{' '}
                                                                {getCurrencySymbol(
                                                                    plan.currency || ''
                                                                )}
                                                                {payment.price}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                                <span>Currency: {plan.currency}</span>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="-mb-2 flex justify-center border-t bg-white pt-4">
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        onClick={() => form.setValue('showAddPlanDialog', true)}
                        className="p-4"
                    >
                        + Add New Payment Plan
                    </MyButton>
                </div>
            </ShadDialogContent>
        </ShadDialog>
    );
}
