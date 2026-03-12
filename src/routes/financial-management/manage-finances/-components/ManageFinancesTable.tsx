import { useMemo, useCallback } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { MyTable, TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { Badge } from '@/components/ui/badge';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { FinancalManagementPaginatedResponse, StudentFeePaymentRowDTO } from '@/types/manage-finances';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import dayjs from 'dayjs';

interface ManageFinancesTableProps {
    data: FinancalManagementPaginatedResponse | undefined;
    isLoading: boolean;
    error: unknown;
    currentPage: number;
    onPageChange: (page: number) => void;
}

const getStatusBadgeVariant = (
    status: string
): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'PAID':
            return 'default'; // Green
        case 'WAIVED':
            return 'outline';
        case 'PENDING':
        case 'PARTIAL_PAID':
            return 'secondary'; // Yellow-ish
        case 'OVERDUE':
            return 'destructive'; // Red
        default:
            return 'secondary';
    }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

export function ManageFinancesTable({
    data,
    isLoading,
    error,
    currentPage,
    onPageChange,
}: ManageFinancesTableProps) {
    const { instituteDetails,getDetailsFromPackageSessionId } = useInstituteDetailsStore();

    const getPackageName = useCallback((id: string) => {
        let details = getDetailsFromPackageSessionId({ packageSessionId: id });
        console.log("this is details: ", details);
        // Try fallback if not found directly
        if (!details && instituteDetails?.batches_for_sessions) {
            details = instituteDetails.batches_for_sessions.find(
                (batch) => batch.package_dto?.id === id || batch.id === id
            ) || null;
        }

        if (details) {
            const pkgName = details.package_dto?.package_name || '';
            const lvlName = details.level?.level_name || '';
            if (pkgName && lvlName) return `${pkgName} - ${lvlName}`;
            // if (pkgName) return pkgName;
            // if (lvlName) return lvlName;
        }
        return id;
    }, [getDetailsFromPackageSessionId, instituteDetails]);
    const tableData: TableData<StudentFeePaymentRowDTO> | undefined = useMemo(() => {
        if (!data) return undefined;
        const d = data as any;
        return {
            content: d.content || [],
            total_pages: d.totalPages ?? d.total_pages ?? 0,
            page_no: d.number ?? d.page_no ?? d.page ?? 0,
            page_size: d.size ?? d.page_size ?? 10,
            total_elements: d.totalElements ?? d.total_elements ?? 0,
            last: d.last ?? false,
        };
    }, [data]);

    const columns = useMemo<ColumnDef<StudentFeePaymentRowDTO>[]>(
        () => [
            {
                id: 'student',
                header: 'Student',
                accessorFn: (row: any) => row.studentName || row.student_name || '',
                cell: ({ row }) => {
                    const data = row.original as any;
                    return (
                        <div className="space-y-1">
                            <div className="font-medium text-gray-900">{data.studentName || data.student_name || '-'}</div>
                            <div className="text-xs text-gray-500">{data.studentEmail || data.student_email || '-'}</div>
                        </div>
                    );
                },
                size: 200,
            },
            {
                id: 'packageSessionIds',
                header: 'Course/Package',
                accessorFn: (row: any) => {
                    const ids: string[] = row.packageSessionIds || row.package_session_ids || [];
                    return ids?.length ? ids.map(id => getPackageName(id)).join(', ') : '—';
                },
                cell: ({ row }) => {
                    const data = row.original as any;
                    const ids: string[] = data.packageSessionIds || data.package_session_ids || [];
                    const names = ids.map(id => getPackageName(id));
                    const display =
                        !names || names.length === 0
                            ? '—'
                            : names.join(', ');
                    return (
                        <div className="text-sm text-gray-900 break-all" title={display}>
                            {display}
                        </div>
                    );
                },
                size: 220,
            },
            {
                id: 'feeDetails',
                header: 'Fee Details',
                accessorFn: (row: any) => row.feeTypeName || row.fee_type_name || '',
                cell: ({ row }) => {
                    const data = row.original as any;
                    return (
                        <div className="space-y-1">
                            <div className="font-medium text-gray-900">{data.feeTypeName || data.fee_type_name || '-'}</div>
                            <div className="text-xs text-gray-500">Inst. #{data.installmentNumber ?? data.installment_number}</div>
                        </div>
                    );
                },
                size: 160,
            },
            {
                id: 'amountExpected',
                header: 'Expected',
                accessorFn: (row: any) => row.amountExpected ?? row.amount_expected ?? 0,
                cell: ({ row }) => {
                    const data = row.original as any;
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(data.amountExpected ?? data.amount_expected ?? 0)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'amountPaid',
                header: 'Paid',
                accessorFn: (row: any) => row.amountPaid ?? row.amount_paid ?? 0,
                cell: ({ row }) => {
                    const data = row.original as any;
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(data.amountPaid ?? data.amount_paid ?? 0)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'totalDue',
                header: 'Due',
                accessorFn: (row: any) => row.totalDue ?? row.total_due ?? 0,
                cell: ({ row }) => {
                    const data = row.original as any;
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(data.totalDue ?? data.total_due ?? 0)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'dueDate',
                header: 'Due Date',
                accessorFn: (row: any) => row.dueDate || row.due_date || '',
                cell: ({ row }) => {
                    const data = row.original as any;
                    const dateVal = data.dueDate || data.due_date;
                    return (
                        <div className="text-sm text-gray-700">
                            {dateVal ? dayjs(dateVal).format('D MMM YYYY, h:mm a') : '-'}
                        </div>
                    );
                },
                size: 140,
            },
            {
                id: 'status',
                header: 'Status',
                accessorFn: (row: any) => row.status || '',
                cell: ({ row }) => {
                    const data = row.original as any;
                    const status = data.status;
                    return (
                        <Badge variant={getStatusBadgeVariant(status)} className="font-medium">
                            {status?.replace(/_/g, ' ') || '-'}
                        </Badge>
                    );
                },
                size: 140,
            },
        ],
        [getPackageName]
    );

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
                <p className="text-red-800">Error loading payment records</p>
                <p className="mt-2 text-sm text-red-600">
                    {error instanceof Error ? error.message : 'Unknown error occurred'}
                </p>
            </div>
        );
    }

    if (!tableData) {
        return null;
    }

    if (tableData.content.length === 0) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
                <p className="text-lg font-medium text-gray-600">No payment records found</p>
                <p className="mt-2 text-sm text-gray-500">
                    Try adjusting your filters to see more results
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <MyTable
                    data={tableData}
                    columns={columns}
                    isLoading={false}
                    error={null}
                    currentPage={currentPage}
                    scrollable={true}
                    enableColumnResizing={true}
                    enableColumnPinning={false}
                />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="text-sm text-gray-600">
                    Showing {tableData.page_no * tableData.page_size + 1} -{' '}
                    {Math.min(
                        (tableData.page_no + 1) * tableData.page_size,
                        tableData.total_elements
                    )}{' '}
                    of {tableData.total_elements} payments
                </div>
                <MyPagination
                    currentPage={currentPage}
                    totalPages={tableData.total_pages}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
}
