import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStudentSidebar } from '../../../../-context/selected-student-sidebar-context';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    fetchUserInvoices,
    fetchUserAccountSummary,
    fetchUserAccountLedger,
    markInvoicePaidManual,
    rejectInvoice,
    fetchInvoiceById,
} from '@/services/invoice-service';
import { downloadInvoicePdf as downloadNamedInvoicePdf } from '@/services/invoice-pdf';
import { InvoicePreviewDialog } from '@/components/common/invoice/invoice-preview-dialog';
import type { InvoiceDTO, UserAccountSummaryDTO, UserAccountLedgerEntryDTO } from '@/services/invoice-service';
import {
    FileText,
    Wallet,
    Plus,
    DownloadSimple,
    Eye,
    PencilSimple,
    CaretLeft,
    CaretRight,
    Receipt,
    Copy,
    Check,
    ClockCounterClockwise,
    ArrowCircleUp,
    ArrowCircleDown,
    XCircle,
} from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { CpoInstallmentsEditor } from './cpo-installments-editor';
import { CreateInvoiceDialog } from './create-invoice-dialog';
import { ProfileSectionCard, ProfileEmpty, ProfileMiniBar } from '../profile-ui';
import { useUserCpoUserPlans } from '../../../../-services/cpoSideViewService';
import type { CpoUserPlanSummary } from '../../../../-types/cpo-side-view-types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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

/**
 * Display labels for invoice status codes. The Record keys are the raw
 * backend enum values used for style lookup and MUST NOT be translated —
 * only the rendered `label` text below changes per-locale.
 */
function buildInvoiceStatusLabels(t: TFunction): Record<string, string> {
    return {
        GENERATED: t('invoiceStatus.generated'),
        SENT: t('invoiceStatus.sent'),
        VIEWED: t('invoiceStatus.viewed'),
        PENDING_PAYMENT: t('invoiceStatus.pendingPayment'),
        PAID: t('invoiceStatus.paid'),
        REJECTED: t('invoiceStatus.rejected'),
    };
}

function getStatusBadge(status: string, label: string) {
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
            {label}
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
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const net = summary.net_total ?? 0;
    const paid = summary.paid_total ?? 0;
    const pct = net > 0 ? Math.round((paid / net) * 100) : 0;
    const planLabel = summary.cpo_name || summary.payment_option_name || t('feePlan.planLabelFallback');
    return (
        <ProfileSectionCard icon={Wallet} heading={t('feePlan.heading')}>
            <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                    <div className="text-subtitle font-bold text-card-foreground">
                        {planLabel} · {t('feePlan.installments', { count: summary.installment_count })}
                    </div>
                    <div className="mt-0.5 text-caption text-muted-foreground">
                        {t('feePlan.netPaid', { net: formatCurrency(net), paid: formatCurrency(paid) })}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('feePlan.outstanding')}
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

/** Account summary grid — shows total accrued, paid, balance, overdue from the ledger. */
const AccountSummaryGrid = ({ summary }: { summary: UserAccountSummaryDTO }) => {
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const sym = summary.currency === 'USD' ? '$' : summary.currency === 'EUR' ? '€' : '₹';
    const fmt = (v: number) =>
        `${sym}${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
                { label: t('accountSummary.totalAccrued'), value: fmt(summary.total_accrued), tone: 'neutral' },
                { label: t('accountSummary.totalPaid'), value: fmt(summary.total_paid), tone: 'success' },
                { label: t('accountSummary.due'), value: fmt(summary.balance), tone: summary.balance > 0 ? 'danger' : 'neutral' },
                { label: t('accountSummary.pastDue'), value: fmt(summary.overdue), tone: summary.overdue > 0 ? 'danger' : 'neutral' },
            ].map(({ label, value, tone }) => (
                <div key={label} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className={`mt-0.5 text-sm font-bold ${tone === 'danger' ? 'text-danger-600' : tone === 'success' ? 'text-success-600' : 'text-neutral-900'}`}>
                        {value}
                    </p>
                </div>
            ))}
        </div>
    );
};

/** Inline mark-paid dialog for ADMIN_MANUAL invoices in the student side-view. */
const StudentMarkPaidDialog = ({
    open,
    onOpenChange,
    invoiceId,
    invoiceNumber,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    invoiceId: string;
    invoiceNumber?: string;
    onSuccess?: () => void;
}) => {
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const [txnId, setTxnId] = useState('');
    const [notes, setNotes] = useState('');
    const mutation = useMutation({
        mutationFn: () =>
            markInvoicePaidManual(invoiceId, {
                transaction_id: txnId.trim() || undefined,
                notes: notes.trim() || undefined,
            }),
        onSuccess: () => {
            toast.success(t('markPaidDialog.successToast', { invoice: invoiceNumber || invoiceId }));
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || t('markPaidDialog.errorToast'));
        },
    });
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{t('markPaidDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {invoiceNumber ? (
                            <>
                                {t('markPaidDialog.descriptionPrefix')} <strong>{invoiceNumber}</strong>.
                            </>
                        ) : (
                            t('markPaidDialog.descriptionFallback')
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-1">
                    <div className="space-y-1">
                        <Label>{t('markPaidDialog.transactionReference')}</Label>
                        <Input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder={t('markPaidDialog.transactionReferencePlaceholder')} />
                    </div>
                    <div className="space-y-1">
                        <Label>{t('markPaidDialog.notes')}</Label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('markPaidDialog.notesPlaceholder')} />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <MyButton type="button" buttonType="secondary" scale="small" onClick={() => onOpenChange(false)} disable={mutation.isPending}>
                        {t('markPaidDialog.cancel')}
                    </MyButton>
                    <MyButton type="button" buttonType="primary" scale="small" onClick={() => mutation.mutate()} disable={mutation.isPending}>
                        {mutation.isPending ? <><CircleNotch className="size-4 animate-spin" /> {t('markPaidDialog.saving')}</> : t('markPaidDialog.submit')}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/** Invoice list with client-side pagination + source-based actions. */
const InvoicesList = ({
    invoices,
    instituteId,
    onRefresh,
    onEdit,
}: {
    invoices: InvoiceDTO[];
    instituteId: string;
    onRefresh?: () => void;
    /** Opens the Create-Invoice dialog in edit mode for an unpaid admin invoice. */
    onEdit?: (invoiceId: string) => void;
}) => {
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const statusLabels = buildInvoiceStatusLabels(t);
    const [page, setPage] = useState(0);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [markPaidTarget, setMarkPaidTarget] = useState<{ id: string; number?: string } | null>(null);
    // Pending confirm for the destructive Cancel action — terminal, so it goes behind an
    // AlertDialog rather than firing straight from the row (same gate as the sub-org panel).
    const [cancelTarget, setCancelTarget] = useState<{ id: string; number: string } | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    // Inline PDF preview — view an invoice without downloading it first.
    const [previewTarget, setPreviewTarget] = useState<InvoiceDTO | null>(null);
    const totalPages = Math.ceil(invoices.length / INVOICES_PER_PAGE);
    const paged = invoices.slice(page * INVOICES_PER_PAGE, (page + 1) * INVOICES_PER_PAGE);

    // Voids a mistaken PENDING_PAYMENT invoice. Mirrors the Reject action in
    // manage-suborg-teams/sub-org-analytics-panel — same endpoint, same terminal semantics.
    const cancelMutation = useMutation({
        mutationFn: (invoiceId: string) => rejectInvoice(invoiceId, instituteId),
        onMutate: (invoiceId) => setCancellingId(invoiceId),
        onSettled: () => setCancellingId(null),
        onSuccess: () => {
            toast.success(t('invoicesList.cancelSuccessToast'));
            onRefresh?.();
        },
        onError: (err: unknown) => {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data
                ?.message;
            toast.error(message || t('invoicesList.cancelErrorToast'));
        },
    });

    // Downloads via the shared helper so the file lands as Invoice-<number>.pdf rather than
    // under the opaque storage key a plain window.open would produce.
    const handleDownload = (invoice: InvoiceDTO) => downloadNamedInvoicePdf(invoice);

    const handleCopyLink = async (invoiceId: string, link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiedId(invoiceId);
            toast.success(t('invoicesList.copyLinkSuccessToast'));
            window.setTimeout(() => setCopiedId((p) => (p === invoiceId ? null : p)), 2000);
        } catch {
            toast.error(t('invoicesList.copyLinkErrorToast'));
        }
    };

    if (invoices.length === 0) {
        return (
            <ProfileEmpty
                icon={FileText}
                title={t('invoicesList.emptyTitle')}
                hint={t('invoicesList.emptyHint')}
            />
        );
    }

    return (
        <>
            <div className="overflow-hidden rounded-lg border border-neutral-200">
                <ul className="divide-y divide-neutral-100">
                    {paged.map((inv) => {
                        const canDownload = !!(inv.pdf_url || inv.pdf_file_id);
                        const status = String(inv.status || '').toUpperCase();
                        const isPending = status === 'PENDING_PAYMENT' || status === 'GENERATED' || status === 'SENT';
                        const isAdminManual = inv.source === 'ADMIN_MANUAL';
                        // Cancel is gated strictly on PENDING_PAYMENT, NOT the broader
                        // isPending: InvoiceService.rejectInvoice rejects any other status
                        // outright, so offering it on GENERATED/SENT would only ever 400.
                        const canCancel = isAdminManual && status === 'PENDING_PAYMENT';
                        const paymentLink = inv.payment_link;
                        return (
                            <li
                                key={inv.id}
                                className="flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-neutral-50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                className="min-w-0 truncate text-sm font-medium text-neutral-900"
                                                title={inv.invoice_number || inv.id}
                                            >
                                                {shortInvoiceLabel(inv.invoice_number, inv.id)}
                                            </span>
                                            <span className="shrink-0">{getStatusBadge(inv.status, statusLabels[inv.status] ?? inv.status)}</span>
                                            {/* A proforma is not a tax invoice yet — it holds a
                                                number from the separate PRO- series and gets a real
                                                invoice number only once it is paid. Worth calling
                                                out on the row so admins don't quote it as one. */}
                                            {inv.proforma && (
                                                <span
                                                    className="inline-flex shrink-0 items-center rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600"
                                                    title={t('invoicesList.proformaTitle')}
                                                >
                                                    {t('invoicesList.proforma')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                                            <span>{formatDate(inv.due_date || inv.invoice_date)}</span>
                                            <span aria-hidden>·</span>
                                            {/* Discounted invoice: show gross struck through so the
                                                coupon's effect is visible next to the charged amount. */}
                                            {(inv.discount_amount ?? 0) > 0 && (
                                                <span className="text-neutral-400 line-through">
                                                    {formatCurrency(
                                                        (inv.total_amount ?? 0) + (inv.discount_amount ?? 0),
                                                        inv.currency
                                                    )}
                                                </span>
                                            )}
                                            <span className="font-medium text-neutral-700">
                                                {formatCurrency(inv.total_amount, inv.currency)}
                                            </span>
                                            {(inv.discount_amount ?? 0) > 0 &&
                                                (() => {
                                                    const couponItem = inv.line_items?.find(
                                                        (li) =>
                                                            li.item_type?.includes('COUPON') ||
                                                            li.item_type?.includes('DISCOUNT') ||
                                                            li.item_type?.includes('REFERRAL')
                                                    );
                                                    const label = couponItem?.description || t('invoicesList.discountFallback');
                                                    return (
                                                        <span
                                                            className="inline-flex shrink-0 items-center rounded border border-success-200 bg-success-50 px-1.5 py-0.5 text-caption font-medium text-success-700"
                                                            title={`${label}: ${formatCurrency(inv.discount_amount, inv.currency)} off`}
                                                        >
                                                            {label} −
                                                            {formatCurrency(inv.discount_amount, inv.currency)}
                                                        </span>
                                                    );
                                                })()}
                                            {inv.source && (() => {
                                                const srcMeta: Record<string, { label: string; cls: string }> = {
                                                    ADMIN_MANUAL: { label: t('invoicesList.sourceAdminInvoice'), cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                                                    USER_PLAN: { label: t('invoicesList.sourceSubscription'), cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                                                    STUDENT_FEE_PAYMENT: { label: t('invoicesList.sourceFeePayment'), cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                                                };
                                                const m = srcMeta[inv.source] || { label: inv.source.replace(/_/g, ' '), cls: 'bg-gray-50 text-gray-600 border-gray-200' };
                                                return (
                                                    <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-2xs font-medium ${m.cls}`}>
                                                        {m.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    {canDownload && (
                                        <>
                                            <button
                                                onClick={() => setPreviewTarget(inv)}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
                                                title={t('invoicesList.previewTitle')}
                                            >
                                                <Eye className="size-3.5" />
                                                {t('invoicesList.preview')}
                                            </button>
                                            <button
                                                onClick={() => void handleDownload(inv)}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
                                                title={t('invoicesList.downloadTitle')}
                                            >
                                                <DownloadSimple className="size-3.5" />
                                                {t('invoicesList.download')}
                                            </button>
                                        </>
                                    )}
                                </div>
                                {/* Action row: payment link + mark paid for actionable invoices */}
                                {(paymentLink || (isAdminManual && isPending) || canCancel) && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {paymentLink && (
                                            <button
                                                onClick={() => handleCopyLink(inv.id, paymentLink)}
                                                className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-1 text-2xs uppercase tracking-wide text-neutral-600 hover:bg-neutral-50"
                                                title={t('invoicesList.copyPaymentLinkTitle')}
                                            >
                                                {copiedId === inv.id ? (
                                                    <><Check className="size-3 text-success-600" /> {t('invoicesList.copied')}</>
                                                ) : (
                                                    <><Copy className="size-3" /> {t('invoicesList.copyPaymentLink')}</>
                                                )}
                                            </button>
                                        )}
                                        {isAdminManual && isPending && onEdit && (
                                            <button
                                                onClick={() => onEdit(inv.id)}
                                                className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-1 text-2xs uppercase tracking-wide text-neutral-600 hover:bg-neutral-50"
                                                title={t('invoicesList.editTitle')}
                                            >
                                                <PencilSimple className="size-3" />
                                                {t('invoicesList.edit')}
                                            </button>
                                        )}
                                        {isAdminManual && isPending && (
                                            <button
                                                onClick={() => setMarkPaidTarget({ id: inv.id, number: inv.invoice_number || inv.id })}
                                                className="inline-flex items-center gap-1 rounded border border-primary-300 bg-primary-50 px-2 py-1 text-2xs uppercase tracking-wide text-primary-700 hover:bg-primary-100"
                                                title={t('invoicesList.markPaidTitle')}
                                            >
                                                {t('invoicesList.markPaid')}
                                            </button>
                                        )}
                                        {canCancel && (
                                            <button
                                                onClick={() =>
                                                    setCancelTarget({
                                                        id: inv.id,
                                                        number: inv.invoice_number || inv.id,
                                                    })
                                                }
                                                disabled={cancellingId === inv.id}
                                                className="inline-flex items-center gap-1 rounded border border-danger-300 bg-danger-50 px-2 py-1 text-2xs uppercase tracking-wide text-danger-700 hover:bg-danger-100 disabled:opacity-50"
                                                title={t('invoicesList.cancelInvoiceTitle')}
                                            >
                                                <XCircle className="size-3" />
                                                {cancellingId === inv.id ? t('invoicesList.cancelling') : t('invoicesList.cancelAction')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-2">
                        <span className="text-xs text-neutral-500">
                            {t('invoicesList.paginationRange', {
                                from: page * INVOICES_PER_PAGE + 1,
                                to: Math.min((page + 1) * INVOICES_PER_PAGE, invoices.length),
                                total: invoices.length,
                            })}
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
            <StudentMarkPaidDialog
                open={!!markPaidTarget}
                onOpenChange={(o) => !o && setMarkPaidTarget(null)}
                invoiceId={markPaidTarget?.id || ''}
                invoiceNumber={markPaidTarget?.number}
                onSuccess={() => {
                    setMarkPaidTarget(null);
                    onRefresh?.();
                }}
            />
            {/* Cancel confirm — terminal and money-voiding, so it is gated behind an explicit
                AlertDialog rather than firing on the row click. */}
            <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('invoicesList.cancelDialog.title', { number: cancelTarget?.number })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('invoicesList.cancelDialog.description')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('invoicesList.cancelDialog.keep')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (cancelTarget) cancelMutation.mutate(cancelTarget.id);
                                setCancelTarget(null);
                            }}
                            className="bg-danger-600 hover:bg-danger-700"
                        >
                            {t('invoicesList.cancelDialog.confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <InvoicePreviewDialog
                invoice={previewTarget}
                onClose={() => setPreviewTarget(null)}
            />
        </>
    );
};

/**
 * `isCredit` drives the arrow + sign (does this line reduce what the learner owes?).
 * `neutral` marks lines where nothing was actually collected — a reversal cancels an
 * obligation that was raised in error, so painting it green like a real payment would
 * read as money received.
 */
/**
 * Display metadata for ledger event types. Record keys are the raw backend
 * `event_type` enum values used to look up the entry's meta — they MUST NOT
 * be translated, only the rendered `label` text changes per-locale.
 */
function buildLedgerEventMeta(
    t: TFunction
): Record<string, { label: string; cls: string; isCredit: boolean; neutral?: boolean }> {
    return {
        DEBIT_ACCRUAL:     { label: t('transactionHistory.event.debitAccrual'),     cls: 'bg-red-50 text-red-700 border-red-200',          isCredit: false },
        CREDIT_PAYMENT:    { label: t('transactionHistory.event.creditPayment'),    cls: 'bg-green-50 text-green-700 border-green-200',    isCredit: true  },
        CREDIT_WAIVER:     { label: t('transactionHistory.event.creditWaiver'),     cls: 'bg-blue-50 text-blue-700 border-blue-200',       isCredit: true  },
        CREDIT_ADJUSTMENT: { label: t('transactionHistory.event.creditAdjustment'), cls: 'bg-amber-50 text-amber-700 border-amber-200',    isCredit: true  },
        DEBIT_PENALTY:     { label: t('transactionHistory.event.debitPenalty'),     cls: 'bg-orange-50 text-orange-700 border-orange-200', isCredit: false },
        DEBIT_REVERSAL:    { label: t('transactionHistory.event.debitReversal'),    cls: 'bg-gray-50 text-gray-600 border-gray-200',       isCredit: true, neutral: true },
    };
}

const TransactionHistory = ({
    userId,
    instituteId,
}: {
    userId: string;
    instituteId: string;
}) => {
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const ledgerEventMeta = buildLedgerEventMeta(t);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 10;

    const { data, isLoading } = useQuery({
        queryKey: ['user-account-ledger', userId, instituteId, page],
        queryFn: () => fetchUserAccountLedger(userId, instituteId, page, PAGE_SIZE),
        staleTime: 60000,
        enabled: !!userId && !!instituteId,
    });

    const entries: UserAccountLedgerEntryDTO[] = data?.content ?? [];
    const totalPages = data?.totalPages ?? 1;

    if (isLoading && entries.length === 0) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                <span className="ms-2 text-xs text-muted-foreground">{t('transactionHistory.loading')}</span>
            </div>
        );
    }

    if (!isLoading && entries.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">{t('transactionHistory.empty')}</p>
        );
    }

    return (
        <div className="space-y-2">
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
                {entries.map((entry) => {
                    const meta = ledgerEventMeta[entry.event_type] ?? {
                        label: entry.event_type,
                        cls: 'bg-gray-50 text-gray-600 border-gray-200',
                        isCredit: false,
                        neutral: false,
                    };
                    const sym = entry.currency === 'USD' ? '$' : entry.currency === 'EUR' ? '€' : '₹';
                    const amtStr = `${sym}${Number(entry.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                    // Discounted accrual: backend sends the list price (gross_amount)
                    // alongside the net amount — render it struck through so the
                    // coupon's effect is visible on the transaction line itself.
                    const gross = Number(entry.gross_amount || 0);
                    const grossStr =
                        gross > Number(entry.amount || 0)
                            ? `${sym}${gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : null;
                    return (
                        <li key={entry.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-50">
                            <span className="mt-0.5 shrink-0">
                                {meta.isCredit
                                    ? <ArrowCircleUp className={`size-4 ${meta.neutral ? 'text-neutral-400' : 'text-green-600'}`} weight="duotone" />
                                    : <ArrowCircleDown className="size-4 text-red-500" weight="duotone" />
                                }
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium ${meta.cls}`}>
                                        {meta.label}
                                    </span>
                                    {entry.remarks && (
                                        <span className="truncate text-2xs text-muted-foreground" title={entry.remarks}>
                                            {entry.remarks}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-2xs text-muted-foreground">
                                    {formatDate(entry.created_at)}
                                    {entry.source_type && <> · {entry.source_type.replace(/_/g, ' ')}</>}
                                </p>
                            </div>
                            <span className="shrink-0 text-right">
                                {grossStr && (
                                    <span className="mr-1.5 text-xs tabular-nums text-neutral-400 line-through">
                                        {grossStr}
                                    </span>
                                )}
                                <span className={`text-sm font-semibold tabular-nums ${meta.neutral ? 'text-neutral-500' : meta.isCredit ? 'text-green-700' : 'text-red-600'}`}>
                                    {meta.isCredit ? '+' : '-'}{amtStr}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-muted-foreground">
                        {t('transactionHistory.pageOf', { page: page + 1, total: totalPages })}
                    </span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
                        >
                            <CaretLeft className="size-3.5" />
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
                        >
                            <CaretRight className="size-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const StudentPaymentHistory = () => {
    const { t } = useTranslation('manageStudentsPaymentHistory');
    const { selectedStudent } = useStudentSidebar();
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const queryClient = useQueryClient();
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    // Editing an existing unpaid invoice reuses the Create-Invoice dialog. The list row only
    // holds a summary, so the full invoice (line items) is fetched before opening.
    const [editSource, setEditSource] = useState<InvoiceDTO | null>(null);
    const handleEditInvoice = async (invoiceId: string) => {
        try {
            setEditSource(await fetchInvoiceById(invoiceId));
            setCreateInvoiceOpen(true);
        } catch {
            toast.error(t('main.loadInvoiceError'));
        }
    };

    const {
        data: invoicesData,
        isLoading: isLoadingInvoices,
    } = useQuery({
        queryKey: ['user-invoices', selectedStudent?.user_id],
        queryFn: () => fetchUserInvoices(selectedStudent!.user_id),
        staleTime: 60000,
        enabled: Boolean(selectedStudent?.user_id),
    });

    // Account ledger summary — total accrued / paid / balance / overdue from the
    // append-only user_account_ledger. Only populated once the backend has ledger
    // rows for this user (leads and pre-enrolled users will see zeros, which is fine).
    const { data: accountSummary } = useQuery({
        queryKey: ['user-account-summary', selectedStudent?.user_id, instituteDetails?.id],
        queryFn: () => fetchUserAccountSummary(selectedStudent!.user_id, instituteDetails?.id ?? ''),
        staleTime: 60000,
        enabled: Boolean(selectedStudent?.user_id) && Boolean(instituteDetails?.id),
    });

    // CPO summaries power the read-only Fee Plan headline card(s) above the
    // installments editor. We render one card per UserPlan (handoff assumes a
    // single plan; multi-plan learners get one card per plan to preserve plan
    // identity, mirroring the per-plan card pattern in CpoInstallmentsEditor).
    const { data: cpoUserPlans } = useUserCpoUserPlans(selectedStudent?.user_id);

    const invalidateInvoices = () =>
        queryClient.invalidateQueries({ queryKey: ['user-invoices', selectedStudent?.user_id] });

    // Client-side fallback summary computed from the invoice list.
    // Used when the ledger API returns all-zeros (migration not yet applied,
    // or invoices created before the DEBIT_ACCRUAL recording was wired up).
    // The ledger summary takes precedence once it has real data.
    const invoiceList = invoicesData || [];
    // A cancelled invoice is a voided obligation — the learner never owed it. Counting it
    // kept the cancelled amount sitting in "Total accrued" (and in "Due") forever.
    const isVoidedInvoice = (inv: InvoiceDTO) =>
        ['REJECTED', 'CANCELLED', 'CANCELED', 'VOID'].includes(String(inv.status || '').toUpperCase());
    const fallbackSummary: UserAccountSummaryDTO | null = invoiceList.length > 0
        ? (() => {
              const billable = invoiceList.filter((inv) => !isVoidedInvoice(inv));
              const currency = billable[0]?.currency || invoiceList[0]?.currency || 'INR';
              const totalAccrued = billable.reduce((s, inv) => s + (inv.total_amount ?? 0), 0);
              const totalPaid = billable
                  .filter((inv) => String(inv.status || '').toUpperCase() === 'PAID')
                  .reduce((s, inv) => s + (inv.total_amount ?? 0), 0);
              const balance = Math.max(0, totalAccrued - totalPaid);
              const now = Date.now();
              const overdue = billable
                  .filter((inv) => {
                      const st = String(inv.status || '').toUpperCase();
                      const isPending = st === 'PENDING_PAYMENT' || st === 'GENERATED' || st === 'SENT';
                      const pastDue = inv.due_date ? new Date(inv.due_date).getTime() < now : false;
                      return isPending && pastDue;
                  })
                  .reduce((s, inv) => s + (inv.total_amount ?? 0), 0);
              return { user_id: selectedStudent?.user_id || '', institute_id: instituteDetails?.id || '', total_accrued: totalAccrued, total_paid: totalPaid, balance, overdue, currency };
          })()
        : null;

    // Prefer ledger data when non-zero; fall back to invoice-derived summary.
    const effectiveSummary: UserAccountSummaryDTO | null =
        accountSummary && (accountSummary.total_accrued > 0 || accountSummary.total_paid > 0)
            ? accountSummary
            : fallbackSummary;

    if (!selectedStudent?.user_id) {
        return (
            <ProfileEmpty
                icon={Wallet}
                title={t('main.noLearnerTitle')}
                hint={t('main.noLearnerHint')}
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Account summary — total accrued / paid / balance / overdue.
                Ledger data is authoritative; falls back to client-side totals
                computed from the invoice list (covers old invoices / fresh installs
                before the migration writes ledger rows). Hidden only when there
                are no invoices at all. */}
            {effectiveSummary && (
                <ProfileSectionCard icon={Wallet} heading={t('accountSummary.heading')}>
                    <AccountSummaryGrid summary={effectiveSummary} />
                </ProfileSectionCard>
            )}

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
            <ProfileSectionCard icon={Receipt} heading={t('main.installmentsHeading')}>
                <CpoInstallmentsEditor userId={selectedStudent.user_id} />
            </ProfileSectionCard>

            {/* Invoices — lifted into a SectionCard with Create Invoice in
                the action slot, per handoff PaymentHistorySection layout. */}
            <ProfileSectionCard
                icon={FileText}
                heading={
                    invoicesData && invoicesData.length > 0
                        ? t('main.invoicesHeadingCount', { count: invoicesData.length })
                        : t('main.invoicesHeading')
                }
                action={
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        onClick={() => setCreateInvoiceOpen(true)}
                    >
                        <Plus className="mr-1 size-3.5" />
                        {t('main.createInvoice')}
                    </MyButton>
                }
            >
                {selectedStudent?.user_id && instituteDetails?.id && (
                    <CreateInvoiceDialog
                        userId={selectedStudent.user_id}
                        userName={selectedStudent.full_name}
                        instituteId={instituteDetails.id}
                        open={createInvoiceOpen}
                        onOpenChange={(o) => {
                            setCreateInvoiceOpen(o);
                            if (!o) setEditSource(null);
                        }}
                        editInvoice={editSource}
                        onSuccess={invalidateInvoices}
                    />
                )}
                {isLoadingInvoices ? (
                    <div className="flex items-center justify-center rounded-lg border border-border bg-muted p-6">
                        <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-card-foreground" />
                        <span className="ms-2 text-sm text-muted-foreground">{t('main.loadingInvoices')}</span>
                    </div>
                ) : (
                    <InvoicesList
                        invoices={invoicesData || []}
                        instituteId={instituteDetails?.id ?? ''}
                        onRefresh={invalidateInvoices}
                        onEdit={handleEditInvoice}
                    />
                )}
            </ProfileSectionCard>

            {/* Transaction History — append-only ledger entries from user_account_ledger.
                Shows every debit (invoice raised, penalty) and credit (payment, waiver,
                adjustment) with sign-coded colours. Newest-first, server-paginated. */}
            {selectedStudent?.user_id && instituteDetails?.id && (
                <ProfileSectionCard icon={ClockCounterClockwise} heading={t('transactionHistory.heading')}>
                    <TransactionHistory
                        userId={selectedStudent.user_id}
                        instituteId={instituteDetails.id}
                    />
                </ProfileSectionCard>
            )}
        </div>
    );
};
