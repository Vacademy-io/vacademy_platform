/**
 * Manage counselors in this pool.
 *  - Add a counselor → backend creates one member row per audience in the pool
 *  - Remove a counselor → backend deletes all their rows in the pool
 *  - Mark counselor INACTIVE → opens a dialog to pick a backup counselor.
 *    While inactive, leads that would go to this counselor get redirected to
 *    the backup. Reactivating clears the backup.
 *
 * Reordering counselors per audience is NOT exposed in this v1 UI. Order is
 * fixed at insertion time (admin can remove + re-add to change). The schema
 * supports per-audience custom order; expose it later if needed.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_USERS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MyButton } from '@/components/design-system/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import MultiSelectAddList from './MultiSelectAddList';
import {
    handleFetchCampaignsList,
    type CampaignItem,
} from '@/routes/audience-manager/list/-services/get-campaigns-list';
import {
    CounselorPoolDTO,
    type MonthlyTargetEntry,
    PoolMemberDTO,
    useAddCounselorsToPool,
    useBulkUpdateMemberStatus,
    useCounselorMemberships,
    useRemoveCounselorFromPool,
    useUpdateMemberMonthlyTargets,
    useUpdateMemberStatus,
} from '@/services/counselor-pool';

interface CounselorsTabProps {
    pool: CounselorPoolDTO;
}

interface InstituteUser {
    id: string;
    full_name: string;
    email?: string | null;
}

/**
 * Fetch users in the institute who can be added as counsellors.
 * Reuses the existing GET_INSTITUTE_USERS endpoint (auth-service). Filters by
 * COUNSELLOR + ADMIN since both are valid for pool routing. Backend's role
 * filter is OR-additive, so we pass both. Page size 500 is well above any
 * realistic institute headcount; backend has no hard cap.
 */
const fetchInstituteCounselors = async (): Promise<InstituteUser[]> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: { instituteId, pageNumber: 0, pageSize: 500 },
        data: { roles: ['COUNSELLOR', 'ADMIN'], status: ['ACTIVE'] },
    });
    const raw = Array.isArray(response.data) ? response.data : response.data?.content || [];
    return raw.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        full_name: u.full_name as string,
        email: (u.email as string) || null,
    }));
};

/**
 * Fetch institute users eligible to be a backup counsellor. Strictly the
 * COUNSELLOR role (admins not allowed as backup, per requirement) and only
 * accounts that are ACTIVE in auth-service. Pool-level status (INACTIVE
 * member of this pool) is filtered out in the component, not here.
 */
const fetchBackupEligibleCounsellors = async (): Promise<InstituteUser[]> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: { instituteId, pageNumber: 0, pageSize: 500 },
        data: { roles: ['COUNSELLOR'], status: ['ACTIVE'] },
    });
    const raw = Array.isArray(response.data) ? response.data : response.data?.content || [];
    return raw.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        full_name: u.full_name as string,
        email: (u.email as string) || null,
    }));
};

export default function CounselorsTab({ pool }: CounselorsTabProps) {
    const [statusDialog, setStatusDialog] = useState<{
        counselorUserId: string;
        counselorName: string;
        action: 'INACTIVE' | 'ACTIVE';
    } | null>(null);
    const [pendingBackupId, setPendingBackupId] = useState<string>('');
    const [reassignExistingLeads, setReassignExistingLeads] = useState<boolean>(false);
    // Pool IDs the admin has checked for the INACTIVE batch. Seeded with the
    // current pool when the dialog opens; admin can add/remove.
    const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
    // Monthly-target dialog state. One row per audience in the pool, with the
    // current value prefilled. Saving sends one PATCH with the full set.
    const [targetDialog, setTargetDialog] = useState<{
        counselorUserId: string;
        counselorName: string;
    } | null>(null);
    const [editedTargets, setEditedTargets] = useState<Map<string, number | null>>(new Map());

    const { data: instituteUsers = [], isLoading: usersLoading } = useQuery({
        queryKey: ['institute-counselors'],
        queryFn: fetchInstituteCounselors,
        staleTime: 60 * 1000,
    });

    // Separate fetch for backup candidates — strictly COUNSELLOR role only.
    const { data: backupEligibleUsers = [] } = useQuery({
        queryKey: ['institute-backup-counsellors'],
        queryFn: fetchBackupEligibleCounsellors,
        staleTime: 60 * 1000,
    });

    const userById = useMemo(() => {
        const map = new Map<string, InstituteUser>();
        for (const u of instituteUsers) map.set(u.id, u);
        return map;
    }, [instituteUsers]);

    const counselorsInPool = useMemo(() => groupMembersByCounselor(pool.members ?? []), [pool.members]);

    const availableUsers = useMemo(
        () => instituteUsers.filter((u) => !counselorsInPool.has(u.id)),
        [instituteUsers, counselorsInPool]
    );

    const { mutateAsync: addCounselorsAsync } = useAddCounselorsToPool(pool.id);
    const { mutate: removeCounselor, isPending: removing } = useRemoveCounselorFromPool(pool.id);
    const { mutate: updateStatus, isPending: updatingStatus } = useUpdateMemberStatus(pool.id);
    const { mutate: bulkUpdateStatus, isPending: bulkUpdatingStatus } = useBulkUpdateMemberStatus();
    const { mutate: saveMonthlyTargets, isPending: savingTargets } =
        useUpdateMemberMonthlyTargets(pool.id);

    // Resolve audience_id → campaign_name for the target dialog + row summary.
    // Same pattern as OrderTab — fetches the institute's campaign list once
    // and looks up the names locally.
    const instituteId = getCurrentInstituteId() ?? '';
    const { data: campaignsPage } = useQuery(
        handleFetchCampaignsList({ institute_id: instituteId, page: 0, size: 500 })
    );
    const campaignName = (audienceId: string) => {
        const c = (campaignsPage?.content ?? []).find(
            (it: CampaignItem) => it.id === audienceId
        );
        return c?.campaign_name ?? `(unknown — ${audienceId.slice(0, 6)}…)`;
    };

    // Fetch memberships only when the INACTIVE dialog is open. Reactivation
    // doesn't need this — it stays per-pool.
    const membershipsCounselorId =
        statusDialog?.action === 'INACTIVE' ? statusDialog.counselorUserId : undefined;
    const { data: memberships = [], isLoading: membershipsLoading } =
        useCounselorMemberships(membershipsCounselorId);

    // One atomic bulk add. On failure the whole batch is rejected, so we keep
    // every checked id selected for retry; on success we clear them all.
    const handleAddCounselors = async (ids: string[]): Promise<string[]> => {
        if ((pool.audiences ?? []).length === 0) {
            toast.error('Add at least one campaign to the pool before adding counselors');
            return ids; // keep all checked — nothing was attempted
        }
        try {
            await addCounselorsAsync(ids);
            toast.success(ids.length === 1 ? 'Counselor added' : `${ids.length} counselors added`);
            return [];
        } catch (err) {
            toast.error(extractError(err) ?? 'Failed to add counselors');
            return ids;
        }
    };

    const handleRemove = (counselorUserId: string, name: string) => {
        if (!window.confirm(`Remove ${name} from this pool? Their leads stay assigned to them.`))
            return;
        removeCounselor(counselorUserId, {
            onSuccess: () => toast.success('Counselor removed'),
            onError: (err) => toast.error(extractError(err) ?? 'Failed to remove counselor'),
        });
    };

    const openStatusDialog = (counselorUserId: string, currentStatus: 'ACTIVE' | 'INACTIVE') => {
        const user = userById.get(counselorUserId);
        const name = user?.full_name ?? counselorUserId;
        const action = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        setStatusDialog({
            counselorUserId,
            counselorName: name,
            action,
        });
        setPendingBackupId('');
        setReassignExistingLeads(false);
        // For inactivation we seed with the current pool; admin can add the
        // counsellor's other ACTIVE pools once the memberships fetch returns.
        setSelectedPoolIds(action === 'INACTIVE' ? [pool.id] : []);
    };

    const openTargetDialog = (counselorUserId: string) => {
        const user = userById.get(counselorUserId);
        const name = user?.full_name ?? counselorUserId;
        // Prefill from the pool's known member rows for this counsellor.
        const rows = (pool.members ?? []).filter(
            (m) => m.counselor_user_id === counselorUserId
        );
        const prefill = new Map<string, number | null>();
        for (const a of pool.audiences ?? []) {
            const row = rows.find((r) => r.audience_id === a.audience_id);
            prefill.set(a.audience_id, row?.monthly_target ?? null);
        }
        setEditedTargets(prefill);
        setTargetDialog({ counselorUserId, counselorName: name });
    };

    const updateTargetEntry = (audienceId: string, raw: string) => {
        // Empty input clears the target. Anything else parses to a non-negative int;
        // <input type="number" min=0> already guards UI-side but be tolerant.
        const next = new Map(editedTargets);
        if (raw.trim() === '') {
            next.set(audienceId, null);
        } else {
            const parsed = Math.max(0, Math.floor(Number(raw)));
            next.set(audienceId, Number.isFinite(parsed) ? parsed : null);
        }
        setEditedTargets(next);
    };

    const confirmTargetSave = () => {
        if (!targetDialog) return;
        const targets: MonthlyTargetEntry[] = [...editedTargets.entries()].map(
            ([audience_id, monthly_target]) => ({ audience_id, monthly_target })
        );
        saveMonthlyTargets(
            { counselorUserId: targetDialog.counselorUserId, request: { targets } },
            {
                onSuccess: () => {
                    toast.success('Monthly targets updated');
                    setTargetDialog(null);
                },
                onError: (err) =>
                    toast.error(extractError(err) ?? 'Failed to update monthly targets'),
            }
        );
    };

    const togglePoolSelection = (poolId: string) => {
        setSelectedPoolIds((prev) =>
            prev.includes(poolId) ? prev.filter((id) => id !== poolId) : [...prev, poolId]
        );
    };

    const confirmStatusChange = () => {
        if (!statusDialog) return;
        const { counselorUserId, action } = statusDialog;

        if (action === 'ACTIVE') {
            // Reactivate stays per-pool — the admin clicked it from this pool view.
            updateStatus(
                {
                    counselorUserId,
                    request: { status: 'ACTIVE', backup_counselor_user_id: null },
                },
                {
                    onSuccess: () => {
                        toast.success('Counselor reactivated');
                        setStatusDialog(null);
                    },
                    onError: (err) =>
                        toast.error(extractError(err) ?? 'Failed to update status'),
                }
            );
            return;
        }

        // INACTIVE path — multi-pool, all-or-nothing.
        if (selectedPoolIds.length === 0) {
            toast.error('Pick at least one pool');
            return;
        }
        if (!pendingBackupId) {
            toast.error('Pick a backup counselor');
            return;
        }
        bulkUpdateStatus(
            {
                counselorUserId,
                request: {
                    pool_ids: selectedPoolIds,
                    status: 'INACTIVE',
                    backup_counselor_user_id: pendingBackupId,
                    reassign_existing_leads: reassignExistingLeads,
                },
            },
            {
                onSuccess: () => {
                    toast.success(
                        selectedPoolIds.length === 1
                            ? 'Counselor marked inactive'
                            : `Counselor marked inactive in ${selectedPoolIds.length} pools`
                    );
                    setStatusDialog(null);
                },
                onError: (err) =>
                    toast.error(extractError(err) ?? 'Failed to update status'),
            }
        );
    };

    // Backup picker options: any COUNSELLOR-role user in the institute, minus:
    //   - the counsellor being deactivated (self-exclude)
    //   - anyone whose pool-membership status here is INACTIVE (no point routing
    //     leads to someone who's also paused in this pool)
    // Backups are NOT required to be members of this pool — picking an outside
    // counsellor temporarily covers the deactivated one's leads.
    const backupCandidates = useMemo(() => {
        if (!statusDialog) return [] as { id: string; name: string }[];
        const poolInactiveIds = new Set<string>();
        for (const [userId, rows] of counselorsInPool.entries()) {
            if (rows.every((r) => r.status === 'INACTIVE')) poolInactiveIds.add(userId);
        }
        return backupEligibleUsers
            .filter((u) => u.id !== statusDialog.counselorUserId)
            .filter((u) => !poolInactiveIds.has(u.id))
            .map((u) => ({ id: u.id, name: u.full_name }));
    }, [statusDialog, backupEligibleUsers, counselorsInPool]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Add Counselor</CardTitle>
                    <CardDescription>
                        Adding a counselor creates one row per campaign in this pool. They go to
                        the bottom of the rotation by default.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MultiSelectAddList
                        items={availableUsers.map((u) => ({
                            id: u.id,
                            label: u.full_name,
                        }))}
                        loading={usersLoading}
                        onAdd={handleAddCounselors}
                        searchPlaceholder="Search counselors…"
                        emptyText="All eligible counselors are already in this pool."
                        itemNoun="counselor"
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Counselors in Pool ({counselorsInPool.size})</CardTitle>
                </CardHeader>
                <CardContent>
                    {counselorsInPool.size === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No counselors yet. Add at least one to enable auto-assignment.
                        </p>
                    ) : (
                        <ul className="divide-y">
                            {[...counselorsInPool.entries()].map(([counselorUserId, rows]) => {
                                const user = userById.get(counselorUserId);
                                const name = user?.full_name ?? `(unknown — ${counselorUserId.slice(0, 8)}…)`;
                                const status: 'ACTIVE' | 'INACTIVE' = rows.every(
                                    (r) => r.status === 'ACTIVE'
                                )
                                    ? 'ACTIVE'
                                    : 'INACTIVE';
                                const backupId = rows.find((r) => r.backup_counselor_user_id)?.backup_counselor_user_id;
                                const backupName = backupId ? userById.get(backupId)?.full_name ?? backupId : null;
                                return (
                                    <li
                                        key={counselorUserId}
                                        className="flex items-center justify-between gap-3 py-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-medium">{name}</p>
                                                <Badge
                                                    className={
                                                        status === 'ACTIVE'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }
                                                >
                                                    {status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Order: {summarizeOrders(rows)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Targets: {summarizeTargets(rows, campaignName)}
                                            </p>
                                            {status === 'INACTIVE' && backupName && (
                                                <p className="text-xs text-amber-700">
                                                    Backup → {backupName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <button
                                                type="button"
                                                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                                                disabled={(pool.audiences ?? []).length === 0}
                                                onClick={() => openTargetDialog(counselorUserId)}
                                            >
                                                {rows.some((r) => r.monthly_target != null)
                                                    ? 'Edit Targets'
                                                    : 'Set Targets'}
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs text-blue-600 hover:underline"
                                                onClick={() => openStatusDialog(counselorUserId, status)}
                                            >
                                                {status === 'ACTIVE' ? 'Mark Inactive' : 'Reactivate'}
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs text-red-600 hover:underline disabled:opacity-50"
                                                disabled={removing}
                                                onClick={() => handleRemove(counselorUserId, name)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={!!statusDialog}
                onOpenChange={(open) => !open && setStatusDialog(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {statusDialog?.action === 'INACTIVE' ? 'Mark Inactive' : 'Reactivate'}{' '}
                            — {statusDialog?.counselorName}
                        </DialogTitle>
                        <DialogDescription>
                            {statusDialog?.action === 'INACTIVE'
                                ? 'Choose which pools to mark inactive in and pick one backup counselor. Leads that would go to this counselor in those pools will route to the backup until they are reactivated.'
                                : 'Reactivating clears the backup. New leads will route to this counselor normally.'}
                        </DialogDescription>
                    </DialogHeader>

                    {statusDialog?.action === 'INACTIVE' && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">
                                    Pools to mark inactive in
                                </p>
                                {membershipsLoading ? (
                                    <p className="text-xs text-muted-foreground">
                                        Loading pools…
                                    </p>
                                ) : memberships.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        No active pool memberships found for this counselor.
                                    </p>
                                ) : (
                                    <ul className="space-y-1 rounded-md border p-2">
                                        {memberships.map((m) => (
                                            <li key={m.pool_id}>
                                                <label className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={selectedPoolIds.includes(
                                                            m.pool_id
                                                        )}
                                                        onCheckedChange={() =>
                                                            togglePoolSelection(m.pool_id)
                                                        }
                                                    />
                                                    <span className="flex-1">
                                                        {m.pool_name}
                                                        {m.pool_id === pool.id && (
                                                            <span className="ml-2 text-xs text-muted-foreground">
                                                                (this pool)
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-medium">Backup counselor</p>
                                <Select
                                    value={pendingBackupId}
                                    onValueChange={setPendingBackupId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select backup counselor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {backupCandidates.length === 0 ? (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                                No other active counselors available
                                            </div>
                                        ) : (
                                            backupCandidates.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Applies to every selected pool.
                                </p>
                            </div>

                            <label className="flex items-start gap-2 text-sm">
                                <Checkbox
                                    checked={reassignExistingLeads}
                                    onCheckedChange={(c) =>
                                        setReassignExistingLeads(c === true)
                                    }
                                    disabled={!pendingBackupId}
                                    className="mt-0.5"
                                />
                                <span className="leading-snug">
                                    <span className="font-medium">
                                        Also move existing open leads to the backup
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        For each selected pool, leads from that pool&apos;s
                                        campaigns that are still open (not converted or
                                        lost) move to the backup. If the counselor is
                                        reactivated later, these leads stay with the backup.
                                    </span>
                                </span>
                            </label>
                        </div>
                    )}

                    <DialogFooter>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setStatusDialog(null)}
                            disable={updatingStatus || bulkUpdatingStatus}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={confirmStatusChange}
                            disable={
                                updatingStatus ||
                                bulkUpdatingStatus ||
                                (statusDialog?.action === 'INACTIVE' &&
                                    (!pendingBackupId ||
                                        selectedPoolIds.length === 0 ||
                                        membershipsLoading))
                            }
                        >
                            {updatingStatus || bulkUpdatingStatus
                                ? 'Saving…'
                                : statusDialog?.action === 'INACTIVE'
                                  ? 'Mark Inactive'
                                  : 'Reactivate'}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!targetDialog}
                onOpenChange={(open) => !open && setTargetDialog(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Set monthly targets — {targetDialog?.counselorName}
                        </DialogTitle>
                        <DialogDescription>
                            One target per campaign. Leave a field blank to clear that
                            campaign&apos;s target.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {(pool.audiences ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No campaigns in this pool yet.
                            </p>
                        ) : (
                            (pool.audiences ?? []).map((a) => {
                                const value = editedTargets.get(a.audience_id);
                                return (
                                    <div
                                        key={a.audience_id}
                                        className="flex items-center justify-between gap-3"
                                    >
                                        <span className="text-sm">
                                            {campaignName(a.audience_id)}
                                        </span>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            placeholder="e.g. 20"
                                            className="w-32"
                                            value={value == null ? '' : String(value)}
                                            onChange={(e) =>
                                                updateTargetEntry(
                                                    a.audience_id,
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <DialogFooter>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setTargetDialog(null)}
                            disable={savingTargets}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={confirmTargetSave}
                            disable={savingTargets || (pool.audiences ?? []).length === 0}
                        >
                            {savingTargets ? 'Saving…' : 'Save Targets'}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function groupMembersByCounselor(members: PoolMemberDTO[]) {
    const map = new Map<string, PoolMemberDTO[]>();
    for (const m of members) {
        const arr = map.get(m.counselor_user_id);
        if (arr) arr.push(m);
        else map.set(m.counselor_user_id, [m]);
    }
    return map;
}

function summarizeOrders(rows: PoolMemberDTO[]): string {
    const distinct = new Set(rows.map((r) => r.display_order));
    if (distinct.size === 1) return `#${[...distinct][0]} (same across all campaigns)`;
    return rows
        .map((r) => `#${r.display_order} (${r.audience_id.slice(0, 6)}…)`)
        .join(', ');
}

/**
 * One-line per-(audience, counsellor) target summary. Em-dash for unset cells
 * so the admin can see at a glance which campaigns still need a target.
 */
function summarizeTargets(
    rows: PoolMemberDTO[],
    campaignName: (audienceId: string) => string
): string {
    if (rows.length === 0) return 'not set';
    const allUnset = rows.every((r) => r.monthly_target == null);
    if (allUnset) return 'not set';
    return rows
        .map((r) => `${campaignName(r.audience_id)} ${r.monthly_target ?? '—'}`)
        .join(' · ');
}

function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}
