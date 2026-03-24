import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { StudentFeePaymentRowDTO, StudentFeeDueDTO } from '@/types/manage-finances';
import { allocateSelectedPayment, getStudentDuesQueryKey } from '@/services/manage-finances';
import { getInstituteId } from '@/constants/helper';
import { ConfirmPaymentDialog } from './ConfirmPaymentDialog';

// ─── Types ──────────────────────────────────────────────────────────────────

type PaymentMode = 'CASH' | 'ONLINE' | 'UPI' | 'CARD' | 'CHEQUE';

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'ONLINE', label: 'Online' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CARD', label: 'Card' },
    { value: 'CHEQUE', label: 'Cheque' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

// ─── Component ──────────────────────────────────────────────────────────────

interface PaymentDetailsStepProps {
    student: StudentFeePaymentRowDTO;
    selectedDues: StudentFeeDueDTO[];
    onBack: () => void;
    onSuccess: (amount: number) => void;
}

export function PaymentDetailsStep({
    student,
    selectedDues,
    onBack,
    onSuccess,
}: PaymentDetailsStepProps) {
    const queryClient = useQueryClient();

    const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
    const [transactionId, setTransactionId] = useState('');
    const [amount, setAmount] = useState('');
    const [remarks, setRemarks] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const totalDue = useMemo(
        () => selectedDues.reduce((sum, d) => sum + d.amount_due, 0),
        [selectedDues]
    );

    const handleAmountChange = (value: string) => {
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setAmount(value);
        }
    };

    const parsedAmount = parseFloat(amount) || 0;

    const mutation = useMutation({
        mutationFn: () => {
            const instituteId = getInstituteId();
            if (!instituteId) throw new Error('Institute ID not found');

            const remarkParts: string[] = [];
            remarkParts.push(`Mode: ${paymentMode}`);
            if (transactionId.trim()) remarkParts.push(`Txn ID: ${transactionId.trim()}`);
            if (remarks.trim()) remarkParts.push(remarks.trim());

            return allocateSelectedPayment(student.student_id, {
                institute_id: instituteId,
                student_fee_payment_ids: selectedDues.map((d) => d.id),
                amount: parsedAmount,
                remarks: remarkParts.join(' | '),
            });
        },
        onSuccess: () => {
            toast.success('Payment submitted successfully');
            queryClient.invalidateQueries({
                queryKey: getStudentDuesQueryKey(student.student_id),
            });
            onSuccess(parsedAmount);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.ex || err?.message || 'Payment failed');
        },
    });

    const handleSubmit = () => {
        if (parsedAmount <= 0) return;
        setShowConfirm(true);
    };

    const handleConfirm = () => {
        setShowConfirm(false);
        mutation.mutate();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Installments
                </button>
                <div className="h-5 w-px bg-gray-200" />
                <div>
                    <span className="font-semibold text-gray-800">{student.student_name}</span>
                    {student.phone && (
                        <span className="ml-2 text-sm text-gray-400">{student.phone}</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left: Receipt Preview ── */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                            Selected Installments ({selectedDues.length})
                        </h3>
                    </div>
                    <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-gray-200 bg-gray-50/95">
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                        Fee Type
                                    </th>
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                        CPO / Plan
                                    </th>
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                                        Expected
                                    </th>
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                                        Paid
                                    </th>
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                                        Due
                                    </th>
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                        Due Date
                                    </th>
                                    <th className="py-2.5 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm font-medium">
                                {selectedDues.map((inst) => (
                                    <tr key={inst.id} className="hover:bg-gray-50/40">
                                        <td className="py-2.5 px-4 text-gray-800 font-semibold">
                                            {inst.fee_type_name}
                                        </td>
                                        <td className="py-2.5 px-4 text-gray-600">
                                            {inst.cpo_name || '\u2014'}
                                        </td>
                                        <td className="py-2.5 px-4 text-gray-700 text-right">
                                            {formatCurrency(inst.amount_expected)}
                                        </td>
                                        <td className="py-2.5 px-4 text-emerald-700 font-semibold text-right">
                                            {formatCurrency(inst.amount_paid)}
                                        </td>
                                        <td className="py-2.5 px-4 text-red-600 font-semibold text-right">
                                            {formatCurrency(inst.amount_due)}
                                        </td>
                                        <td className="py-2.5 px-4 text-gray-600">
                                            {inst.due_date
                                                ? dayjs(inst.due_date).format('D MMM YYYY')
                                                : '\u2014'}
                                        </td>
                                        <td className="py-2.5 px-4">
                                            {inst.is_overdue ? (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-red-50 text-red-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                                    Overdue
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-amber-50 text-amber-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                    {inst.status === 'PARTIAL_PAID' ? 'Partial' : 'Pending'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-gray-50/60">
                                    <td
                                        colSpan={4}
                                        className="py-3 px-4 text-sm font-bold text-gray-700 text-right"
                                    >
                                        Total Due:
                                    </td>
                                    <td className="py-3 px-4 text-base font-extrabold text-red-600 text-right">
                                        {formatCurrency(totalDue)}
                                    </td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ── Right: Payment Form ── */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5 h-fit">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                        Payment Details
                    </h3>

                    {/* Payment Mode */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Payment Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_MODES.map((mode) => (
                                <button
                                    key={mode.value}
                                    type="button"
                                    onClick={() => setPaymentMode(mode.value)}
                                    className={`px-3 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                                        paymentMode === mode.value
                                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Transaction ID */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Transaction ID <span className="text-gray-400 normal-case">(optional)</span>
                        </label>
                        <Input
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="e.g. TXN123456"
                            className="text-sm"
                        />
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                                {'\u20B9'}
                            </span>
                            <Input
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder={totalDue.toString()}
                                className="pl-7 text-sm font-semibold"
                            />
                        </div>
                        {parsedAmount > totalDue && (
                            <p className="text-xs text-amber-600">
                                Amount exceeds total due. Excess will remain unallocated.
                            </p>
                        )}
                    </div>

                    {/* Remarks */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Remarks <span className="text-gray-400 normal-case">(optional)</span>
                        </label>
                        <Input
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="e.g. Cash collected at counter"
                            className="text-sm"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={parsedAmount <= 0 || mutation.isPending}
                        className="w-full px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {mutation.isPending ? 'Processing...' : `Submit Payment \u2014 ${formatCurrency(parsedAmount || 0)}`}
                    </button>
                </div>
            </div>

            <ConfirmPaymentDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                studentName={student.student_name}
                amount={parsedAmount}
                installmentCount={selectedDues.length}
                paymentMode={paymentMode}
                transactionId={transactionId.trim() || undefined}
                isSubmitting={mutation.isPending}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
