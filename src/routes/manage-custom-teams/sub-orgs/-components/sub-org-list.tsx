import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSubOrgs } from '../../-services/custom-team-services';
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
import { Plus, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateSubOrgModal } from './create-sub-org-modal';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect } from 'react';

export function SubOrgList() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!subOrgs || subOrgs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                        <Building2 className="h-8 w-8 opacity-50" />
                                        <p>No sub-organizations found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            subOrgs.map((org: any) => (
                                <SubOrgRow key={org.sub_org_id || org.suborgId || org.subOrgId || org.suborg_id || org.id} org={org} />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateSubOrgModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
            />
        </div>
    );
}

function SubOrgRow({ org }: { org: any }) {
    const [logoUrl, setLogoUrl] = useState<string>('');
    const { getPublicUrl } = useFileUpload();

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

    const name = org.name || org.institute_name || org.instituteName || org.subOrgName || 'Unknown';

    return (
        <TableRow>
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
        </TableRow>
    );
}
