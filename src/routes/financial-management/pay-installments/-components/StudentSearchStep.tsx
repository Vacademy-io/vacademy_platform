import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { MyTable, TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Input } from '@/components/ui/input';
import {
    FeeSearchFilterDTO,
    FinancalManagementPaginatedResponse,
    StudentFeePaymentRowDTO,
} from '@/types/manage-finances';
import { fetchManageFinancesLogs, getManageFinancesQueryKey } from '@/services/manage-finances';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

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

interface StudentSearchStepProps {
    onSelectStudent: (student: StudentFeePaymentRowDTO) => void;
}

export function StudentSearchStep({ onSelectStudent }: StudentSearchStepProps) {
    const { getDetailsFromPackageSessionId, instituteDetails } = useInstituteDetailsStore();

    const [filter, setFilter] = useState<FeeSearchFilterDTO>({
        page: 0,
        size: 10,
        sortBy: 'studentName',
        sortDirection: 'ASC',
        filters: {},
    });

    const [searchInput, setSearchInput] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        debounceRef.current = setTimeout(() => {
            setFilter((prev) => ({
                ...prev,
                page: 0,
                filters: { ...prev.filters, studentSearchQuery: searchInput || undefined },
            }));
        }, 300);
        return () => clearTimeout(debounceRef.current);
    }, [searchInput]);

    const { data, isLoading, error } = useQuery({
        queryKey: getManageFinancesQueryKey(filter),
        queryFn: () => fetchManageFinancesLogs(filter),
        staleTime: 30000,
    });

    const getPackageName = useCallback(
        (id: string) => {
            let details = getDetailsFromPackageSessionId({ packageSessionId: id });
            if (!details && instituteDetails?.batches_for_sessions) {
                details =
                    instituteDetails.batches_for_sessions.find(
                        (batch: any) => batch.package_dto?.id === id || batch.id === id
                    ) || null;
            }
            if (details) {
                const pkg = (details as any).package_dto?.package_name || '';
                const lvl = (details as any).level?.level_name || '';
                if (pkg && lvl) return `${pkg} - ${lvl}`;
                if (pkg) return pkg;
            }
            return id;
        },
        [getDetailsFromPackageSessionId, instituteDetails]
    );

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
                accessorFn: (row) => row.student_name || '',
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <div className="space-y-0.5 min-w-[140px]">
                            <div className="font-semibold text-gray-800">
                                {r.student_name || '\u2014'}
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
                    return ids.length ? ids.map((id) => getPackageName(id)).join(', ') : '\u2014';
                },
                cell: ({ row }) => {
                    const ids = row.original.package_session_ids || [];
                    const names = ids.map((id) => getPackageName(id));
                    const display = names.length > 0 ? names.join(', ') : '\u2014';
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
        ],
        [getPackageName]
    );

    const handlePageChange = (page: number) => {
        setFilter((prev) => ({ ...prev, page }));
    };

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="relative max-w-md">
                    <MagnifyingGlass
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <Input
                        placeholder="Search by student name or phone..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Results */}
            {isLoading && (
                <div className="flex h-48 items-center justify-center">
                    <DashboardLoader />
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                    <p className="font-semibold text-red-800">Unable to load students</p>
                    <p className="mt-2 text-sm text-red-600">
                        {error instanceof Error ? error.message : 'Please try again.'}
                    </p>
                </div>
            )}

            {!isLoading && !error && tableData && tableData.content.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                    <p className="text-lg font-semibold text-gray-600">No students found.</p>
                    <p className="mt-2 text-sm text-gray-400">
                        Try searching by name or phone number.
                    </p>
                </div>
            )}

            {!isLoading && !error && tableData && tableData.content.length > 0 && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <MyTable
                            data={tableData}
                            columns={columns}
                            isLoading={false}
                            error={null}
                            currentPage={filter.page}
                            scrollable={true}
                            enableColumnResizing={true}
                            enableColumnPinning={false}
                            onCellClick={(row: StudentFeePaymentRowDTO) => {
                                onSelectStudent(row);
                            }}
                        />
                    </div>

                    {tableData.total_pages > 1 && (
                        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
                            <div className="text-sm text-gray-500 font-medium">
                                Showing{' '}
                                <span className="font-semibold text-gray-800">
                                    {tableData.page_no * tableData.page_size + 1}
                                </span>
                                {' \u2013 '}
                                <span className="font-semibold text-gray-800">
                                    {Math.min(
                                        (tableData.page_no + 1) * tableData.page_size,
                                        tableData.total_elements
                                    )}
                                </span>{' '}
                                of{' '}
                                <span className="font-semibold text-gray-800">
                                    {tableData.total_elements}
                                </span>
                            </div>
                            <MyPagination
                                currentPage={filter.page}
                                totalPages={tableData.total_pages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
