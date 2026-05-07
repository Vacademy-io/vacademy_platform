import { MyButton } from '@/components/design-system/button';
import { Plus, User, Building2, X } from 'lucide-react';
import { useState } from 'react';
import { AddMemberForm } from './add-member-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAllRoles,
    listSubOrgTeamMembers,
    removeSubOrgTeamMember,
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
import { mapRoleToCustomName } from '@/utils/roleUtils';
import { toast } from 'sonner';

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
                const resp = await listSubOrgTeamMembers({
                    sub_org_id: subOrgId,
                    institute_id: instituteId,
                    roles: activeRoles.map((r: any) => r.name),
                    status: ['ACTIVE', 'DISABLED'],
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

    const members = data?.content || [];

    const removeMutation = useMutation({
        mutationFn: async (userId: string) => {
            if (mode !== 'subOrg' || !subOrgId) {
                throw new Error('Remove is only supported in sub-org mode');
            }
            return removeSubOrgTeamMember({
                sub_org_id: subOrgId,
                institute_id: instituteId,
                user_id: userId,
            });
        },
        onSuccess: () => {
            toast.success('Member removed from sub-org');
            queryClient.invalidateQueries({ queryKey: ['custom-teams'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to remove member');
        },
    });

    if (isLoadingRoles || isLoadingUsers) return <DashboardLoader />;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
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
                            {mode === 'subOrg' && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!members || members.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={mode === 'subOrg' ? 6 : 5} className="h-24 text-center">
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
                                        setAccessModalUserId(member.id || member.userId);
                                        setAccessModalUserName(member.full_name || member.name);
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
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${member.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {member.status}
                                        </span>
                                    </TableCell>
                                    {mode === 'subOrg' && (
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const userId = member.id || member.userId;
                                                    if (!userId) return;
                                                    if (window.confirm(`Remove ${member.full_name || member.fullName || 'this user'} from this sub-org?`)) {
                                                        removeMutation.mutate(userId);
                                                    }
                                                }}
                                                disabled={removeMutation.isPending}
                                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                                title="Remove from sub-org"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
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
        </div>
    );
}
