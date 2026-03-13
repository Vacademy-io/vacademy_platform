import { useState, useMemo, useCallback } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { MyTable, TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Eye } from '@phosphor-icons/react';
import {
    FinancalManagementPaginatedResponse,
    StudentFeePaymentRowDTO,
} from '@/types/manage-finances';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { InstallmentDetailsModal } from './InstallmentDetailsModal';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ManageFinancesTableProps {
    data: FinancalManagementPaginatedResponse | undefined;
    isLoading: boolean;
    error: unknown;
    currentPage: number;
    onPageChange: (page: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    PARTIAL: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    PENDING: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

function StatusPill({ status }: { status: string }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES['PENDING']!;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
        >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
            {status}
        </span>
    );
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

// ─── Component ──────────────────────────────────────────────────────────────

export function ManageFinancesTable({
    data,
    isLoading,
    error,
    currentPage,
    onPageChange,
}: ManageFinancesTableProps) {
    const { getDetailsFromPackageSessionId, instituteDetails } = useInstituteDetailsStore();

    // Modal state
    const [selectedRow, setSelectedRow] = useState<{
        studentId: string;
        cpoId: string;
        studentName: string;
        cpoName: string;
    } | null>(null);

    // Map package_session_id → "Package Name - Level"
    const getPackageName = useCallback(
        (id: string) => {
            let details = getDetailsFromPackageSessionId({ packageSessionId: id });
            if (!details && instituteDetails?.batches_for_sessions) {
                details =
                    instituteDetails.batches_for_sessions.find(
                        (batch) => batch.package_dto?.id === id || batch.id === id
                    ) || null;
            }
            if (details) {
                const pkg = details.package_dto?.package_name || '';
                const lvl = details.level?.level_name || '';
                if (pkg && lvl) return `${pkg} - ${lvl}`;
                if (pkg) return pkg;
            }
            return id;
        },
        [getDetailsFromPackageSessionId, instituteDetails]
    );

    // Normalize paginated response (handle camel / snake)
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

    // ── Column definitions ──────────────────────────────────────────────

    const columns = useMemo<ColumnDef<StudentFeePaymentRowDTO>[]>(
        () => [
            {
                id: 'student',
                header: 'Student',
                accessorFn: (row) => row.student_name || '',
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <div className="space-y-0.5 min-w-[140px]">
                            <div className="font-semibold text-gray-800">
                                {r.student_name || '—'}
                            </div>
                            {r.phone && (
                                <div className="text-[11px] text-gray-400">{r.phone}</div>
                            )}
                        </div>
                    );
                },
                size: 180,
            },
            {
                id: 'package',
                header: 'Course / Package',
                accessorFn: (row) => {
                    const ids = row.package_session_ids || [];
                    return ids.length ? ids.map((id) => getPackageName(id)).join(', ') : '—';
                },
                cell: ({ row }) => {
                    const ids = row.original.package_session_ids || [];
                    const names = ids.map((id) => getPackageName(id));
                    const display = names.length > 0 ? names.join(', ') : '—';
                    return (
                        <div
                            className="text-sm text-gray-700 max-w-[200px] truncate"
                            title={display}
                        >
                            {display}
                        </div>
                    );
                },
                size: 200,
            },
            {
                id: 'cpoName',
                header: 'CPO / Plan',
                accessorFn: (row) => row.cpo_name || '',
                cell: ({ row }) => (
                    <div className="text-sm font-medium text-gray-700">
                        {row.original.cpo_name || '—'}
                    </div>
                ),
                size: 160,
            },
            {
                id: 'totalExpected',
                header: 'Expected',
                accessorFn: (row) => row.total_expected_amount ?? 0,
                cell: ({ row }) => (
                    <div className="font-semibold text-gray-800">
                        {formatCurrency(row.original.total_expected_amount ?? 0)}
                    </div>
                ),
                size: 120,
            },
            {
                id: 'totalPaid',
                header: 'Paid',
                accessorFn: (row) => row.total_paid_amount ?? 0,
                cell: ({ row }) => (
                    <div className="font-semibold text-emerald-700">
                        {formatCurrency(row.original.total_paid_amount ?? 0)}
                    </div>
                ),
                size: 120,
            },
            {
                id: 'dueAmount',
                header: 'Due',
                accessorFn: (row) => row.due_amount ?? 0,
                cell: ({ row }) => {
                    const due = row.original.due_amount ?? 0;
                    return (
                        <div
                            className={`font-semibold ${due > 0 ? 'text-orange-600' : 'text-gray-400'}`}
                        >
                            {formatCurrency(due)}
                        </div>
                    );
                },
                size: 120,
            },
            {
                id: 'overdueAmount',
                header: 'Overdue',
                accessorFn: (row) => row.overdue_amount ?? 0,
                cell: ({ row }) => {
                    const od = row.original.overdue_amount ?? 0;
                    return (
                        <div
                            className={`font-semibold ${od > 0 ? 'text-red-600' : 'text-gray-400'}`}
                        >
                            {formatCurrency(od)}
                        </div>
                    );
                },
                size: 120,
            },
            {
                id: 'status',
                header: 'Status',
                accessorFn: (row) => row.status || '',
                cell: ({ row }) => <StatusPill status={row.original.status} />,
                size: 120,
            },
            {
                id: 'actions',
                header: '',
                cell: ({ row }) => (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const r = row.original;
                            setSelectedRow({
                                studentId: r.student_id,
                                cpoId: r.cpo_id,
                                studentName: r.student_name,
                                cpoName: r.cpo_name,
                            });
                        }}
                        className="rounded-full p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        title="View installments"
                    >
                        <Eye size={18} weight="duotone" />
                    </button>
                ),
                size: 50,
            },
        ],
        [getPackageName]
    );

    // ── Render states ───────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex h-48 items-center justify-center text-gray-500 font-semibold tracking-wide">
                <DashboardLoader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
                <p className="font-semibold text-red-800">Unable to load payment data</p>
                <p className="mt-2 text-sm text-red-600">
                    {error instanceof Error ? error.message : 'Please try again.'}
                </p>
            </div>
        );
    }

    if (!tableData) return null;

    if (tableData.content.length === 0) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <p className="text-lg font-semibold text-gray-600">No payment records found.</p>
                <p className="mt-2 text-sm text-gray-400">
                    Try adjusting your filters to see more results.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {/* Table Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <MyTable
                        data={tableData}
                        columns={columns}
                        isLoading={false}
                        error={null}
                        currentPage={currentPage}
                        scrollable={true}
                        enableColumnResizing={true}
                        enableColumnPinning={false}
                        onCellClick={(row: StudentFeePaymentRowDTO) => {
                            setSelectedRow({
                                studentId: row.student_id,
                                cpoId: row.cpo_id,
                                studentName: row.student_name,
                                cpoName: row.cpo_name,
                            });
                        }}
                    />
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
                    <div className="text-sm text-gray-500 font-medium">
                        Showing{' '}
                        <span className="font-semibold text-gray-800">
                            {tableData.page_no * tableData.page_size + 1}
                        </span>
                        {' – '}
                        <span className="font-semibold text-gray-800">
                            {Math.min(
                                (tableData.page_no + 1) * tableData.page_size,
                                tableData.total_elements
                            )}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-gray-800">
                            {tableData.total_elements}
                        </span>{' '}
                        records
                    </div>
                    <MyPagination
                        currentPage={currentPage}
                        totalPages={tableData.total_pages}
                        onPageChange={onPageChange}
                    />
                </div>
            </div>

            {/* Installment Details Popup */}
            {selectedRow && (
                <InstallmentDetailsModal
                    open={!!selectedRow}
                    onOpenChange={(open) => {
                        if (!open) setSelectedRow(null);
                    }}
                    studentId={selectedRow.studentId}
                    cpoId={selectedRow.cpoId}
                    studentName={selectedRow.studentName}
                    cpoName={selectedRow.cpoName}
                />
            )}
        </>
    );
}
