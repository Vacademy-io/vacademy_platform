import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { CpoInstallmentsEditor } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-payment-history/cpo-installments-editor';
import { useQuery } from '@tanstack/react-query';
import {
    getInvoicesByUser,
    downloadInvoicePdf,
    buildInvoiceFilename,
    type InvoiceSummary,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { Download, ExternalLink, FileText, Lock } from 'lucide-react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string | null;
    userName?: string | null;
    /** Short context line ("Sub-org admin", "Learner — Class · 2026-2027", "Team member"). */
    subtitle?: string;
    /** When true, the installment editor is visually disabled. The parent-institute
     *  admin is the only role that can edit a sub-org admin's CPO ledger; sub-org
     *  admins must NOT edit their own finance agreement. Backend also enforces. */
    readOnly?: boolean;
}

/**
 * Right-side drawer that surfaces CPO installments + invoices for any user — same component
 * the learners-list side-view uses. `CpoInstallmentsEditor` silently renders nothing for
 * users without a CPO UserPlan, so it's safe to mount for FREE learners / team members too.
 */
export function MemberHistoryDrawer({
    open,
    onOpenChange,
    userId,
    userName,
    subtitle,
    readOnly = false,
}: Props) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]"
            >
                <SheetHeader className="border-b px-6 py-4">
                    <SheetTitle className="text-lg">
                        {userName || 'Member'}
                    </SheetTitle>
                    {subtitle && (
                        <SheetDescription>{subtitle}</SheetDescription>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {userId ? (
                        <div className="space-y-6">
                            {readOnly && (
                                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <div>
                                        <p className="font-medium">Read-only ledger</p>
                                        <p>
                                            Only the parent institute admin can edit
                                            installments, apply CPO discounts, or record
                                            offline payments on this sub-org admin&apos;s
                                            ledger.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {/*
                              CpoInstallmentsEditor doesn't expose a readOnly prop, so we
                              gate it visually + interactively at the wrapper. The backend
                              also enforces — PUT installment / cpo-discount / record
                              offline-payment endpoints return 403 for sub-org admins.
                            */}
                            <div
                                className={
                                    readOnly
                                        ? 'pointer-events-none select-none opacity-60'
                                        : ''
                                }
                                aria-disabled={readOnly}
                            >
                                <CpoInstallmentsEditor userId={userId} />
                            </div>

                            {/* Invoices are read-only for everyone; no gating needed. */}
                            <InvoicesSection userId={userId} />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No member selected.</p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function InvoicesSection({ userId }: { userId: string }) {
    const { data: invoices = [], isLoading } = useQuery<InvoiceSummary[]>({
        queryKey: ['member-invoices', userId],
        queryFn: () => getInvoicesByUser(userId),
        enabled: !!userId,
    });

    if (isLoading) {
        return (
            <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FileText className="h-4 w-4" />
                    Invoices
                </h3>
                <p className="text-xs text-muted-foreground">Loading invoices...</p>
            </section>
        );
    }

    if (invoices.length === 0) return null;

    return (
        <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FileText className="h-4 w-4" />
                Invoices ({invoices.length})
            </h3>
            <ul className="space-y-1 rounded-md border">
                {invoices.map((inv) => {
                    const number =
                        inv.invoice_number || inv.invoiceNumber || inv.id;
                    const date = inv.invoice_date || inv.invoiceDate;
                    const amount = inv.total_amount ?? inv.totalAmount;
                    const url = inv.pdf_url || inv.pdfUrl;
                    return (
                        <li
                            key={inv.id}
                            className="flex items-center justify-between gap-2 border-b border-muted px-3 py-2 text-xs last:border-b-0"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{number}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {date ? fmtDate(date) : '—'}
                                    {inv.status ? ` · ${inv.status}` : ''}
                                </p>
                            </div>
                            <span className="shrink-0 font-medium">{fmtMoney(amount)}</span>
                            {url ? (
                                <div className="flex shrink-0 items-center gap-1">
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title="View PDF in new tab"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        View
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            downloadInvoicePdf(url, buildInvoiceFilename(inv))
                                        }
                                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title="Download invoice PDF"
                                    >
                                        <Download className="h-3 w-3" />
                                        Save
                                    </button>
                                </div>
                            ) : (
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                    No PDF
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function fmtMoney(v: number | null | undefined): string {
    if (v == null) return '—';
    return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
    if (!d) return '—';
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}
