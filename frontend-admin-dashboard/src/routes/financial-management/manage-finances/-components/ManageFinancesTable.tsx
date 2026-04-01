import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { MyTable, TableData } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Eye, CaretDown, CaretRight } from '@phosphor-icons/react';
import {
    FinancalManagementPaginatedResponse,
    StudentFeePaymentRowDTO,
    InstallmentDetailDTO,
} from '@/types/manage-finances';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { InstallmentDetailsModal } from './InstallmentDetailsModal';
import {
    fetchInstallmentDetails,
    getInstallmentDetailsQueryKey,
} from '@/services/manage-finances';

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

const INSTALLMENT_STATUS_COLORS: Record<string, { bg: string; label: string }> = {
    PAID: { bg: '#10b981', label: 'Paid' },
    PARTIAL_PAID: { bg: '#f59e0b', label: 'Partial' },
    OVERDUE: { bg: '#ef4444', label: 'Overdue' },
    PENDING: { bg: '#e5e7eb', label: 'Pending' },
    WAIVED: { bg: '#3b82f6', label: 'Waived' },
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

// ─── Percentage Progress Bar (parent row) ──────────────────────────────────

function PercentageProgressBar({
    paid,
    due,
    overdue,
    total,
}: {
    paid: number;
    due: number;
    overdue: number;
    total: number;
}) {
    if (total <= 0) return <span className="text-gray-400">—</span>;

    const paidPct = Math.round((paid / total) * 100);
    const overduePct = Math.round((overdue / total) * 100);
    const duePct = Math.max(0, 100 - paidPct - overduePct);

    return (
        <div className="flex flex-col gap-1 min-w-[120px] max-w-[180px]">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                {paidPct > 0 && (
                    <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${paidPct}%` }}
                        title={`Paid: ${paidPct}%`}
                    />
                )}
                {overduePct > 0 && (
                    <div
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${overduePct}%` }}
                        title={`Overdue: ${overduePct}%`}
                    />
                )}
                {duePct > 0 && (
                    <div
                        className="h-full bg-orange-400 transition-all"
                        style={{ width: `${duePct}%` }}
                        title={`Due: ${duePct}%`}
                    />
                )}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">{paidPct}% paid</div>
        </div>
    );
}

// ─── Installment Progress Bar (per fee type in expanded row) ───────────────

function InstallmentProgressBar({ statuses }: { statuses: string[] }) {
    if (!statuses || statuses.length === 0) return <span className="text-gray-400">—</span>;

    return (
        <div className="flex items-center gap-[2px] min-w-[80px] max-w-[160px]">
            {statuses.map((status, idx) => {
                const config =
                    INSTALLMENT_STATUS_COLORS[status] || INSTALLMENT_STATUS_COLORS['PENDING']!;
                return (
                    <div
                        key={idx}
                        className="relative group h-5 flex-1 rounded-sm cursor-default"
                        style={{ backgroundColor: config.bg }}
                    >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 pointer-events-none">
                            <div className="rounded bg-gray-800 px-2 py-1 text-[10px] font-medium text-white whitespace-nowrap shadow-lg">
                                #{idx + 1}: {config.label}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Expanded Row Content ──────────────────────────────────────────────────

interface FeeTypeGroup {
    feeTypeName: string;
    totalExpected: number;
    totalPaid: number;
    totalDue: number;
    totalOverdue: number;
    installmentStatuses: string[];
}

function groupByFeeType(installments: InstallmentDetailDTO[]): FeeTypeGroup[] {
    const map = new Map<string, FeeTypeGroup>();
    for (const inst of installments) {
        const key = inst.fee_type_name;
        let group = map.get(key);
        if (!group) {
            group = {
                feeTypeName: key,
                totalExpected: 0,
                totalPaid: 0,
                totalDue: 0,
                totalOverdue: 0,
                installmentStatuses: [],
            };
            map.set(key, group);
        }
        group.totalExpected += inst.amount_expected;
        group.totalPaid += inst.amount_paid;
        const instDue = inst.due_amount ?? 0;
        if (inst.status === 'OVERDUE') {
            group.totalOverdue += instDue;
        } else {
            group.totalDue += instDue;
        }
        group.installmentStatuses.push(inst.status);
    }
    return Array.from(map.values());
}

function ExpandedRowContent({ studentId, cpoId }: { studentId: string; cpoId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: getInstallmentDetailsQueryKey(studentId, cpoId),
        queryFn: () => fetchInstallmentDetails(studentId, cpoId),
        enabled: !!studentId && !!cpoId,
        staleTime: 30000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-4">
                <DashboardLoader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-6 py-3 text-sm text-red-600">
                Failed to load installment details.
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="px-6 py-3 text-sm text-gray-500">No installments found.</div>
        );
    }

    const feeTypeGroups = groupByFeeType(data);

    return (
        <div className="px-6 py-3 space-y-2">
            {/* Legend */}
            <div className="flex items-center gap-4 mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Installment Status:
                </span>
                {Object.entries(INSTALLMENT_STATUS_COLORS).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1">
                        <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: config.bg }}
                        />
                        <span className="text-[10px] text-gray-500">{config.label}</span>
                    </div>
                ))}
            </div>

            {/* Fee type rows */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-gray-100/80 border-b border-gray-200">
                            <th className="py-2 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                Fee Type
                            </th>
                            <th className="py-2 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                Expected
                            </th>
                            <th className="py-2 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                Paid
                            </th>
                            <th className="py-2 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                Due
                            </th>
                            <th className="py-2 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                Overdue
                            </th>
                            <th className="py-2 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[140px]">
                                Installments
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {feeTypeGroups.map((group) => (
                            <tr key={group.feeTypeName} className="hover:bg-gray-50/60">
                                <td className="py-2 px-4 font-semibold text-gray-800">
                                    {group.feeTypeName}
                                </td>
                                <td className="py-2 px-4 text-gray-700">
                                    {formatCurrency(group.totalExpected)}
                                </td>
                                <td className="py-2 px-4 font-semibold text-emerald-700">
                                    {formatCurrency(group.totalPaid)}
                                </td>
                                <td className="py-2 px-4 font-semibold text-orange-600">
                                    {group.totalDue > 0 ? formatCurrency(group.totalDue) : '—'}
                                </td>
                                <td className="py-2 px-4 font-semibold text-red-600">
                                    {group.totalOverdue > 0
                                        ? formatCurrency(group.totalOverdue)
                                        : '—'}
                                </td>
                                <td className="py-2 px-4">
                                    <InstallmentProgressBar
                                        statuses={group.installmentStatuses}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ManageFinancesTable({
    data,
    isLoading,
    error,
    currentPage,
    onPageChange,
}: ManageFinancesTableProps) {
    const { getDetailsFromPackageSessionId, instituteDetails } = useInstituteDetailsStore();

    // Modal state (eye button only)
    const [selectedRow, setSelectedRow] = useState<{
        studentId: string;
        cpoId: string;
        studentName: string;
        cpoName: string;
    } | null>(null);

    // Expanded rows state
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleExpand = useCallback((studentId: string, cpoId: string) => {
        const key = `${studentId}_${cpoId}`;
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const isExpanded = useCallback(
        (studentId: string, cpoId: string) => expandedRows.has(`${studentId}_${cpoId}`),
        [expandedRows]
    );

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
                id: 'expand',
                header: '',
                cell: ({ row }) => {
                    const r = row.original;
                    const expanded = isExpanded(r.student_id, r.cpo_id);
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(r.student_id, r.cpo_id);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                            {expanded ? (
                                <CaretDown size={14} weight="bold" />
                            ) : (
                                <CaretRight size={14} weight="bold" />
                            )}
                        </button>
                    );
                },
                size: 40,
            },
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
                id: 'progress',
                header: 'Progress',
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <PercentageProgressBar
                            paid={r.total_paid_amount ?? 0}
                            due={r.due_amount ?? 0}
                            overdue={r.overdue_amount ?? 0}
                            total={r.total_expected_amount ?? 0}
                        />
                    );
                },
                size: 180,
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
        [getPackageName, isExpanded, toggleExpand]
    );

    // ── Render expanded row ────────────────────────────────────────────

    const renderExpandedRow = useCallback(
        (row: StudentFeePaymentRowDTO) => {
            if (!isExpanded(row.student_id, row.cpo_id)) return null;
            return <ExpandedRowContent studentId={row.student_id} cpoId={row.cpo_id} />;
        },
        [isExpanded]
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
                        onCellClick={(row: StudentFeePaymentRowDTO, column: ColumnDef<StudentFeePaymentRowDTO>) => {
                            const colId = column.id || (column as any).accessorKey;
                            if (colId === 'actions' || colId === 'expand') return;
                            toggleExpand(row.student_id, row.cpo_id);
                        }}
                        renderExpandedRow={renderExpandedRow}
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

            {/* Installment Details Popup (eye button only) */}
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
