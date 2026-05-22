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
import {
    CounselorPoolDTO,
    PoolMemberDTO,
    useAddCounselorToPool,
    useBulkUpdateMemberStatus,
    useCounselorMemberships,
    useRemoveCounselorFromPool,
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
    const [pendingUserId, setPendingUserId] = useState<string>('');
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

    const { mutate: addCounselor, isPending: adding } = useAddCounselorToPool(pool.id);
    const { mutate: removeCounselor, isPending: removing } = useRemoveCounselorFromPool(pool.id);
    const { mutate: updateStatus, isPending: updatingStatus } = useUpdateMemberStatus(pool.id);
    const { mutate: bulkUpdateStatus, isPending: bulkUpdatingStatus } = useBulkUpdateMemberStatus();

    // Fetch memberships only when the INACTIVE dialog is open. Reactivation
    // doesn't need this — it stays per-pool.
    const membershipsCounselorId =
        statusDialog?.action === 'INACTIVE' ? statusDialog.counselorUserId : undefined;
    const { data: memberships = [], isLoading: membershipsLoading } =
        useCounselorMemberships(membershipsCounselorId);

    const handleAdd = () => {
        if (!pendingUserId) return;
        if ((pool.audiences ?? []).length === 0) {
            toast.error('Add at least one campaign to the pool before adding counselors');
            return;
        }
        addCounselor(pendingUserId, {
            onSuccess: () => {
                toast.success('Counselor added');
                setPendingUserId('');
            },
            onError: (err) => toast.error(extractError(err) ?? 'Failed to add counselor'),
        });
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
                    <div className="flex items-center gap-3">
                        <Select value={pendingUserId} onValueChange={setPendingUserId}>
                            <SelectTrigger className="w-full max-w-md">
                                <SelectValue
                                    placeholder={
                                        usersLoading
                                            ? 'Loading counselors…'
                                            : availableUsers.length === 0
                                              ? 'All eligible counselors already in pool'
                                              : 'Select a counselor'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {availableUsers.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.full_name}
                                        {u.email && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                {u.email}
                                            </span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={handleAdd}
                            disable={!pendingUserId || adding}
                        >
                            {adding ? 'Adding…' : 'Add'}
                        </MyButton>
                    </div>
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
                                            {status === 'INACTIVE' && backupName && (
                                                <p className="text-xs text-amber-700">
                                                    Backup → {backupName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
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

function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}
