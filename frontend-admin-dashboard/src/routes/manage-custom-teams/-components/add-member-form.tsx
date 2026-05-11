import { Button } from '@/components/ui/button';
import PhoneInputField from '@/components/design-system/phone-input-field';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form } from '@/components/ui/form';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    grantUserAccess,
    inviteUser,
    createCustomRole,
    getAllRoles,
    addSubOrgTeamMember,
    listAccessibleGrants,
} from '../-services/custom-team-services';
import { fetchBatchesByIds } from '@/routes/admin-package-management/-services/package-service';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchPaginatedBatches } from '../../admin-package-management/-services/package-service';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from 'use-debounce';

const memberSchema = z.object({
    fullName: z.string().min(1, 'Full Name is required'),
    email: z.string().email('Invalid email address'),
    mobileNumber: z.string().min(10, 'Phone must be at least 10 digits'),
    roleId: z.string().optional(),
    hasFacultyAssigned: z.boolean().default(false),
    linkageType: z.enum(['DIRECT', 'INHERITED', 'PARTNERSHIP']).optional(),
    accessPermission: z.string().default('FULL'),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface AddMemberFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    /** 'institute' (default) — original 2-step invite + grantUserAccess flow.
     *  'subOrg' — single-call backend that creates user + FSPSSM with linkage_type=SUB_ORG. */
    mode?: 'institute' | 'subOrg';
    subOrgId?: string;
}

export function AddMemberForm({ open, onOpenChange, onSuccess, mode = 'institute', subOrgId }: AddMemberFormProps) {
    const queryClient = useQueryClient();
    const [isCustomRole, setIsCustomRole] = useState(false);
    const [customRoleName, setCustomRoleName] = useState('');

    // Multi-select package sessions
    const [selectedPackageSessionIds, setSelectedPackageSessionIds] = useState<string[]>([]);
    const [sessionSearch, setSessionSearch] = useState('');
    const [debouncedSessionSearch] = useDebounce(sessionSearch, 300);
    const [sessionPage, setSessionPage] = useState(0);
    const SESSION_PAGE_SIZE = 10;

    const form = useForm<MemberFormValues>({
        resolver: zodResolver(memberSchema),
        defaultValues: {
            mobileNumber: '',
            hasFacultyAssigned: false,
            accessPermission: 'FULL',
            linkageType: 'DIRECT',
        },
    });

    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        formState: { errors },
    } = form;

    const hasFacultyAssigned = form.watch('hasFacultyAssigned');

    // Fetch Roles. In subOrg mode, system roles are hidden — sub-org admins can only assign
    // custom roles to their team members.
    const SYSTEM_ROLE_NAMES = ['ADMIN', 'TEACHER', 'STUDENT', 'EVALUATOR', 'COURSE CREATOR', 'ASSESSMENT CREATOR'];
    const { data: rolesRaw = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: open,
    });
    const roles = mode === 'subOrg'
        ? (rolesRaw || []).filter((r: any) => !SYSTEM_ROLE_NAMES.includes(String(r.name || '').toUpperCase()))
        : (rolesRaw || []);

    const instituteId = getCurrentInstituteId();

    // In subOrg mode, the caller can only grant access to PSes/invites their FSPSSM allows.
    // We fetch the allowed set from the backend; if they have only invite-level access, the
    // PS section won't render.
    const { data: accessibleGrants } = useQuery({
        queryKey: ['accessible-grants', instituteId],
        queryFn: () => listAccessibleGrants(instituteId!),
        enabled: open && mode === 'subOrg' && !!instituteId,
        staleTime: 1000 * 60,
    });
    const accessiblePsIds = accessibleGrants?.package_session_ids;

    const { data: scopedSessionsData, isLoading: isLoadingScopedSessions } = useQuery({
        queryKey: ['scoped-package-sessions', accessiblePsIds],
        queryFn: async () => {
            if (!accessiblePsIds || accessiblePsIds.length === 0) return { content: [] };
            const resp = await fetchBatchesByIds(accessiblePsIds);
            return { content: resp.content || [] };
        },
        enabled: open && mode === 'subOrg' && !!accessiblePsIds && accessiblePsIds.length > 0,
    });

    // Fetch paginated package sessions (institute-wide flow — unchanged for default mode)
    const { data: paginatedSessionsRaw, isLoading: isLoadingPaginatedSessions } = useQuery({
        queryKey: ['paginated-sessions', debouncedSessionSearch, sessionPage],
        queryFn: () => fetchPaginatedBatches({
            page: sessionPage,
            size: SESSION_PAGE_SIZE,
            search: debouncedSessionSearch || undefined,
            statuses: ['ACTIVE'],
        }),
        enabled: open && mode !== 'subOrg',
    });

    // Unified shape for the UI: in subOrg mode use the scoped list (no pagination needed);
    // otherwise use the original paginated source.
    const paginatedSessions = mode === 'subOrg'
        ? (scopedSessionsData
            ? {
                  content: (scopedSessionsData.content as any[]).filter((ps: any) => {
                      if (!debouncedSessionSearch) return true;
                      const haystack = [
                          ps.package_dto?.package_name,
                          ps.level?.level_name,
                          ps.session?.session_name,
                      ].filter(Boolean).join(' ').toLowerCase();
                      return haystack.includes(debouncedSessionSearch.toLowerCase());
                  }),
                  total_pages: 1,
                  total_elements: scopedSessionsData.content.length,
                  has_previous: false,
                  has_next: false,
              }
            : undefined)
        : paginatedSessionsRaw;
    const isLoadingSessions = mode === 'subOrg' ? isLoadingScopedSessions : isLoadingPaginatedSessions;

    const togglePackageSession = (id: string) => {
        setSelectedPackageSessionIds((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const mutation = useMutation({
        mutationFn: async (data: MemberFormValues) => {
            let roleName: string;
            let roleId: string | undefined;

            if (isCustomRole) {
                roleName = customRoleName;
            } else {
                const selectedRole = roles.find((r: any) => r.id === data.roleId);
                roleName = selectedRole?.name || data.roleId;
                roleId = data.roleId;
            }

            // Sub-org mode: single backend call that does invite + scoped FSPSSM grant.
            if (mode === 'subOrg') {
                if (!subOrgId) throw new Error('Missing sub-org id');
                if (isCustomRole) {
                    // Sub-org team members always get faculty-access permission (the role is
                    // scoped via SUB_ORG FSPSSM entries server-side), so no checkbox needed.
                    const roleResponse = await createCustomRole({ name: customRoleName, permissionIds: ['109'] });
                    roleId = roleResponse.id || roleResponse.roleId;
                    roleName = customRoleName;
                }
                const result = await addSubOrgTeamMember({
                    sub_org_id: subOrgId,
                    institute_id: instituteId!,
                    user: {
                        email: data.email,
                        full_name: data.fullName,
                        mobile_number: data.mobileNumber,
                    },
                    role_name: roleName,
                    role_id: roleId,
                    package_session_ids: selectedPackageSessionIds,
                    access_permission: data.accessPermission,
                });
                return { userId: result.user_id, roleId, success: true };
            }

            // STEP 1: Invite user with the role name
            const inviteResponse = await inviteUser({
                email: data.email,
                full_name: data.fullName,
                roles: [roleName],
                root_user: false,
            });

            const userId = inviteResponse.userId || inviteResponse.id || inviteResponse.user?.id;
            if (!userId) {
                throw new Error('Failed to create user - no userId returned');
            }

            // STEP 2: Create custom role if needed
            if (isCustomRole) {
                const permissionIds = hasFacultyAssigned ? ['109'] : [];
                const roleResponse = await createCustomRole({ name: customRoleName, permissionIds });
                roleId = roleResponse.id || roleResponse.roleId;
                if (!roleId) {
                    throw new Error('Failed to create role - no roleId returned');
                }
            }

            // STEP 3: Grant access for each selected package session
            if (selectedPackageSessionIds.length > 0 && roleId) {
                const accessPromises = selectedPackageSessionIds.map((psId) =>
                    grantUserAccess({
                        user_id: userId,
                        status: 'ACTIVE',
                        name: data.fullName,
                        user_type: 'ROLE',
                        type_id: roleId!,
                        access_type: 'PACKAGE_SESSION',
                        access_id: psId,
                        access_permission: data.accessPermission,
                        linkage_type: (data.linkageType?.toUpperCase() || 'DIRECT') as
                            | 'DIRECT'
                            | 'INHERITED'
                            | 'PARTNERSHIP',
                    })
                );
                await Promise.all(accessPromises);
            }

            return { userId, roleId, success: true };
        },
        onSuccess: () => {
            toast.success('Member added successfully');
            queryClient.invalidateQueries({ queryKey: ['custom-teams'] });
            queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            reset();
            setSelectedPackageSessionIds([]);
            setSessionSearch('');
            setSessionPage(0);
            setIsCustomRole(false);
            setCustomRoleName('');
            onOpenChange(false);
            if (onSuccess) onSuccess();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to add member');
        },
    });

    const onSubmit = (data: MemberFormValues) => {
        if (!isCustomRole && !data.roleId) {
            form.setError('roleId', { type: 'manual', message: 'Role is required' });
            return;
        }
        if (isCustomRole && !customRoleName.trim()) {
            toast.error('Please enter a custom role name');
            return;
        }
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-[95vw] sm:max-w-[720px] md:max-w-[900px] lg:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle>Add New Member</DialogTitle>
                    <DialogDescription>
                        Create a new user and assign them to a team/role with specific access.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            {/* User Details Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700">
                                    User Details
                                </h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullName">Full Name *</Label>
                                        <Input
                                            id="fullName"
                                            {...register('fullName')}
                                            placeholder="John Doe"
                                        />
                                        {errors.fullName && (
                                            <p className="text-xs text-red-500">
                                                {errors.fullName.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email *</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            {...register('email')}
                                            placeholder="john@example.com"
                                        />
                                        {errors.email && (
                                            <p className="text-xs text-red-500">
                                                {errors.email.message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <PhoneInputField
                                            label="Phone"
                                            name="mobileNumber"
                                            placeholder="123 456 7890"
                                            control={control}
                                            country="in"
                                            required={true}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="role">Role *</Label>
                                        {!isCustomRole ? (
                                            <Controller
                                                control={control}
                                                name="roleId"
                                                render={({ field }) => (
                                                    <Select
                                                        onValueChange={(val) => {
                                                            if (val === 'CUSTOM') {
                                                                setIsCustomRole(true);
                                                                field.onChange('');
                                                            } else {
                                                                field.onChange(val);
                                                            }
                                                        }}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Role" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <ScrollArea className="h-[200px]">
                                                                {roles.map((role: any) => (
                                                                    <SelectItem
                                                                        key={role.id}
                                                                        value={role.id}
                                                                    >
                                                                        {role.name}
                                                                    </SelectItem>
                                                                ))}
                                                                <SelectItem value="CUSTOM">
                                                                    <span className="font-semibold text-blue-600">
                                                                        + Custom Role
                                                                    </span>
                                                                </SelectItem>
                                                            </ScrollArea>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        ) : (
                                            <div className="flex gap-2">
                                                <Input
                                                    id="customRole"
                                                    value={customRoleName}
                                                    onChange={(e) =>
                                                        setCustomRoleName(e.target.value)
                                                    }
                                                    placeholder="Enter custom role name"
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setIsCustomRole(false);
                                                        setCustomRoleName('');
                                                        setValue('roleId', '');
                                                        form.clearErrors('roleId');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        )}
                                        {errors.roleId && (
                                            <p className="text-xs text-red-500">
                                                {errors.roleId.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {mode !== 'subOrg' && (
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Controller
                                            control={control}
                                            name="hasFacultyAssigned"
                                            render={({ field }) => (
                                                <Checkbox
                                                    id="hasFacultyAssigned"
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            )}
                                        />
                                        <Label
                                            htmlFor="hasFacultyAssigned"
                                            className="cursor-pointer font-normal"
                                        >
                                            Has Faculty Assigned Permission?
                                        </Label>
                                    </div>
                                )}
                            </div>

                            {/* Access Mapping Section - Multi-select Package Sessions */}
                            <div className="space-y-4 border-t pt-4">
                                <h3 className="text-sm font-semibold text-gray-700">
                                    User Access Mapping
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Select one or more package sessions to grant access to.
                                </p>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {/* Package Sessions multi-select with search + pagination */}
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Package Sessions</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Search package sessions..."
                                                value={sessionSearch}
                                                onChange={(e) => {
                                                    setSessionSearch(e.target.value);
                                                    setSessionPage(0);
                                                }}
                                                className="pl-9"
                                            />
                                        </div>
                                        <div className="rounded-md border">
                                            <ScrollArea className="h-[250px] p-3">
                                                {isLoadingSessions ? (
                                                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Loading sessions...
                                                    </div>
                                                ) : !paginatedSessions?.content?.length ? (
                                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                                        No package sessions found.
                                                    </p>
                                                ) : (
                                                    paginatedSessions.content.map((ps) => {
                                                        const packageName = ps.package_dto?.package_name || '';
                                                        const levelName = ps.level?.level_name || '';
                                                        const sessionName = ps.session?.session_name || '';
                                                        const display = [packageName, levelName, sessionName]
                                                            .filter(Boolean)
                                                            .join(' - ');
                                                        return (
                                                            <label
                                                                key={ps.id}
                                                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                                                            >
                                                                <Checkbox
                                                                    checked={selectedPackageSessionIds.includes(ps.id)}
                                                                    onCheckedChange={() => togglePackageSession(ps.id)}
                                                                />
                                                                <span>{display || ps.id}</span>
                                                            </label>
                                                        );
                                                    })
                                                )}
                                            </ScrollArea>
                                            {/* Pagination controls */}
                                            {paginatedSessions && paginatedSessions.total_pages > 1 && (
                                                <div className="flex items-center justify-between border-t px-3 py-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        Page {sessionPage + 1} of {paginatedSessions.total_pages} ({paginatedSessions.total_elements} total)
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={!paginatedSessions.has_previous}
                                                            onClick={() => setSessionPage((p) => p - 1)}
                                                        >
                                                            <ChevronLeft className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={!paginatedSessions.has_next}
                                                            onClick={() => setSessionPage((p) => p + 1)}
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {selectedPackageSessionIds.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                {selectedPackageSessionIds.length} session(s) selected
                                            </p>
                                        )}
                                    </div>

                                    {mode !== 'subOrg' && (
                                        <div className="space-y-2">
                                            <Label>Linkage Type</Label>
                                            <Controller
                                                control={control}
                                                name="linkageType"
                                                render={({ field }) => (
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Linkage Type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="DIRECT">
                                                                Direct
                                                            </SelectItem>
                                                            <SelectItem value="INHERITED">
                                                                Inherited
                                                            </SelectItem>
                                                            <SelectItem value="PARTNERSHIP">
                                                                Partnership
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </ScrollArea>
                </Form>

                <DialogFooter className="mt-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onOpenChange(false)}
                        disabled={mutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit(onSubmit)}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Member
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
