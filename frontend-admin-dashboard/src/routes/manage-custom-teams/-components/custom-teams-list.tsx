import { MyButton } from '@/components/design-system/button';
import { Plus, User, Building2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AddMemberForm } from './add-member-form';
import { SubOrgRemoveMemberDialog } from './sub-org-remove-member-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAllRoles,
    listSubOrgTeamMembers,
    removeSubOrgTeamMember,
    getSubOrgTeamPendingInstallments,
    type SubOrgTeamPendingInstallments,
} from '../-services/custom-team-services';
import { fetchInstituteDashboardUsers } from '@/routes/dashboard/-services/dashboard-services';
import { getInstituteId } from '@/constants/helper';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserAccessModal } from './user-access-modal';
import { MemberHistoryDrawer } from '@/routes/manage-custom-teams/sub-orgs/-components/member-history-drawer';
import { isCallerSubOrgAdmin } from '@/lib/auth/facultyAccessUtils';
import { mapRoleToCustomName } from '@/utils/roleUtils';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type SubOrgTab = 'active' | 'invited';

export interface CustomTeamsListProps {
    /** 'institute' (default) — original institute-wide custom teams flow.
     *  'subOrg' — scope listing/add/remove to a specific sub-org (server-enforced). */
    mode?: 'institute' | 'subOrg';
    /** Required when mode='subOrg'. */
    subOrgId?: string;
}

export function CustomTeamsList({ mode = 'institute', subOrgId }: CustomTeamsListProps = {}) {
    const queryClient = useQueryClient();
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [accessModalUserId, setAccessModalUserId] = useState<string | null>(null);
    const [accessModalUserName, setAccessModalUserName] = useState<string>('');
    // In subOrg mode a row click opens the payment-history drawer (CPO installments +
    // invoices) instead of the per-permissions UserAccessModal.
    const [historyDrawer, setHistoryDrawer] = useState<{
        userId: string;
        name?: string;
    } | null>(null);
    const [selectedTab, setSelectedTab] = useState<SubOrgTab>('active');

    const { data: rolesResponse, isLoading: isLoadingRoles } = useQuery({
        queryKey: ['custom-roles'],
        queryFn: getAllRoles,
    });

    const activeRoles = rolesResponse || [];
    const instituteId = getInstituteId();

    const { data, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['custom-teams', mode, subOrgId, activeRoles],
        queryFn: async () => {
            if (!activeRoles.length) return { content: [] };

            if (mode === 'subOrg') {
                if (!subOrgId) return { content: [] };
                // Sub-org members should only have custom (non-system) roles.
                // Strip system role names defensively even if the backend lists them.
                const SYSTEM_ROLES = new Set([
                    'ADMIN', 'TEACHER', 'STUDENT', 'EVALUATOR',
                    'CONTENT CREATOR', 'ASSESSMENT CREATOR',
                ]);
                const customRoleNames = activeRoles
                    .map((r: any) => r.name)
                    .filter((n: string) => !SYSTEM_ROLES.has((n || '').toUpperCase()));
                const resp = await listSubOrgTeamMembers({
                    sub_org_id: subOrgId,
                    institute_id: instituteId!,
                    roles: customRoleNames,
                    // INVITED covers freshly added members who haven't accepted yet.
                    status: ['ACTIVE', 'DISABLED', 'INVITED'],
                    page_number: 0,
                    page_size: 50,
                });
                // Normalize to the same shape the institute flow expects
                return { content: resp.content || [] };
            }

            const mappedRoles = activeRoles.map((role: any) => ({
                id: role.id,
                name: role.name,
            }));

            return fetchInstituteDashboardUsers(
                instituteId,
                {
                    roles: mappedRoles,
                    status: [
                        { id: '1', name: 'ACTIVE' },
                        { id: '2', name: 'DISABLED' }
                    ]
                },
                0, // pageNumber
                50 // pageSize
            );
        },
        enabled: activeRoles.length > 0 && (mode !== 'subOrg' || !!subOrgId),
    });

    const allMembers = data?.content || [];

    // Pending-installments lookup, only in subOrg mode. Only members with non-PAID
    // StudentFeePayment rows are returned by the backend; absent members render '—'.
    const { data: pendingDues } = useQuery<SubOrgTeamPendingInstallments>({
        queryKey: ['sub-org-team-pending-installments', subOrgId],
        queryFn: () => getSubOrgTeamPendingInstallments(subOrgId!, instituteId!),
        enabled: mode === 'subOrg' && !!subOrgId && !!instituteId,
        staleTime: 30000,
    });
    const duesByUserId = (pendingDues?.members || []).reduce<
        Record<string, SubOrgTeamPendingInstallments['members'][number]>
    >((acc, row) => {
        acc[row.user_id] = row;
        return acc;
    }, {});

    // Status derivation has to mirror the cell-level logic — auth-service doesn't set the
    // top-level `status` field, so fall back to the first institute-scoped role's status.
    const instituteIdForFilter = getInstituteId();
    const memberStatus = (m: any): string =>
        m.status
        || (m.roles || []).find((r: any) => r.institute_id === instituteIdForFilter)?.status
        || 'UNKNOWN';

    const activeMembers = allMembers.filter((m: any) => {
        const s = memberStatus(m);
        return s === 'ACTIVE' || s === 'DISABLED';
    });
    const invitedMembers = allMembers.filter((m: any) => memberStatus(m) === 'INVITED');

    // In subOrg mode the table content depends on the tab; institute mode keeps original behaviour.
    const members = mode === 'subOrg'
        ? (selectedTab === 'active' ? activeMembers : invitedMembers)
        : allMembers;

    // Which member the remove dialog is targeting (null = closed).
    const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

    const removeMutation = useMutation({
        mutationFn: async (vars: {
            userId: string;
            removeMode: 'SOFT' | 'HARD';
            accessTillDate: string | null;
        }) => {
            if (mode !== 'subOrg' || !subOrgId) {
                throw new Error('Remove is only supported in sub-org mode');
            }
            return removeSubOrgTeamMember({
                sub_org_id: subOrgId,
                institute_id: instituteId!,
                user_id: vars.userId,
                mode: vars.removeMode,
                access_till_date: vars.accessTillDate,
            });
        },
        onSuccess: (_data, vars) => {
            toast.success(
                vars.removeMode === 'SOFT'
                    ? 'Member scheduled for removal — access continues until the chosen date'
                    : 'Member removed from sub-org'
            );
            setRemoveTarget(null);
            queryClient.invalidateQueries({ queryKey: ['custom-teams'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to remove member');
        },
    });

    if (isLoadingRoles || isLoadingUsers) return <DashboardLoader />;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                {mode === 'subOrg' ? (
                    <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as SubOrgTab)}>
                        <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
                            <TabsTrigger
                                value="active"
                                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                    selectedTab === 'active'
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                }`}
                            >
                                <span className={selectedTab === 'active' ? 'text-primary-500' : ''}>
                                    Active
                                </span>
                                <Badge
                                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                                    variant="outline"
                                >
                                    {activeMembers.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger
                                value="invited"
                                className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                                    selectedTab === 'invited'
                                        ? 'rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50'
                                        : 'border-none bg-transparent'
                                }`}
                            >
                                <span className={selectedTab === 'invited' ? 'text-primary-500' : ''}>
                                    Invited
                                </span>
                                <Badge
                                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                                    variant="outline"
                                >
                                    {invitedMembers.length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                ) : <div />}
                <MyButton onClick={() => setIsAddMemberOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Member
                </MyButton>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead>Status</TableHead>
                            {mode === 'subOrg' && <TableHead>Pending Dues</TableHead>}
                            {mode === 'subOrg' && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!members || members.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={mode === 'subOrg' ? 7 : 5} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                        <User className="h-8 w-8 opacity-50" />
                                        <p>No members found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            members.map((member: any) => (
                                <TableRow
                                    key={member.id || member.userId}
                                    className="cursor-pointer hover:bg-neutral-50 transition-colors"
                                    onClick={() => {
                                        const uid = member.id || member.userId;
                                        const uname = member.full_name || member.name;
                                        if (mode === 'subOrg') {
                                            setHistoryDrawer({ userId: uid, name: uname });
                                        } else {
                                            setAccessModalUserId(uid);
                                            setAccessModalUserName(uname);
                                        }
                                    }}
                                >
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.profile_pic_file_id || member.profilePic} />
                                                <AvatarFallback>{(member.full_name || member.name)?.charAt(0) || 'U'}</AvatarFallback>
                                            </Avatar>
                                            {member.full_name || member.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>{member.mobile_number || member.mobileNumber}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(member.roles || []).filter((r: any) => r.institute_id === getInstituteId()).map((role: any) => (
                                                <span
                                                    key={role.id}
                                                    className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700"
                                                >
                                                    {mapRoleToCustomName(role.role_name)}
                                                </span>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            // auth-service doesn't fill the top-level `status` on UserWithRolesDTO
                                            // (it lives on each per-institute UserRole). Fall back to the first
                                            // institute-scoped role's status so the column isn't blank.
                                            const instituteRoles = (member.roles || []).filter(
                                                (r: any) => r.institute_id === getInstituteId()
                                            );
                                            const status = member.status || instituteRoles[0]?.status || 'UNKNOWN';
                                            const badgeClass =
                                                status === 'ACTIVE' ? 'bg-green-100 text-green-800'
                                                    : status === 'INVITED' ? 'bg-amber-100 text-amber-800'
                                                        : status === 'DISABLED' ? 'bg-red-100 text-red-800'
                                                            : 'bg-neutral-100 text-neutral-700';
                                            return (
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                                                    {status}
                                                </span>
                                            );
                                        })()}
                                    </TableCell>
                                    {mode === 'subOrg' && (() => {
                                        // Most team members have no UserPlan → no SFP rows → empty cell.
                                        // A row appears here only if the member happens to have a CPO plan.
                                        const memberId = member.id || member.userId;
                                        const dues = memberId ? duesByUserId[memberId] : undefined;
                                        if (!dues || (dues.pending_installments_count ?? 0) === 0) {
                                            return (
                                                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                                            );
                                        }
                                        const amount = dues.outstanding_amount ?? 0;
                                        const fmt = `₹${Number(amount).toLocaleString('en-IN', {
                                            maximumFractionDigits: 2,
                                        })}`;
                                        return (
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-amber-700">
                                                        {fmt}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {dues.pending_installments_count} pending
                                                        {dues.next_due_date
                                                            ? ` · next ${new Date(
                                                                  dues.next_due_date,
                                                              ).toLocaleDateString('en-IN', {
                                                                  day: '2-digit',
                                                                  month: 'short',
                                                              })}`
                                                            : ''}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        );
                                    })()}
                                    {mode === 'subOrg' && (
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                disabled={removeMutation.isPending}
                                                className="h-8 w-8 text-neutral-500 hover:bg-danger-50 hover:text-danger-600"
                                                aria-label="Remove from sub-org"
                                                title="Remove from sub-org"
                                                onClick={() => {
                                                    const userId = member.id || member.userId;
                                                    if (!userId) return;
                                                    setRemoveTarget({
                                                        userId,
                                                        name:
                                                            member.full_name ||
                                                            member.fullName ||
                                                            'this user',
                                                    });
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AddMemberForm
                open={isAddMemberOpen}
                onOpenChange={setIsAddMemberOpen}
                mode={mode}
                subOrgId={subOrgId}
            />

            <UserAccessModal
                open={!!accessModalUserId}
                onOpenChange={(open) => !open && setAccessModalUserId(null)}
                userId={accessModalUserId}
                userName={accessModalUserName}
            />

            <MemberHistoryDrawer
                open={!!historyDrawer}
                onOpenChange={(o) => !o && setHistoryDrawer(null)}
                userId={historyDrawer?.userId || null}
                userName={historyDrawer?.name}
                subtitle="Team member"
                readOnly={isCallerSubOrgAdmin()}
            />

            <SubOrgRemoveMemberDialog
                open={!!removeTarget}
                onOpenChange={(o) => !o && setRemoveTarget(null)}
                memberName={removeTarget?.name || 'this user'}
                isPending={removeMutation.isPending}
                onConfirm={(removeMode, accessTillDate) => {
                    if (!removeTarget) return;
                    removeMutation.mutate({
                        userId: removeTarget.userId,
                        removeMode,
                        accessTillDate,
                    });
                }}
            />
        </div>
    );
}
