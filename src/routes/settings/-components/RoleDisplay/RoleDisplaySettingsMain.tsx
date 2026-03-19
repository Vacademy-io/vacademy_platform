import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminDisplaySettings from './AdminDisplaySettings';
import TeacherDisplaySettings from './TeacherDisplaySettings';
import CustomRoleDisplaySettings from './CustomRoleDisplaySettings';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getAllRoles, createCustomRole } from '@/routes/manage-custom-teams/-services/custom-team-services';
import type { CustomRole } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RoleDisplaySettingsMain() {
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | 'custom'>('admin');
    const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');
    const [showNewRoleInput, setShowNewRoleInput] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    const { data: customRoles } = useQuery({
        queryKey: ['custom-roles'],
        queryFn: getAllRoles,
    });

    const createRoleMutation = useMutation({
        mutationFn: (name: string) => createCustomRole({ name, permissionIds: ['109'] }),
        onSuccess: () => {
            toast.success('Role created successfully');
            queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
            setNewRoleName('');
            setShowNewRoleInput(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to create role');
        },
    });

    const handleCreateRole = () => {
        const trimmed = newRoleName.trim();
        if (!trimmed) {
            toast.error('Role name is required');
            return;
        }
        createRoleMutation.mutate(trimmed);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 py-2">
                <h1 className="text-xl font-bold">Display Settings</h1>
                <Select value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="custom">Custom Role</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {selectedRole === 'admin' && <AdminDisplaySettings />}
            {selectedRole === 'teacher' && <TeacherDisplaySettings />}
            {selectedRole === 'custom' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 py-2 border-b pb-4">
                        <span className="text-sm font-medium">Select Custom Role to Configure:</span>
                        {showNewRoleInput ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Enter role name"
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCreateRole();
                                        }
                                    }}
                                    disabled={createRoleMutation.isPending}
                                    className="h-8 w-[250px]"
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleCreateRole}
                                    disabled={createRoleMutation.isPending}
                                    className="h-8"
                                >
                                    {createRoleMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        'Create'
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowNewRoleInput(false);
                                        setNewRoleName('');
                                    }}
                                    disabled={createRoleMutation.isPending}
                                    className="h-8 px-2"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Select
                                    value={selectedCustomRoleId}
                                    onValueChange={(val: any) => setSelectedCustomRoleId(val)}
                                >
                                    <SelectTrigger className="w-[300px]">
                                        <SelectValue placeholder="Choose a custom role..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customRoles?.map((r: CustomRole) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowNewRoleInput(true)}
                                    className="h-8 px-2"
                                    title="Add new role"
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {selectedCustomRoleId ? (
                        <CustomRoleDisplaySettings key={selectedCustomRoleId} roleId={selectedCustomRoleId} />
                    ) : (
                        <div className="text-sm text-gray-500 italic mt-4">Please select a custom role from the dropdown above to view or edit its settings.</div>
                    )}
                </div>
            )}
        </div>
    );
}
