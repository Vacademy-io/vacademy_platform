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
    getSubOrgs,
    inviteUser,
    createCustomRole,
    getAllRoles,
} from '../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchBatchesSummary, fetchCourseBatches, fetchEnrollInvites } from '../../admin-package-management/-services/package-service';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

const memberSchema = z.object({
    fullName: z.string().min(1, 'Full Name is required'),
    email: z.string().email('Invalid email address'),
    mobileNumber: z.string().min(10, 'Phone must be at least 10 digits'),
    roleId: z.string().optional(), // Made optional - will validate conditionally
    hasFacultyAssigned: z.boolean().default(false),
    packageId: z.string().optional(),
    packageSessionId: z.string().optional(),
    enrollInviteId: z.string().optional(),
    subOrgId: z.string().optional(),
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
    const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>(undefined);
    const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(undefined);
    const [isCustomRole, setIsCustomRole] = useState(false);
    const [customRoleName, setCustomRoleName] = useState('');

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
        watch,
        setValue,
        formState: { errors },
    } = form;

    const hasFacultyAssigned = watch('hasFacultyAssigned');

    // Fetch Roles
    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: open,
    });

    const instituteId = getCurrentInstituteId();

    // Fetch SubOrgs
    const { data: subOrgsData } = useQuery({
        queryKey: ['sub-orgs-list', instituteId],
        queryFn: () => getSubOrgs(instituteId),
        staleTime: 1000 * 60 * 5,
        enabled: open && !!instituteId,
        refetchOnMount: 'always',
    });

    const subOrgs = Array.isArray(subOrgsData) ? subOrgsData : (subOrgsData as any)?.content || [];

    // Fetch Packages Summary for Access Mapping (same as admin-package-management)
    const { data: packagesSummary } = useQuery({
        queryKey: ['packages-summary'],
        queryFn: () => fetchBatchesSummary(['ACTIVE']),
        enabled: open,
    });

    // Fetch Sessions if Package Selected - returns PackageSessionDTO[]
    const { data: packageSessions = [], isLoading: isLoadingSessions } = useQuery({
        queryKey: ['package-sessions', selectedPackageId],
        queryFn: () => fetchCourseBatches(selectedPackageId!),
        enabled: !!selectedPackageId,
    });

    // Fetch Enroll Invites if Session Selected
    const { data: enrollInvitesData, isLoading: isLoadingInvites } = useQuery({
        queryKey: ['enroll-invites', selectedSessionId],
        queryFn: () => fetchEnrollInvites(selectedSessionId!),
        enabled: !!selectedSessionId,
    });

    const enrollInvites = enrollInvitesData?.content || [];

    const mutation = useMutation({
        mutationFn: async (data: MemberFormValues) => {
            // Determine the role name and roleId
            let roleName: string;
            let roleId: string | undefined;

            if (isCustomRole) {
                // Use custom role name
                roleName = customRoleName;
            } else {
                // Find the selected role from the dropdown
                const selectedRole = roles.find((r: any) => r.id === data.roleId);
                roleName = selectedRole?.name || data.roleId;
                roleId = data.roleId; // Already have the roleId from dropdown
            }

            // STEP 1: Invite user with the role name
            // This creates the user and assigns the role(s)
            const inviteResponse = await inviteUser({
                email: data.email,
                full_name: data.fullName,
                roles: [roleName], // Role name for user invitation
                root_user: false,
            });

            // Extract the created userId from the response
            const userId = inviteResponse.userId || inviteResponse.id || inviteResponse.user?.id;

            if (!userId) {
                throw new Error('Failed to create user - no userId returned');
            }

            // STEP 2: Create custom role if "Custom" was selected
            if (isCustomRole) {
                const permissionIds = hasFacultyAssigned ? ['109'] : [];
                const roleResponse = await createCustomRole({ name: customRoleName, permissionIds });
                roleId = roleResponse.id || roleResponse.roleId;

                if (!roleId) {
                    throw new Error('Failed to create role - no roleId returned');
                }
            }

            // STEP 3: Grant additional access if package/session/invite is selected
            // Only call grantUserAccess if specific access mapping is needed
            if (data.packageId || data.packageSessionId || data.enrollInviteId) {
                let accessType = 'INSTITUTE';
                let accessId = 'INSTITUTE';

                if (data.enrollInviteId) {
                    accessType = 'ENROLL_INVITE';
                    accessId = data.enrollInviteId;
                } else if (data.packageSessionId) {
                    accessType = 'PACKAGE_SESSION';
                    accessId = data.packageSessionId;
                } else if (data.packageId) {
                    accessType = 'PACKAGE';
                    accessId = data.packageId;
                }

                await grantUserAccess({
                    user_id: userId,
                    status: 'ACTIVE',
                    name: data.fullName,
                    user_type: 'ROLE', // Always 'ROLE' as specified
                    type_id: roleId!, // Use the roleId (from existing role or newly created)
                    access_type: accessType,
                    access_id: accessId,
                    access_permission: data.accessPermission,
                    linkage_type: (data.linkageType?.toUpperCase() || 'DIRECT') as 'DIRECT' | 'INHERITED' | 'PARTNERSHIP',
                    suborg_id: data.subOrgId,
                });
            }

            return { userId, roleId, success: true };
        },
        onSuccess: () => {
            toast.success('Member added successfully');
            queryClient.invalidateQueries({ queryKey: ['custom-teams'] });
            reset();
            setSelectedPackageId(undefined);
            setSelectedSessionId(undefined);
            onOpenChange(false);
            if (onSuccess) onSuccess();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to add member');
        },
    });

    const onSubmit = (data: MemberFormValues) => {
        // Validate: either roleId must be set OR customRole must be selected with a name
        if (!isCustomRole && !data.roleId) {
            form.setError('roleId', {
                type: 'manual',
                message: 'Role is required',
            });
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
                                <h3 className="text-sm font-semibold text-gray-700">User Details</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullName">Full Name *</Label>
                                        <Input
                                            id="fullName"
                                            {...register('fullName')}
                                            placeholder="John Doe"
                                        />
                                        {errors.fullName && (
                                            <p className="text-xs text-red-500">{errors.fullName.message}</p>
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
                                            <p className="text-xs text-red-500">{errors.email.message}</p>
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
                                                                    <span className="font-semibold text-blue-600">+ Custom Role</span>
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
                                                    onChange={(e) => setCustomRoleName(e.target.value)}
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
                                            <p className="text-xs text-red-500">{errors.roleId.message}</p>
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
                                    <Label htmlFor="hasFacultyAssigned" className="cursor-pointer font-normal">
                                        Has Faculty Assigned Permission?
                                    </Label>
                                </div>
                            </div>

                            {/* Access Mapping Section */}
                            <div className="space-y-4 border-t pt-4">
                                <h3 className="text-sm font-semibold text-gray-700">User Access Mapping</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Package</Label>
                                        <Controller
                                            control={control}
                                            name="packageId"
                                            render={({ field }) => (
                                                <Select
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        setSelectedPackageId(val);
                                                        setValue('packageSessionId', '');
                                                        setValue('enrollInviteId', '');
                                                        setSelectedSessionId(undefined);
                                                    }}
                                                    value={field.value}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Package" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <ScrollArea className="h-[200px]">
                                                            {packagesSummary?.packages?.map((pkg: any) => (
                                                                <SelectItem key={pkg.id} value={pkg.id}>
                                                                    {pkg.name}
                                                                </SelectItem>
                                                            ))}
                                                        </ScrollArea>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>PackageSession</Label>
                                        <Controller
                                            control={control}
                                            name="packageSessionId"
                                            render={({ field }) => (
                                                <Select
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        setSelectedSessionId(val);
                                                        setValue('enrollInviteId', '');
                                                    }}
                                                    value={field.value}
                                                    disabled={!selectedPackageId || isLoadingSessions}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={isLoadingSessions ? "Loading..." : "Select Session"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <ScrollArea className="h-[200px]">
                                                            {packageSessions.length > 0 ? (
                                                                packageSessions.map((session: any) => {
                                                                    const packageName = session.package_dto?.package_name || 'Unknown Package';
                                                                    const levelName = session.level?.level_name || '';
                                                                    const sessionName = session.session?.session_name || '';
                                                                    const displayName = `${packageName}${levelName ? ` - ${levelName}` : ''}${sessionName ? ` - ${sessionName}` : ''}`;

                                                                    return (
                                                                        <SelectItem
                                                                            key={session.id}
                                                                            value={session.id}
                                                                        >
                                                                            {displayName}
                                                                        </SelectItem>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="p-2 text-center text-xs text-gray-500">
                                                                    {selectedPackageId ? 'No sessions found' : 'Select a package first'}
                                                                </div>
                                                            )}
                                                        </ScrollArea>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Enroll Invite (Optional)</Label>
                                        <Controller
                                            control={control}
                                            name="enrollInviteId"
                                            render={({ field }) => (
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!selectedSessionId || isLoadingInvites}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={isLoadingInvites ? "Loading..." : "Select Invite"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <ScrollArea className="h-[200px]">
                                                            {enrollInvites.length > 0 ? (
                                                                enrollInvites.map((invite: any) => (
                                                                    <SelectItem key={invite.id} value={invite.id}>
                                                                        {invite.name || invite.id}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <div className="p-2 text-center text-xs text-gray-500">
                                                                    {selectedSessionId ? 'No invites found' : 'Select a session first'}
                                                                </div>
                                                            )}
                                                        </ScrollArea>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Sub-Organization (Optional)</Label>
                                        <Controller
                                            control={control}
                                            name="subOrgId"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Sub-Org" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <ScrollArea className="h-[200px]">
                                                            {subOrgs.map((org: any) => (
                                                                <SelectItem
                                                                    key={org.sub_org_id || org.suborgId || org.subOrgId || org.suborg_id || org.id}
                                                                    value={org.sub_org_id || org.suborgId || org.subOrgId || org.suborg_id || org.id}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6">
                                                                            <AvatarImage src={org.institute_logo_file_id || org.logo} />
                                                                            <AvatarFallback className="text-[10px]">{String(org.name || org.institute_name || org.instituteName || org.subOrgName || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="flex flex-col text-left">
                                                                            <span className="font-medium text-sm leading-tight">{org.name || org.institute_name || org.instituteName || org.subOrgName || 'Unknown'}</span>
                                                                            {(org.email || org.phone) && (
                                                                                <span className="text-[10px] text-gray-500 leading-tight">
                                                                                    {org.email}{org.email && org.phone ? ' • ' : ''}{org.phone}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </ScrollArea>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Linkage Type</Label>
                                        <Controller
                                            control={control}
                                            name="linkageType"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Linkage Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="DIRECT">Direct</SelectItem>
                                                        <SelectItem value="INHERITED">Inherited</SelectItem>
                                                        <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
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
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Member
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
