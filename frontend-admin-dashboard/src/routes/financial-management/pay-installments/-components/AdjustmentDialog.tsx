import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { StudentFeeDueDTO } from '@/types/manage-finances';
import {
    submitAdjustment,
    retractAdjustment,
    getStudentDuesQueryKey,
} from '@/services/manage-finances';
import { cn } from '@/lib/utils';

interface AdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    installment: StudentFeeDueDTO;
    studentId: string;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const ADJ_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    PENDING_FOR_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-800' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-800' },
};

export function AdjustmentDialog({
    open,
    onOpenChange,
    installment,
    studentId,
}: AdjustmentDialogProps) {
    const queryClient = useQueryClient();
    const [selectedType, setSelectedType] = useState<'CONCESSION' | 'PENALTY' | null>(null);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    const hasExistingAdjustment =
        installment.adjustment_status !== null && installment.adjustment_status !== undefined;

    const submitMutation = useMutation({
        mutationFn: () =>
            submitAdjustment({
                student_fee_payment_id: installment.id,
                user_id: studentId,
                adjustment_amount: Number(amount),
                adjustment_type: selectedType!,
                adjustment_reason: reason || undefined,
            }),
        onSuccess: () => {
            const msg =
                selectedType === 'PENALTY'
                    ? 'Penalty applied'
                    : 'Concession submitted for approval';
            toast.success(msg);
            queryClient.invalidateQueries({ queryKey: getStudentDuesQueryKey(studentId) });
            handleClose();
        },
        onError: (err: any) => {
            toast.error(
                err?.response?.data?.ex || err?.message || 'Failed to submit adjustment'
            );
        },
    });

    const retractMutation = useMutation({
        mutationFn: () =>
            retractAdjustment({ student_fee_payment_id: installment.id }),
        onSuccess: () => {
            toast.success('Adjustment retracted');
            queryClient.invalidateQueries({ queryKey: getStudentDuesQueryKey(studentId) });
            handleClose();
        },
        onError: (err: any) => {
            toast.error(
                err?.response?.data?.ex || err?.message || 'Failed to retract adjustment'
            );
        },
    });

    const handleClose = () => {
        setSelectedType(null);
        setAmount('');
        setReason('');
        onOpenChange(false);
    };

    const handleSubmit = () => {
        const amt = Number(amount);
        if (!selectedType) {
            toast.error('Select Concession or Penalty');
            return;
        }
        if (!amount || isNaN(amt) || amt <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (selectedType === 'CONCESSION' && amt > installment.amount_expected) {
            toast.error('Concession cannot exceed expected amount');
            return;
        }
        submitMutation.mutate();
    };

    const isPending = submitMutation.isPending || retractMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Adjust Installment</DialogTitle>
                </DialogHeader>

                {/* Installment summary */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Fee Type</span>
                        <span className="font-medium">{installment.fee_type_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Expected</span>
                        <span className="font-medium">
                            {formatCurrency(installment.amount_expected)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Paid</span>
                        <span className="font-medium text-emerald-700">
                            {formatCurrency(installment.amount_paid)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Due</span>
                        <span className="font-medium text-red-600">
                            {formatCurrency(installment.amount_due)}
                        </span>
                    </div>
                </div>

                {/* Existing adjustment info */}
                {hasExistingAdjustment && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-700">
                                Current Adjustment
                            </span>
                            <span
                                className={cn(
                                    'rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase',
                                    ADJ_STATUS_STYLES[installment.adjustment_status ?? '']?.bg ??
                                        'bg-gray-100',
                                    ADJ_STATUS_STYLES[installment.adjustment_status ?? '']
                                        ?.text ?? 'text-gray-600'
                                )}
                            >
                                {installment.adjustment_status?.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>
                                {installment.adjustment_type === 'PENALTY'
                                    ? 'Penalty'
                                    : 'Concession'}
                            </span>
                            <span className="font-medium">
                                {formatCurrency(installment.adjustment_amount)}
                            </span>
                        </div>
                        {installment.adjustment_reason && (
                            <div className="text-gray-500 text-xs">
                                Reason: {installment.adjustment_reason}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => retractMutation.mutate()}
                            disabled={isPending}
                            className="w-full mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                            Retract Adjustment
                        </button>
                    </div>
                )}

                {/* New adjustment form - only show if no existing adjustment */}
                {!hasExistingAdjustment && (
                    <div className="space-y-4">
                        {/* Type selection - side by side */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedType('CONCESSION')}
                                className={cn(
                                    'rounded-lg border-2 p-3 text-center transition-all',
                                    selectedType === 'CONCESSION'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                )}
                            >
                                <div className="text-sm font-semibold text-emerald-700">
                                    Concession
                                </div>
                                <div className="text-[11px] text-gray-500 mt-0.5">
                                    Decreases due amount
                                </div>
                                <div className="text-[10px] text-amber-600 mt-1 font-medium">
                                    Requires approval
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedType('PENALTY')}
                                className={cn(
                                    'rounded-lg border-2 p-3 text-center transition-all',
                                    selectedType === 'PENALTY'
                                        ? 'border-red-500 bg-red-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                )}
                            >
                                <div className="text-sm font-semibold text-red-700">
                                    Penalty
                                </div>
                                <div className="text-[11px] text-gray-500 mt-0.5">
                                    Increases due amount
                                </div>
                                <div className="text-[10px] text-emerald-600 mt-1 font-medium">
                                    Applied instantly
                                </div>
                            </button>
                        </div>

                        {/* Amount & Reason */}
                        {selectedType && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Amount
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step={1}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Reason
                                    </label>
                                    <input
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder={
                                            selectedType === 'CONCESSION'
                                                ? 'e.g., Scholarship, Financial hardship'
                                                : 'e.g., Late payment, Policy violation'
                                        }
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isPending}
                                    className={cn(
                                        'w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
                                        selectedType === 'CONCESSION'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                    )}
                                >
                                    {isPending
                                        ? 'Submitting...'
                                        : selectedType === 'PENALTY'
                                          ? 'Apply Penalty'
                                          : 'Submit for Approval'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
