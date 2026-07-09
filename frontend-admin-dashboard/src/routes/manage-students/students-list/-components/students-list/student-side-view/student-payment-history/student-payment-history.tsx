import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchUserInvoices, getInvoiceDownloadUrl } from '@/services/invoice-service';
import type { InvoiceDTO } from '@/services/invoice-service';
import {
    FileText,
    Wallet,
    Plus,
    DownloadSimple,
    CaretLeft,
    CaretRight,
    Receipt,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { CpoInstallmentsEditor } from './cpo-installments-editor';
import { CreateInvoiceDialog } from './create-invoice-dialog';
import { ProfileSectionCard, ProfileEmpty, ProfileMiniBar } from '../profile-ui';
import { useUserCpoUserPlans } from '../../../../-services/cpoSideViewService';
import type { CpoUserPlanSummary } from '../../../../-types/cpo-side-view-types';

const INVOICES_PER_PAGE = 10;

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
        REJECTED: 'bg-danger-50 text-danger-700 border-danger-200',
    };
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {status}
        </span>
    );
}

/**
 * Read-only Fee Plan headline card — mirrors PaymentSection in the design
 * handoff: plan name + installment count on the left, "Outstanding" eyebrow
 * + danger-toned amount on the right, success-toned paid/net progress bar
 * along the bottom. One card per CPO UserPlan so multi-plan learners keep
 * plan identity (matches the per-plan card pattern in CpoInstallmentsEditor).
 */
const FeePlanSummaryCard = ({ summary }: { summary: CpoUserPlanSummary }) => {
    const net = summary.net_total ?? 0;
    const paid = summary.paid_total ?? 0;
    const pct = net > 0 ? Math.round((paid / net) * 100) : 0;
    const planLabel = summary.cpo_name || summary.payment_option_name || 'Fee Plan';
    return (
        <ProfileSectionCard icon={Wallet} heading="Fee Plan">
            <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                    <div className="text-subtitle font-bold text-card-foreground">
                        {planLabel} · {summary.installment_count} installments
                    </div>
                    <div className="mt-0.5 text-caption text-muted-foreground">
                        Net {formatCurrency(net)} · Paid {formatCurrency(paid)}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                        Outstanding
                    </div>
                    <div className="text-h2 font-bold leading-tight text-danger-600">
                        {formatCurrency(summary.outstanding_total ?? 0)}
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <ProfileMiniBar value={pct} tone="success" label={`${pct}%`} />
            </div>
        </ProfileSectionCard>
    );
};

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
            <ProfileEmpty
                icon={FileText}
                title="No invoices yet"
                hint="Invoices generated for this learner will appear here."
            />
        );
    }

    return (
        // Card-list (not a <table>): a 5-column table can't fit the ~288px mobile
        // / 565px desktop side-panel without horizontal scroll. Each invoice is a
        // self-contained row that wraps + truncates, so the panel never scrolls
        // sideways and the Download action is always reachable.
        <div className="overflow-hidden rounded-lg border border-neutral-200">
            <ul className="divide-y divide-neutral-100">
                {paged.map((inv) => {
                    const canDownload = !!(inv.pdf_url || inv.pdf_file_id);
                    return (
                        <li
                            key={inv.id}
                            className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-50"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    {/* Synthetic invoice numbers carry a status prefix + full
                                        SFP UUID (e.g. "PARTIAL-1f2f1396-…"). Truncate visually
                                        but expose the full id via title= for forensics. */}
                                    <span
                                        className="min-w-0 truncate text-sm font-medium text-neutral-900"
                                        title={inv.invoice_number || inv.id}
                                    >
                                        {shortInvoiceLabel(inv.invoice_number, inv.id)}
                                    </span>
                                    <span className="shrink-0">{getStatusBadge(inv.status)}</span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                                    {/* Prefer due_date so each row matches its installment's
                                        deadline. Falls back to invoice_date for legacy /
                                        non-CPO real Invoice rows that may not carry one. */}
                                    <span>{formatDate(inv.due_date || inv.invoice_date)}</span>
                                    <span aria-hidden>·</span>
                                    <span className="font-medium text-neutral-700">
                                        {formatCurrency(inv.total_amount, inv.currency)}
                                    </span>
                                </div>
                            </div>
                            {canDownload && (
                                <button
                                    onClick={() => handleDownload(inv)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
                                    title="Download Invoice PDF"
                                >
                                    <DownloadSimple className="size-3.5" />
                                    Download
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-2">
                    <span className="text-xs text-neutral-500">
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
    );
};

export const StudentPaymentHistory = () => {
    const { selectedStudent } = useStudentSidebar();
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const queryClient = useQueryClient();
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);

    const {
        data: invoicesData,
        isLoading: isLoadingInvoices,
    } = useQuery({
        queryKey: ['user-invoices', selectedStudent?.user_id],
        queryFn: () => fetchUserInvoices(selectedStudent!.user_id),
        staleTime: 60000,
        enabled: Boolean(selectedStudent?.user_id),
    });

    // CPO summaries power the read-only Fee Plan headline card(s) above the
    // installments editor. We render one card per UserPlan (handoff assumes a
    // single plan; multi-plan learners get one card per plan to preserve plan
    // identity, mirroring the per-plan card pattern in CpoInstallmentsEditor).
    const { data: cpoUserPlans } = useUserCpoUserPlans(selectedStudent?.user_id);

    if (!selectedStudent?.user_id) {
        return (
            <ProfileEmpty
                icon={Wallet}
                title="No learner selected"
                hint="Select a learner to view their payment history."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Fee Plan summary card(s) — read-only headline mirroring the
                handoff PaymentSection. Hidden when the learner has no CPO
                UserPlan; one card per plan otherwise. */}
            {cpoUserPlans?.map((summary) => (
                <FeePlanSummaryCard key={summary.user_plan_id} summary={summary} />
            ))}

            {/* CPO Installments editor — keeps the per-installment edit
                surface, CPO discount controls, and offline payment form.
                Renamed from 'Fee Plan & Installments' so the new Fee Plan
                summary card above owns plan-level identity, and given the
                Receipt icon to differentiate from the wallet headline. */}
            <ProfileSectionCard icon={Receipt} heading="Installments">
                <CpoInstallmentsEditor userId={selectedStudent.user_id} />
            </ProfileSectionCard>

            {/* Invoices — lifted into a SectionCard with Create Invoice in
                the action slot, per handoff PaymentHistorySection layout. */}
            <ProfileSectionCard
                icon={FileText}
                heading={
                    invoicesData && invoicesData.length > 0
                        ? `Invoices (${invoicesData.length})`
                        : 'Invoices'
                }
                action={
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setCreateInvoiceOpen(true)}
                    >
                        <Plus className="mr-1 size-3.5" />
                        Create Invoice
                    </MyButton>
                }
            >
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
                    <div className="flex items-center justify-center rounded-lg border border-border bg-muted p-6">
                        <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-card-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading invoices...</span>
                    </div>
                ) : (
                    <InvoicesList invoices={invoicesData || []} />
                )}
            </ProfileSectionCard>

            {/* Payment Logs table removed per handoff PaymentHistorySection —
                Invoices already shows the per-installment lifecycle (GENERATED
                → SENT → PAID), so the raw payment-log audit trail is forensic
                detail rather than counsellor surface. CpoInstallmentsEditor
                continues to cover plan adjustments above. */}
        </div>
    );
};
