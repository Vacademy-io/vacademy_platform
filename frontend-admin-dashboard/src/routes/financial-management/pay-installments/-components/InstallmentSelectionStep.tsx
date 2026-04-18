import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ArrowCounterClockwise, ArrowLeft, CaretLeft, CaretRight, CurrencyInr, DownloadSimple, PencilSimple, Spinner, Wallet, WarningCircle, X } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StudentFeePaymentRowDTO, StudentFeeDueDTO } from '@/types/manage-finances';
import {
    fetchStudentDues,
    getStudentDuesQueryKey,
    generateInvoiceForInstallments,
    sendInvoiceEmail,
    getReceiptUrlForInstallment,
    StudentDuesFilterRequest,
} from '@/services/manage-finances';
import { useTheme } from '@/providers/theme/theme-provider';
import { InvoiceActionDialog } from './InvoiceActionDialog';
import { AdjustmentDialog } from './AdjustmentDialog';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

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

    // Filters + pagination
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [dueDateFrom, setDueDateFrom] = useState('');
    const [dueDateTo, setDueDateTo] = useState('');
    const [page, setPage] = useState(0);

    const filterBody = useMemo<StudentDuesFilterRequest>(() => ({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        start_due_date: dueDateFrom || undefined,
        end_due_date: dueDateTo || undefined,
        page,
        size: PAGE_SIZE,
    }), [statusFilter, dueDateFrom, dueDateTo, page]);

    // Reset to first page whenever filter inputs change
    useEffect(() => {
        setPage(0);
    }, [statusFilter, dueDateFrom, dueDateTo]);

    const { data: pageData, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: [...getStudentDuesQueryKey(student.student_id), filterBody],
        queryFn: () => fetchStudentDues(student.student_id, filterBody),
        staleTime: 30000,
        placeholderData: keepPreviousData,
    });

    // Cross-page selection: persist full DTOs as user navigates/filters
    const [selectedDuesMap, setSelectedDuesMap] = useState<Map<string, StudentFeeDueDTO>>(new Map());
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
    const [isSelectingAll, setIsSelectingAll] = useState(false);

    const pageContent = pageData?.content ?? [];
    const pageSelectable = useMemo(
        () => pageContent.filter((d) => d.status !== 'PAID'),
        [pageContent]
    );
    const selectedDues = useMemo(() => Array.from(selectedDuesMap.values()), [selectedDuesMap]);
    const selectedIds = useMemo(() => new Set(selectedDuesMap.keys()), [selectedDuesMap]);

    const totalSelectedDue = useMemo(
        () => selectedDues.reduce((sum, d) => sum + d.amount_due, 0),
        [selectedDues]
    );

    const summaryTotals = {
        totalFee: pageData?.total_fee ?? 0,
        totalPaid: pageData?.total_paid ?? 0,
        totalDue: pageData?.total_due ?? 0,
    };

    const totalElements = pageData?.total_elements ?? 0;
    const totalPages = pageData?.total_pages ?? 0;

    const hasActiveFilters = statusFilter !== 'ALL' || dueDateFrom || dueDateTo;

    const clearFilters = () => {
        setStatusFilter('ALL');
        setDueDateFrom('');
        setDueDateTo('');
    };

    const toggleSelect = (id: string, due: StudentFeeDueDTO) => {
        setSelectedDuesMap((prev) => {
            const next = new Map(prev);
            if (next.has(id)) next.delete(id);
            else next.set(id, due);
            return next;
        });
    };

    const pageFullySelected =
        pageSelectable.length > 0 && pageSelectable.every((d) => selectedDuesMap.has(d.id));

    const togglePageSelection = () => {
        setSelectedDuesMap((prev) => {
            const next = new Map(prev);
            if (pageFullySelected) {
                pageSelectable.forEach((d) => next.delete(d.id));
            } else {
                pageSelectable.forEach((d) => next.set(d.id, d));
            }
            return next;
        });
    };

    const handleSelectAllFiltered = async () => {
        setIsSelectingAll(true);
        try {
            const allMatching = await fetchStudentDues(student.student_id, {
                ...filterBody,
                fetch_all: true,
            });
            setSelectedDuesMap((prev) => {
                const next = new Map(prev);
                for (const d of allMatching.content) {
                    if (d.status !== 'PAID') next.set(d.id, d);
                }
                return next;
            });
            toast.success(`Selected ${allMatching.content.filter((d) => d.status !== 'PAID').length} installments`);
        } catch {
            toast.error('Failed to select all');
        } finally {
            setIsSelectingAll(false);
        }
    };

    const clearSelection = () => setSelectedDuesMap(new Map());

    const [adjustmentDialogInstallment, setAdjustmentDialogInstallment] = useState<StudentFeeDueDTO | null>(null);
    const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

    const handleDownloadReceipt = async (installmentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDownloadingReceiptId(installmentId);
        try {
            const data = await getReceiptUrlForInstallment(installmentId);
            window.open(data.download_url, '_blank');
        } catch {
            toast.error('No receipt found for this installment');
        } finally {
            setDownloadingReceiptId(null);
        }
    };

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

    return (
        <div className="flex flex-col flex-1 min-h-0">
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

                {totalElements === 0 && !hasActiveFilters && (
                    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                        <p className="text-lg font-semibold text-gray-600">No dues found.</p>
                        <p className="mt-2 text-sm text-gray-400">
                            This student has no pending installments.
                        </p>
                    </div>
                )}
            </div>

            {(totalElements > 0 || hasActiveFilters) && (
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

                    {/* Select all filtered banner */}
                    {pageFullySelected && totalElements > pageContent.length && (
                        <div className="mb-2 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-2 flex items-center justify-between text-xs text-blue-800">
                            <span>
                                All <span className="font-bold">{pageSelectable.length}</span> selectable row{pageSelectable.length !== 1 ? 's' : ''} on this page selected.
                            </span>
                            <button
                                type="button"
                                onClick={handleSelectAllFiltered}
                                disabled={isSelectingAll}
                                className="font-semibold underline hover:text-blue-900 disabled:opacity-50"
                            >
                                {isSelectingAll
                                    ? 'Selecting…'
                                    : `Select all ${totalElements} filtered row${totalElements !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    )}

                    {/* ── Refresh + Table ── */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-gray-500">
                            Showing <span className="font-semibold text-gray-700">{pageContent.length === 0 ? 0 : page * PAGE_SIZE + 1}</span>
                            {'\u2013'}
                            <span className="font-semibold text-gray-700">{page * PAGE_SIZE + pageContent.length}</span>
                            {' of '}
                            <span className="font-semibold text-gray-700">{totalElements}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                            <ArrowCounterClockwise size={14} className={isFetching ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                        <div className="overflow-auto h-full">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b-2 border-gray-200 bg-gray-50/95 backdrop-blur-sm">
                                        <th className="py-3 px-4 w-10">
                                            <input
                                                type="checkbox"
                                                checked={pageFullySelected}
                                                onChange={togglePageSelection}
                                                disabled={pageSelectable.length === 0}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                                            />
                                        </th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fee Type</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CPO / Plan</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Expected</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Adjustment</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due / Overdue</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                                        <th className="py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="py-3 px-4 w-10" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm font-medium">
                                    {pageContent.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="py-12 text-center text-gray-400">
                                                No installments match the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                    {pageContent.map((inst: StudentFeeDueDTO) => {
                                        const isSelectable = inst.status !== 'PAID';
                                        const isSelected = selectedDuesMap.has(inst.id);
                                        return (
                                            <tr
                                                key={inst.id}
                                                className={`transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-50/40'
                                                        : 'hover:bg-gray-50/60'
                                                } ${!isSelectable ? 'opacity-50' : 'cursor-pointer'}`}
                                                onClick={() => isSelectable && toggleSelect(inst.id, inst)}
                                            >
                                                <td className="py-3 px-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={!isSelectable}
                                                        onChange={() => toggleSelect(inst.id, inst)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-gray-800 font-semibold">{inst.fee_type_name}</td>
                                                <td className="py-3 px-4 text-gray-600">{inst.cpo_name || '\u2014'}</td>
                                                <td className="py-3 px-4 text-gray-700">{formatCurrency(inst.amount_expected)}</td>
                                                <td className="py-3 px-4 text-gray-500">
                                                    <div className="flex items-center gap-2">
                                                        {inst.adjustment_status ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className={cn(
                                                                    'text-xs font-medium',
                                                                    inst.adjustment_type === 'PENALTY' ? 'text-red-600' : 'text-emerald-600'
                                                                )}>
                                                                    {inst.adjustment_type === 'PENALTY' ? '+' : '-'}
                                                                    {formatCurrency(inst.adjustment_amount)}
                                                                </span>
                                                                <span className={cn(
                                                                    'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase w-fit',
                                                                    inst.adjustment_status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                                                                    inst.adjustment_status === 'PENDING_FOR_APPROVAL' && 'bg-amber-100 text-amber-700',
                                                                    inst.adjustment_status === 'REJECTED' && 'bg-red-100 text-red-700',
                                                                )}>
                                                                    {inst.adjustment_status === 'PENDING_FOR_APPROVAL' ? 'Pending' : inst.adjustment_status}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span>{'\u2014'}</span>
                                                        )}
                                                        {isSelectable && (
                                                            <button
                                                                type="button"
                                                                title="Adjust"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAdjustmentDialogInstallment(inst);
                                                                }}
                                                                className="flex items-center justify-center h-6 w-6 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            >
                                                                <PencilSimple size={13} weight="bold" />
                                                            </button>
                                                        )}
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
                                                <td className="py-3 px-2">
                                                    {inst.status === 'PAID' && (
                                                        <button
                                                            title="Download Receipt"
                                                            onClick={(e) => handleDownloadReceipt(inst.id, e)}
                                                            disabled={downloadingReceiptId === inst.id}
                                                            className="flex items-center justify-center h-7 w-7 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                                        >
                                                            {downloadingReceiptId === inst.id
                                                                ? <Spinner size={14} className="animate-spin" />
                                                                : <DownloadSimple size={14} weight="bold" />
                                                            }
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-3 mb-4">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0 || isFetching}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <CaretLeft size={12} weight="bold" />
                                Prev
                            </button>
                            <span className="text-xs text-gray-500 px-3">
                                Page <span className="font-bold text-gray-800">{page + 1}</span> of{' '}
                                <span className="font-bold text-gray-800">{totalPages}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1 || isFetching}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                                <CaretRight size={12} weight="bold" />
                            </button>
                        </div>
                    )}

                    {/* ── Fixed bottom action bar ── */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-gray-600">
                                <span className="font-bold text-gray-800">{selectedDuesMap.size}</span>{' '}
                                installment{selectedDuesMap.size !== 1 ? 's' : ''} selected
                                {selectedDuesMap.size > 0 && (
                                    <>
                                        {' \u00b7 '}
                                        Total due:{' '}
                                        <span className="font-bold text-gray-800">
                                            {formatCurrency(totalSelectedDue)}
                                        </span>
                                        {' \u00b7 '}
                                        <button
                                            type="button"
                                            onClick={clearSelection}
                                            className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors underline"
                                        >
                                            Clear
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="flex-1" />

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowInvoiceDialog(true)}
                                    disabled={selectedDuesMap.size === 0}
                                    className="px-5 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                >
                                    Generate Invoice
                                </button>
                                <button
                                    onClick={() => onProceedToPayment(selectedDues)}
                                    disabled={selectedDuesMap.size === 0}
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

            {adjustmentDialogInstallment && (
                <AdjustmentDialog
                    open={!!adjustmentDialogInstallment}
                    onOpenChange={(open) => {
                        if (!open) setAdjustmentDialogInstallment(null);
                    }}
                    installment={adjustmentDialogInstallment}
                    studentId={student.student_id}
                />
            )}
        </div>
    );
}
