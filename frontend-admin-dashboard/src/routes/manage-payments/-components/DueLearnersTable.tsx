import { useMemo } from 'react';
import { CalendarX, HourglassMedium } from '@phosphor-icons/react';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/payment-currency';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import type { ColumnDef } from '@tanstack/react-table';
import type { OutstandingLearner, OutstandingLearnersPage } from '@/services/payment-logs';

interface DueLearnersTableProps {
    data: OutstandingLearnersPage | undefined;
    isLoading: boolean;
    error: unknown;
    currentPage: number;
    onPageChange: (page: number) => void;
    /** Opens the balance breakdown for one learner. */
    onSelectLearner?: (learner: OutstandingLearner) => void;
}

const initialsOf = (name?: string | null): string => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
};

const money = (amount: number, currency?: string | null): string =>
    formatMoney(amount, currency || '', { maximumFractionDigits: 0 });

/** dd MMM yyyy in the admin's own zone; the API sends a plain YYYY-MM-DD calendar date. */
const formatDueDate = (date?: string | null): string => {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return date;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

/** True once the next instalment's due date has passed. */
const isOverdue = (date?: string | null): boolean => {
    if (!date) return false;
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return false;
    const due = new Date(y, m - 1, d);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
};

/**
 * Who owes what — the drill-down behind the "Due payment" card.
 *
 * The payments table below can't answer this: a learner part-way through an instalment plan shows
 * only the instalments they HAVE paid, and one who has never paid shows nothing at all. This lists
 * the balance itself (billed minus paid, per learner), the fee type it sits under, and for custom
 * instalment plans how many instalments are outstanding and when the next one is due.
 */
export function DueLearnersTable({
    data,
    isLoading,
    error,
    currentPage,
    onPageChange,
    onSelectLearner,
}: DueLearnersTableProps) {
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);

    const columns = useMemo<ColumnDef<OutstandingLearner>[]>(
        () => [
            {
                id: 'learner',
                header: 'Learner',
                accessorFn: (row) => row.full_name || row.email || '',
                cell: ({ row }) => {
                    const learner = row.original;
                    return (
                        <div className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-semibold text-primary-600">
                                {initialsOf(learner.full_name)}
                            </span>
                            <div className="min-w-0">
                                <div className="truncate font-medium text-neutral-700">
                                    {learner.full_name || '—'}
                                </div>
                                <div className="truncate text-xs text-neutral-500">
                                    {learner.email || learner.mobile_number || ''}
                                </div>
                            </div>
                        </div>
                    );
                },
                size: 240,
            },
            {
                id: 'course_name',
                header: `${courseTerm}/Membership`,
                accessorFn: (row) => row.course_name || '',
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate text-neutral-700">
                            {row.original.course_name || '—'}
                        </div>
                        {row.original.plan_count > 1 && (
                            <div className="text-xs text-primary-500">
                                +{row.original.plan_count - 1} more · view all
                            </div>
                        )}
                    </div>
                ),
                size: 200,
            },
            {
                id: 'payment_type',
                header: 'Fee Type',
                accessorFn: (row) => row.payment_type || '',
                cell: ({ row }) => (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600">
                        {row.original.payment_type || '—'}
                    </span>
                ),
                size: 150,
            },
            {
                id: 'billed',
                header: 'Billed',
                accessorFn: (row) => row.billed,
                cell: ({ row }) => (
                    <span className="tabular-nums text-neutral-600">
                        {money(row.original.billed, row.original.currency)}
                    </span>
                ),
                size: 110,
            },
            {
                id: 'paid',
                header: 'Paid',
                accessorFn: (row) => row.paid,
                cell: ({ row }) => (
                    <span className="tabular-nums text-success-700">
                        {money(row.original.paid, row.original.currency)}
                    </span>
                ),
                size: 110,
            },
            {
                id: 'due',
                header: 'Due',
                accessorFn: (row) => row.due,
                cell: ({ row }) => (
                    <span className="font-semibold tabular-nums text-warning-700">
                        {money(row.original.due, row.original.currency)}
                    </span>
                ),
                size: 120,
            },
            {
                id: 'installments',
                header: 'Instalments',
                accessorFn: (row) => row.pending_installments,
                cell: ({ row }) => {
                    const learner = row.original;
                    // Only custom instalment plans carry a schedule; everything else is a single fee.
                    if (!learner.pending_installments && !learner.next_due_date) {
                        return <span className="text-neutral-400">—</span>;
                    }
                    const overdue = isOverdue(learner.next_due_date);
                    return (
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-neutral-700">
                                <HourglassMedium size={13} className="text-warning-600" />
                                {learner.pending_installments} pending
                            </div>
                            {learner.next_due_date && (
                                <div
                                    className={cn(
                                        'flex items-center gap-1.5 text-xs',
                                        overdue ? 'font-medium text-danger-600' : 'text-neutral-500'
                                    )}
                                >
                                    {overdue && <CalendarX size={12} />}
                                    {overdue ? 'Overdue since ' : 'Next '}
                                    {formatDueDate(learner.next_due_date)}
                                </div>
                            )}
                        </div>
                    );
                },
                size: 170,
            },
        ],
        [courseTerm]
    );

    const tableData = useMemo(() => {
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

    if (error) {
        return (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-8 text-center">
                <p className="font-medium text-danger-700">Couldn’t load outstanding balances</p>
                <p className="mt-2 text-body text-danger-600">
                    {error instanceof Error ? error.message : 'Please try again in a moment.'}
                </p>
            </div>
        );
    }

    const isEmpty = !isLoading && !!tableData && tableData.content.length === 0;

    return (
        <div className="space-y-4">
            {isEmpty ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                    <p className="text-title font-medium text-neutral-700">Nothing outstanding</p>
                    <p className="mt-2 text-body text-neutral-500">
                        Every enrolment in this view is paid up.
                    </p>
                </div>
            ) : (
                <MyTable
                    data={tableData}
                    columns={columns}
                    isLoading={isLoading}
                    error={null}
                    currentPage={currentPage}
                    scrollable={true}
                    enableColumnResizing={true}
                    enableColumnPinning={false}
                    onCellClick={(row) => onSelectLearner?.(row)}
                    className={onSelectLearner ? '[&_tbody_tr]:cursor-pointer' : undefined}
                />
            )}

            {tableData && tableData.total_pages > 1 && (
                <MyPagination
                    currentPage={currentPage}
                    totalPages={tableData.total_pages}
                    onPageChange={onPageChange}
                />
            )}
        </div>
    );
}
