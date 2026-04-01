import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchPaymentLogs, getPaymentLogsQueryKey } from '@/services/payment-logs';
import { fetchUserInvoices, getInvoiceDownloadUrl } from '@/services/invoice-service';
import type { InvoiceDTO } from '@/services/invoice-service';
import { PaymentLogsTable } from '@/routes/manage-payments/-components/PaymentLogsTable';
import type { BatchForSession, PaymentLogsResponse } from '@/types/payment-logs';
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;
const INVOICES_PER_PAGE = 10;

/** Sort payment log entries by date, most recent first (by payment_log.date then user_plan.created_at) */
function sortByDateRecentFirst(data: PaymentLogsResponse): PaymentLogsResponse {
    const sorted = [...data.content].sort((a, b) => {
        const dateA = a.payment_log?.date || a.user_plan?.created_at || '';
        const dateB = b.payment_log?.date || b.user_plan?.created_at || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return { ...data, content: sorted };
}

function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function formatCurrency(amount: number | null | undefined, currency?: string): string {
    if (amount == null) return '—';
    const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹';
    return `${sym}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
        GENERATED: 'bg-blue-50 text-blue-700 border-blue-200',
        SENT: 'bg-green-50 text-green-700 border-green-200',
        VIEWED: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {status}
        </span>
    );
}

/** Invoice list with client-side pagination */
const InvoicesList = ({ invoices }: { invoices: InvoiceDTO[] }) => {
    const [page, setPage] = useState(0);
    const totalPages = Math.ceil(invoices.length / INVOICES_PER_PAGE);
    const paged = invoices.slice(page * INVOICES_PER_PAGE, (page + 1) * INVOICES_PER_PAGE);

    const handleDownload = (invoice: InvoiceDTO) => {
        if (invoice.pdf_url) {
            window.open(invoice.pdf_url, '_blank');
        } else if (invoice.pdf_file_id) {
            window.open(getInvoiceDownloadUrl(invoice.id), '_blank');
        }
    };

    if (invoices.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <FileText className="mx-auto mb-2 size-8 text-gray-400" />
                <p className="text-sm text-gray-500">No invoices found.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Invoice #</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {paged.map((inv) => (
                        <tr key={inv.id} className="transition-colors hover:bg-gray-50">
                            <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-gray-900">
                                {inv.invoice_number || inv.id.substring(0, 8)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-sm text-gray-600">
                                {formatDate(inv.invoice_date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-gray-900">
                                {formatCurrency(inv.total_amount, inv.currency)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                                {getStatusBadge(inv.status)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                {(inv.pdf_url || inv.pdf_file_id) && (
                                    <button
                                        onClick={() => handleDownload(inv)}
                                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                                        title="Download Invoice PDF"
                                    >
                                        <Download className="size-3.5" />
                                        Download
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="text-xs text-gray-500">
                        {page * INVOICES_PER_PAGE + 1}–{Math.min((page + 1) * INVOICES_PER_PAGE, invoices.length)} of {invoices.length}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-40"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const StudentPaymentHistory = () => {
    const { selectedStudent } = useStudentSidebar();
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const [currentPage, setCurrentPage] = useState(0);

    const batchesForSessions: BatchForSession[] = useMemo(() => {
        const batches = instituteDetails?.batches_for_sessions;
        return batches && Array.isArray(batches)
            ? (batches as unknown as BatchForSession[])
            : [];
    }, [instituteDetails]);

    const hasOrgAssociatedBatches = useMemo(() => {
        return batchesForSessions.some((batch) => batch.is_org_associated === true);
    }, [batchesForSessions]);

    const requestFilters = useMemo(
        () => ({
            sort_columns: { createdAt: 'DESC' as const },
            ...(selectedStudent?.user_id && { user_id: selectedStudent.user_id }),
        }),
        [selectedStudent?.user_id]
    );

    const {
        data: paymentLogsData,
        isLoading: isLoadingPayments,
        error: paymentsError,
        refetch: refetchPaymentLogs,
    } = useQuery({
        queryKey: getPaymentLogsQueryKey(currentPage, PAGE_SIZE, requestFilters),
        queryFn: () => fetchPaymentLogs(currentPage, PAGE_SIZE, requestFilters),
        staleTime: 30000,
        enabled: Boolean(selectedStudent?.user_id),
    });

    const {
        data: invoicesData,
        isLoading: isLoadingInvoices,
    } = useQuery({
        queryKey: ['user-invoices', selectedStudent?.user_id],
        queryFn: () => fetchUserInvoices(selectedStudent!.user_id),
        staleTime: 60000,
        enabled: Boolean(selectedStudent?.user_id),
    });

    const packageSessionsMap = useMemo(() => {
        const map: Record<string, string> = {};
        batchesForSessions.forEach((batch) => {
            const packageName = batch.package_dto.package_name;
            const sessionName = batch.session.session_name;
            const levelName = batch.level.level_name;
            map[batch.id] = `${packageName} - ${sessionName} - ${levelName}`;
        });
        return map;
    }, [batchesForSessions]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!selectedStudent?.user_id) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-gray-600">Select a learner to view payment history.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Invoices Section */}
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <FileText className="size-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-700">
                        Invoices
                        {invoicesData && invoicesData.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400">({invoicesData.length})</span>
                        )}
                    </h3>
                </div>
                {isLoadingInvoices ? (
                    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6">
                        <div className="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                        <span className="ml-2 text-sm text-gray-500">Loading invoices...</span>
                    </div>
                ) : (
                    <InvoicesList invoices={invoicesData || []} />
                )}
            </div>

            {/* Payment Logs Section */}
            <div>
                <p className="mb-2 text-sm text-neutral-600">
                    Payment History for <span className="font-medium text-neutral-800">{selectedStudent.full_name}</span>
                </p>
                <PaymentLogsTable
                    data={paymentLogsData ? sortByDateRecentFirst(paymentLogsData) : undefined}
                    isLoading={isLoadingPayments}
                    error={paymentsError as Error}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    packageSessions={packageSessionsMap}
                    hasOrgAssociatedBatches={hasOrgAssociatedBatches}
                    hideUserColumn
                    onRefresh={() => refetchPaymentLogs()}
                />
            </div>
        </div>
    );
};
