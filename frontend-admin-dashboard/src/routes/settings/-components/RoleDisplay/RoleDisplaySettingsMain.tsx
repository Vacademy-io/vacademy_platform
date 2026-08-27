import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import {
    getAllRoles,
    createCustomRole,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import type { CustomRole } from '@/routes/manage-custom-teams/-services/custom-team-services';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SettingsPageShell } from '@/components/settings/shell';

type RoleKey = 'admin' | 'teacher' | 'custom';

const buildRoleOptions = (t: TFunction): { value: RoleKey; label: string }[] => [
    { value: 'admin', label: t('roleTabs.admin') },
    { value: 'teacher', label: t('roleTabs.teacher') },
    { value: 'custom', label: t('roleTabs.custom') },
];

export default function RoleDisplaySettingsMain() {
    const { t } = useTranslation('settingsRoleDisplayMain');
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState<RoleKey>('admin');
    const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');
    const [showNewRoleInput, setShowNewRoleInput] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    const ROLE_OPTIONS = buildRoleOptions(t);

    const { data: customRoles } = useQuery({
        queryKey: ['custom-roles'],
        queryFn: getAllRoles,
    });

    // System roles already have dedicated panels (Admin / Teacher) or are not
    // configurable here (Student lives under "Student Display"). Filter them
    // out so this dropdown only lists true custom roles.
    const SYSTEM_ROLE_NAMES = new Set([
        'ADMIN',
        'TEACHER',
        'STUDENT',
        'LEARNER',
        'EVALUATOR',
        'CONTENT CREATOR',
        'ASSESSMENT CREATOR',
    ]);
    const filteredCustomRoles = (customRoles || []).filter(
        (r: CustomRole) => !SYSTEM_ROLE_NAMES.has(r.name.toUpperCase())
    );

    const createRoleMutation = useMutation({
        mutationFn: (name: string) => createCustomRole({ name, permissionIds: ['109'] }),
        onSuccess: () => {
            toast.success(t('toasts.roleCreated'));
            queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
            setNewRoleName('');
            setShowNewRoleInput(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || t('toasts.roleCreateFailed'));
        },
    });

    const handleCreateRole = () => {
        const trimmed = newRoleName.trim();
        if (!trimmed) {
            toast.error(t('toasts.roleNameRequired'));
            return;
        }
        createRoleMutation.mutate(trimmed);
    };

    const selectedCustomRoleName = customRoles?.find(
        (r: CustomRole) => r.id === selectedCustomRoleId
    )?.name;

    return (
        <SettingsPageShell
            title={
                selectedRole === 'admin'
                    ? t('title.admin')
                    : selectedRole === 'teacher'
                      ? t('title.teacher')
                      : selectedCustomRoleName
                        ? t('title.customNamed', { name: selectedCustomRoleName })
                        : t('title.customDefault')
            }
            description={t('description')}
            maxWidth="max-w-7xl"
            actions={
                <div
                    role="tablist"
                    aria-label={t('tabs.ariaLabel')}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1"
                >
                    {ROLE_OPTIONS.map((opt) => {
                        const active = selectedRole === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setSelectedRole(opt.value)}
                                className={cn(
                                    'cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                                    active
                                        ? 'bg-white text-neutral-900 shadow-sm'
                                        : 'text-neutral-600 hover:text-neutral-800'
                                )}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            }
        >
            {selectedRole === 'admin' && <AdminDisplaySettings />}
            {selectedRole === 'teacher' && <TeacherDisplaySettings />}
            {selectedRole === 'custom' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                        <span className="text-sm font-semibold text-neutral-700">
                            {t('customRole.label')}
                        </span>
                        {showNewRoleInput ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder={t('customRole.newRoleInput.placeholder')}
                                    value={newRoleName}
                                    onChange={(e) => setNewRoleName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCreateRole();
                                        }
                                    }}
                                    disabled={createRoleMutation.isPending}
                                    className="h-9 w-64"
                                />
                                <MyButton
                                    type="button"
                                    scale="small"
                                    onClick={handleCreateRole}
                                    disable={createRoleMutation.isPending}
                                >
                                    {createRoleMutation.isPending ? (
                                        <CircleNotch className="size-3 animate-spin" />
                                    ) : (
                                        t('customRole.newRoleInput.create')
                                    )}
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    layoutVariant="icon"
                                    aria-label={t('customRole.newRoleInput.cancel')}
                                    onClick={() => {
                                        setShowNewRoleInput(false);
                                        setNewRoleName('');
                                    }}
                                    disable={createRoleMutation.isPending}
                                >
                                    <X className="size-4" />
                                </MyButton>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Select
                                    value={selectedCustomRoleId}
                                    onValueChange={(val: string) =>
                                        setSelectedCustomRoleId(val)
                                    }
                                >
                                    <SelectTrigger className="h-9 w-72">
                                        <SelectValue
                                            placeholder={t('customRole.select.placeholder')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCustomRoles.length === 0 ? (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                {t('customRole.select.empty')}
                                            </div>
                                        ) : (
                                            filteredCustomRoles.map((r: CustomRole) => (
                                                <SelectItem key={r.id} value={r.id}>
                                                    {r.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    layoutVariant="icon"
                                    aria-label={t('customRole.select.addAriaLabel')}
                                    onClick={() => setShowNewRoleInput(true)}
                                >
                                    <Plus className="size-4" />
                                </MyButton>
                            </div>
                        )}
                    </div>

                    {selectedCustomRoleId ? (
                        <CustomRoleDisplaySettings
                            key={selectedCustomRoleId}
                            roleId={selectedCustomRoleId}
                            roleName={selectedCustomRoleName}
                        />
                    ) : (
                        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-neutral-500">
                            {t('customRole.emptyState')}
                        </div>
                    )}
                </div>
            )}
        </SettingsPageShell>
    );
}
