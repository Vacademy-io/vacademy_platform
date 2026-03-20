import { MyButton } from '@/components/design-system/button';
import { Plus, User, Building2 } from 'lucide-react';
import { useState } from 'react';
import { AddMemberForm } from './add-member-form';
import { useQuery } from '@tanstack/react-query';
import { getAllRoles } from '../-services/custom-team-services';
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

export function CustomTeamsList() {
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [accessModalUserId, setAccessModalUserId] = useState<string | null>(null);
    const [accessModalUserName, setAccessModalUserName] = useState<string>('');

    const { data: rolesResponse, isLoading: isLoadingRoles } = useQuery({
        queryKey: ['custom-roles'],
        queryFn: getAllRoles,
    });

    const activeRoles = rolesResponse || [];

    const { data, isLoading: isLoadingUsers } = useQuery({
        queryKey: ['custom-teams', activeRoles],
        queryFn: async () => {
            if (!activeRoles.length) return { content: [] };

            const mappedRoles = activeRoles.map((role: any) => ({
                id: role.id,
                name: role.name,
            }));

            return fetchInstituteDashboardUsers(
                getInstituteId(),
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
        enabled: activeRoles.length > 0,
    });

    const members = data?.content || [];

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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!members || members.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
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
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AddMemberForm
                open={isAddMemberOpen}
                onOpenChange={setIsAddMemberOpen}
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
