import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchPaymentLogs, getPaymentLogsQueryKey } from '@/services/payment-logs';
import { fetchUserInvoices, getInvoiceDownloadUrl } from '@/services/invoice-service';
import type { InvoiceDTO } from '@/services/invoice-service';
import { PaymentLogsTable } from '@/routes/manage-payments/-components/PaymentLogsTable';
import type { BatchForSession, PaymentLogsResponse } from '@/types/payment-logs';
import {
    FileText,
    Wallet,
    Plus,
    DownloadSimple,
    CaretLeft,
    CaretRight,
    Receipt,
    CurrencyCircleDollar,
    Warning as WarningIcon,
    CalendarBlank,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';
import {
    ProfileSectionCard,
    ProfileSkeleton,
    ProfileEmpty,
    ProfileError,
    ProfileHero,
    ProfileHeroStat,
    ProfileActionBar,
} from '../profile-ui';
import { CpoInstallmentsEditor } from './cpo-installments-editor';
import { CreateInvoiceDialog } from './create-invoice-dialog';

const PAGE_SIZE = 20;
const INVOICES_PER_PAGE = 10;

// Statuses that represent money not yet collected.
const UNPAID_STATUSES = new Set([
    'PENDING_PAYMENT',
    'SENT',
    'GENERATED',
    'VIEWED',
    'FAILED',
    'OVERDUE',
]);

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

// Status pill config — maps invoice status to semantic token classes.
const STATUS_PILL: Record<string, { bg: string; text: string; ring: string; label?: string }> = {
    PAID:            { bg: 'bg-success-50', text: 'text-success-700', ring: 'ring-success-200' },
    GENERATED:       { bg: 'bg-info-50',    text: 'text-info-700',    ring: 'ring-info-200' },
    SENT:            { bg: 'bg-primary-50', text: 'text-primary-700', ring: 'ring-primary-200' },
    VIEWED:          { bg: 'bg-warning-50', text: 'text-warning-700', ring: 'ring-warning-200' },
    PENDING_PAYMENT: { bg: 'bg-warning-50', text: 'text-warning-700', ring: 'ring-warning-200', label: 'Pending' },
    FAILED:          { bg: 'bg-danger-50',  text: 'text-danger-700',  ring: 'ring-danger-200' },
    REFUNDED:        { bg: 'bg-neutral-50', text: 'text-neutral-600', ring: 'ring-neutral-200' },
};

const DEFAULT_PILL: { bg: string; text: string; ring: string; label?: string } = {
    bg: 'bg-neutral-50',
    text: 'text-neutral-600',
    ring: 'ring-neutral-200',
};

function StatusPill({ status }: { status: string }) {
    const config = STATUS_PILL[status] ?? DEFAULT_PILL;
    const label = config.label ?? status.replace(/_/g, ' ');
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1',
                config.bg,
                config.text,
                config.ring,
            )}
        >
            {label}
        </span>
    );
}

/** Invoice list with client-side pagination, styled to the profile drawer pattern. */
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
            <ProfileEmpty
                icon={FileText}
                title="No invoices yet"
                hint="Invoices you create for this learner will appear here."
            />
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
            {/* overflow-x-auto keeps the Download column reachable on narrow panels */}
            <table className="min-w-full divide-y divide-neutral-200">
                <thead className="bg-neutral-50">
                    <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            Invoice #
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            Due Date
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            Amount
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            Status
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            PDF
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                    {paged.map((inv) => (
                        <tr
                            key={inv.id}
                            className="transition-colors hover:bg-neutral-50"
                        >
                            {/* Synthetic invoice numbers carry a status prefix + full SFP UUID
                                (e.g. "PARTIAL-1f2f1396-…"). Showing the full string pushes
                                the Action column off-screen in narrow side-panels. Truncate
                                visually but expose the full id via title= for forensics. */}
                            <td
                                className="max-w-0 truncate whitespace-nowrap px-3 py-2.5 text-xs font-medium text-neutral-700"
                                title={inv.invoice_number || inv.id}
                            >
                                {shortInvoiceLabel(inv.invoice_number, inv.id)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500">
                                {/* Prefer due_date so each row matches its installment's
                                    deadline. Falls back to invoice_date for legacy /
                                    non-CPO real Invoice rows that may not carry one. */}
                                {formatDate(inv.due_date || inv.invoice_date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold text-neutral-800">
                                {formatCurrency(inv.total_amount, inv.currency)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                                <StatusPill status={inv.status} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                {(inv.pdf_url || inv.pdf_file_id) && (
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => handleDownload(inv)}
                                        title="Download Invoice PDF"
                                    >
                                        <DownloadSimple className="size-3.5" />
                                    </MyButton>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-2">
                    <span className="text-xs text-neutral-500">
                        {page * INVOICES_PER_PAGE + 1}–
                        {Math.min((page + 1) * INVOICES_PER_PAGE, invoices.length)} of{' '}
                        {invoices.length}
                    </span>
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label="Previous page"
                        >
                            <CaretLeft className="size-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            aria-label="Next page"
                        >
                            <CaretRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Hero stats computation ─────────────────────────────────────────────────────

type NextDueTone = 'primary' | 'warning' | 'danger';

interface PaymentHeroStats {
    totalPaid: number;
    outstanding: number;
    nextDueDate: string | null;
    nextDueTone: NextDueTone;
    currency: string;
}

function computePaymentHeroStats(invoices: InvoiceDTO[]): PaymentHeroStats {
    let totalPaid = 0;
    let outstanding = 0;
    let earliestUnpaidDue: Date | null = null;
    let currency = 'INR';

    for (const inv of invoices) {
        // Use the first invoice's currency as display currency (all invoices share one learner).
        if (inv.currency) currency = inv.currency;

        if (inv.status === 'PAID') {
            totalPaid += inv.total_amount ?? 0;
        } else if (UNPAID_STATUSES.has(inv.status)) {
            outstanding += inv.total_amount ?? 0;
            // Track earliest due date among unpaid invoices.
            const raw = inv.due_date || inv.invoice_date;
            if (raw) {
                const d = new Date(raw);
                if (!Number.isNaN(d.getTime())) {
                    if (!earliestUnpaidDue || d < earliestUnpaidDue) {
                        earliestUnpaidDue = d;
                    }
                }
            }
        }
    }

    // Derive Next Due tone: danger if past, warning if within 7 days, primary otherwise.
    let nextDueTone: NextDueTone = 'primary';
    if (earliestUnpaidDue) {
        const now = Date.now();
        const diff = earliestUnpaidDue.getTime() - now;
        if (diff < 0) {
            nextDueTone = 'danger';
        } else if (diff < 7 * 24 * 60 * 60 * 1000) {
            nextDueTone = 'warning';
        }
    }

    return {
        totalPaid,
        outstanding,
        nextDueDate: earliestUnpaidDue
            ? earliestUnpaidDue.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
              })
            : null,
        nextDueTone,
        currency,
    };
}

// ── Main component ─────────────────────────────────────────────────────────────

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
        error: invoicesError,
        refetch: refetchInvoices,
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

    // ── Compute hero stats client-side from invoices data ──────────────────────
    const heroStats = useMemo<PaymentHeroStats>(() => {
        return computePaymentHeroStats(invoicesData ?? []);
    }, [invoicesData]);

    // Outstanding tone: danger when any amount is owed, success when cleared.
    const outstandingTone = heroStats.outstanding > 0 ? 'danger' : 'success';

    // Guard: no student selected
    if (!selectedStudent?.user_id) {
        return (
            <ProfileEmpty
                icon={Receipt}
                title="No learner selected"
                hint="Select a learner to view their payment history."
            />
        );
    }

    // Loading state — both queries still in flight
    if (isLoadingInvoices && isLoadingPayments) {
        return <ProfileSkeleton blocks={3} />;
    }

    // Error state — invoices failed (primary data for hero)
    if (invoicesError && !invoicesData) {
        return (
            <ProfileError
                title="Could not load payment data"
                hint="Something went wrong fetching invoices. Please retry."
                onRetry={() => {
                    void refetchInvoices();
                    void refetchPaymentLogs();
                }}
            />
        );
    }

    // Empty state — no invoices AND no payment log entries
    const hasNoData =
        !isLoadingInvoices &&
        !isLoadingPayments &&
        (!invoicesData || invoicesData.length === 0) &&
        (!paymentLogsData || paymentLogsData.content.length === 0);

    if (hasNoData) {
        return (
            <div className="flex flex-col gap-4">
                <ProfileEmpty
                    icon={Receipt}
                    title="No payment history"
                    hint="Create an invoice to get started with billing for this learner."
                    action={
                        <>
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                onClick={() => setCreateInvoiceOpen(true)}
                            >
                                <Plus className="mr-1 size-3.5" />
                                Create Invoice
                            </MyButton>
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
                        </>
                    }
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">

            {/* ── Hero — 3-stat financial snapshot ──────────────────────────── */}
            <ProfileHero
                eyebrow="Payment Summary"
                title={selectedStudent.full_name}
                icon={CurrencyCircleDollar}
                tone="primary"
            >
                <div className="grid grid-cols-3 gap-3">
                    <ProfileHeroStat
                        label="Total Paid"
                        value={formatCurrency(heroStats.totalPaid, heroStats.currency)}
                        tone="success"
                        icon={CurrencyCircleDollar}
                    />
                    <ProfileHeroStat
                        label="Outstanding"
                        value={formatCurrency(heroStats.outstanding, heroStats.currency)}
                        tone={outstandingTone}
                        icon={WarningIcon}
                    />
                    <ProfileHeroStat
                        label="Next Due"
                        value={heroStats.nextDueDate ?? '—'}
                        tone={heroStats.nextDueDate ? heroStats.nextDueTone : 'neutral'}
                        icon={CalendarBlank}
                    />
                </div>
            </ProfileHero>

            {/* ── Action bar ────────────────────────────────────────────────── */}
            <ProfileActionBar>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={() => setCreateInvoiceOpen(true)}
                >
                    <Plus className="mr-1 size-3.5" />
                    Create Invoice
                </MyButton>
            </ProfileActionBar>

            {/* Dialog is data-wired; only its trigger state lives here */}
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

            {/* ── CPO Installments (first — most actionable when present) ───── */}
            <ProfileSectionCard
                icon={Wallet}
                heading="CPO Installments"
                className="border-neutral-200"
            >
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Plan-driven installments
                </p>
                {/* Self-hides when this learner has no CPO UserPlans */}
                <CpoInstallmentsEditor userId={selectedStudent.user_id} />
            </ProfileSectionCard>

            {/* ── Invoices ───────────────────────────────────────────────────── */}
            <ProfileSectionCard
                icon={FileText}
                heading={
                    invoicesData && invoicesData.length > 0
                        ? `Invoices (${invoicesData.length})`
                        : 'Invoices'
                }
            >
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Generated invoices
                </p>
                {isLoadingInvoices ? (
                    <ProfileSkeleton blocks={2} />
                ) : (
                    <InvoicesList invoices={invoicesData || []} />
                )}
            </ProfileSectionCard>

            {/* ── Payment Log ────────────────────────────────────────────────── */}
            <ProfileSectionCard icon={Receipt} heading="Payment Log">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    All transactions
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
            </ProfileSectionCard>
        </div>
    );
};
