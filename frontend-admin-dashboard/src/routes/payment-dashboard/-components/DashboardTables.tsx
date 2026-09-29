import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { cn } from '@/lib/utils';
import type { DashboardBatchRow } from '@/services/payment-dashboard';
import { batchLabel, formatFull, toCourseRows, type CourseRow } from '../-utils/dashboardMath';

const money = (v: number, currency: string | null, tone?: string) => (
    <span className={cn('tabular-nums', v > 0 ? tone : 'text-neutral-400')}>
        {formatFull(v, currency)}
    </span>
);

const asTableData = <T,>(rows: T[], page: number, pageSize: number) => ({
    content: rows.slice(page * pageSize, (page + 1) * pageSize),
    total_pages: Math.max(1, Math.ceil(rows.length / pageSize)),
    page_no: page,
    page_size: pageSize,
    total_elements: rows.length,
    last: (page + 1) * pageSize >= rows.length,
});

/**
 * One row per course: collected in the period and over all time, and what is overdue / still to
 * come on its live enrolments. Clicking a course narrows the whole page to it.
 */
export function CoursesTable({
    batches,
    currency,
    courseTerm,
    onSelectCourse,
}: {
    batches: DashboardBatchRow[];
    currency: string | null;
    courseTerm: string;
    onSelectCourse?: (course: CourseRow) => void;
}) {
    const rows = useMemo(() => toCourseRows(batches), [batches]);
    const periodTotal = rows.reduce((s, r) => s + r.collected, 0);
    const columns = useMemo<ColumnDef<CourseRow>[]>(
        () => [
            {
                id: 'name',
                header: courseTerm,
                size: 260,
                cell: ({ row }) => (
                    <span
                        className={cn(
                            'font-medium',
                            row.original.key === '__none__'
                                ? 'text-neutral-500'
                                : 'text-neutral-800'
                        )}
                    >
                        {row.original.name}
                    </span>
                ),
            },
            {
                id: 'collected',
                header: 'Collected',
                size: 170,
                cell: ({ row }) => {
                    const share =
                        periodTotal > 0 ? (row.original.collected / periodTotal) * 100 : 0;
                    return (
                        <div className="flex flex-col gap-1">
                            {money(
                                row.original.collected,
                                currency,
                                'font-semibold text-neutral-800'
                            )}
                            <span className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                                {/* Share of the period's total — data, so inline width. */}
                                <span
                                    className="block h-full rounded-full bg-primary-500"
                                    style={{ width: `${share}%` }}
                                />
                            </span>
                        </div>
                    );
                },
            },
            {
                id: 'collected_all_time',
                header: 'Collected (all time)',
                size: 150,
                cell: ({ row }) =>
                    money(row.original.collectedAllTime, currency, 'text-neutral-700'),
            },
            {
                id: 'overdue',
                header: 'Overdue',
                size: 130,
                cell: ({ row }) =>
                    money(row.original.overdue, currency, 'font-medium text-danger-600'),
            },
            {
                id: 'still_to_come',
                header: 'Still to come',
                size: 130,
                cell: ({ row }) => money(row.original.stillToCome, currency, 'text-success-700'),
            },
        ],
        [courseTerm, currency, periodTotal]
    );
    const [page, setPage] = useState(0);
    // New data (another period or filter) starts from the first page, or a short list could
    // leave the table on a page that no longer exists.
    useEffect(() => setPage(0), [batches]);
    const pageSize = 8;

    if (rows.length === 0) {
        return (
            <p className="py-8 text-center text-caption text-neutral-500">
                No payments or balances to show.
            </p>
        );
    }
    return (
        <div className="space-y-3">
            <MyTable<CourseRow>
                data={asTableData(rows, page, pageSize)}
                columns={columns}
                isLoading={false}
                error={null}
                currentPage={page}
                enableColumnResizing={false}
                enableColumnPinning={false}
                scrollable
                onCellClick={(row) => {
                    if (row.key !== '__none__' && onSelectCourse) onSelectCourse(row);
                }}
            />
            {rows.length > pageSize && (
                <MyPagination
                    currentPage={page}
                    totalPages={Math.ceil(rows.length / pageSize)}
                    onPageChange={setPage}
                    totalElements={rows.length}
                    pageSize={pageSize}
                />
            )}
        </div>
    );
}

const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every batch with a balance or a payment, sorted by the money still to collect. */
export function BatchesTable({
    batches,
    currency,
    courseTerm,
    batchTerm,
}: {
    batches: DashboardBatchRow[];
    currency: string | null;
    courseTerm: string;
    batchTerm: string;
}) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    // New data (another period or filter) starts from the first page, or a short list could
    // leave the table on a page that no longer exists.
    useEffect(() => setPage(0), [batches]);
    const pageSize = 10;

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return batches
            .filter((b) => {
                if (!q) return true;
                return `${b.package_name ?? ''} ${batchLabel(b)}`.toLowerCase().includes(q);
            })
            .sort((a, b) => {
                if (!a.package_session_id) return 1;
                if (!b.package_session_id) return -1;
                return (
                    b.overdue + b.still_to_come - (a.overdue + a.still_to_come) ||
                    b.collected - a.collected
                );
            });
    }, [batches, search]);

    const columns = useMemo<ColumnDef<DashboardBatchRow>[]>(
        () => [
            {
                id: 'batch',
                header: batchTerm,
                size: 420,
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate font-medium text-neutral-800">
                            {batchLabel(row.original)}
                        </div>
                        {row.original.package_name && (
                            <div className="truncate text-caption text-neutral-500">
                                {row.original.package_name}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                id: 'collected',
                header: 'Collected',
                size: 220,
                cell: ({ row }) =>
                    money(row.original.collected, currency, 'font-semibold text-neutral-800'),
            },
            {
                id: 'overdue',
                header: 'Overdue',
                size: 220,
                cell: ({ row }) =>
                    money(row.original.overdue, currency, 'font-medium text-danger-600'),
            },
            {
                id: 'still_to_come',
                header: 'Still to come',
                size: 220,
                cell: ({ row }) => money(row.original.still_to_come, currency, 'text-success-700'),
            },
            {
                id: 'learners',
                header: 'Learners owing',
                size: 180,
                cell: ({ row }) => <span className="tabular-nums">{row.original.learners}</span>,
            },
        ],
        [batchTerm, currency]
    );

    const downloadCsv = () => {
        if (rows.length === 0) {
            toast.info('Nothing to export.');
            return;
        }
        const header = [
            courseTerm,
            batchTerm,
            'Collected',
            'Collected (all time)',
            'Overdue',
            'Still to come',
            'Learners owing',
        ];
        const lines = rows.map((b) =>
            [
                b.package_name ?? '',
                batchLabel(b),
                b.collected.toFixed(2),
                b.collected_all_time.toFixed(2),
                b.overdue.toFixed(2),
                b.still_to_come.toFixed(2),
                b.learners,
            ]
                .map(csvCell)
                .join(',')
        );
        const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], {
            type: 'text/csv;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-balances-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <MagnifyingGlass
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-neutral-400"
                    />
                    <MyInput
                        inputType="text"
                        input={search}
                        onChangeFunction={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        inputPlaceholder={`Search ${batchTerm.toLowerCase()} or ${courseTerm.toLowerCase()}`}
                        className="w-full pl-9"
                        size="medium"
                    />
                </div>
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    className="gap-2"
                    onClick={downloadCsv}
                >
                    <DownloadSimple size={16} />
                    CSV
                </MyButton>
            </div>
            {rows.length === 0 ? (
                <p className="py-8 text-center text-caption text-neutral-500">
                    {search ? 'No batch matches your search.' : 'No payments or balances to show.'}
                </p>
            ) : (
                <>
                    <MyTable<DashboardBatchRow>
                        data={asTableData(rows, page, pageSize)}
                        columns={columns}
                        isLoading={false}
                        error={null}
                        currentPage={page}
                        enableColumnResizing={false}
                        enableColumnPinning={false}
                        scrollable
                    />
                    {rows.length > pageSize && (
                        <MyPagination
                            currentPage={page}
                            totalPages={Math.ceil(rows.length / pageSize)}
                            onPageChange={setPage}
                            totalElements={rows.length}
                            pageSize={pageSize}
                        />
                    )}
                </>
            )}
        </div>
    );
}
