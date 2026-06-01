import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchPaymentLogs, getPaymentLogsQueryKey } from '@/services/payment-logs';
import { fetchUserInvoices, getInvoiceDownloadUrl, markInvoicePaidManually } from '@/services/invoice-service';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import type { InvoiceDTO } from '@/services/invoice-service';
import { PaymentLogsTable } from '@/routes/manage-payments/-components/PaymentLogsTable';
import type { BatchForSession, PaymentLogsResponse } from '@/types/payment-logs';
import { FileText, Wallet, Plus, DownloadSimple, CaretLeft, CaretRight, ClipboardText, CurrencyDollar, DotsThreeVertical, Check } from '@phosphor-icons/react';
// Check is used in MarkPaidDialog confirm button
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MyInput } from '@/components/design-system/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CpoInstallmentsEditor } from './cpo-installments-editor';
import { CreateInvoiceDialog } from './create-invoice-dialog';

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

/**
 * Compact label for the Invoice # column. Real invoice numbers (e.g.
 * "INV-20260512-0001") are returned as-is. Synthetic SFP-derived numbers
 * carry a status prefix + UUID (e.g. "PARTIAL-1f2f1396-…") — those get
 * trimmed to "PARTIAL-1f2f1396" so the column doesn't push the rest of
 * the table off-screen in the side-panel layout. The full value remains
 * available via the cell's title attribute.
 */
function shortInvoiceLabel(invoiceNumber: string | null | undefined, fallbackId: string): string {
    const raw = invoiceNumber || fallbackId;
    if (!raw) return '';
    // Match "STATUS-<uuid-or-id>" and keep the prefix + first UUID segment only.
    const m = /^(PAID|PARTIAL|DUE|OVERDUE|WAIVED)-([a-f0-9]{8})/i.exec(raw);
    if (m && m[1] && m[2]) return `${m[1].toUpperCase()}-${m[2]}`;
    return raw;
}

function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
        GENERATED: 'bg-blue-50 text-blue-700 border-blue-200',
        SENT: 'bg-green-50 text-green-700 border-green-200',
        VIEWED: 'bg-amber-50 text-amber-700 border-amber-200',
        PENDING_PAYMENT: 'bg-warning-50 text-warning-700 border-warning-200',
        PAID: 'bg-success-50 text-success-700 border-success-200',
    };
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {status}
        </span>
    );
}

// ─── Mark Paid Dialog ────────────────────────────────────────────────────────

const markPaidSchema = z.object({
    transaction_id: z.string().optional(),
    notes: z.string().optional(),
});
type MarkPaidValues = z.infer<typeof markPaidSchema>;

function MarkPaidDialog({
    invoice,
    open,
    onOpenChange,
    onSuccess,
}: {
    invoice: InvoiceDTO;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}) {
    const form = useForm<MarkPaidValues>({
        resolver: zodResolver(markPaidSchema),
        defaultValues: { transaction_id: '', notes: '' },
    });

    const handleClose = () => {
        form.reset();
        onOpenChange(false);
    };

    const handleSubmit = async (values: MarkPaidValues) => {
        await markInvoicePaidManually(invoice.id, {
            transaction_id: values.transaction_id || undefined,
            notes: values.notes || undefined,
        });
        toast.success(`Invoice ${invoice.invoice_number} marked as paid`);
        onSuccess();
        handleClose();
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}
            heading={`Mark as Paid — ${invoice.invoice_number}`}
            dialogWidth="max-w-sm"
            content={
                <Form {...form}>
                    <form className="flex flex-col gap-4 px-6 py-5">
                        <p className="text-body text-neutral-600">
                            Record an offline / cash payment of{' '}
                            <span className="font-semibold text-neutral-800">
                                {formatCurrency(invoice.total_amount, invoice.currency)}
                            </span>{' '}
                            for this invoice.
                        </p>

                        <FormField
                            control={form.control}
                            name="transaction_id"
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel className="text-caption text-neutral-600">
                                        Transaction / Reference ID <span className="text-neutral-400">(optional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="e.g. UTR123456789"
                                            input={f.value ?? ''}
                                            onChangeFunction={f.onChange}
                                            {...f}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel className="text-caption text-neutral-600">
                                        Notes <span className="text-neutral-400">(optional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <MyInput
                                            inputType="text"
                                            inputPlaceholder="e.g. Cash collected at counter"
                                            input={f.value ?? ''}
                                            onChangeFunction={f.onChange}
                                            {...f}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
                            <MyButton buttonType="secondary" scale="medium" onClick={handleClose}>
                                Cancel
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onAsyncClick={form.handleSubmit(handleSubmit)}
                                loadingText="Saving…"
                            >
                                <Check className="mr-1.5 size-4" />
                                Confirm Payment
                            </MyButton>
                        </div>
                    </form>
                </Form>
            }
        />
    );
}

// ─── Invoice list with client-side pagination ─────────────────────────────────

const InvoicesList = ({
    invoices,
    onRefresh,
}: {
    invoices: InvoiceDTO[];
    onRefresh: () => void;
}) => {
    const [page, setPage] = useState(0);
    const [markPaidInvoice, setMarkPaidInvoice] = useState<InvoiceDTO | null>(null);

    const totalPages = Math.ceil(invoices.length / INVOICES_PER_PAGE);
    const paged = invoices.slice(page * INVOICES_PER_PAGE, (page + 1) * INVOICES_PER_PAGE);

    const handleDownload = (invoice: InvoiceDTO) => {
        if (invoice.pdf_url) {
            window.open(invoice.pdf_url, '_blank');
        } else if (invoice.pdf_file_id) {
            window.open(getInvoiceDownloadUrl(invoice.id), '_blank');
        }
    };

    const handleCopyLink = async (invoice: InvoiceDTO) => {
        const link = invoice.payment_link ?? `${BASE_URL_LEARNER_DASHBOARD}/pay/invoice/${invoice.id}`;
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Payment link copied');
        } catch {
            toast.error('Could not copy link');
        }
    };

    if (invoices.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
                <FileText className="mx-auto mb-2 size-8 text-neutral-400" />
                <p className="text-body text-neutral-500">No invoices found.</p>
            </div>
        );
    }

    return (
        <>
            {markPaidInvoice && (
                <MarkPaidDialog
                    invoice={markPaidInvoice}
                    open={Boolean(markPaidInvoice)}
                    onOpenChange={(o) => { if (!o) setMarkPaidInvoice(null); }}
                    onSuccess={onRefresh}
                />
            )}

            <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                        <tr>
                            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Invoice #</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Due</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Amount</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Status</th>
                            <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                        {paged.map((inv) => {
                            const isPending = inv.status === 'PENDING_PAYMENT';
                            const hasPdf = Boolean(inv.pdf_url || inv.pdf_file_id);
                            return (
                                <tr key={inv.id} className="transition-colors hover:bg-neutral-50">
                                    <td
                                        className="whitespace-nowrap px-3 py-2.5 text-body font-medium text-neutral-900"
                                        title={inv.invoice_number || inv.id}
                                    >
                                        {shortInvoiceLabel(inv.invoice_number, inv.id)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-body text-neutral-600">
                                        {formatDate(inv.due_date || inv.invoice_date)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-body font-medium text-neutral-900">
                                        {formatCurrency(inv.total_amount, inv.currency)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5">
                                        {getStatusBadge(inv.status)}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                        {(isPending || hasPdf) && <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    className="inline-flex size-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-700"
                                                    title="Actions"
                                                >
                                                    <DotsThreeVertical className="size-4" weight="bold" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-40">
                                                {isPending && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer gap-2"
                                                        onSelect={() => handleCopyLink(inv)}
                                                    >
                                                        <ClipboardText className="size-4 text-neutral-500" />
                                                        Copy Link
                                                    </DropdownMenuItem>
                                                )}
                                                {isPending && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer gap-2 text-warning-700 focus:text-warning-700"
                                                        onSelect={() => setMarkPaidInvoice(inv)}
                                                    >
                                                        <CurrencyDollar className="size-4" />
                                                        Mark as Paid
                                                    </DropdownMenuItem>
                                                )}
                                                {isPending && hasPdf && (
                                                    <DropdownMenuSeparator />
                                                )}
                                                {hasPdf && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer gap-2"
                                                        onSelect={() => handleDownload(inv)}
                                                    >
                                                        <DownloadSimple className="size-4 text-neutral-500" />
                                                        Download PDF
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-2">
                        <span className="text-caption text-neutral-500">
                            {page * INVOICES_PER_PAGE + 1}–{Math.min((page + 1) * INVOICES_PER_PAGE, invoices.length)} of {invoices.length}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40"
                            >
                                <CaretLeft className="size-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40"
                            >
                                <CaretRight className="size-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export const StudentPaymentHistory = () => {
    const { selectedStudent } = useStudentSidebar();
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const queryClient = useQueryClient();
    const [currentPage, setCurrentPage] = useState(0);
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

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
            {/* CPO Installments — only renders when this learner has CPO UserPlans;
                self-hides for everyone else so non-CPO views are unchanged. */}
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <Wallet className="size-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-700">CPO Installments</h3>
                </div>
                <CpoInstallmentsEditor userId={selectedStudent.user_id} />
            </div>

            {/* Invoices Section */}
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <FileText className="size-4 text-gray-500" />
                    <h3 className="flex-1 text-sm font-semibold text-gray-700">
                        Invoices
                        {invoicesData && invoicesData.length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400">({invoicesData.length})</span>
                        )}
                    </h3>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setCreateInvoiceOpen(true)}
                    >
                        <Plus className="mr-1 size-3.5" />
                        Create Invoice
                    </MyButton>
                </div>
                {selectedStudent?.user_id && instituteDetails?.id && (
                    <CreateInvoiceDialog
                        userId={selectedStudent.user_id}
                        userName={selectedStudent.full_name}
                        instituteId={instituteDetails.id}
                        open={createInvoiceOpen}
                        onOpenChange={setCreateInvoiceOpen}
                        onSuccess={() =>
                            queryClient.invalidateQueries({
                                queryKey: ['user-invoices', selectedStudent.user_id],
                            })
                        }
                    />
                )}
                {isLoadingInvoices ? (
                    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6">
                        <div className="size-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                        <span className="ml-2 text-sm text-gray-500">Loading invoices...</span>
                    </div>
                ) : (
                    <InvoicesList
                        invoices={invoicesData || []}
                        onRefresh={() =>
                            queryClient.invalidateQueries({
                                queryKey: ['user-invoices', selectedStudent?.user_id],
                            })
                        }
                    />
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
