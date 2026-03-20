import { useState } from 'react';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { useTeacherList } from '@/routes/dashboard/-hooks/useTeacherList';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { FacultyFilterParams } from '@/routes/dashboard/-services/dashboard-services';

export const TeachersList = ({ packageSessionId }: { packageSessionId: string }) => {
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = (tokenData?.authorities && Object.keys(tokenData.authorities)[0]) ?? '';
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

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    // Define columns for the teachers table
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
                return subjects.map((subject) => subject.name).join(', ');
            },
        },
    ];

    if (isLoading) return <DashboardLoader />;
    if (error) {
        const is403 = (error as { response?: { status?: number } })?.response?.status === 403;
        return (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {is403
                    ? "You don't have permission to load teachers for this batch. If this persists, the backend may need to allow the faculty-by-institute endpoint for your role."
                    : 'Error loading teachers'}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Add filters UI here */}
            <div className="h-auto max-w-full">
                <MyTable
                    currentPage={page}
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
