import { useState } from 'react';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { useTeacherList } from '@/routes/dashboard/-hooks/useTeacherList';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { FacultyFilterParams } from '@/routes/dashboard/-services/dashboard-services';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { UPDATE_FACULTY_ASSIGNMENTS } from '@/constants/urls';
import { TrashSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const TeachersList = ({ packageSessionId }: { packageSessionId: string }) => {
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = (tokenData?.authorities && Object.keys(tokenData.authorities)[0]) ?? '';
    const queryClient = useQueryClient();

    const filters: FacultyFilterParams = {
        name: '',
        batches: packageSessionId ? [packageSessionId] : [],
        subjects: [],
        status: [],
        sort_columns: { name: 'DESC' },
    };

    const hasValidContext = Boolean(INSTITUTE_ID && packageSessionId);
    const { data, isLoading, error } = useTeacherList(
        INSTITUTE_ID,
        page,
        pageSize,
        filters,
        hasValidContext
    );

    const removeMutation = useMutation({
        mutationFn: async ({ facultyId, subjects }: { facultyId: string; subjects: { id: string }[] }) => {
            const subjectAssignments = subjects.map((s) => ({
                subject_id: s.id,
                is_new_assignment: false,
            }));
            if (subjectAssignments.length === 0) return;

            await authenticatedAxiosInstance({
                method: 'PUT',
                url: UPDATE_FACULTY_ASSIGNMENTS,
                data: {
                    faculty_id: facultyId,
                    batch_subject_assignments: [
                        {
                            batch_id: packageSessionId,
                            subject_assignments: subjectAssignments,
                        },
                    ],
                },
            });
        },
        onSuccess: () => {
            toast.success('Teacher removed from this batch');
            queryClient.invalidateQueries({ queryKey: ['facultyList'] });
        },
        onError: () => {
            toast.error('Failed to remove teacher.');
            queryClient.invalidateQueries({ queryKey: ['facultyList'] });
        },
    });

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    const columns = [
        {
            accessorKey: 'name',
            header: 'Name',
            // @ts-expect-error: Binding element 'row' implicitly has an 'any' type.
            cell: ({ row }) => {
                const name = row.getValue('name') ?? 'N/A';
                return name;
            },
        },
        {
            accessorKey: 'subjects',
            header: 'Subjects',
            // @ts-expect-error: Binding element 'row' implicitly has an 'any' type.
            cell: ({ row }) => {
                const subjects = row.original.subjects || [];
                // @ts-expect-error: Parameter 'subject' implicitly has an 'any' type.
                return subjects.map((subject) => subject.name).join(', ') || '--';
            },
        },
        {
            id: 'status',
            header: 'Status',
            cell: () => {
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <span className="size-1.5 rounded-full bg-green-500"></span>
                        Active
                    </span>
                );
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            // @ts-expect-error: Binding element 'row' implicitly has an 'any' type.
            cell: ({ row }) => {
                const teacher = row.original;
                const subjects = teacher.subjects || [];

                return (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                title="Remove from this batch"
                            >
                                <TrashSimple size={16} />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-sm">
                            <AlertDialogHeader>
                                <AlertDialogTitle>Remove Teacher</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Remove <strong>{teacher.name}</strong> from this batch? They will no longer have access to teach here.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-red-500 text-white hover:bg-red-600"
                                    disabled={removeMutation.isPending}
                                    onClick={() =>
                                        removeMutation.mutate({
                                            facultyId: teacher.userId,
                                            subjects,
                                        })
                                    }
                                >
                                    {removeMutation.isPending ? 'Removing...' : 'Remove'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                );
            },
        },
    ];

    if (isLoading) return <DashboardLoader />;
    if (error) {
        const is403 = (error as { response?: { status?: number } })?.response?.status === 403;
        return (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {is403
                    ? "You don't have permission to load teachers for this batch."
                    : 'Error loading teachers'}
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-5">
            <div className="h-auto w-full">
                <MyTable
                    currentPage={page}
                    scrollable={false}
                    className="w-full"
                    data={
                        data || {
                            content: [],
                            total_pages: 0,
                            page_no: 0,
                            page_size: pageSize,
                            total_elements: 0,
                            last: true,
                        }
                    }
                    columns={columns}
                    columnWidths={{
                        name: '30%',
                        subjects: '35%',
                        status: '20%',
                        actions: '15%',
                    }}
                    isLoading={isLoading}
                    error={error}
                />
            </div>
            <MyPagination
                currentPage={page}
                totalPages={data?.total_pages || 1}
                onPageChange={handlePageChange}
            />
        </div>
    );
};
