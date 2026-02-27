import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { getAllRoles } from '@/routes/manage-custom-teams/-services/custom-team-services';
import type { CustomRole } from '@/routes/manage-custom-teams/-services/custom-team-services';

export default function RoleDisplaySettingsMain() {
    const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | 'custom'>('admin');
    const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');

    const { data: customRoles } = useQuery({
        queryKey: ['custom-roles'],
        queryFn: getAllRoles,
    });

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
