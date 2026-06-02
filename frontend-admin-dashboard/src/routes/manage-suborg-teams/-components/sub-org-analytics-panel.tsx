import { useQuery } from '@tanstack/react-query';
import {
    Wallet,
    Users,
    FileText,
    BookOpen,
    GraduationCap,
    ChevronDown,
    CircleCheck,
    Download,
    ExternalLink,
} from 'lucide-react';
import {
    getSubOrgFinanceDetail,
    getScopedInvites,
    getInvoicesByUser,
    downloadInvoicePdf,
    buildInvoiceFilename,
    type SubOrgFinanceDetail,
    type InvoiceSummary,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { getInvoiceDownloadUrl } from '@/services/invoice-service';

/**
 * Pick a working URL for an invoice — same pattern manage-students payment-history
 * uses. Direct `pdf_url` first; otherwise the canonical
 * /v1/invoices/{invoiceId}/download endpoint (which now regenerates the PDF on the
 * fly when the persisted Invoice has no fileId). Synthetic SFP rows that have a
 * linked real Invoice expose its id on `inv.id`, so this resolver naturally hits
 * the right endpoint without any SFP-specific path. Rows that are still synthetic
 * (id starts with `sfp:`) have no payment yet → No PDF is correct.
 */
function resolveInvoiceUrl(inv: InvoiceSummary): string | null {
    const direct = inv.pdf_url || inv.pdfUrl;
    if (direct) return direct;
    const fileId = inv.pdf_file_id || inv.pdfFileId || inv.file_id || inv.fileId;
    if (fileId) return getInvoiceDownloadUrl(inv.id);
    // A real Invoice id exists for this synthetic row → call the canonical endpoint,
    // which regenerates the PDF when missing. Rows whose id is still "sfp:..." have
    // no payment yet (DUE/UNPAID) → leave as "No PDF".
    if (typeof inv.id === 'string' && !inv.id.startsWith('sfp:')) {
        const status = String(inv.status || '').toUpperCase();
        if (status === 'PAID' || status === 'PARTIAL' || status === 'PARTIAL_PAID') {
            return getInvoiceDownloadUrl(inv.id);
        }
    }
    return null;
}
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { isCallerSubOrgAdmin } from '@/lib/auth/facultyAccessUtils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Copy, Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { MemberHistoryDrawer } from '@/routes/manage-custom-teams/sub-orgs/-components/member-history-drawer';
import { RecordSubOrgPaymentDialog } from '@/routes/manage-custom-teams/sub-orgs/-components/record-sub-org-payment-dialog';
import {
    triggerInvoiceReminderForSfp,
    sendInvoiceReminder,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { CreateInvoiceDialog } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-payment-history/create-invoice-dialog';
// Add-admin-user form (CPO installment editor + discount card). Used to be mounted
// at deep-page level which made it visible on every tab; it now lives inside the
// Admin Payment tab where the admin enrollment context belongs.
import { AddUserToSubOrgSection } from '@/routes/manage-custom-teams/sub-orgs/-components/sub-org-detail-modal';
import { MarkPaidDialog } from '@/routes/manage-custom-teams/sub-orgs/-components/mark-paid-dialog';
import { CustomTeamsList } from '@/routes/manage-custom-teams/-components/custom-teams-list';

interface Props {
    subOrgId: string;
    subOrgName?: string;
    /**
     * When true, the panel only renders the **Admin payment** + **Team** tabs
     * (and their corresponding KPI tile). Used by the sub-org-admin route
     * `/manage-suborg-teams` — sub-org admins don't need to browse course/learner/
     * invoice detail; only their own payment status and their team members.
     *
     * Defaults to `false` (full 5-tab + 4-tile view) so the institute-admin deep
     * route `/manage-custom-teams/sub-orgs/$slug` stays unaffected.
     */
    restrictedView?: boolean;
}

/**
 * Analytics dashboard for /manage-suborg-teams.
 *
 * Aggregates four data sources (all already endpoints we built earlier):
 *  - `getSubOrgFinanceDetail`  → admin payment + learners
 *  - `getScopedInvites`        → which package sessions the sub-org has access to
 *  - `getInvoicesByUser`       → invoices generated for the admin (per-user list)
 *
 * Renders four tiles + a learner roster + an invoice list. Click "View ledger"
 * to expand the admin's CPO installment table.
 */
export function SubOrgAnalyticsPanel({ subOrgId, subOrgName, restrictedView = false }: Props) {
    const instituteId = getCurrentInstituteId();

    const { data: finance, isLoading: financeLoading } = useQuery<SubOrgFinanceDetail>({
        queryKey: ['sub-org-finance-detail', subOrgId],
        queryFn: () => getSubOrgFinanceDetail(subOrgId, instituteId || undefined),
        enabled: !!subOrgId,
    });

    const { data: scopedInvites = [] } = useQuery<any[]>({
        queryKey: ['sub-org-scoped-invites', subOrgId],
        queryFn: () => getScopedInvites(subOrgId),
        enabled: !!subOrgId,
    });

    const adminUserId = finance?.admin_payment?.user_id;
    const { data: invoices = [] } = useQuery<InvoiceSummary[]>({
        queryKey: ['sub-org-admin-invoices', adminUserId],
        queryFn: () => getInvoicesByUser(adminUserId!),
        enabled: !!adminUserId,
    });

    const admin = finance?.admin_payment;
    const learners = finance?.learners || [];
    const totals = finance?.totals;

    // Distinct package sessions across all scoped invites.
    const psList = collectPackageSessions(scopedInvites);

    const [showLedger, setShowLedger] = useState(false);
    const [activeTab, setActiveTab] = useState<'admin' | 'courses' | 'learners' | 'invoices' | 'team'>('admin');
    const [drawer, setDrawer] = useState<{
        userId: string;
        name?: string;
        subtitle?: string;
    } | null>(null);
    const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
    // Create Invoice CTA in the Invoices tab — surfaces the same dialog the drawer
    // uses, but pre-targeted at the sub-org admin user. Without this the only way
    // to raise an admin invoice was to open the per-user drawer first.
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    // Per-row PENDING_PAYMENT actions on the Invoices tab.
    //   copiedLinkId   — flips the Copy Link button to "Copied" for 2s
    //   markPaidTarget — opens MarkPaidDialog scoped to one invoice
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
    const [markPaidTarget, setMarkPaidTarget] = useState<{ id: string; number?: string } | null>(null);

    const handleCopyInvoiceLink = async (invoiceId: string, link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiedLinkId(invoiceId);
            toast.success('Payment link copied');
            window.setTimeout(() => {
                setCopiedLinkId((prev) => (prev === invoiceId ? null : prev));
            }, 2000);
        } catch (_err) {
            toast.error('Could not copy to clipboard');
        }
    };

    const queryClient = useQueryClient();
    // Track which row is currently sending a reminder so we can show a per-row spinner
    // instead of disabling every Remind button on the page. One id space serves both
    // the SFP reminder and the admin-invoice reminder — only one row can be in flight
    // at a time per click.
    const [remindingId, setRemindingId] = useState<string | null>(null);
    const remindMutation = useMutation({
        mutationFn: (sfpId: string) => triggerInvoiceReminderForSfp(sfpId),
        onMutate: (sfpId) => setRemindingId(sfpId),
        onSettled: () => setRemindingId(null),
        onSuccess: (data) => {
            toast.success(
                data?.recipient_email
                    ? `Reminder sent to ${data.recipient_email}`
                    : 'Reminder fired'
            );
            if (adminUserId) {
                queryClient.invalidateQueries({
                    queryKey: ['sub-org-admin-invoices', adminUserId],
                });
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Failed to send reminder');
        },
    });

    // Separate mutation for the admin-invoice reminder (POST /v1/invoices/{id}/send-reminder).
    // Different endpoint + payload shape than the SFP reminder, but shares the
    // remindingId state so the UI only spins one row at a time.
    const invoiceReminderMutation = useMutation({
        mutationFn: (invoiceId: string) => sendInvoiceReminder(invoiceId),
        onMutate: (invoiceId) => setRemindingId(invoiceId),
        onSettled: () => setRemindingId(null),
        onSuccess: (data) => {
            // Report channels honestly — email may be off in INVOICE_SETTING, in
            // which case only the in-app alert fired; admin should know that.
            const channels: string[] = [];
            if (data.alert_sent) channels.push('in-app');
            if (data.email_sent) channels.push('email');
            const where = data.recipient_email ? ` to ${data.recipient_email}` : '';
            toast.success(
                channels.length > 0
                    ? `Reminder sent${where} via ${channels.join(' + ')}`
                    : `Reminder${where} — no channels delivered (check institute Invoice Settings)`
            );
            if (adminUserId) {
                queryClient.invalidateQueries({
                    queryKey: ['sub-org-admin-invoices', adminUserId],
                });
            }
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Failed to send invoice reminder');
        },
    });

    // The CTAs only make sense for the parent institute admin — sub-org admins can't
    // edit their own CPO ledger or fire reminders against themselves.
    const canEditLedger = !restrictedView && !isCallerSubOrgAdmin();
    const adminUserPlanId = admin?.user_plan_id || null;
    const nextDueRemaining = admin?.next_due
        ? (admin.next_due.amount_expected ?? 0) - (admin.next_due.amount_paid ?? 0)
        : 0;
    const suggestedAmount = nextDueRemaining > 0
        ? nextDueRemaining
        : (admin?.outstanding_amount ?? undefined);

    if (financeLoading) {
        return (
            <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
                Loading sub-org analytics…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Tile row — full view shows all 4 tiles, restricted view (sub-org admin)
                shows only the Admin payment tile since the other tabs are hidden. */}
            <div
                className={
                    restrictedView
                        ? 'grid gap-3 sm:grid-cols-1'
                        : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
                }
            >
                <Tile
                    icon={<Wallet className="h-4 w-4 text-emerald-600" />}
                    label="Admin payment"
                    primary={admin?.payment_type || 'No plan'}
                    secondary={
                        admin?.payment_type === 'CPO'
                            ? `Outstanding ${fmtMoney(admin?.outstanding_amount)}`
                            : admin?.user_plan_status || '—'
                    }
                />
                {!restrictedView && (
                    <>
                        <Tile
                            icon={<Users className="h-4 w-4 text-blue-600" />}
                            label={(() => {
                                const seat = finance?.seat_usage;
                                if (!seat || seat.total == null) return 'Learners';
                                return `Learners · ${seat.used ?? 0}/${seat.total} seats`;
                            })()}
                            primary={String(totals?.learner_count ?? 0)}
                            secondary={(() => {
                                const seat = finance?.seat_usage;
                                const outstanding = `Total outstanding ${fmtMoney(totals?.total_outstanding)}`;
                                if (seat && seat.remaining != null) {
                                    return `${outstanding} · ${seat.remaining} seat${
                                        seat.remaining === 1 ? '' : 's'
                                    } left`;
                                }
                                return outstanding;
                            })()}
                        />
                        <Tile
                            icon={<FileText className="h-4 w-4 text-purple-600" />}
                            label="Invoices"
                            primary={String(invoices.length)}
                            secondary={
                                adminUserId ? `Generated for admin` : 'No admin linked yet'
                            }
                        />
                        <Tile
                            icon={<BookOpen className="h-4 w-4 text-amber-600" />}
                            label="PS access"
                            primary={String(psList.length)}
                            secondary={`${scopedInvites.length} scoped invite${
                                scopedInvites.length === 1 ? '' : 's'
                            }`}
                        />
                    </>
                )}
            </div>

            {/* Horizontal tabs — each tab renders its own dataset lazily on click. */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                className="w-full"
            >
                <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-md border bg-white p-1">
                    <TabsTrigger value="admin" className="gap-2">
                        <Wallet className="h-3.5 w-3.5" />
                        Admin payment
                    </TabsTrigger>
                    {!restrictedView && (
                        <>
                            <TabsTrigger value="courses" className="gap-2">
                                <BookOpen className="h-3.5 w-3.5" />
                                Courses
                                <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                                    {psList.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="learners" className="gap-2">
                                <GraduationCap className="h-3.5 w-3.5" />
                                Learners
                                <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                                    {learners.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="invoices" className="gap-2">
                                <FileText className="h-3.5 w-3.5" />
                                Invoices
                                <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                                    {invoices.length}
                                </Badge>
                            </TabsTrigger>
                        </>
                    )}
                    <TabsTrigger value="team" className="gap-2">
                        <Users className="h-3.5 w-3.5" />
                        Team
                    </TabsTrigger>
                </TabsList>

                {/* Admin payment */}
                <TabsContent value="admin" className="mt-3">
                    <section className="rounded-lg border bg-white p-4">
                        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <Wallet className="h-4 w-4" />
                                Admin payment{subOrgName ? ` — ${subOrgName}` : ''}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                {admin?.payment_type === 'CPO' && (
                                    <Badge variant="secondary">
                                        {admin.pending_installments_count ?? 0} pending
                                    </Badge>
                                )}
                                {/* Record an arbitrary amount and FIFO-fill it across the
                                    admin's pending CPO installments. Same dialog the
                                    Invoices tab exposes — surfaced here too because the
                                    installment buckets visually live on this tab, so
                                    "Record payment against these installments" is the
                                    natural CTA next to them. */}
                                {canEditLedger && adminUserPlanId && (
                                    <MyButton
                                        type="button"
                                        buttonType="primary"
                                        scale="small"
                                        onClick={() => setRecordPaymentOpen(true)}
                                    >
                                        <Plus className="size-4" />
                                        Record Offline Payment
                                    </MyButton>
                                )}
                            </div>
                        </header>
                        {admin?.user_id ? (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">
                                            {admin.full_name || admin.user_id}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {admin.payment_type || 'unknown plan'}
                                            {admin.user_plan_status
                                                ? ` · ${admin.user_plan_status}`
                                                : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDrawer({
                                                userId: admin.user_id!,
                                                name: admin.full_name || admin.user_id,
                                                subtitle: 'Sub-org admin',
                                            })
                                        }
                                        className="shrink-0 rounded border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                                    >
                                        Open history
                                    </button>
                                </div>
                                {admin.payment_type === 'CPO' && (
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                        <Metric label="Total" value={fmtMoney(admin.total_amount)} />
                                        <Metric label="Paid" value={fmtMoney(admin.paid_amount)} />
                                        <Metric
                                            label="Outstanding"
                                            value={fmtMoney(admin.outstanding_amount)}
                                        />
                                    </div>
                                )}
                                {admin.next_due && (
                                    <div className="mt-2 rounded bg-muted/40 p-2 text-xs">
                                        <span className="text-muted-foreground">Next due: </span>
                                        <span className="font-medium">
                                            {fmtMoney(admin.next_due.amount_expected)}
                                        </span>
                                        {admin.next_due.due_date && (
                                            <span className="text-muted-foreground">
                                                {' '}
                                                on {fmtDate(admin.next_due.due_date)}
                                            </span>
                                        )}
                                        <span className="text-muted-foreground">
                                            {' '}
                                            ({admin.next_due.status})
                                        </span>
                                    </div>
                                )}
                                {admin.installments && admin.installments.length > 0 && (
                                    <button
                                        type="button"
                                        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowLedger((v) => !v)}
                                    >
                                        <ChevronDown
                                            className={`h-3 w-3 transition-transform ${
                                                showLedger ? 'rotate-180' : ''
                                            }`}
                                        />
                                        {showLedger ? 'Hide' : 'View'} full ledger (
                                        {admin.installments.length})
                                    </button>
                                )}
                                {showLedger && admin.installments && (
                                    <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded bg-muted/30 p-2 text-xs">
                                        {admin.installments.map((inst, idx) => (
                                            <div
                                                key={inst.student_fee_payment_id}
                                                className="flex items-center justify-between border-b border-muted py-1 last:border-b-0"
                                            >
                                                <span className="text-muted-foreground">
                                                    #{idx + 1}
                                                    {inst.due_date
                                                        ? ` · ${fmtDate(inst.due_date)}`
                                                        : ''}
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <span>{fmtMoney(inst.amount_expected)}</span>
                                                    <Badge
                                                        variant={
                                                            inst.status === 'PAID'
                                                                ? 'default'
                                                                : 'secondary'
                                                        }
                                                        className="h-4 px-1.5 text-[10px]"
                                                    >
                                                        {inst.status}
                                                    </Badge>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No admin has redeemed the invite yet.
                            </p>
                        )}
                    </section>

                    {/* Direct "Add admin user" form — CPO installment editor + discount
                        card live in this section. Lets the institute admin enroll the
                        sub-org admin directly (with installment overrides) instead of
                        waiting for them to accept the invite link. Hidden from sub-org
                        admins via the restrictedView gate so they don't see an admin-
                        management form on their own /manage-suborg-teams page. */}
                    {!restrictedView && instituteId && (
                        <div className="mt-4 rounded-lg border bg-white p-4">
                            <AddUserToSubOrgSection
                                subOrgId={subOrgId}
                                instituteId={instituteId}
                                scopedInvites={scopedInvites}
                            />
                        </div>
                    )}
                </TabsContent>

                {/* Courses / Learners / Invoices — hidden in restricted (sub-org-admin) view. */}
                {!restrictedView && <>
                <TabsContent value="courses" className="mt-3">
                    <section className="rounded-lg border bg-white p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <BookOpen className="h-4 w-4" />
                            Package-session access ({psList.length})
                        </h3>
                        {psList.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No active scoped invites — no learner access.
                            </p>
                        ) : (
                            <ul className="grid gap-2 sm:grid-cols-2">
                                {psList.map((ps) => (
                                    <li
                                        key={ps.id}
                                        className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                                    >
                                        <span className="truncate">{ps.label}</span>
                                        <Badge variant="outline" className="shrink-0 text-[10px]">
                                            PS
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </TabsContent>

                {/* Learners */}
                <TabsContent value="learners" className="mt-3">
                    <section className="rounded-lg border bg-white p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <GraduationCap className="h-4 w-4" />
                            Learners ({learners.length})
                        </h3>
                        {learners.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No learners enrolled yet.
                            </p>
                        ) : (
                            <div className="max-h-[60vh] space-y-1 overflow-y-auto rounded-md border">
                                {learners.map((l) => {
                                    const hasDues =
                                        (l.pending_installments_count ?? 0) > 0
                                        || (l.outstanding_amount ?? 0) > 0;
                                    return (
                                        <button
                                            type="button"
                                            key={l.user_id}
                                            onClick={() =>
                                                setDrawer({
                                                    userId: l.user_id,
                                                    name: l.full_name || l.user_id,
                                                    subtitle: 'Learner',
                                                })
                                            }
                                            className="flex w-full items-center justify-between border-b border-muted px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-medium">
                                                    {l.full_name || l.user_id}
                                                </p>
                                                {l.enrolled_date && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Enrolled {fmtDate(l.enrolled_date)}
                                                    </p>
                                                )}
                                            </div>
                                            {hasDues ? (
                                                <div className="text-right text-xs">
                                                    <span className="font-medium text-amber-700">
                                                        {fmtMoney(l.outstanding_amount)}
                                                    </span>
                                                    <span className="ml-1 text-muted-foreground">
                                                        ({l.pending_installments_count} due)
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </TabsContent>

                {/* Invoices */}
                <TabsContent value="invoices" className="mt-3">
                    <section className="rounded-lg border bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <FileText className="h-4 w-4" />
                                Invoices ({invoices.length})
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                {adminUserId && (
                                    <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => setCreateInvoiceOpen(true)}
                                    >
                                        <Plus className="size-4" />
                                        Create Invoice
                                    </MyButton>
                                )}
                                {canEditLedger && adminUserPlanId && (
                                    <MyButton
                                        type="button"
                                        buttonType="primary"
                                        scale="small"
                                        onClick={() => setRecordPaymentOpen(true)}
                                    >
                                        <Plus className="size-4" />
                                        Record Offline Payment
                                    </MyButton>
                                )}
                            </div>
                        </div>
                        {invoices.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No invoices generated yet.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {invoices.map((inv) => {
                                    const number =
                                        inv.invoice_number || inv.invoiceNumber || inv.id;
                                    const date = inv.invoice_date || inv.invoiceDate;
                                    const amount = inv.total_amount ?? inv.totalAmount;
                                    const url = resolveInvoiceUrl(inv);
                                    const status = String(inv.status || '').toUpperCase();
                                    // Synthetic SFP rows carry id "sfp:<sfpId>". The Remind button only fires for those —
                                    // real Invoice rows are receipts (PAID), not future obligations.
                                    const isSfpRow = typeof inv.id === 'string' && inv.id.startsWith('sfp:');
                                    const sfpId = isSfpRow ? inv.id.slice('sfp:'.length) : null;
                                    const isRemindable =
                                        canEditLedger
                                        && !!sfpId
                                        && (status === 'PENDING'
                                            || status === 'UNPAID'
                                            || status === 'OVERDUE'
                                            || status === 'PARTIAL'
                                            || status === 'PARTIAL_PAID');
                                    // Real admin invoices in pending payment carry a
                                    // payment_link and are eligible for Mark Paid; SFP
                                    // synthetic rows are excluded (they have their own
                                    // Remind flow).
                                    const paymentLink = inv.payment_link || inv.paymentLink;
                                    const isPendingAdminInvoice =
                                        !isSfpRow
                                        && status === 'PENDING_PAYMENT'
                                        && typeof inv.id === 'string';
                                    return (
                                        <li
                                            key={inv.id}
                                            className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">{number}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {date ? fmtDate(date) : '—'}
                                                    {inv.status ? ` · ${inv.status}` : ''}
                                                </p>
                                            </div>
                                            <span className="shrink-0 font-medium">
                                                {fmtMoney(amount)}
                                            </span>
                                            {isRemindable && sfpId && (
                                                <button
                                                    type="button"
                                                    onClick={() => remindMutation.mutate(sfpId)}
                                                    disabled={remindingId === sfpId}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                                                    title="Send installment-due reminder"
                                                >
                                                    <Bell className="size-3" />
                                                    {remindingId === sfpId ? 'Sending…' : 'Remind'}
                                                </button>
                                            )}
                                            {isPendingAdminInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        invoiceReminderMutation.mutate(inv.id)
                                                    }
                                                    disabled={remindingId === inv.id}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                                                    title="Re-send the payment-due reminder (email + in-app alert)"
                                                >
                                                    <Bell className="size-3" />
                                                    {remindingId === inv.id ? 'Sending…' : 'Remind'}
                                                </button>
                                            )}
                                            {isPendingAdminInvoice && paymentLink && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyInvoiceLink(inv.id, paymentLink)}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    title="Copy learner payment link"
                                                >
                                                    {copiedLinkId === inv.id ? (
                                                        <>
                                                            <CircleCheck className="size-3" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="size-3" />
                                                            Copy Link
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {isPendingAdminInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setMarkPaidTarget({
                                                            id: inv.id,
                                                            number:
                                                                inv.invoice_number
                                                                || inv.invoiceNumber
                                                                || inv.id,
                                                        })
                                                    }
                                                    className="inline-flex shrink-0 items-center gap-1 rounded border border-primary-300 bg-primary-50 px-2 py-1 text-[10px] uppercase tracking-wide text-primary-700 hover:bg-primary-100"
                                                    title="Record an offline / manual payment for this invoice"
                                                >
                                                    Mark Paid
                                                </button>
                                            )}
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
                        )}
                    </section>
                </TabsContent>

                </>}

                {/* Team members — the existing list with role + status + remove */}
                <TabsContent value="team" className="mt-3">
                    <section className="rounded-lg border bg-white p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <Users className="h-4 w-4" />
                            Team members
                        </h3>
                        <CustomTeamsList mode="subOrg" subOrgId={subOrgId} />
                    </section>
                </TabsContent>
            </Tabs>

            <MemberHistoryDrawer
                open={!!drawer}
                onOpenChange={(o) => !o && setDrawer(null)}
                userId={drawer?.userId || null}
                userName={drawer?.name}
                subtitle={drawer?.subtitle}
                readOnly={isCallerSubOrgAdmin()}
            />

            {canEditLedger && adminUserPlanId && (
                <RecordSubOrgPaymentDialog
                    open={recordPaymentOpen}
                    onOpenChange={setRecordPaymentOpen}
                    userPlanId={adminUserPlanId}
                    adminUserId={adminUserId || undefined}
                    contextLabel={
                        subOrgName ? `${subOrgName} — admin CPO` : 'Sub-org admin CPO'
                    }
                    suggestedAmount={suggestedAmount}
                />
            )}

            {/* Create Invoice from the Invoices tab — pre-targeted at the sub-org admin
                user so an institute admin can raise an ad-hoc invoice without first
                opening the per-user drawer. Invalidates the same query the tab reads
                from so the new row appears immediately. */}
            {adminUserId && instituteId && (
                <CreateInvoiceDialog
                    userId={adminUserId}
                    userName={admin?.full_name || subOrgName || 'Sub-org admin'}
                    instituteId={instituteId}
                    open={createInvoiceOpen}
                    onOpenChange={setCreateInvoiceOpen}
                    onSuccess={() => {
                        queryClient.invalidateQueries({
                            queryKey: ['sub-org-admin-invoices', adminUserId],
                        });
                    }}
                />
            )}

            {/* Mark Paid on any PENDING_PAYMENT row in the Invoices tab. markPaidTarget
                carries the invoice id (for the API call) and the human invoice number
                (for the dialog title + success toast). Refresh the same query the tab
                reads from so the row flips to PAID in place. */}
            <MarkPaidDialog
                open={!!markPaidTarget}
                onOpenChange={(o) => !o && setMarkPaidTarget(null)}
                invoiceId={markPaidTarget?.id || ''}
                invoiceNumber={markPaidTarget?.number}
                onSuccess={() => {
                    if (adminUserId) {
                        queryClient.invalidateQueries({
                            queryKey: ['sub-org-admin-invoices', adminUserId],
                        });
                    }
                }}
            />
        </div>
    );
}

function Tile({
    icon,
    label,
    primary,
    secondary,
}: {
    icon: React.ReactNode;
    label: string;
    primary: string;
    secondary: string;
}) {
    return (
        <div className="rounded-lg border bg-white p-4">
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {icon}
                {label}
            </div>
            <p className="text-lg font-semibold text-gray-900">{primary}</p>
            <p className="text-xs text-muted-foreground">{secondary}</p>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded bg-muted/30 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="text-sm font-medium">{value}</p>
        </div>
    );
}

function collectPackageSessions(invites: any[]): { id: string; label: string }[] {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const inv of invites || []) {
        // Primary shape (current `/scoped-invites` response): each invite carries a
        // `package_sessions: [{ id, package_name, level_name, session_name }]` array
        // — that's the enriched payload the FE Courses card already uses.
        const enriched = (inv?.package_sessions || []) as any[];
        for (const ps of enriched) {
            if (!ps?.id || seen.has(ps.id)) continue;
            seen.add(ps.id);
            const label =
                [ps.package_name, ps.level_name, ps.session_name]
                    .filter(Boolean)
                    .join(' · ') || ps.id;
            out.push({ id: ps.id, label });
        }

        // Legacy shape (kept as a fallback in case any caller still returns the old
        // PSLIPO-mappings array). Skipped when the enriched array is populated.
        if (enriched.length > 0) continue;
        const legacyLinks =
            inv?.package_session_to_payment_options
            || inv?.packageSessionToPaymentOptions
            || [];
        for (const link of legacyLinks) {
            const psId = link?.package_session_id || link?.packageSessionId;
            if (!psId || seen.has(psId)) continue;
            seen.add(psId);
            const label =
                link?.package_session?.name
                || inv?.name
                || inv?.invite_name
                || psId;
            out.push({ id: psId, label });
        }
    }
    return out;
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
