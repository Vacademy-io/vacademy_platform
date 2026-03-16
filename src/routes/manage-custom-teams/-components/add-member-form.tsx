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
} from '../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchBatchesSummary, fetchCourseBatches } from '../../admin-package-management/-services/package-service';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PackageSessionDTO } from '@/routes/admin-package-management/-types/package-types';

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
}

export function AddMemberForm({ open, onOpenChange, onSuccess }: AddMemberFormProps) {
    const queryClient = useQueryClient();
    const [isCustomRole, setIsCustomRole] = useState(false);
    const [customRoleName, setCustomRoleName] = useState('');

    // Multi-select package sessions
    const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
    const [selectedPackageSessionIds, setSelectedPackageSessionIds] = useState<string[]>([]);

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

    // Fetch Roles
    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: open,
    });

    const instituteId = getCurrentInstituteId();

    // Fetch Packages Summary
    const { data: packagesSummary } = useQuery({
        queryKey: ['packages-summary'],
        queryFn: () => fetchBatchesSummary(['ACTIVE']),
        enabled: open,
    });

    // Fetch Sessions for expanded package
    const { data: packageSessions = [], isLoading: isLoadingSessions } = useQuery<
        PackageSessionDTO[]
    >({
        queryKey: ['package-sessions', expandedPackageId],
        queryFn: () => fetchCourseBatches(expandedPackageId!),
        enabled: !!expandedPackageId,
    });

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
            reset();
            setSelectedPackageSessionIds([]);
            setExpandedPackageId(null);
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
                                    {/* Package Sessions multi-select */}
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Package Sessions</Label>
                                        <div className="rounded-md border">
                                            <ScrollArea className="h-[250px] p-3">
                                                {packagesSummary?.packages?.length === 0 && (
                                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                                        No packages found.
                                                    </p>
                                                )}
                                                {packagesSummary?.packages?.map(
                                                    (pkg: { id: string; name: string }) => (
                                                        <div key={pkg.id} className="mb-2">
                                                            <button
                                                                type="button"
                                                                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                                                                onClick={() =>
                                                                    setExpandedPackageId(
                                                                        expandedPackageId ===
                                                                            pkg.id
                                                                            ? null
                                                                            : pkg.id
                                                                    )
                                                                }
                                                            >
                                                                <span>{pkg.name}</span>
                                                                <ChevronRight
                                                                    className={`h-4 w-4 transition-transform ${
                                                                        expandedPackageId ===
                                                                        pkg.id
                                                                            ? 'rotate-90'
                                                                            : ''
                                                                    }`}
                                                                />
                                                            </button>
                                                            {expandedPackageId === pkg.id && (
                                                                <div className="ml-4 mt-1 space-y-1">
                                                                    {isLoadingSessions ? (
                                                                        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                            Loading sessions...
                                                                        </div>
                                                                    ) : packageSessions.length ===
                                                                      0 ? (
                                                                        <p className="py-2 text-sm text-muted-foreground">
                                                                            No sessions
                                                                            available.
                                                                        </p>
                                                                    ) : (
                                                                        packageSessions.map(
                                                                            (ps) => {
                                                                                const packageName =
                                                                                    ps
                                                                                        .package_dto
                                                                                        ?.package_name ||
                                                                                    '';
                                                                                const levelName =
                                                                                    ps.level
                                                                                        ?.level_name ||
                                                                                    '';
                                                                                const sessionName =
                                                                                    ps.session
                                                                                        ?.session_name ||
                                                                                    '';
                                                                                const display = [
                                                                                    packageName,
                                                                                    levelName,
                                                                                    sessionName,
                                                                                ]
                                                                                    .filter(
                                                                                        Boolean
                                                                                    )
                                                                                    .join(
                                                                                        ' - '
                                                                                    );
                                                                                return (
                                                                                    <label
                                                                                        key={
                                                                                            ps.id
                                                                                        }
                                                                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                                                                                    >
                                                                                        <Checkbox
                                                                                            checked={selectedPackageSessionIds.includes(
                                                                                                ps.id
                                                                                            )}
                                                                                            onCheckedChange={() =>
                                                                                                togglePackageSession(
                                                                                                    ps.id
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                        <span>
                                                                                            {display ||
                                                                                                ps.id}
                                                                                        </span>
                                                                                    </label>
                                                                                );
                                                                            }
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                )}
                                            </ScrollArea>
                                        </div>
                                        {selectedPackageSessionIds.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                {selectedPackageSessionIds.length} session(s)
                                                selected
                                            </p>
                                        )}
                                    </div>

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
