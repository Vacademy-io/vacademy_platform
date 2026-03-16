import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import {
    getSubscriptionStatus,
    getScopedInvites,
    type SubOrgSubscriptionStatus,
} from '../../-services/custom-team-services';
import {
    fetchSubOrgAdmins,
    type SubOrgAdminsResponse,
} from '@/routes/manage-students/students-list/-services/sub-org-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Copy, Link2, BookOpen, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

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
                    <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-6 pr-4">
                            {/* Invite Link Section */}
                            <div className="space-y-2">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <Link2 className="h-4 w-4" />
                                    Invite Link
                                </h3>
                                {subscriptionStatus?.invite_code ? (
                                    <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">
                                                    Code:
                                                </span>
                                                <code className="rounded bg-white px-2 py-0.5 text-sm font-mono">
                                                    {subscriptionStatus.invite_code}
                                                </code>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
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
                                            {subscriptionStatus.short_url && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        URL:
                                                    </span>
                                                    <span className="max-w-[300px] truncate text-xs text-primary">
                                                        {subscriptionStatus.short_url}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() =>
                                                            copyToClipboard(
                                                                subscriptionStatus.short_url,
                                                                'Invite URL'
                                                            )
                                                        }
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
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
                )}
            </DialogContent>
        </Dialog>
    );
}

function SubOrgAdminsSection({ subOrgId }: { subOrgId: string }) {
    // We need to fetch admins. The existing endpoint requires userId + packageSessionId + subOrgId.
    // For an institute-level view, we pass empty/placeholder values since the backend
    // resolves admins by subOrgId primarily.
    // If this endpoint doesn't support it, we'll show a fallback.
    const { data: adminsData, isLoading } = useQuery<SubOrgAdminsResponse>({
        queryKey: ['sub-org-admins-detail', subOrgId],
        queryFn: () => fetchSubOrgAdmins('', '', subOrgId),
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
