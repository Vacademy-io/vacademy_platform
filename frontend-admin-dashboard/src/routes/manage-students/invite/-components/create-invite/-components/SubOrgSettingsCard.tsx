import { UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { getAllRoles } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';

interface SubOrgSettingsCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const ADMIN_PERMISSION_OPTIONS = ['FULL', 'CREATE_COURSE'] as const;

/**
 * Sub-org settings for an invite link, mirroring the Create Sub-Org modal.
 * When enabled and the invite targets a sub-org-associated batch, enrolling
 * provisions a sub-org whose admin gets these auth roles / permissions / seat
 * cap. Persisted to setting_json.setting.SUB_ORG_SETTING.
 */
const SubOrgSettingsCard = ({ form }: SubOrgSettingsCardProps) => {
    const enabled = form.watch('subOrgSettings.enabled');
    const authRoles = form.watch('subOrgSettings.authRoles') ?? [];
    const allowedTeamRoles = form.watch('subOrgSettings.allowedTeamRoles') ?? [];
    const adminPermissions = form.watch('subOrgSettings.adminPermissions') ?? [];

    const { data: rolesList = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: !!enabled,
    });

    const toggleInArray = (
        fieldName:
            | 'subOrgSettings.authRoles'
            | 'subOrgSettings.allowedTeamRoles'
            | 'subOrgSettings.adminPermissions',
        current: string[],
        value: string,
        checked: boolean
    ) => {
        const next = checked
            ? Array.from(new Set([...current, value]))
            : current.filter((v) => v !== value);
        form.setValue(fieldName, next, { shouldDirty: true });
    };

    return (
        <Card className="rounded-sm bg-neutral-50/50 shadow-none">
            <CardHeader className="border-b bg-neutral-100/50 p-4">
                <CardTitle className="text-base font-semibold text-neutral-800">
                    Sub-organization Settings
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4">
                <FormField
                    control={form.control}
                    name="subOrgSettings.enabled"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-sm font-semibold">
                                    Sub-org invite
                                </FormLabel>
                                <p className="text-xs text-neutral-500">
                                    Enrolling via this invite into a sub-org-associated batch
                                    creates a sub-organization. Configure its admin roles,
                                    permissions and seat limit below.
                                </p>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )}
                />

                {enabled && (
                    <div className="space-y-6">
                        {/* Admin auth roles */}
                        <div className="space-y-2">
                            <FormLabel className="text-sm font-semibold">
                                Admin roles (auth service)
                            </FormLabel>
                            <p className="text-xs text-neutral-500">
                                Roles assigned to the user who joins via this invite.
                            </p>
                            <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
                                {rolesList.map((role) => (
                                    <label
                                        key={role.id}
                                        className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-100"
                                    >
                                        <Checkbox
                                            checked={authRoles.includes(role.name)}
                                            onCheckedChange={(checked) =>
                                                toggleInArray(
                                                    'subOrgSettings.authRoles',
                                                    authRoles,
                                                    role.name,
                                                    checked === true
                                                )
                                            }
                                        />
                                        {role.name}
                                    </label>
                                ))}
                                {rolesList.length === 0 && (
                                    <span className="text-xs text-neutral-400">No roles found</span>
                                )}
                            </div>
                        </div>

                        {/* Allowed team roles */}
                        <div className="space-y-2">
                            <FormLabel className="text-sm font-semibold">
                                Allowed team roles
                            </FormLabel>
                            <p className="text-xs text-neutral-500">
                                Roles the sub-org admin can assign to their own team. Leave empty
                                to allow any custom role.
                            </p>
                            <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
                                {rolesList.map((role) => (
                                    <label
                                        key={role.id}
                                        className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-100"
                                    >
                                        <Checkbox
                                            checked={allowedTeamRoles.includes(role.name)}
                                            onCheckedChange={(checked) =>
                                                toggleInArray(
                                                    'subOrgSettings.allowedTeamRoles',
                                                    allowedTeamRoles,
                                                    role.name,
                                                    checked === true
                                                )
                                            }
                                        />
                                        {role.name}
                                    </label>
                                ))}
                                {rolesList.length === 0 && (
                                    <span className="text-xs text-neutral-400">No roles found</span>
                                )}
                            </div>
                        </div>

                        {/* Admin permissions */}
                        <div className="space-y-2">
                            <FormLabel className="text-sm font-semibold">
                                Admin permissions
                            </FormLabel>
                            <p className="text-xs text-neutral-500">
                                What the sub-org admin can do. Leave empty to grant FULL access.
                            </p>
                            <div className="flex flex-wrap gap-2 rounded-md border bg-white p-2">
                                {ADMIN_PERMISSION_OPTIONS.map((perm) => (
                                    <label
                                        key={perm}
                                        className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-neutral-100"
                                    >
                                        <Checkbox
                                            checked={adminPermissions.includes(perm)}
                                            onCheckedChange={(checked) =>
                                                toggleInArray(
                                                    'subOrgSettings.adminPermissions',
                                                    adminPermissions,
                                                    perm,
                                                    checked === true
                                                )
                                            }
                                        />
                                        {perm}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Seat limit */}
                        <FormField
                            control={form.control}
                            name="subOrgSettings.memberCount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold">
                                        Seat limit
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={1}
                                            placeholder="e.g. 10"
                                            value={field.value ?? ''}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value === ''
                                                        ? null
                                                        : Number(e.target.value)
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <p className="text-xs text-neutral-500">
                                        Maximum members in the sub-org. Leave blank for no
                                        explicit cap.
                                    </p>
                                </FormItem>
                            )}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SubOrgSettingsCard;
