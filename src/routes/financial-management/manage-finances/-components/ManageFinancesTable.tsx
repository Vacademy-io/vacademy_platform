import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { MyTable, TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { Badge } from '@/components/ui/badge';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { FinancalManagementPaginatedResponse, StudentFeePaymentRowDTO } from '@/types/manage-finances';

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
    const tableData: TableData<StudentFeePaymentRowDTO> | undefined = useMemo(() => {
        if (!data) return undefined;
        return {
            content: data.content,
            total_pages: data.totalPages,
            page_no: data.number,
            page_size: data.size,
            total_elements: data.totalElements,
            last: data.last,
        };
    }, [data]);

    const columns = useMemo<ColumnDef<StudentFeePaymentRowDTO>[]>(
        () => [
            {
                id: 'student',
                header: 'Student',
                accessorFn: (row) => row.studentName || '',
                cell: ({ row }) => {
                    return (
                        <div className="space-y-1">
                            <div className="font-medium text-gray-900">{row.original.studentName || '-'}</div>
                            <div className="text-xs text-gray-500">{row.original.studentEmail || '-'}</div>
                        </div>
                    );
                },
                size: 200,
            },
            {
                id: 'packageSessionName',
                header: 'Course/Package',
                accessorFn: (row) => row.packageSessionName || '',
                cell: ({ row }) => {
                    return (
                        <div className="text-sm text-gray-900">{row.original.packageSessionName || '-'}</div>
                    );
                },
                size: 180,
            },
            {
                id: 'feeDetails',
                header: 'Fee Details',
                accessorFn: (row) => row.feeTypeName || '',
                cell: ({ row }) => {
                    return (
                        <div className="space-y-1">
                            <div className="font-medium text-gray-900">{row.original.feeTypeName || '-'}</div>
                            <div className="text-xs text-gray-500">Inst. #{row.original.installmentNumber}</div>
                        </div>
                    );
                },
                size: 160,
            },
            {
                id: 'amountExpected',
                header: 'Expected',
                accessorFn: (row) => row.amountExpected || 0,
                cell: ({ row }) => {
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(row.original.amountExpected)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'amountPaid',
                header: 'Paid',
                accessorFn: (row) => row.amountPaid || 0,
                cell: ({ row }) => {
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(row.original.amountPaid)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'totalDue',
                header: 'Due',
                accessorFn: (row) => row.totalDue || 0,
                cell: ({ row }) => {
                    return (
                        <div className="font-semibold text-gray-900">
                            {formatCurrency(row.original.totalDue)}
                        </div>
                    );
                },
                size: 130,
            },
            {
                id: 'dueDate',
                header: 'Due Date',
                accessorFn: (row) => row.dueDate || '',
                cell: ({ row }) => {
                    return (
                        <div className="text-sm text-gray-700">{row.original.dueDate || '-'}</div>
                    );
                },
                size: 140,
            },
            {
                id: 'status',
                header: 'Status',
                accessorFn: (row) => row.status || '',
                cell: ({ row }) => {
                    const status = row.original.status;
                    return (
                        <Badge variant={getStatusBadgeVariant(status)} className="font-medium">
                            {status?.replace(/_/g, ' ') || '-'}
                        </Badge>
                    );
                },
                size: 140,
            },
        ],
        []
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
