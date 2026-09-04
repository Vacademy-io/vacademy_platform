import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { CalendarX, Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyTable, type TableData } from '@/components/design-system/table';
import { ChipToggleGroup } from '@/components/design-system/chips';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useHrRole } from '@/hooks/use-hr-role';
import { formatDate } from '@/lib/formatters';
import { reportApiError } from '@/lib/report-api-error';
import type { LeaveApplicationDTO } from '@/routes/erp/-shared/hr-types';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
    HrNoAccessCard,
} from '@/routes/erp/people/-components/HrStates';
import {
    useCancelLeaveApplication,
    useLeaveApplications,
} from '@/routes/erp/leave/-hooks/use-leave';
import { LeaveActionDialog } from './LeaveActionDialog';
import {
    DaysCell,
    LEAVE_STATUS_FILTERS,
    LeaveStatusChip,
    employeeLabel,
    humanizeToken,
    type LeaveStatusFilter,
} from './leave-meta';

/**
 * The leave request queue.
 *
 * Opens on PENDING because that is the only status that needs someone: the other
 * chips are there to answer "what did we decide about X", not to be worked
 * through. Approve/reject happens in a dialog rather than inline — a rejection
 * needs a reason the employee will read, and an approval can be refused by the
 * backend for reasons the table can't show.
 */
export const LeaveRequestsMain = () => {
    const { isHrAdmin, isHrStaff } = useHrRole();
    const [statusFilter, setStatusFilter] = useState<LeaveStatusFilter>('PENDING');
    const [reviewing, setReviewing] = useState<LeaveApplicationDTO | null>(null);
    const [pendingCancel, setPendingCancel] = useState<LeaveApplicationDTO | null>(null);

    const query = useLeaveApplications(statusFilter === 'ALL' ? undefined : statusFilter);
    const cancelMutation = useCancelLeaveApplication();

    const rows = useMemo(
        () =>
            [...(query.data ?? [])].sort((a, b) =>
                (b.from_date ?? '').localeCompare(a.from_date ?? '')
            ),
        [query.data]
    );

    const confirmCancel = async () => {
        if (!pendingCancel?.id) return;
        try {
            await cancelMutation.mutateAsync(pendingCancel.id);
            toast.success('Leave cancelled');
            setPendingCancel(null);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-leave',
                tags: { action: 'cancel-leave' },
                fallbackMessage: 'Could not cancel this leave.',
            });
        }
    };

    const columns = useMemo<ColumnDef<LeaveApplicationDTO>[]>(
        () => [
            {
                id: 'employee',
                header: 'Employee',
                size: 200,
                cell: ({ row }) => (
                    <span className="truncate text-body font-semibold text-foreground">
                        {employeeLabel(row.original.employee_name, row.original.employee_code)}
                    </span>
                ),
            },
            {
                id: 'leave_type',
                header: 'Leave type',
                size: 150,
                cell: ({ row }) => (
                    <span className="truncate text-body text-foreground">
                        {row.original.leave_type_name || '—'}
                    </span>
                ),
            },
            {
                id: 'dates',
                header: 'From → to',
                size: 190,
                cell: ({ row }) => (
                    <span className="text-body text-foreground">
                        {row.original.from_date
                            ? `${formatDate(row.original.from_date)} → ${
                                  row.original.to_date
                                      ? formatDate(row.original.to_date)
                                      : formatDate(row.original.from_date)
                              }`
                            : '—'}
                    </span>
                ),
            },
            {
                id: 'total_days',
                header: 'Days',
                size: 90,
                cell: ({ row }) => <DaysCell value={row.original.total_days} />,
            },
            {
                id: 'half_day',
                header: 'Half day',
                size: 120,
                cell: ({ row }) =>
                    row.original.is_half_day ? (
                        <span className="text-caption text-warning-700">
                            {row.original.half_day_type
                                ? humanizeToken(row.original.half_day_type)
                                : 'Half day'}
                        </span>
                    ) : (
                        <span className="text-caption text-muted-foreground">—</span>
                    ),
            },
            {
                id: 'reason',
                header: 'Reason',
                size: 220,
                cell: ({ row }) => (
                    <span
                        className="block truncate text-body text-muted-foreground"
                        title={row.original.reason ?? undefined}
                    >
                        {row.original.reason || '—'}
                    </span>
                ),
            },
            {
                id: 'status',
                header: 'Status',
                size: 130,
                cell: ({ row }) => <LeaveStatusChip status={row.original.status} />,
            },
            ...(isHrAdmin
                ? [
                      {
                          id: 'actions',
                          header: '',
                          size: 130,
                          cell: ({ row }) => {
                              const status = (row.original.status ?? '').toUpperCase();
                              if (status === 'PENDING') {
                                  return (
                                      <MyButton
                                          buttonType="secondary"
                                          scale="small"
                                          type="button"
                                          onClick={() => setReviewing(row.original)}
                                      >
                                          Review
                                      </MyButton>
                                  );
                              }
                              if (status === 'APPROVED') {
                                  return (
                                      <MyButton
                                          buttonType="text"
                                          scale="small"
                                          type="button"
                                          onClick={() => setPendingCancel(row.original)}
                                      >
                                          Cancel
                                      </MyButton>
                                  );
                              }
                              return null;
                          },
                      } as ColumnDef<LeaveApplicationDTO>,
                  ]
                : []),
        ],
        [isHrAdmin]
    );

    if (!isHrStaff) return <HrNoAccessCard />;

    const tableData: TableData<LeaveApplicationDTO> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    const statusLabel =
        LEAVE_STATUS_FILTERS.find((option) => option.value === statusFilter)?.label ?? statusFilter;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
                <p className="max-w-3xl text-body text-muted-foreground">
                    Leave applied for by your employees. Approving one spends the employee&apos;s
                    balance for that leave type and writes an ON_LEAVE attendance record for each
                    day, so payroll and attendance stay in step with the decision.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <ChipToggleGroup<LeaveStatusFilter>
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={LEAVE_STATUS_FILTERS}
                    ariaLabel="Filter leave requests by status"
                />
                {!query.isLoading && !query.isError && (
                    <span className="text-caption text-muted-foreground">
                        {rows.length} {rows.length === 1 ? 'request' : 'requests'}
                    </span>
                )}
            </div>

            {query.isLoading ? (
                <HrLoadingRows />
            ) : query.isError ? (
                <HrErrorState
                    message="Couldn't load leave requests."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    icon={<CalendarX size={40} className="text-muted-foreground" />}
                    title={
                        statusFilter === 'PENDING'
                            ? 'Nothing waiting on you'
                            : `No ${statusLabel.toLowerCase()} requests`
                    }
                    description={
                        statusFilter === 'PENDING'
                            ? 'Every leave request has been decided. New ones land here as employees apply from their app.'
                            : 'Try another status — requests are only listed once an employee has applied.'
                    }
                />
            ) : (
                <MyTable<LeaveApplicationDTO>
                    data={tableData}
                    columns={columns}
                    isLoading={false}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            {isHrAdmin && (
                <p className="flex items-start gap-2 text-caption text-muted-foreground">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    Cancelling an approved leave returns the days to the balance and removes the
                    ON_LEAVE attendance it created.
                </p>
            )}

            {isHrAdmin && (
                <LeaveActionDialog
                    application={reviewing}
                    onOpenChange={(open) => !open && setReviewing(null)}
                />
            )}

            <AlertDialog
                open={!!pendingCancel}
                onOpenChange={(open) => !open && setPendingCancel(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this approved leave?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingCancel
                                ? `${employeeLabel(
                                      pendingCancel.employee_name,
                                      pendingCancel.employee_code
                                  )} keeps the days back in their ${
                                      pendingCancel.leave_type_name || 'leave'
                                  } balance, and the ON_LEAVE attendance for those dates is removed. If payroll has already locked the month, the backend will refuse and tell you so.`
                                : ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it approved</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void confirmCancel()}>
                            Cancel leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
