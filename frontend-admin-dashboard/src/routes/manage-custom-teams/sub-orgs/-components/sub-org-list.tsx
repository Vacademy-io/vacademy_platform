import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    getSubOrgs,
    getSubscriptionStatus,
    type SubOrgSubscriptionStatus,
} from '../../-services/custom-team-services';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { MyButton } from '@/components/design-system/button';
import { Plus, Building2, Copy, Link2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateSubOrgModal } from './create-sub-org-modal';
import { SubOrgDetailModal } from './sub-org-detail-modal';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function SubOrgList() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);

    const instituteId = getCurrentInstituteId();
    const { data: subOrgsData, isLoading } = useQuery({
        queryKey: ['sub-orgs-list', instituteId],
        queryFn: () => getSubOrgs(instituteId),
        enabled: !!instituteId,
    });

    const subOrgs = Array.isArray(subOrgsData) ? subOrgsData : (subOrgsData as any)?.content || [];

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <MyButton onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Sub-Organization
                </MyButton>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Seats</TableHead>
                            <TableHead>Invite</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!subOrgs || subOrgs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                        <Building2 className="h-8 w-8 opacity-50" />
                                        <p>No sub-organizations found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            subOrgs.map((org: any) => (
                                <SubOrgRow
                                    key={
                                        org.sub_org_id ||
                                        org.suborgId ||
                                        org.subOrgId ||
                                        org.suborg_id ||
                                        org.id
                                    }
                                    org={org}
                                    onRowClick={() => setSelectedOrg(org)}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateSubOrgModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
            />

            {selectedOrg && (
                <SubOrgDetailModal
                    open={!!selectedOrg}
                    onOpenChange={(open) => {
                        if (!open) setSelectedOrg(null);
                    }}
                    org={selectedOrg}
                />
            )}
        </div>
    );
}

function SubOrgRow({ org, onRowClick }: { org: any; onRowClick: () => void }) {
    const [logoUrl, setLogoUrl] = useState<string>('');
    const { getPublicUrl } = useFileUpload();
    const instituteId = getCurrentInstituteId();

    const subOrgId =
        org.sub_org_id || org.suborgId || org.subOrgId || org.suborg_id || org.id;

    useEffect(() => {
        const fileId = org.institute_logo_file_id || org.logo;
        if (fileId && typeof fileId === 'string' && !fileId.startsWith('http')) {
            getPublicUrl(fileId).then((url) => {
                if (url) setLogoUrl(url);
            });
        } else if (fileId && typeof fileId === 'string' && fileId.startsWith('http')) {
            setLogoUrl(fileId);
        }
    }, [org.institute_logo_file_id, org.logo, getPublicUrl]);

    // Fetch subscription status
    const { data: subscriptionStatus } = useQuery<SubOrgSubscriptionStatus>({
        queryKey: ['sub-org-subscription-status', subOrgId],
        queryFn: () => getSubscriptionStatus(subOrgId),
        enabled: !!subOrgId && !!instituteId,
    });

    const name =
        org.name || org.institute_name || org.instituteName || org.subOrgName || 'Unknown';

    const totalUsed = subscriptionStatus?.seat_usages?.reduce(
        (sum, s) => sum + (s.used_seats || 0),
        0
    );
    const totalSeats = subscriptionStatus?.seat_usages?.reduce(
        (sum, s) => sum + (s.total_seats || 0),
        0
    );

    const copyInviteLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = subscriptionStatus?.short_url || subscriptionStatus?.invite_code;
        if (url) {
            navigator.clipboard.writeText(url);
            toast.success('Invite link copied');
        }
    };

    return (
        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onRowClick}>
            <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={logoUrl} />
                        <AvatarFallback className="text-xs">
                            {String(name).charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span>{name}</span>
                </div>
            </TableCell>
            <TableCell>{org.email || '-'}</TableCell>
            <TableCell>{org.phone || org.mobile_number || org.mobileNumber || '-'}</TableCell>
            <TableCell>
                {subscriptionStatus?.org_user_plan_status ? (
                    <Badge
                        variant={
                            subscriptionStatus.org_user_plan_status === 'ACTIVE'
                                ? 'default'
                                : 'secondary'
                        }
                    >
                        {subscriptionStatus.org_user_plan_status}
                    </Badge>
                ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                )}
            </TableCell>
            <TableCell>
                {totalSeats != null && totalSeats > 0 ? (
                    <span className="text-sm">
                        {totalUsed}/{totalSeats}
                    </span>
                ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                )}
            </TableCell>
            <TableCell>
                {subscriptionStatus?.invite_code ? (
                    <button
                        type="button"
                        onClick={copyInviteLink}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                        title={subscriptionStatus.short_url || subscriptionStatus.invite_code}
                    >
                        <Link2 className="h-3.5 w-3.5" />
                        <span className="max-w-[80px] truncate">
                            {subscriptionStatus.invite_code}
                        </span>
                        <Copy className="h-3 w-3" />
                    </button>
                ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                )}
            </TableCell>
        </TableRow>
    );
}
