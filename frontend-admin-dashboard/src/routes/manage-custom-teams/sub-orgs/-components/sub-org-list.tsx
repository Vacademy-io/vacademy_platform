import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    getSubOrgsWithDetails,
    type SubOrgListItem,
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
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { MyButton } from '@/components/design-system/button';
import { Plus, Buildings, Copy, LinkSimple } from '@phosphor-icons/react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CreateSubOrgModal } from './create-sub-org-modal';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildSubOrgSlug } from '@/routes/manage-suborg-teams/-utils/sub-org-slug';
import { humanizeStatus, statusToneClass } from '../../-utils/status-display';

export function SubOrgList() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const navigate = useNavigate();

    const instituteId = getCurrentInstituteId();
    const { data: subOrgs = [], isLoading } = useQuery({
        queryKey: ['sub-orgs-with-details', instituteId],
        queryFn: () => getSubOrgsWithDetails(instituteId),
        enabled: !!instituteId,
    });

    // Row click navigates to the institute-admin deep page for that sub-org.
    const openSubOrg = (org: SubOrgListItem) => {
        const id = org.suborg_id;
        if (!id) return;
        navigate({
            to: '/manage-custom-teams/sub-orgs/$subOrgSlug',
            params: { subOrgSlug: buildSubOrgSlug({ id, name: org.name || '' }) },
        });
    };

    const copyInviteLink = (e: React.MouseEvent, org: SubOrgListItem) => {
        e.stopPropagation();
        const url = org.short_url || org.invite_code;
        if (url) {
            navigator.clipboard.writeText(url);
            toast.success('Invite link copied');
        }
    };

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <MyButton onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {getTerminology(OtherTerms.SubOrg, SystemTerms.SubOrg)}
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
                            <TableHead>{getTerminology(OtherTerms.Invite, SystemTerms.Invite)}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!subOrgs || subOrgs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                        <Buildings className="h-8 w-8 opacity-50" />
                                        <p>
                                            No{' '}
                                            {getTerminologyPlural(
                                                OtherTerms.SubOrg,
                                                SystemTerms.SubOrg
                                            ).toLowerCase()}{' '}
                                            found.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            subOrgs.map((org) => {
                                const name = org.name || 'Unknown';
                                return (
                                    <TableRow
                                        key={org.suborg_id || name}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => openSubOrg(org)}
                                    >
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs">
                                                        {String(name).charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="truncate">{name}</p>
                                                    {org.admin_name && (
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {org.admin_name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{org.admin_email || '-'}</TableCell>
                                        <TableCell>{org.admin_phone || '-'}</TableCell>
                                        <TableCell>
                                            {org.plan_status ? (
                                                <Badge
                                                    variant="outline"
                                                    className={statusToneClass(org.plan_status)}
                                                >
                                                    {humanizeStatus(org.plan_status)}
                                                </Badge>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {org.used_seats == null && org.total_seats == null ? (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            ) : (
                                                <span className="text-sm">
                                                    {org.used_seats ?? 0}
                                                    {org.total_seats != null
                                                        ? `/${org.total_seats}`
                                                        : ''}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {org.invite_code ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => copyInviteLink(e, org)}
                                                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                                                    title={org.short_url || org.invite_code}
                                                >
                                                    <LinkSimple className="h-3.5 w-3.5" />
                                                    <span className="w-20 truncate">
                                                        {org.invite_code}
                                                    </span>
                                                    <Copy className="h-3 w-3" />
                                                </button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateSubOrgModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
        </div>
    );
}
