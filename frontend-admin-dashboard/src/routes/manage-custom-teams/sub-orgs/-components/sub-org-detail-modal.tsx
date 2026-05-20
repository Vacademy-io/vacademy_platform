import { useEffect, useMemo, useState } from 'react';
import { MemberHistoryDrawer } from './member-history-drawer';
import { isCallerSubOrgAdmin } from '@/lib/auth/facultyAccessUtils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getSubscriptionStatus,
    getScopedInvites,
    addSubOrgMember,
    getSubOrgFinanceDetail,
    updateSubOrgTeamRoles,
    getAllRoles,
    type SubOrgSubscriptionStatus,
    type AddSubOrgMemberRequest,
    type SubOrgFinanceDetail,
} from '../../-services/custom-team-services';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL, GET_SUB_ORG_ALL_ADMINS } from '@/constants/urls';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Copy, Link2, BookOpen, ShieldCheck, ExternalLink, UserPlus, Loader2, Wallet, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import createInviteLink from '@/routes/manage-students/invite/-utils/createInviteLink';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';
import { getCachedPreferredCountries } from '@/services/domain-routing';

interface SubOrgDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    org: any;
}

export function SubOrgDetailModal({ open, onOpenChange, org }: SubOrgDetailModalProps) {
    const subOrgId =
        org?.sub_org_id || org?.suborgId || org?.subOrgId || org?.suborg_id || org?.id;
    const name =
        org?.name ||
        org?.institute_name ||
        org?.instituteName ||
        org?.subOrgName ||
        'Unknown';
    const instituteId = getCurrentInstituteId();

    // Fetch subscription status (invite link, seat usages)
    const { data: subscriptionStatus, isLoading: isLoadingStatus } =
        useQuery<SubOrgSubscriptionStatus>({
            queryKey: ['sub-org-subscription-status', subOrgId],
            queryFn: () => getSubscriptionStatus(subOrgId),
            enabled: !!subOrgId && open,
        });

    // Fetch scoped invites (courses linked to this sub-org)
    const { data: scopedInvites = [], isLoading: isLoadingInvites } = useQuery<any[]>({
        queryKey: ['sub-org-scoped-invites', subOrgId],
        queryFn: () => getScopedInvites(subOrgId),
        enabled: !!subOrgId && open,
    });

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
    };

    const isLoading = isLoadingStatus || isLoadingInvites;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden sm:max-w-[700px]">
                <DialogHeader className="shrink-0">
                    <DialogTitle>{name}</DialogTitle>
                    <DialogDescription>
                        Sub-organization details, invite link, courses, and admins.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-8">
                        <DashboardLoader />
                    </div>
                ) : (
                    <div className="-mx-2 flex-1 overflow-y-auto px-2">
                        <div className="space-y-6 pb-2">
                            {/* Invite Link Section */}
                            <div className="space-y-2">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <Link2 className="h-4 w-4" />
                                    Invite Link
                                </h3>
                                {subscriptionStatus?.invite_code ? (
                                    <div className="space-y-2 rounded-md border bg-muted/50 p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Invite Link
                                            </span>
                                            {subscriptionStatus.org_user_plan_status && (
                                                <Badge
                                                    variant={
                                                        subscriptionStatus.org_user_plan_status ===
                                                        'ACTIVE'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {subscriptionStatus.org_user_plan_status}
                                                </Badge>
                                            )}
                                        </div>
                                        {/* Full invite link */}
                                        <div className="flex items-center gap-2 rounded bg-white p-2">
                                            <span className="min-w-0 flex-1 truncate text-xs font-mono text-primary select-all">
                                                {subscriptionStatus.short_url ||
                                                    createInviteLink(subscriptionStatus.invite_code)}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 shrink-0 gap-1 px-2"
                                                onClick={() =>
                                                    copyToClipboard(
                                                        subscriptionStatus.short_url ||
                                                            createInviteLink(subscriptionStatus.invite_code),
                                                        'Invite link'
                                                    )
                                                }
                                            >
                                                <Copy className="h-3 w-3" />
                                                Copy
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 shrink-0 gap-1 px-2"
                                                onClick={() =>
                                                    window.open(
                                                        subscriptionStatus.short_url ||
                                                            createInviteLink(subscriptionStatus.invite_code),
                                                        '_blank'
                                                    )
                                                }
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Open
                                            </Button>
                                        </div>
                                        {/* Invite code (secondary) */}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Code:</span>
                                            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                                                {subscriptionStatus.invite_code}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0"
                                                onClick={() =>
                                                    copyToClipboard(
                                                        subscriptionStatus.invite_code,
                                                        'Invite code'
                                                    )
                                                }
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No invite link configured. Create a subscription to
                                        generate one.
                                    </p>
                                )}
                            </div>

                            {/* Courses Section — flattened package sessions across all
                                active invites for this sub-org, deduped by PS id. */}
                            {(() => {
                                const psMap = new Map<string, { id: string; label: string }>();
                                for (const inv of scopedInvites as any[]) {
                                    for (const ps of (inv?.package_sessions || []) as any[]) {
                                        if (!ps?.id || psMap.has(ps.id)) continue;
                                        const label = [
                                            ps.package_name,
                                            ps.level_name,
                                            ps.session_name,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ') || ps.id;
                                        psMap.set(ps.id, { id: ps.id, label });
                                    }
                                }
                                const psList = Array.from(psMap.values());
                                return (
                                    <div className="space-y-2">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <BookOpen className="h-4 w-4" />
                                            Courses ({psList.length})
                                        </h3>
                                        {psList.length > 0 ? (
                                            <div className="space-y-2">
                                                {psList.map((ps) => (
                                                    <div
                                                        key={ps.id}
                                                        className="flex items-center justify-between rounded-md border p-3"
                                                    >
                                                        <p className="text-sm font-medium">
                                                            {ps.label}
                                                        </p>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            PS
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No courses assigned yet.
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Seat Usage Section */}
                            {subscriptionStatus?.seat_usages &&
                                subscriptionStatus.seat_usages.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-gray-700">
                                            Seat Usage
                                        </h3>
                                        <div className="space-y-2">
                                            {subscriptionStatus.seat_usages.map((su) => (
                                                <div
                                                    key={su.package_session_id}
                                                    className="flex items-center justify-between rounded-md border p-3"
                                                >
                                                    <span className="text-sm">
                                                        {su.package_name ||
                                                            su.package_session_id}
                                                    </span>
                                                    <span className="text-sm font-medium">
                                                        {su.used_seats} / {su.total_seats} seats
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {/* Admins Section */}
                            {/* Allowed team roles — parent admin can edit which custom
                                roles the sub-org admin may assign on /manage-suborg-teams. */}
                            <AllowedTeamRolesSection
                                subOrgId={subOrgId}
                                scopedInvites={scopedInvites}
                            />

                            <SubOrgAdminsSection subOrgId={subOrgId} />

                            {/* Finance Section — admin's CPO ledger + learner outstanding dues */}
                            <SubOrgFinanceSection subOrgId={subOrgId} />

                            {/* Add User Section — kept inside the scroll area so the dialog
                                doesn't grow past the viewport when the form expands. */}
                            <AddUserToSubOrgSection
                                subOrgId={subOrgId}
                                instituteId={instituteId || ''}
                                scopedInvites={scopedInvites}
                            />
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AddUserToSubOrgSection({
    subOrgId,
    instituteId,
    scopedInvites,
}: {
    subOrgId: string;
    instituteId: string;
    scopedInvites: any[];
}) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    // (Course + role pickers removed — both are inherited from sub-org creation.)

    // Per-learner payment-option override. "FREE" → no override (default).
    // A CPO mirror id → backend generates SFPs + applies cpoConfig + FIFO-allocates payment.
    const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState<string>('FREE');

    // Default the admin-payment selection to whatever was picked at sub-org creation
    // (the org-level invite carries the CPO id). Falls back to FREE when the sub-org
    // was created without a CPO. Only seeds once when the form is first opened — admin
    // can still flip it manually afterwards.
    const subOrgDefaultCpoId = useMemo<string | null>(() => {
        for (const inv of scopedInvites as any[]) {
            if (inv?.payment_type === 'CPO' && inv?.complex_payment_option_id) {
                return String(inv.complex_payment_option_id);
            }
        }
        return null;
    }, [scopedInvites]);
    const [hasSeededPaymentOption, setHasSeededPaymentOption] = useState(false);
    useEffect(() => {
        if (!showForm || hasSeededPaymentOption) return;
        if (subOrgDefaultCpoId) {
            setSelectedPaymentOptionId(subOrgDefaultCpoId);
        }
        setHasSeededPaymentOption(true);
    }, [showForm, subOrgDefaultCpoId, hasSeededPaymentOption]);
    // Per-installment edits keyed by aft_installment_id.
    type InstallmentEdit = {
        amount?: string;
        dueDate?: string;
        discountValue?: string;
        discountType?: 'PERCENTAGE' | 'FLAT';
    };
    const [installmentEdits, setInstallmentEdits] = useState<Record<string, InstallmentEdit>>({});
    const [cpoDiscountValue, setCpoDiscountValue] = useState<string>('');
    const [cpoDiscountType, setCpoDiscountType] = useState<'PERCENTAGE' | 'FLAT'>('PERCENTAGE');

    // Optional manual offline-payment recording for the new member.
    const [paymentMode, setPaymentMode] = useState<'SKIP' | 'OFFLINE'>('SKIP');
    const [offlineAmount, setOfflineAmount] = useState<string>('');
    const [offlineCurrency, setOfflineCurrency] = useState<string>('INR');
    const [offlineReference, setOfflineReference] = useState<string>('');
    const [offlineDate, setOfflineDate] = useState<string>(''); // yyyy-mm-dd
    const [generateInvoice, setGenerateInvoice] = useState<boolean>(false);

    // Fetch the institute's CPO list so the admin can pick a per-learner CPO.
    const { data: cpoListResponse } = useQuery({
        queryKey: ['sub-org-add-user-cpo-list', instituteId],
        queryFn: async () => {
            const url = `${BASE_URL}/admin-core-service/v1/fee-management/cpo/${instituteId}`;
            const resp = await authenticatedAxiosInstance({
                method: 'GET',
                url,
                params: { pageNo: 0, pageSize: 100 },
            });
            return resp.data;
        },
        enabled: showForm && !!instituteId,
        staleTime: 30000,
    });
    const cpoList: Array<{ id: string; name: string; status?: string }> =
        (cpoListResponse?.content || []).filter((c: any) => c.status === 'ACTIVE');

    // Fetch the full CPO template when admin picks one. Used to render the installment editor.
    const { data: cpoFullDetails, isLoading: isLoadingCpoTemplate } = useQuery({
        queryKey: ['sub-org-add-user-cpo-full', selectedPaymentOptionId],
        queryFn: async () => {
            // selectedPaymentOptionId is the PaymentOption mirror id; we need the CPO id.
            // Find the matching cpo in cpoList — they share the same id-space via mirror.
            const url = `${BASE_URL}/admin-core-service/v1/fee-management/cpo/${selectedPaymentOptionId}/full`;
            const resp = await authenticatedAxiosInstance({ method: 'GET', url });
            return resp.data;
        },
        enabled: showForm && selectedPaymentOptionId !== 'FREE' && !!selectedPaymentOptionId,
        staleTime: 30000,
    });

    // Flatten the CPO template into a per-installment list for the editor.
    type InstallmentRow = {
        aftInstallmentId: string;
        feeTypeName: string;
        installmentNumber: number;
        defaultAmount: number;
        defaultDueDate?: string;
    };
    const installmentRows: InstallmentRow[] = ((): InstallmentRow[] => {
        const rows: InstallmentRow[] = [];
        const feeTypes = (cpoFullDetails as any)?.feeTypes
            || (cpoFullDetails as any)?.fee_types
            || [];
        for (const ft of feeTypes) {
            const afv = ft?.assignedFeeValue || ft?.assigned_fee_value;
            const installments = afv?.installments || [];
            for (const inst of installments) {
                rows.push({
                    aftInstallmentId: inst.id,
                    feeTypeName: ft.name || 'Fee',
                    installmentNumber: inst.installmentNumber ?? inst.installment_number,
                    defaultAmount: Number(inst.amount ?? 0),
                    defaultDueDate: inst.dueDate || inst.due_date,
                });
            }
        }
        rows.sort((a, b) => a.installmentNumber - b.installmentNumber);
        return rows;
    })();

    // Auto-derive every PS this sub-org owns + the auth role for the admin — both were
    // chosen at sub-org creation, so the admin shouldn't be re-asked here.
    type AdminPs = { id: string; label: string };
    const adminPsList: AdminPs[] = ((): AdminPs[] => {
        const seen = new Map<string, AdminPs>();
        for (const inv of scopedInvites as any[]) {
            for (const ps of (inv?.package_sessions || []) as any[]) {
                if (!ps?.id || seen.has(ps.id)) continue;
                const label = [ps.package_name, ps.level_name, ps.session_name]
                    .filter(Boolean)
                    .join(' · ') || ps.id;
                seen.set(ps.id, { id: ps.id, label });
            }
        }
        return Array.from(seen.values());
    })();

    // First auth role from any invite's setting_json (e.g. {"setting":{"SUB_ORG_SETTING":
    // {"AUTH_ROLES":["TEACHER"]}}}). Falls back to STUDENT if absent.
    const derivedRoleName: string = ((): string => {
        for (const inv of scopedInvites as any[]) {
            const raw = inv?.setting_json;
            if (!raw) continue;
            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const roles = parsed?.setting?.SUB_ORG_SETTING?.AUTH_ROLES;
                if (Array.isArray(roles) && roles.length > 0) return String(roles[0]);
            } catch {
                /* fall through */
            }
        }
        return 'STUDENT';
    })();

    const mutation = useMutation({
        mutationFn: addSubOrgMember,
        onSuccess: (data) => {
            const parts: string[] = [data.message || 'User added to sub-organization'];
            if (data.payment_log_id) parts.push('payment recorded');
            if (data.invoice_id) parts.push('invoice generated');
            toast.success(parts.join(' · '));
            queryClient.invalidateQueries({ queryKey: ['sub-org-admins-detail', subOrgId] });
            queryClient.invalidateQueries({
                queryKey: ['sub-org-subscription-status', subOrgId],
            });
            queryClient.invalidateQueries({ queryKey: ['sub-org-finance-detail', subOrgId] });
            resetForm();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to add user');
        },
    });

    const resetForm = () => {
        setFullName('');
        setEmail('');
        setMobileNumber('');
        setPaymentMode('SKIP');
        setOfflineAmount('');
        setOfflineCurrency('INR');
        setOfflineReference('');
        setOfflineDate('');
        setGenerateInvoice(false);
        setSelectedPaymentOptionId('FREE');
        setHasSeededPaymentOption(false);
        setInstallmentEdits({});
        setCpoDiscountValue('');
        setCpoDiscountType('PERCENTAGE');
        setShowForm(false);
    };

    const handleSubmit = () => {
        if (!fullName.trim()) {
            toast.error('Full name is required');
            return;
        }
        if (!email.trim()) {
            toast.error('Email is required');
            return;
        }
        if (adminPsList.length === 0) {
            toast.error('Sub-org has no package sessions configured');
            return;
        }

        // Manual offline payment validation.
        let amountNum: number | undefined;
        if (paymentMode === 'OFFLINE') {
            amountNum = Number(offlineAmount);
            if (!offlineAmount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
                toast.error('Enter a positive amount for the offline payment');
                return;
            }
        }

        const request: AddSubOrgMemberRequest = {
            user: {
                email: email.trim(),
                full_name: fullName.trim(),
                mobile_number: mobileNumber.trim() || undefined,
                roles: [derivedRoleName],
            },
            // Multi-PS — admin gets access to every PS this sub-org owns in one call.
            package_session_ids: adminPsList.map((p) => p.id),
            sub_org_id: subOrgId,
            institute_id: instituteId,
            comma_separated_org_roles: 'ROOT_ADMIN',
            payment_mode: paymentMode,
            offline_payment_amount: paymentMode === 'OFFLINE' ? amountNum : undefined,
            offline_payment_currency:
                paymentMode === 'OFFLINE' ? (offlineCurrency || 'INR') : undefined,
            offline_payment_reference:
                paymentMode === 'OFFLINE' && offlineReference.trim()
                    ? offlineReference.trim() : undefined,
            offline_payment_date:
                paymentMode === 'OFFLINE' && offlineDate
                    ? new Date(offlineDate).toISOString()
                    : undefined,
            generate_invoice: paymentMode === 'OFFLINE' ? generateInvoice : undefined,
        };

        if (selectedPaymentOptionId !== 'FREE') {
            request.payment_option_id = selectedPaymentOptionId;

            // Build cpo_config from per-installment edits + CPO-level discount, but only
            // include rows the admin actually touched.
            const overrides: AddSubOrgMemberRequest['cpo_config'] = {};
            const edits: NonNullable<AddSubOrgMemberRequest['cpo_config']>['installment_overrides'] = [];
            for (const row of installmentRows) {
                const edit = installmentEdits[row.aftInstallmentId];
                if (!edit) continue;
                const amount =
                    edit.amount && edit.amount.trim() !== '' ? Number(edit.amount) : undefined;
                const dueDate = edit.dueDate || undefined;
                const discountVal =
                    edit.discountValue && edit.discountValue.trim() !== ''
                        ? Number(edit.discountValue)
                        : undefined;
                const hasEdit =
                    amount !== undefined || dueDate || discountVal !== undefined;
                if (!hasEdit) continue;
                edits.push({
                    aft_installment_id: row.aftInstallmentId,
                    amount,
                    due_date: dueDate,
                    discount:
                        discountVal !== undefined
                            ? {
                                  type: edit.discountType || 'PERCENTAGE',
                                  value: discountVal,
                              }
                            : undefined,
                });
            }
            if (edits.length > 0) overrides.installment_overrides = edits;
            if (cpoDiscountValue.trim() !== '') {
                overrides.cpo_discount = {
                    type: cpoDiscountType,
                    value: Number(cpoDiscountValue),
                };
            }
            if (overrides.installment_overrides || overrides.cpo_discount) {
                request.cpo_config = overrides;
            }
        }
        mutation.mutate(request);
    };

    // Hide only if there are literally no courses to assign — otherwise show the form,
    // even when the only invite is the bundled org-level SUB_ORG one.
    if (adminPsList.length === 0) return null;

    return (
        <div className="space-y-3 border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <UserPlus className="h-4 w-4" />
                Add User
            </h3>
            {!showForm && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(true)}
                >
                    <UserPlus className="mr-1 h-3 w-3" />
                    Add User
                </Button>
            )}

            {showForm && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label className="text-xs">Full Name *</Label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Email *</Label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Phone</Label>
                            <PhoneInput
                                country={
                                    (getCachedPreferredCountries()[0] || 'in').toLowerCase()
                                }
                                preferredCountries={
                                    getCachedPreferredCountries().length > 0
                                        ? getCachedPreferredCountries()
                                        : ['us', 'gb', 'in', 'au']
                                }
                                enableSearch
                                placeholder="123 456 7890"
                                value={mobileNumber}
                                onChange={(value) => setMobileNumber(value)}
                                inputClass="!w-full h-8"
                            />
                        </div>
                    </div>

                    {/* Inherited from sub-org creation — admin lands on all PSes + the
                        auth role chosen at creation time. Shown read-only so the operator
                        can verify what's being granted. */}
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
                        <p className="font-medium text-muted-foreground">
                            Inherited from sub-org
                        </p>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">Role:</span>
                            <Badge variant="outline">{derivedRoleName}</Badge>
                        </div>
                        <div>
                            <p className="text-muted-foreground">
                                Courses ({adminPsList.length}):
                            </p>
                            <ul className="ml-3 mt-1 list-disc space-y-0.5">
                                {adminPsList.map((p) => (
                                    <li key={p.id}>{p.label}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Admin payment — the sub-org admin pays via this CPO. Each sub-org's
                        admin can have a different CPO + per-installment discount. */}
                    <div className="space-y-3 rounded-md border bg-white p-3">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Admin payment
                            </Label>
                        </div>
                        <Select
                            value={selectedPaymentOptionId}
                            onValueChange={setSelectedPaymentOptionId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pick a plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FREE">FREE (no charge)</SelectItem>
                                {cpoList.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name} (CPO)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedPaymentOptionId !== 'FREE' && (
                            <p className="text-[10px] text-muted-foreground">
                                Installments + discount apply to this admin. Different
                                sub-orgs can carry different CPOs / discounts.
                            </p>
                        )}
                    </div>

                    {/* Installment editor — shows when a CPO is picked above. Per-installment
                        amount + due-date + discount overrides, plus a CPO-level discount.
                        Applied to the admin's own SFP rows via CpoEnrollmentConfigApplier. */}
                    {selectedPaymentOptionId !== 'FREE' && (
                        <div className="space-y-3 rounded-md border bg-white p-3">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Installments
                            </Label>
                            {isLoadingCpoTemplate ? (
                                <p className="text-xs text-muted-foreground">
                                    Loading installment template…
                                </p>
                            ) : installmentRows.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    This fee structure has no installments configured.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {installmentRows.map((row) => {
                                        const edit = installmentEdits[row.aftInstallmentId] || {};
                                        const updateEdit = (patch: InstallmentEdit) =>
                                            setInstallmentEdits((prev) => ({
                                                ...prev,
                                                [row.aftInstallmentId]: { ...prev[row.aftInstallmentId], ...patch },
                                            }));
                                        return (
                                            <div
                                                key={row.aftInstallmentId}
                                                className="space-y-1 rounded border bg-muted/20 p-2 text-xs"
                                            >
                                                <p className="font-medium">
                                                    #{row.installmentNumber} · {row.feeTypeName}
                                                </p>
                                                <div className="grid gap-2 sm:grid-cols-3">
                                                    <div>
                                                        <Label className="text-[10px]">Amount</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder={row.defaultAmount.toFixed(2)}
                                                            value={edit.amount ?? ''}
                                                            onChange={(e) =>
                                                                updateEdit({ amount: e.target.value })
                                                            }
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px]">Due date</Label>
                                                        <Input
                                                            type="date"
                                                            value={edit.dueDate ?? ''}
                                                            onChange={(e) =>
                                                                updateEdit({ dueDate: e.target.value })
                                                            }
                                                            className="h-7 text-xs"
                                                        />
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <div className="flex-1">
                                                            <Label className="text-[10px]">Discount</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0"
                                                                value={edit.discountValue ?? ''}
                                                                onChange={(e) =>
                                                                    updateEdit({
                                                                        discountValue: e.target.value,
                                                                    })
                                                                }
                                                                className="h-7 text-xs"
                                                            />
                                                        </div>
                                                        <div className="w-[80px]">
                                                            <Label className="text-[10px]">Type</Label>
                                                            <Select
                                                                value={edit.discountType || 'PERCENTAGE'}
                                                                onValueChange={(v) =>
                                                                    updateEdit({
                                                                        discountType: v as
                                                                            | 'PERCENTAGE'
                                                                            | 'FLAT',
                                                                    })
                                                                }
                                                            >
                                                                <SelectTrigger className="h-7 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="PERCENTAGE">
                                                                        %
                                                                    </SelectItem>
                                                                    <SelectItem value="FLAT">
                                                                        ₹
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>
                                                {row.defaultDueDate && (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Default due {row.defaultDueDate}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* CPO-level discount applied proportionally across all installments */}
                                    <div className="space-y-1 rounded border bg-muted/10 p-2 text-xs">
                                        <p className="font-medium">CPO-level discount</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Applied across all installments proportionally.
                                        </p>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0"
                                                value={cpoDiscountValue}
                                                onChange={(e) =>
                                                    setCpoDiscountValue(e.target.value)
                                                }
                                                className="h-7 text-xs"
                                            />
                                            <Select
                                                value={cpoDiscountType}
                                                onValueChange={(v) =>
                                                    setCpoDiscountType(v as 'PERCENTAGE' | 'FLAT')
                                                }
                                            >
                                                <SelectTrigger className="h-7 w-[80px] text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PERCENTAGE">%</SelectItem>
                                                    <SelectItem value="FLAT">₹</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual offline-payment recording — mirrors bulk/v3/assign skip/offline pattern.
                        For CPO admins, the recorded payment FIFO-allocates across the SFP rows. */}
                    <div className="space-y-3 rounded-md border bg-white p-3">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Record initial payment (optional)
                            </Label>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant={paymentMode === 'SKIP' ? 'default' : 'outline'}
                                onClick={() => setPaymentMode('SKIP')}
                                disabled={mutation.isPending}
                                className="flex-1"
                            >
                                Skip
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={paymentMode === 'OFFLINE' ? 'default' : 'outline'}
                                onClick={() => setPaymentMode('OFFLINE')}
                                disabled={mutation.isPending}
                                className="flex-1"
                            >
                                Record offline payment
                            </Button>
                        </div>
                        {paymentMode === 'OFFLINE' && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Amount *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={offlineAmount}
                                        onChange={(e) => setOfflineAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Currency</Label>
                                    <Select
                                        value={offlineCurrency}
                                        onValueChange={setOfflineCurrency}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INR">INR</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="AUD">AUD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Payment date</Label>
                                    <Input
                                        type="date"
                                        value={offlineDate}
                                        onChange={(e) => setOfflineDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Reference (cheque #, UPI ref)</Label>
                                    <Input
                                        value={offlineReference}
                                        onChange={(e) => setOfflineReference(e.target.value)}
                                        placeholder="optional"
                                    />
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={generateInvoice}
                                        onChange={(e) => setGenerateInvoice(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <span className="text-xs">
                                        Generate invoice after payment
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            disabled={mutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmit}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Add User
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SubOrgFinanceSection({ subOrgId }: { subOrgId: string }) {
    const instituteId = getCurrentInstituteId();
    const { data, isLoading, isError } = useQuery<SubOrgFinanceDetail>({
        queryKey: ['sub-org-finance-detail', subOrgId],
        queryFn: () => getSubOrgFinanceDetail(subOrgId, instituteId || undefined),
        enabled: !!subOrgId,
    });

    // Right-side drawer state — opens with CpoInstallmentsEditor + invoices for the
    // clicked row. The editor is safe for non-CPO members (renders nothing).
    const [drawer, setDrawer] = useState<{
        userId: string;
        name?: string;
        subtitle?: string;
    } | null>(null);

    if (isLoading) {
        return (
            <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Wallet className="h-4 w-4" />
                    Finance
                </h3>
                <p className="text-sm text-muted-foreground">Loading finance details...</p>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Wallet className="h-4 w-4" />
                    Finance
                </h3>
                <p className="text-sm text-muted-foreground">
                    Couldn&apos;t load finance details.
                </p>
            </div>
        );
    }

    const admin = data.admin_payment;
    const learners = data.learners || [];
    const totals = data.totals;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Wallet className="h-4 w-4" />
                    Finance
                </h3>
                {totals && (
                    <span className="text-xs text-muted-foreground">
                        {totals.learner_count} learner{totals.learner_count === 1 ? '' : 's'} ·
                        outstanding {fmtMoney(totals.total_outstanding)}
                    </span>
                )}
            </div>

            {/* Admin payment block */}
            {admin?.user_id ? (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                        setDrawer({
                            userId: admin.user_id!,
                            name: admin.full_name || admin.user_id,
                            subtitle: 'Sub-org admin',
                        })
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setDrawer({
                                userId: admin.user_id!,
                                name: admin.full_name || admin.user_id,
                                subtitle: 'Sub-org admin',
                            });
                        }
                    }}
                    className="cursor-pointer space-y-2 rounded-md border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                    title="View installments & invoices"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">
                                Admin: {admin.full_name || admin.user_id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {admin.payment_type || 'unknown'}
                                {admin.user_plan_status ? ` · ${admin.user_plan_status}` : ''}
                            </p>
                        </div>
                        {admin.payment_type === 'CPO' && (
                            <Badge variant="secondary">
                                {admin.pending_installments_count ?? 0} pending
                            </Badge>
                        )}
                    </div>
                    {admin.payment_type === 'CPO' && (
                        <>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <Metric label="Total" value={fmtMoney(admin.total_amount)} />
                                <Metric label="Paid" value={fmtMoney(admin.paid_amount)} />
                                <Metric
                                    label="Outstanding"
                                    value={fmtMoney(admin.outstanding_amount)}
                                />
                            </div>
                            {admin.next_due && (
                                <div className="rounded bg-white p-2 text-xs">
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
                                <details
                                    className="text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                                        View full ledger ({admin.installments.length})
                                    </summary>
                                    <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded bg-white p-2">
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
                                </details>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    No admin payment yet — admin will be linked when they accept the invite.
                </p>
            )}

            {/* Learner roster */}
            <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Learners ({learners.length})
                </h4>
                {learners.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No learners enrolled yet.</p>
                ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border">
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
                                            subtitle: l.package_session_id
                                                ? 'Learner'
                                                : 'Learner',
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
            </div>

            <MemberHistoryDrawer
                open={!!drawer}
                onOpenChange={(o) => !o && setDrawer(null)}
                userId={drawer?.userId || null}
                userName={drawer?.name}
                subtitle={drawer?.subtitle}
                readOnly={isCallerSubOrgAdmin()}
            />
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded bg-white p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
        </div>
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
    return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function AllowedTeamRolesSection({
    subOrgId,
    scopedInvites,
}: {
    subOrgId: string;
    scopedInvites: any[];
}) {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState<string[]>([]);

    // Seed draft from scopedInvites[].allowed_team_roles (first non-empty).
    const persistedRoles: string[] = (() => {
        for (const inv of scopedInvites as any[]) {
            const list = inv?.allowed_team_roles;
            if (Array.isArray(list)) return list;
        }
        return [];
    })();

    const { data: rolesList = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: isEditing,
    });

    const mutation = useMutation({
        mutationFn: (roles: string[]) => updateSubOrgTeamRoles(subOrgId, roles),
        onSuccess: () => {
            toast.success('Allowed team roles updated');
            queryClient.invalidateQueries({ queryKey: ['sub-org-scoped-invites', subOrgId] });
            queryClient.invalidateQueries({ queryKey: ['sub-org-scoped-invites-for-roles', subOrgId] });
            setIsEditing(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to update');
        },
    });

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <ShieldCheck className="h-4 w-4" />
                    Allowed team roles
                    {persistedRoles.length > 0 && (
                        <Badge variant="secondary">{persistedRoles.length}</Badge>
                    )}
                </h3>
                {!isEditing && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDraft(persistedRoles);
                            setIsEditing(true);
                        }}
                    >
                        Edit
                    </Button>
                )}
            </div>

            {!isEditing && (
                persistedRoles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        No restriction — sub-org admin can assign any custom role.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {persistedRoles.map((r) => (
                            <Badge key={r} variant="outline" className="text-xs">
                                {r}
                            </Badge>
                        ))}
                    </div>
                )
            )}

            {isEditing && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                        Tick the custom roles the sub-org admin may pick on
                        /manage-suborg-teams. Leave all unticked to allow any role.
                    </p>
                    <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
                        {rolesList.map((role) => (
                            <label
                                key={role.id}
                                className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted"
                            >
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5"
                                    checked={draft.includes(role.name)}
                                    onChange={(e) => {
                                        setDraft((prev) =>
                                            e.target.checked
                                                ? [...prev, role.name]
                                                : prev.filter((r) => r !== role.name)
                                        );
                                    }}
                                />
                                {role.name}
                            </label>
                        ))}
                        {rolesList.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                                Loading roles...
                            </span>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(false)}
                            disabled={mutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => mutation.mutate(draft)}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Save
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SubOrgAdminsSection({ subOrgId }: { subOrgId: string }) {
    const { data: adminsData, isLoading } = useQuery<{
        admins: { user_id: string; name: string; role: string }[];
    }>({
        queryKey: ['sub-org-admins-detail', subOrgId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_SUB_ORG_ALL_ADMINS, {
                params: { subOrgId },
            });
            return response.data;
        },
        enabled: !!subOrgId,
    });

    const admins = adminsData?.admins || [];

    return (
        <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ShieldCheck className="h-4 w-4" />
                Admins ({admins.length})
            </h3>
            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading admins...</p>
            ) : admins.length > 0 ? (
                <div className="space-y-2">
                    {admins.map((admin, idx) => (
                        <div
                            key={admin.user_id || idx}
                            className="flex items-center justify-between rounded-md border p-3"
                        >
                            <div>
                                <p className="text-sm font-medium">{admin.name}</p>
                                <p className="text-xs text-muted-foreground">{admin.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    No admins assigned yet. Admins are added when they pay via the invite
                    link.
                </p>
            )}
        </div>
    );
}
