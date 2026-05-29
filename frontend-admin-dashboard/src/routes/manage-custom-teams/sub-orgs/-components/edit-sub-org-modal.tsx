import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock as LockIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';
import {
    getAllRoles,
    getScopedInvites,
    updateSubOrgConfiguration,
    type SubOrgConfigurationUpdate,
} from '../../-services/custom-team-services';

// Local sub-org helpers mirroring create-sub-org-modal.tsx — kept inline so this
// modal's lookups don't accidentally pick up the rest of the dashboard's
// package-service logic.
const fetchBatchesSummaryLocal = async (instituteId: string, statuses: string[]) => {
    const params = new URLSearchParams();
    statuses.forEach((s) => params.append('statuses', s));
    const url = `${BASE_URL}/admin-core-service/institute/v1/batches-summary/${instituteId}${
        params.toString() ? `?${params.toString()}` : ''
    }`;
    const response = await authenticatedAxiosInstance({ method: 'GET', url });
    return response.data;
};
const fetchCourseBatchesLocal = async (courseId: string): Promise<PackageSessionDTO[]> => {
    const url = `${BASE_URL}/admin-core-service/course/v1/${courseId}/batches`;
    const response = await authenticatedAxiosInstance({ method: 'GET', url });
    return response.data;
};

interface EditSubOrgModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subOrgId: string;
    subOrgName: string;
}

interface ScopedInviteRow {
    id: string;
    tag?: string;
    name?: string;
    learner_access_days?: number;
    learner_access_days_top?: number;
    auth_roles?: string[];
    allowed_team_roles?: string[];
    admin_permissions?: string[];
    member_count_setting?: number;
    package_sessions?: { id: string; package_name?: string; level_name?: string; session_name?: string }[];
    payment_type?: string;
    setting_json?: string;
}

const PERMISSION_CATALOG = ['FULL', 'CREATE_COURSE'] as const;

/**
 * Single-modal config editor for a sub-org. Pre-fills from `/scoped-invites` (the
 * org-level SUB_ORG invite carries everything except the seat-cap CPO swap, which we
 * defer because it would require migrating the admin's UserPlan to a new mirror).
 *
 * Save fires ONE PATCH `/sub-org/{id}/configuration` with only the fields that actually
 * changed — so a no-op save is cheap and the backend's `applied` payload tells us what
 * to toast.
 */
export function EditSubOrgModal({ open, onOpenChange, subOrgId, subOrgName }: EditSubOrgModalProps) {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId();

    const { data: scoped, isLoading: isLoadingScoped } = useQuery<ScopedInviteRow[]>({
        queryKey: ['sub-org-scoped-invites', subOrgId],
        queryFn: () => getScopedInvites(subOrgId),
        enabled: open && !!subOrgId,
    });

    const { data: rolesList = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: open,
    });

    // Institute-wide PS catalog — same fetch flow as create-sub-org-modal. Only
    // loaded when the modal is open AND we have an institute id, since the rest
    // of the page may render without one (the dialog body shows the loader).
    const { data: packagesSummary } = useQuery({
        queryKey: ['sub-org-packages-summary-local', instituteId],
        queryFn: () => fetchBatchesSummaryLocal(instituteId || '', ['ACTIVE']),
        enabled: open && !!instituteId,
    });
    const packageIds: string[] = (packagesSummary?.packages || []).map(
        (p: { id: string }) => p.id
    );
    const sessionQueries = useQueries({
        queries: packageIds.map((pkgId: string) => ({
            queryKey: ['sub-org-package-sessions-local', pkgId],
            queryFn: () => fetchCourseBatchesLocal(pkgId),
            enabled: open && !!pkgId,
            staleTime: 30000,
        })),
    });
    type FlatRow = {
        packageId: string;
        packageName: string;
        packageSessionId: string;
        levelName: string;
        sessionName: string;
    };
    const flatRows: FlatRow[] = (packagesSummary?.packages || []).flatMap(
        (pkg: { id: string; name: string }, idx: number) => {
            const sessions = (sessionQueries[idx]?.data || []) as PackageSessionDTO[];
            return sessions.map((ps) => ({
                packageId: pkg.id,
                packageName: pkg.name || pkg.id,
                packageSessionId: ps.id,
                levelName: ps.level?.level_name || '—',
                sessionName: ps.session?.session_name || '—',
            }));
        }
    );

    // The org-level invite carries the editable config; SUBORG_LEARNER mirror invites
    // don't. Pick the SUB_ORG-tagged invite (with fallback to the first row).
    const orgInvite = useMemo<ScopedInviteRow | undefined>(() => {
        if (!scoped) return undefined;
        return scoped.find((r) => r.tag === 'SUB_ORG') || scoped[0];
    }, [scoped]);

    const [authRoles, setAuthRoles] = useState<string[]>([]);
    const [allowedTeamRoles, setAllowedTeamRoles] = useState<string[]>([]);
    const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
    const [memberCount, setMemberCount] = useState<string>('');
    const [validityInDays, setValidityInDays] = useState<string>('');
    // PS ids the admin has ticked in this session that aren't already linked. Existing
    // PSes can't be unticked (add-only). Reset when the modal opens.
    const [pendingAddPsIds, setPendingAddPsIds] = useState<string[]>([]);

    // Snapshot of the pre-fill values so we can compute a diff on Save.
    const [baseline, setBaseline] = useState<{
        authRoles: string[];
        allowedTeamRoles: string[];
        adminPermissions: string[];
        memberCount: string;
        validityInDays: string;
    } | null>(null);

    useEffect(() => {
        if (!open) return;
        if (!orgInvite) return;
        const initAuth = orgInvite.auth_roles ?? [];
        const initAllowed = orgInvite.allowed_team_roles ?? [];
        const initPerms = orgInvite.admin_permissions ?? [];
        const initSeat = orgInvite.member_count_setting != null
            ? String(orgInvite.member_count_setting)
            : '';
        const initValidity = orgInvite.learner_access_days_top != null
            ? String(orgInvite.learner_access_days_top)
            : (orgInvite.learner_access_days != null ? String(orgInvite.learner_access_days) : '');
        setAuthRoles(initAuth);
        setAllowedTeamRoles(initAllowed);
        setAdminPermissions(initPerms);
        setMemberCount(initSeat);
        setValidityInDays(initValidity);
        setPendingAddPsIds([]);
        setBaseline({
            authRoles: initAuth,
            allowedTeamRoles: initAllowed,
            adminPermissions: initPerms,
            memberCount: initSeat,
            validityInDays: initValidity,
        });
    }, [open, orgInvite]);

    const mutation = useMutation({
        mutationFn: (update: SubOrgConfigurationUpdate) =>
            updateSubOrgConfiguration(subOrgId, update),
        onSuccess: (data) => {
            const applied = (data.applied || {}) as Record<string, unknown>;
            const addedRaw = applied['added_package_session_ids'];
            const addedCount = Array.isArray(addedRaw) ? addedRaw.length : 0;
            const otherKeys = Object.keys(applied).filter(
                (k) => k !== 'added_package_session_ids'
            );

            if (addedCount === 0 && otherKeys.length === 0) {
                toast.info('No changes to save');
            } else {
                const bits: string[] = [];
                if (addedCount > 0) bits.push(`linked ${addedCount} course(s)`);
                if (otherKeys.length > 0) bits.push(`updated ${otherKeys.join(', ')}`);
                toast.success(`Saved: ${bits.join(' · ')}`);
            }

            queryClient.invalidateQueries({ queryKey: ['sub-org-scoped-invites', subOrgId] });
            queryClient.invalidateQueries({ queryKey: ['sub-org-subscription-status', subOrgId] });
            onOpenChange(false);
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'Failed to update sub-org');
        },
    });

    const isLoading = isLoadingScoped || !baseline;

    const handleSave = () => {
        if (!baseline) return;
        const update: SubOrgConfigurationUpdate = {};

        if (!arrSetEqual(authRoles, baseline.authRoles)) update.auth_roles = authRoles;
        if (!arrSetEqual(allowedTeamRoles, baseline.allowedTeamRoles)) {
            update.allowed_team_roles = allowedTeamRoles;
        }
        if (!arrSetEqual(adminPermissions, baseline.adminPermissions)) {
            update.admin_permissions = adminPermissions;
        }
        if (memberCount.trim() !== baseline.memberCount.trim()) {
            const n = Number(memberCount);
            if (memberCount.trim() !== '' && (Number.isNaN(n) || n <= 0)) {
                toast.error('Seat cap must be a positive number');
                return;
            }
            if (memberCount.trim() !== '') update.member_count = n;
        }
        if (validityInDays.trim() !== baseline.validityInDays.trim()) {
            const n = Number(validityInDays);
            if (validityInDays.trim() !== '' && (Number.isNaN(n) || n <= 0)) {
                toast.error('Validity must be a positive number');
                return;
            }
            if (validityInDays.trim() !== '') update.validity_in_days = n;
        }
        if (pendingAddPsIds.length > 0) {
            update.add_package_session_ids = pendingAddPsIds;
        }
        if (Object.keys(update).length === 0) {
            toast.info('No changes to save');
            return;
        }
        mutation.mutate(update);
    };

    const linkedPsList = useMemo(() => {
        if (!orgInvite?.package_sessions) return [];
        return orgInvite.package_sessions.map((ps) => ({
            id: ps.id,
            label: [ps.package_name, ps.level_name, ps.session_name]
                .filter(Boolean)
                .join(' · ') || ps.id,
        }));
    }, [orgInvite]);
    const linkedPsIdSet = useMemo(
        () => new Set(linkedPsList.map((p) => p.id)),
        [linkedPsList]
    );
    // Catalog rows that aren't already linked — those become the "add" picker.
    const addableRows = useMemo(
        () => flatRows.filter((r) => !linkedPsIdSet.has(r.packageSessionId)),
        [flatRows, linkedPsIdSet]
    );

    const togglePendingPs = (psId: string) => {
        setPendingAddPsIds((prev) =>
            prev.includes(psId) ? prev.filter((p) => p !== psId) : [...prev, psId]
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden sm:max-w-[640px]">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Edit Sub-Org: {subOrgName}</DialogTitle>
                    <DialogDescription>
                        Update auth roles, allowed team roles, admin permissions, seat cap, and validity.
                        Linked courses and the payment plan/CPO can&apos;t be edited here yet.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="-mx-2 flex-1 overflow-y-auto px-2">
                        <div className="space-y-6 pb-2">
                            {/* Linked courses — existing PSes shown locked (add-only;
                                removing would orphan already-enrolled learners). The
                                addable list below adds new PSLIPO rows on Save and runs
                                the SUBORG_LEARNER mirror logic for each new PS. */}
                            <section className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    Linked courses ({linkedPsList.length + pendingAddPsIds.length})
                                </Label>
                                {linkedPsList.length === 0 ? (
                                    <p className="text-caption text-neutral-500">
                                        No courses linked yet.
                                    </p>
                                ) : (
                                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
                                        <ul className="space-y-1 text-caption text-neutral-700">
                                            {linkedPsList.map((ps) => (
                                                <li key={ps.id} className="flex items-center gap-2">
                                                    <LockIcon className="size-3 shrink-0 text-neutral-400" />
                                                    <span>{ps.label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="mt-1 text-caption text-neutral-500">
                                            Already linked PSes can&apos;t be removed here (would orphan enrolled learners).
                                        </p>
                                    </div>
                                )}

                                {addableRows.length > 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-caption font-medium text-neutral-700">
                                            Add courses
                                        </p>
                                        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
                                            {addableRows.map((row) => {
                                                const checked = pendingAddPsIds.includes(row.packageSessionId);
                                                const label = `${row.packageName} · ${row.levelName} · ${row.sessionName}`;
                                                return (
                                                    <label
                                                        key={row.packageSessionId}
                                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50"
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={() =>
                                                                togglePendingPs(row.packageSessionId)
                                                            }
                                                        />
                                                        <span className="truncate">{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {pendingAddPsIds.length > 0 && (
                                            <p className="text-caption text-primary-600">
                                                {pendingAddPsIds.length} course(s) will be linked on Save.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-caption text-neutral-500">
                                        No other courses available to link.
                                    </p>
                                )}
                            </section>

                            <section className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    Auth roles (assigned on invite acceptance)
                                </Label>
                                <div className="flex flex-wrap gap-2 rounded-md border border-neutral-200 p-2">
                                    {rolesList.map((role) => (
                                        <label
                                            key={role.id}
                                            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-50"
                                        >
                                            <Checkbox
                                                checked={authRoles.includes(role.name)}
                                                onCheckedChange={(checked) => {
                                                    setAuthRoles((prev) =>
                                                        checked
                                                            ? Array.from(new Set([...prev, role.name]))
                                                            : prev.filter((r) => r !== role.name)
                                                    );
                                                }}
                                            />
                                            {role.name}
                                        </label>
                                    ))}
                                    {rolesList.length === 0 && (
                                        <span className="text-caption text-neutral-500">
                                            No roles found
                                        </span>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    Allowed team roles (sub-org admin&apos;s pick-list)
                                </Label>
                                <p className="text-caption text-neutral-500">
                                    Empty = no restriction.
                                </p>
                                <div className="flex flex-wrap gap-2 rounded-md border border-neutral-200 p-2">
                                    {rolesList.map((role) => (
                                        <label
                                            key={role.id}
                                            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-50"
                                        >
                                            <Checkbox
                                                checked={allowedTeamRoles.includes(role.name)}
                                                onCheckedChange={(checked) => {
                                                    setAllowedTeamRoles((prev) =>
                                                        checked
                                                            ? Array.from(new Set([...prev, role.name]))
                                                            : prev.filter((r) => r !== role.name)
                                                    );
                                                }}
                                            />
                                            {role.name}
                                        </label>
                                    ))}
                                    {rolesList.length === 0 && (
                                        <span className="text-caption text-neutral-500">
                                            No roles found
                                        </span>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-2">
                                <Label className="text-sm font-semibold">
                                    Admin permissions
                                </Label>
                                <p className="text-caption text-neutral-500">
                                    Stamped on the sub-org admin&apos;s FSPSSM rows. Empty falls back to FULL.
                                    Applies only to admins enrolled after this save.
                                </p>
                                <div className="flex flex-wrap gap-2 rounded-md border border-neutral-200 p-2">
                                    {PERMISSION_CATALOG.map((perm) => (
                                        <label
                                            key={perm}
                                            className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-50"
                                        >
                                            <Checkbox
                                                checked={adminPermissions.includes(perm)}
                                                onCheckedChange={(checked) => {
                                                    setAdminPermissions((prev) =>
                                                        checked
                                                            ? Array.from(new Set([...prev, perm]))
                                                            : prev.filter((p) => p !== perm)
                                                    );
                                                }}
                                            />
                                            {perm}
                                        </label>
                                    ))}
                                </div>
                            </section>

                            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="seat-cap" className="text-sm font-semibold">
                                        Seat cap
                                    </Label>
                                    <Input
                                        id="seat-cap"
                                        type="number"
                                        min={1}
                                        value={memberCount}
                                        onChange={(e) => setMemberCount(e.target.value)}
                                        placeholder="e.g. 25"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="validity-days" className="text-sm font-semibold">
                                        Validity (days)
                                    </Label>
                                    <Input
                                        id="validity-days"
                                        type="number"
                                        min={1}
                                        value={validityInDays}
                                        onChange={(e) => setValidityInDays(e.target.value)}
                                        placeholder="e.g. 365"
                                    />
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                <DialogFooter className="shrink-0 gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onOpenChange(false)}
                        disable={mutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="small"
                        onClick={handleSave}
                        disable={mutation.isPending || isLoading}
                    >
                        {mutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            'Save'
                        )}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function arrSetEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = new Set(a);
    for (const x of b) if (!sa.has(x)) return false;
    return true;
}
