import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { fetchUserAccessDetails } from '@/lib/auth/facultyAccessUtils';
import { getInstituteId } from '@/constants/helper';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UserAccessModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string | null;
    userName: string;
}

export function UserAccessModal({ open, onOpenChange, userId, userName }: UserAccessModalProps) {
    const instituteId = getInstituteId();

    const { data: accessData, isLoading } = useQuery({
        queryKey: ['user-access-details', userId, instituteId],
        queryFn: () => fetchUserAccessDetails(userId!, instituteId!),
        enabled: !!userId && !!instituteId && open,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Access Details</DialogTitle>
                    <DialogDescription>
                        View access mappings and permissions assigned to {userName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    {isLoading ? (
                        <div className="py-8"><DashboardLoader /></div>
                    ) : !accessData || accessData.accessMappings.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-500">
                            No special access mapped for this user.
                        </div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead>Linkage</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accessData.accessMappings.map((mapping, idx) => (
                                        <TableRow key={mapping.id || idx}>
                                            <TableCell className="font-medium text-xs text-gray-700 text-nowrap">
                                                {mapping.accessType === 'PACKAGE' ? 'Course' :
                                                    mapping.accessType === 'PACKAGE_SESSION' ? 'Session' :
                                                        mapping.accessType === 'ENROLL_INVITE' ? 'Invite' :
                                                            mapping.accessType === 'INSTITUTE' ? 'Global' :
                                                                mapping.accessType}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {mapping.name || mapping.accessId || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(mapping.accessPermission || '').split(',').map((p, i) => (
                                                        p.trim() && (
                                                            <span key={i} className="rounded-full bg-blue-50 px-2 flex justify-center py-0.5 text-xs text-blue-700">
                                                                {p.trim()}
                                                            </span>
                                                        )
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-gray-500">
                                                {mapping.linkageType || 'DIRECT'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
