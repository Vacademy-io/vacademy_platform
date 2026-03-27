import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CurrencyInr, Wallet, WarningCircle, X } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StudentFeePaymentRowDTO, StudentFeeDueDTO } from '@/types/manage-finances';
import {
    fetchStudentDues,
    getStudentDuesQueryKey,
    generateInvoiceForInstallments,
    applyManualDiscount,
    sendInvoiceEmail,
} from '@/services/manage-finances';
import { useTheme } from '@/providers/theme/theme-provider';
import { InvoiceActionDialog } from './InvoiceActionDialog';
import { cn } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    PARTIAL_PAID: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    PARTIAL: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    PENDING: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

function StatusPill({ status }: { status: string }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES['PENDING']!;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
        >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {status}
        </span>
    );
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const FILTER_STATUS_CONFIG = [
    { value: 'ALL', label: 'All', activeBg: 'bg-blue-100', activeText: 'text-blue-700', activeBorder: 'border-blue-300' },
    { value: 'OVERDUE', label: 'Overdue', activeBg: 'bg-red-100', activeText: 'text-red-700', activeBorder: 'border-red-300' },
    { value: 'PENDING', label: 'Due', activeBg: 'bg-orange-100', activeText: 'text-orange-700', activeBorder: 'border-orange-300' },
    { value: 'PARTIAL_PAID', label: 'Partial', activeBg: 'bg-amber-100', activeText: 'text-amber-700', activeBorder: 'border-amber-300' },
    { value: 'PAID', label: 'Paid', activeBg: 'bg-emerald-100', activeText: 'text-emerald-700', activeBorder: 'border-emerald-300' },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface InstallmentSelectionStepProps {
    student: StudentFeePaymentRowDTO;
    onBack: () => void;
    onProceedToPayment: (selectedDues: StudentFeeDueDTO[]) => void;
}

export function InstallmentSelectionStep({
    student,
    onBack,
    onProceedToPayment,
}: InstallmentSelectionStepProps) {
    const { getPrimaryColorCode } = useTheme();
    const queryClient = useQueryClient();

    const { data: dues, isLoading, error } = useQuery({
        queryKey: getStudentDuesQueryKey(student.student_id),
        queryFn: () => fetchStudentDues(student.student_id),
        staleTime: 30000,
    });

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [dueDateFrom, setDueDateFrom] = useState('');
    const [dueDateTo, setDueDateTo] = useState('');

    const filteredDues = useMemo(() => {
        if (!dues) return [];
        return dues.filter((d) => {
            if (statusFilter === 'OVERDUE') {
                if (!d.is_overdue) return false;
            } else if (statusFilter !== 'ALL') {
                if (d.status !== statusFilter) return false;
            }
            if (dueDateFrom && d.due_date) {
                if (dayjs(d.due_date).isBefore(dayjs(dueDateFrom), 'day')) return false;
            }
            if (dueDateTo && d.due_date) {
                if (dayjs(d.due_date).isAfter(dayjs(dueDateTo), 'day')) return false;
            }
            return true;
        });
    }, [dues, statusFilter, dueDateFrom, dueDateTo]);

    const selectableDues = useMemo(() => filteredDues.filter((d) => d.status !== 'PAID'), [filteredDues]);

    const selectedDues = useMemo(
        () => (dues || []).filter((d) => selectedIds.has(d.id)),
        [dues, selectedIds]
    );

    const totalSelectedDue = useMemo(
        () => selectedDues.reduce((sum, d) => sum + d.amount_due, 0),
        [selectedDues]
    );

    const summaryTotals = useMemo(() => {
        if (!dues) return { totalFee: 0, totalPaid: 0, totalDue: 0 };
        return dues.reduce(
            (acc, d) => ({
                totalFee: acc.totalFee + d.amount_expected,
                totalPaid: acc.totalPaid + d.amount_paid,
                totalDue: acc.totalDue + d.amount_due,
            }),
            { totalFee: 0, totalPaid: 0, totalDue: 0 }
        );
    }, [dues]);

    const hasActiveFilters = statusFilter !== 'ALL' || dueDateFrom || dueDateTo;

    const clearFilters = () => {
        setStatusFilter('ALL');
        setDueDateFrom('');
        setDueDateTo('');
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === selectableDues.length && selectableDues.length > 0) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                selectableDues.forEach((d) => next.delete(d.id));
                return next;
            });
        } else {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                selectableDues.forEach((d) => next.add(d.id));
                return next;
            });
        }
    };

    const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>({});
    const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

    const discountMutation = useMutation({
        mutationFn: ({
            studentFeePaymentId,
            userId,
            discountAmount,
            discountReason,
        }: {
            studentFeePaymentId: string;
            userId: string;
            discountAmount: number;
            discountReason?: string;
        }) =>
            applyManualDiscount({
                student_fee_payment_id: studentFeePaymentId,
                user_id: userId,
                discount_amount: discountAmount,
                discount_reason: discountReason,
            }),
        onSuccess: (_data, variables) => {
            // Auto-select the installment so it is included in allocate-selected receipts
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.add(variables.studentFeePaymentId);
                return next;
            });
            toast.success('Discount applied');
            queryClient.invalidateQueries({ queryKey: getStudentDuesQueryKey(student.student_id) });
            setDiscountDrafts((prev) => ({ ...prev, [variables.studentFeePaymentId]: '' }));
            setReasonDrafts((prev) => ({ ...prev, [variables.studentFeePaymentId]: '' }));
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.ex || err?.message || 'Failed to apply discount');
        },
    });

    const invoiceMutation = useMutation({
        mutationFn: () =>
            generateInvoiceForInstallments(student.student_id, Array.from(selectedIds)),
        onSuccess: (data) => {
            if (data.download_url) {
                window.open(data.download_url, '_blank');
                toast.success('Invoice downloaded successfully');
                setShowInvoiceDialog(false);
            } else {
                toast.error('Invoice generated but download URL not available');
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to generate invoice');
        },
    });

    const emailInvoiceMutation = useMutation({
        mutationFn: async (email: string) => {
            const data = await generateInvoiceForInstallments(
                student.student_id,
                Array.from(selectedIds)
            );
            if (!data.download_url) throw new Error('Download URL not available');
            await sendInvoiceEmail(email, student.student_name, data.download_url, getPrimaryColorCode());
        },
        onSuccess: () => {
            toast.success('Invoice sent to email successfully');
            setShowInvoiceDialog(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to send invoice email');
        },
    });

    // ── Render ───────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                <p className="font-semibold text-red-800">Unable to load installments</p>
                <p className="mt-2 text-sm text-red-600">
                    {error instanceof Error ? error.message : 'Please try again.'}
                </p>
            </div>
        );
    }

    const allVisibleSelectableSelected =
        selectableDues.length > 0 && selectableDues.every((d) => selectedIds.has(d.id));

    return (
        <div className="flex flex-col h-[calc(100vh-220px)]">
            {/* ── Top section ── */}
            <div className="space-y-4 mb-4">
                {/* Header */}
                <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Change Student
                    </button>
                    <div className="h-5 w-px bg-gray-200" />
                    <div>
                        <span className="font-semibold text-gray-800">
                            {student.student_name}
                        </span>
                        {student.phone && (
                            <span className="ml-2 text-sm text-gray-400">{student.phone}</span>
                        )}
                    </div>
                </div>

                {(!dues || dues.length === 0) && (
                    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                        <p className="text-lg font-semibold text-gray-600">No dues found.</p>
                        <p className="mt-2 text-sm text-gray-400">
                            This student has no pending installments.
                        </p>
                    </div>
                )}
            </div>

            {dues && dues.length > 0 && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        {[
                            {
                                title: 'Total Fee',
                                value: formatCurrency(summaryTotals.totalFee),
                                icon: CurrencyInr,
                                iconColor: 'text-blue-600',
                                borderColor: 'border-blue-100',
                                valueColor: 'text-gray-800',
                            },
                            {
                                title: 'Paid',
                                value: formatCurrency(summaryTotals.totalPaid),
                                icon: Wallet,
                                iconColor: 'text-emerald-600',
                                borderColor: 'border-emerald-100',
                                valueColor: 'text-emerald-700',
                            },
                            {
                                title: 'Due',
                                value: formatCurrency(summaryTotals.totalDue),
                                icon: WarningCircle,
                                iconColor: 'text-red-600',
                                borderColor: 'border-red-100',
                                valueColor: 'text-red-600',
                            },
                        ].map((card, idx) => (
                            <div
                                key={idx}
                                className={`bg-white border ${card.borderColor} rounded-xl p-4 shadow-sm flex flex-col transition hover:shadow-md`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        {card.title}
                                    </span>
                                    <div
                                        className={`p-1.5 bg-gray-50/50 rounded-full ${card.iconColor}`}
                                    >
                                        <card.icon size={18} weight="duotone" />
                                    </div>
                                </div>
                                <div
                                    className={`text-xl font-extrabold mt-1 ${card.valueColor}`}
                                >
                                    {card.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                {FILTER_STATUS_CONFIG.map((s) => (
                                    <button
                                        key={s.value}
                                        onClick={() => setStatusFilter(s.value)}
                                        className={cn(
                                            'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
                                            statusFilter === s.value
                                                ? `${s.activeBg} ${s.activeText} ${s.activeBorder}`
                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>

                            <div className="h-5 w-px bg-gray-200 hidden sm:block" />

                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-500">From:</label>
                                <input
                                    type="date"
                                    value={dueDateFrom}
                                    onChange={(e) => setDueDateFrom(e.target.value)}
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <label className="text-xs font-medium text-gray-500">To:</label>
                                <input
                                    type="date"
                                    value={dueDateTo}
                                    onChange={(e) => setDueDateTo(e.target.value)}
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
                                >
                                    <X size={14} />
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Scrollable table ── */}
                    <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                        <div className="overflow-auto h-full">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b-2 border-gray-200 bg-gray-50/95 backdrop-blur-sm">
                                        <th className="py-3 px-4 w-10">
                                            <input
                                                type="checkbox"
                                            checked={allVisibleSelectableSelected}
                                                onChange={toggleSelectAll}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fee Type</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CPO / Plan</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Expected</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due / Overdue</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm font-medium">
                                    {filteredDues.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="py-12 text-center text-gray-400">
                                                No installments match the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                    {filteredDues.map((inst: StudentFeeDueDTO) => {
                                        const isSelectable = inst.status !== 'PAID';
                                        const isSelected = selectedIds.has(inst.id);
                                        return (
                                            <tr
                                                key={inst.id}
                                                className={`transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-50/40'
                                                        : 'hover:bg-gray-50/60'
                                                } ${!isSelectable ? 'opacity-50' : 'cursor-pointer'}`}
                                                onClick={() => isSelectable && toggleSelect(inst.id)}
                                            >
                                                <td className="py-3 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={!isSelectable}
                                                        onChange={() => toggleSelect(inst.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-gray-800 font-semibold">{inst.fee_type_name}</td>
                                                <td className="py-3 px-4 text-gray-600">{inst.cpo_name || '\u2014'}</td>
                                                <td className="py-3 px-4 text-gray-700">{formatCurrency(inst.amount_expected)}</td>
                                                <td className="py-3 px-4 text-gray-500">
                                                    <div className="flex flex-col gap-2">
                                                        <div>
                                                            {inst.discount_amount > 0 ? `-${formatCurrency(inst.discount_amount)}` : '\u2014'}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min={0}
                                                                step={1}
                                                                placeholder="Add"
                                                                value={discountDrafts[inst.id] ?? ''}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) =>
                                                                    setDiscountDrafts((prev) => ({
                                                                        ...prev,
                                                                        [inst.id]: e.target.value,
                                                                    }))
                                                                }
                                                                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const raw = discountDrafts[inst.id] ?? '';
                                                                    const amt = Number(raw);
                                                                    if (!raw || Number.isNaN(amt) || amt <= 0) {
                                                                        toast.error('Enter a valid discount amount');
                                                                        return;
                                                                    }
                                                                    const reason = (reasonDrafts[inst.id] ?? '').trim();
                                                                    discountMutation.mutate({
                                                                        studentFeePaymentId: inst.id,
                                                                        userId: student.student_id,
                                                                        discountAmount: amt,
                                                                        discountReason: reason || undefined,
                                                                    });
                                                                }}
                                                                disabled={!isSelectable || discountMutation.isPending}
                                                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>

                                                        <input
                                                            type="text"
                                                            placeholder="Reason (optional)"
                                                            value={reasonDrafts[inst.id] ?? ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) =>
                                                                setReasonDrafts((prev) => ({
                                                                    ...prev,
                                                                    [inst.id]: e.target.value,
                                                                }))
                                                            }
                                                            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-emerald-700 font-semibold">{formatCurrency(inst.amount_paid)}</td>
                                                <td className="py-3 px-4 text-red-600 font-semibold">
                                                    {inst.amount_due > 0 ? formatCurrency(inst.amount_due) : '\u2014'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {inst.is_overdue ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-red-50 text-red-700">
                                                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                                                            Overdue
                                                            {inst.days_overdue > 0 && (
                                                                <span className="text-red-500 font-normal">({inst.days_overdue}d)</span>
                                                            )}
                                                        </span>
                                                    ) : inst.amount_due > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-orange-50 text-orange-700">
                                                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                                                            Due
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">{'\u2014'}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">
                                                    {inst.due_date ? dayjs(inst.due_date).format('D MMM YYYY') : '\u2014'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <StatusPill status={inst.status} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Fixed bottom action bar ── */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-600">
                                <span className="font-bold text-gray-800">{selectedIds.size}</span>{' '}
                                installment{selectedIds.size !== 1 ? 's' : ''} selected
                                {selectedIds.size > 0 && (
                                    <>
                                        {' \u00b7 '}
                                        Total due:{' '}
                                        <span className="font-bold text-gray-800">
                                            {formatCurrency(totalSelectedDue)}
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="flex-1" />

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowInvoiceDialog(true)}
                                    disabled={selectedIds.size === 0}
                                    className="px-5 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                >
                                    Generate Invoice
                                </button>
                                <button
                                    onClick={() => onProceedToPayment(selectedDues)}
                                    disabled={selectedIds.size === 0}
                                    className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                >
                                    Proceed to Pay
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <InvoiceActionDialog
                open={showInvoiceDialog}
                onOpenChange={setShowInvoiceDialog}
                studentName={student.student_name}
                studentEmail={student.email}
                isGenerating={invoiceMutation.isPending}
                isSendingEmail={emailInvoiceMutation.isPending}
                onDownload={() => invoiceMutation.mutate()}
                onSendEmail={(email) => emailInvoiceMutation.mutate(email)}
            />
        </div>
    );
}
