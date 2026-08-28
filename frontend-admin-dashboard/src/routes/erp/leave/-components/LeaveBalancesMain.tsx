import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { ArrowsClockwise, CalendarBlank, PlusMinus } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyTable, type TableData } from '@/components/design-system/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { reportApiError } from '@/lib/report-api-error';
import { EmployeePicker } from '@/routes/erp/-shared/EmployeePicker';
import type { LeaveBalanceDTO } from '@/routes/erp/-shared/hr-types';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
    HrNoAccessCard,
} from '@/routes/erp/people/-components/HrStates';
import {
    useLeaveBalances,
    useRunLeaveAccrual,
    useRunLeaveYearEnd,
} from '@/routes/erp/leave/-hooks/use-leave';
import { BalanceAdjustDialog } from './BalanceAdjustDialog';
import { CompOffTab } from './CompOffTab';
import { DaysCell, employeeLabel, recentLeaveYears } from './leave-meta';

type BulkJob = 'ACCRUAL' | 'YEAR_END';

/**
 * Leave balances for a year, one row per employee per leave type.
 *
 * The ledger columns are shown in the order the closing balance is built from
 * them — opening, accrued, used, adjustment, carried forward, encashed, closing —
 * because the number an admin is challenged on is the closing one, and the only
 * useful answer is which of the other six moved.
 */
export const LeaveBalancesMain = () => {
    const { isHrAdmin, isHrStaff } = useHrRole();
    const [year, setYear] = useState<number>(() => new Date().getFullYear());
    const [employeeId, setEmployeeId] = useState<string | undefined>();
    const [adjusting, setAdjusting] = useState<LeaveBalanceDTO | null>(null);
    const [pendingJob, setPendingJob] = useState<BulkJob | null>(null);

    const query = useLeaveBalances(year, employeeId);
    const accrualMutation = useRunLeaveAccrual();
    const yearEndMutation = useRunLeaveYearEnd();

    const rows = useMemo(
        () =>
            [...(query.data ?? [])].sort(
                (a, b) =>
                    (a.employee_name ?? a.employee_code ?? '').localeCompare(
                        b.employee_name ?? b.employee_code ?? ''
                    ) || (a.leave_type_name ?? '').localeCompare(b.leave_type_name ?? '')
            ),
        [query.data]
    );

    const runJob = async (job: BulkJob) => {
        try {
            const message =
                job === 'ACCRUAL'
                    ? await accrualMutation.mutateAsync()
                    : await yearEndMutation.mutateAsync();
            // The endpoints answer with a sentence about what they did ("credited 42
            // employees"), which is more useful than a generic "Done".
            toast.success(
                typeof message === 'string' && message.trim()
                    ? message
                    : job === 'ACCRUAL'
                      ? 'Accrual run finished'
                      : 'Year-end process finished'
            );
            setPendingJob(null);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-leave',
                tags: { action: job === 'ACCRUAL' ? 'run-accrual' : 'run-year-end' },
                fallbackMessage:
                    job === 'ACCRUAL'
                        ? 'Could not run the accrual.'
                        : 'Could not run the year-end process.',
            });
        }
    };

    const columns = useMemo<ColumnDef<LeaveBalanceDTO>[]>(
        () => [
            {
                id: 'employee',
                header: 'Employee',
                size: 220,
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
                id: 'opening_balance',
                header: 'Opening',
                size: 100,
                cell: ({ row }) => <DaysCell value={row.original.opening_balance} />,
            },
            {
                id: 'accrued',
                header: 'Accrued',
                size: 100,
                cell: ({ row }) => <DaysCell value={row.original.accrued} />,
            },
            {
                id: 'used',
                header: 'Used',
                size: 100,
                cell: ({ row }) => <DaysCell value={row.original.used} />,
            },
            {
                id: 'adjustment',
                header: 'Adjustment',
                size: 110,
                cell: ({ row }) => <DaysCell value={row.original.adjustment} />,
            },
            {
                id: 'carried_forward',
                header: 'Carried fwd',
                size: 110,
                cell: ({ row }) => <DaysCell value={row.original.carried_forward} />,
            },
            {
                id: 'encashed',
                header: 'Encashed',
                size: 100,
                cell: ({ row }) => <DaysCell value={row.original.encashed} />,
            },
            {
                id: 'closing_balance',
                header: 'Closing',
                size: 110,
                cell: ({ row }) => <DaysCell value={row.original.closing_balance} emphasis />,
            },
            ...(isHrAdmin
                ? [
                      {
                          id: 'actions',
                          header: '',
                          size: 110,
                          cell: ({ row }) => (
                              <MyButton
                                  buttonType="text"
                                  scale="small"
                                  type="button"
                                  onClick={() => setAdjusting(row.original)}
                              >
                                  <PlusMinus size={14} /> Adjust
                              </MyButton>
                          ),
                      } as ColumnDef<LeaveBalanceDTO>,
                  ]
                : []),
        ],
        [isHrAdmin]
    );

    if (!isHrStaff) return <HrNoAccessCard />;

    const tableData: TableData<LeaveBalanceDTO> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <p className="max-w-3xl text-body text-muted-foreground">
                    What every employee has left, per leave type. The closing balance is the opening
                    balance plus what has accrued and been carried forward, less what has been used
                    or encashed, plus any manual adjustment.
                </p>
                {isHrAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            type="button"
                            onClick={() => setPendingJob('ACCRUAL')}
                        >
                            <ArrowsClockwise size={16} /> Run accrual
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            type="button"
                            onClick={() => setPendingJob('YEAR_END')}
                        >
                            <CalendarBlank size={16} /> Year-end process
                        </MyButton>
                    </div>
                )}
            </div>

            <Tabs defaultValue="balances" className="flex flex-col gap-2">
                <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
                    <TabsTrigger value="balances">Balances</TabsTrigger>
                    <TabsTrigger value="comp-off">Comp-off</TabsTrigger>
                </TabsList>

                <TabsContent value="balances" className="mt-4 flex flex-col gap-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-caption text-muted-foreground">Year</span>
                            <MyDropdown
                                currentValue={String(year)}
                                dropdownList={recentLeaveYears().map(String)}
                                handleChange={(value) => setYear(Number(value))}
                            />
                        </div>
                        <div className="w-full sm:w-80">
                            <span className="mb-1 block text-caption text-muted-foreground">
                                Employee
                            </span>
                            <EmployeePicker
                                value={employeeId ?? ''}
                                onChange={(id) => setEmployeeId(id || undefined)}
                                filterStatus={null}
                                placeholder="All employees"
                            />
                        </div>
                        {employeeId && (
                            <MyButton
                                buttonType="text"
                                scale="small"
                                type="button"
                                onClick={() => setEmployeeId(undefined)}
                            >
                                <ArrowsClockwise size={14} /> Show everyone
                            </MyButton>
                        )}
                    </div>

                    {query.isLoading ? (
                        <HrLoadingRows />
                    ) : query.isError ? (
                        <HrErrorState
                            message="Couldn't load leave balances."
                            onRetry={() => void query.refetch()}
                        />
                    ) : rows.length === 0 ? (
                        <HrEmptyState
                            title={`No balances for ${year}`}
                            description={
                                employeeId
                                    ? 'This employee has no balance row for the selected year. Balances are created by the accrual run once a policy applies to them.'
                                    : 'Balances appear once a leave policy is in force and the accrual has run for the period. Set the policies up under Types & Policies first.'
                            }
                        />
                    ) : (
                        <MyTable<LeaveBalanceDTO>
                            data={tableData}
                            columns={columns}
                            isLoading={false}
                            error={null}
                            currentPage={0}
                            scrollable
                        />
                    )}
                </TabsContent>

                <TabsContent value="comp-off" className="mt-4">
                    <CompOffTab />
                </TabsContent>
            </Tabs>

            {isHrAdmin && (
                <BalanceAdjustDialog
                    balance={adjusting}
                    onOpenChange={(open) => !open && setAdjusting(null)}
                />
            )}

            <AlertDialog
                open={pendingJob === 'ACCRUAL'}
                onOpenChange={(open) => !open && setPendingJob(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Run the leave accrual now?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This credits this period&apos;s leave to every eligible employee,
                            following each leave type&apos;s policy. It is safe to run more than
                            once — the accrual ledger makes a repeat for the same period a no-op, so
                            nobody gets credited twice.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Not now</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void runJob('ACCRUAL')}>
                            Run accrual
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pendingJob === 'YEAR_END'}
                onOpenChange={(open) => !open && setPendingJob(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Run the year-end process?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This closes the leave year: each balance is carried forward or encashed
                            according to its leave type&apos;s policy, up to the carry-forward cap.
                            Run it once the closing year is genuinely finished — balances that lapse
                            are not recoverable from here.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Not now</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void runJob('YEAR_END')}>
                            Run year-end
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
