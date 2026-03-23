import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getSubscriptionStatus,
    getScopedInvites,
    addSubOrgMember,
    getAllRoles,
    createCustomRole,
    type SubOrgSubscriptionStatus,
    type AddSubOrgMemberRequest,
} from '../../-services/custom-team-services';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_SUB_ORG_ALL_ADMINS } from '@/constants/urls';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Copy, Link2, BookOpen, ShieldCheck, ExternalLink, UserPlus, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import createInviteLink from '@/routes/manage-students/invite/-utils/createInviteLink';

interface SubOrgDetailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    org: any;
}

export function SubOrgDetailModal({ open, onOpenChange, org }: SubOrgDetailModalProps) {
    const subOrgId =
        org?.sub_org_id || org?.suborgId || org?.subOrgId || org?.suborg_id || org?.id;
    const name =
        org?.name ||
        org?.institute_name ||
        org?.instituteName ||
        org?.subOrgName ||
        'Unknown';
    const instituteId = getCurrentInstituteId();

    // Fetch subscription status (invite link, seat usages)
    const { data: subscriptionStatus, isLoading: isLoadingStatus } =
        useQuery<SubOrgSubscriptionStatus>({
            queryKey: ['sub-org-subscription-status', subOrgId],
            queryFn: () => getSubscriptionStatus(subOrgId),
            enabled: !!subOrgId && open,
        });

    // Fetch scoped invites (courses linked to this sub-org)
    const { data: scopedInvites = [], isLoading: isLoadingInvites } = useQuery<any[]>({
        queryKey: ['sub-org-scoped-invites', subOrgId],
        queryFn: () => getScopedInvites(subOrgId),
        enabled: !!subOrgId && open,
    });

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
    };

    const isLoading = isLoadingStatus || isLoadingInvites;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>{name}</DialogTitle>
                    <DialogDescription>
                        Sub-organization details, invite link, courses, and admins.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-8">
                        <DashboardLoader />
                    </div>
                ) : (
                    <>
                    <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-6 pr-4">
                            {/* Invite Link Section */}
                            <div className="space-y-2">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <Link2 className="h-4 w-4" />
                                    Invite Link
                                </h3>
                                {subscriptionStatus?.invite_code ? (
                                    <div className="space-y-2 rounded-md border bg-muted/50 p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Invite Link
                                            </span>
                                            {subscriptionStatus.org_user_plan_status && (
                                                <Badge
                                                    variant={
                                                        subscriptionStatus.org_user_plan_status ===
                                                        'ACTIVE'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {subscriptionStatus.org_user_plan_status}
                                                </Badge>
                                            )}
                                        </div>
                                        {/* Full invite link */}
                                        <div className="flex items-center gap-2 rounded bg-white p-2">
                                            <span className="min-w-0 flex-1 truncate text-xs font-mono text-primary select-all">
                                                {subscriptionStatus.short_url ||
                                                    createInviteLink(subscriptionStatus.invite_code)}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 shrink-0 gap-1 px-2"
                                                onClick={() =>
                                                    copyToClipboard(
                                                        subscriptionStatus.short_url ||
                                                            createInviteLink(subscriptionStatus.invite_code),
                                                        'Invite link'
                                                    )
                                                }
                                            >
                                                <Copy className="h-3 w-3" />
                                                Copy
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 shrink-0 gap-1 px-2"
                                                onClick={() =>
                                                    window.open(
                                                        subscriptionStatus.short_url ||
                                                            createInviteLink(subscriptionStatus.invite_code),
                                                        '_blank'
                                                    )
                                                }
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Open
                                            </Button>
                                        </div>
                                        {/* Invite code (secondary) */}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Code:</span>
                                            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                                                {subscriptionStatus.invite_code}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0"
                                                onClick={() =>
                                                    copyToClipboard(
                                                        subscriptionStatus.invite_code,
                                                        'Invite code'
                                                    )
                                                }
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No invite link configured. Create a subscription to
                                        generate one.
                                    </p>
                                )}
                            </div>

                            {/* Courses (Scoped Invites) Section */}
                            <div className="space-y-2">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <BookOpen className="h-4 w-4" />
                                    Courses ({scopedInvites.length})
                                </h3>
                                {scopedInvites.length > 0 ? (
                                    <div className="space-y-2">
                                        {scopedInvites.map((invite: any) => (
                                            <div
                                                key={invite.id}
                                                className="flex items-center justify-between rounded-md border p-3"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {invite.name || invite.invite_name || 'Course Invite'}
                                                    </p>
                                                    {invite.invite_code && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Code: {invite.invite_code}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant={
                                                        invite.status === 'ACTIVE'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                >
                                                    {invite.status || 'ACTIVE'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No courses assigned yet.
                                    </p>
                                )}
                            </div>

                            {/* Seat Usage Section */}
                            {subscriptionStatus?.seat_usages &&
                                subscriptionStatus.seat_usages.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-gray-700">
                                            Seat Usage
                                        </h3>
                                        <div className="space-y-2">
                                            {subscriptionStatus.seat_usages.map((su) => (
                                                <div
                                                    key={su.package_session_id}
                                                    className="flex items-center justify-between rounded-md border p-3"
                                                >
                                                    <span className="text-sm">
                                                        {su.package_name ||
                                                            su.package_session_id}
                                                    </span>
                                                    <span className="text-sm font-medium">
                                                        {su.used_seats} / {su.total_seats} seats
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {/* Admins Section */}
                            <SubOrgAdminsSection subOrgId={subOrgId} />
                        </div>
                    </ScrollArea>

                    {/* Add User Section - outside ScrollArea so it is always visible */}
                    <AddUserToSubOrgSection
                        subOrgId={subOrgId}
                        instituteId={instituteId || ''}
                        scopedInvites={scopedInvites}
                    />
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function AddUserToSubOrgSection({
    subOrgId,
    instituteId,
    scopedInvites,
}: {
    subOrgId: string;
    instituteId: string;
    scopedInvites: any[];
}) {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [selectedInviteId, setSelectedInviteId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [showNewRoleInput, setShowNewRoleInput] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');

    // Fetch roles from parent institute
    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: getAllRoles,
        staleTime: 1000 * 60 * 5,
        enabled: showForm,
    });

    // Mutation for creating a new role
    const createRoleMutation = useMutation({
        mutationFn: (name: string) => createCustomRole({ name, permissionIds: ['109'] }),
        onSuccess: () => {
            toast.success('Role created successfully');
            queryClient.invalidateQueries({ queryKey: ['roles'] });
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

    // Derive package_session_id from selected scoped invite
    const selectedInvite = scopedInvites.find((inv: any) => inv.id === selectedInviteId);
    const packageSessionId =
        selectedInvite?.package_session_to_payment_options?.[0]?.package_session_id || '';

    const mutation = useMutation({
        mutationFn: addSubOrgMember,
        onSuccess: (data) => {
            toast.success(data.message || 'User added to sub-organization');
            queryClient.invalidateQueries({ queryKey: ['sub-org-admins-detail', subOrgId] });
            queryClient.invalidateQueries({
                queryKey: ['sub-org-subscription-status', subOrgId],
            });
            resetForm();
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to add user');
        },
    });

    const resetForm = () => {
        setFullName('');
        setEmail('');
        setMobileNumber('');
        setSelectedInviteId('');
        setSelectedRoleId('');
        setShowNewRoleInput(false);
        setNewRoleName('');
        setShowForm(false);
    };

    const handleSubmit = () => {
        if (!fullName.trim()) {
            toast.error('Full name is required');
            return;
        }
        if (!email.trim()) {
            toast.error('Email is required');
            return;
        }
        if (!selectedInviteId) {
            toast.error('Please select a scoped invite');
            return;
        }
        if (!packageSessionId) {
            toast.error('Selected invite has no package session');
            return;
        }
        if (!selectedRoleId) {
            toast.error('Please select a role');
            return;
        }

        const selectedRole = roles.find((r: any) => r.id === selectedRoleId);
        const roleName = selectedRole?.name || 'STUDENT';

        const request: AddSubOrgMemberRequest = {
            user: {
                email: email.trim(),
                full_name: fullName.trim(),
                mobile_number: mobileNumber.trim() || undefined,
                roles: [roleName],
            },
            package_session_id: packageSessionId,
            sub_org_id: subOrgId,
            institute_id: instituteId,
            comma_separated_org_roles: 'ROOT_ADMIN',
        };
        mutation.mutate(request);
    };

    if (scopedInvites.length === 0) return null;

    return (
        <div className="space-y-3 border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <UserPlus className="h-4 w-4" />
                Add User
            </h3>
            {!showForm && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(true)}
                >
                    <UserPlus className="mr-1 h-3 w-3" />
                    Add User
                </Button>
            )}

            {showForm && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label className="text-xs">Full Name *</Label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Email *</Label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Phone</Label>
                            <Input
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                placeholder="+91 1234567890"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Scoped Invite *</Label>
                            <Select
                                value={selectedInviteId}
                                onValueChange={setSelectedInviteId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select invite" />
                                </SelectTrigger>
                                <SelectContent>
                                    {scopedInvites.map((inv: any) => (
                                        <SelectItem key={inv.id} value={inv.id}>
                                            {inv.name || inv.invite_name || `Invite ${inv.invite_code}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Institute Role *</Label>
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
                                        className="h-8"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCreateRole}
                                        disabled={createRoleMutation.isPending}
                                        className="h-8 shrink-0"
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
                                        className="h-8 shrink-0 px-2"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={selectedRoleId}
                                        onValueChange={setSelectedRoleId}
                                    >
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((role: any) => (
                                                <SelectItem key={role.id} value={role.id}>
                                                    {role.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowNewRoleInput(true)}
                                        className="h-8 shrink-0 px-2"
                                        title="Add new role"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            disabled={mutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmit}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            )}
                            Add User
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SubOrgAdminsSection({ subOrgId }: { subOrgId: string }) {
    const { data: adminsData, isLoading } = useQuery<{
        admins: { user_id: string; name: string; role: string }[];
    }>({
        queryKey: ['sub-org-admins-detail', subOrgId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_SUB_ORG_ALL_ADMINS, {
                params: { subOrgId },
            });
            return response.data;
        },
        enabled: !!subOrgId,
    });

    const admins = adminsData?.admins || [];

    return (
        <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ShieldCheck className="h-4 w-4" />
                Admins ({admins.length})
            </h3>
            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading admins...</p>
            ) : admins.length > 0 ? (
                <div className="space-y-2">
                    {admins.map((admin, idx) => (
                        <div
                            key={admin.user_id || idx}
                            className="flex items-center justify-between rounded-md border p-3"
                        >
                            <div>
                                <p className="text-sm font-medium">{admin.name}</p>
                                <p className="text-xs text-muted-foreground">{admin.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    No admins assigned yet. Admins are added when they pay via the invite
                    link.
                </p>
            )}
        </div>
    );
}
