import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Lock, Plus, Trash, Warning } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MoneyCell } from '@/components/design-system/money-cell';
import {
    MonthPicker,
    currentMonthValue,
    type MonthValue,
} from '@/components/design-system/month-picker';
import { StatusChip } from '@/components/design-system/status-chips';
import { MyTable, type TableData } from '@/components/design-system/table';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getInstituteId } from '@/constants/helper';
import { useHrRole } from '@/hooks/use-hr-role';
import { reportApiError } from '@/lib/report-api-error';
import { formatEmployeeLabel } from '@/routes/erp/-shared/EmployeePicker';
import {
    deleteAdjustment,
    fetchAdjustments,
    fetchEmployees,
    hrKeys,
} from '@/routes/erp/-shared/hr-service';
import type { PayrollAdjustmentDTO } from '@/routes/erp/-shared/hr-types';
import { AdjustmentDialog } from './AdjustmentDialog';
import { AdjustmentTypeChip, RunScopeChip } from './adjustment-meta';

/**
 * Adjustments carry `employee_id` only, so a name map is fetched alongside them.
 * Deliberately unfiltered by status and a page bigger than the picker's: an FNF
 * adjustment belongs to someone who has already left, and showing a raw UUID for
 * them would be worse than one extra request.
 */
const NAME_MAP_PAGE_SIZE = 200;

// TODO(payroll phase 2): Teaching Pay and Incentives join this screen as sibling
// tabs (per-class/per-hour teaching pay, and incentive schemes with their own
// payout rules). Both land as adjustments on the same run, so they belong here
// rather than on a separate route — wrap this table in <Tabs> at that point.

export const AdjustmentsMain = () => {
    const { isHrAdmin, isHrStaff } = useHrRole();
    const queryClient = useQueryClient();
    const instituteId = getInstituteId();

    const [month, setMonth] = useState<MonthValue>(currentMonthValue());
    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<PayrollAdjustmentDTO | null>(null);

    const adjustmentsQuery = useQuery({
        queryKey: hrKeys.adjustments(month.year, month.month),
        queryFn: () => fetchAdjustments(month.year, month.month),
        enabled: !!instituteId && isHrStaff,
    });

    const employeesQuery = useQuery({
        queryKey: hrKeys.employees({ size: NAME_MAP_PAGE_SIZE }),
        queryFn: () => fetchEmployees({ size: NAME_MAP_PAGE_SIZE }),
        enabled: !!instituteId && isHrStaff,
    });

    const employeeLabels = useMemo(() => {
        const map = new Map<string, string>();
        for (const employee of employeesQuery.data?.content ?? []) {
            if (employee.id) map.set(employee.id, formatEmployeeLabel(employee));
        }
        return map;
    }, [employeesQuery.data]);

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteAdjustment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: hrKeys.adjustments(month.year, month.month),
            });
            toast.success('Adjustment removed');
            setPendingDelete(null);
        },
        onError: (error) => {
            // The backend refuses to delete an adjustment a payroll run already
            // consumed; its message says so, so let it through untouched.
            reportApiError(error, {
                feature: 'erp-adjustments',
                tags: { action: 'delete-adjustment' },
                fallbackMessage:
                    'Could not remove this adjustment. If a payroll run has already picked it up, reject that run first.',
            });
            setPendingDelete(null);
        },
    });

    const rows = useMemo(() => adjustmentsQuery.data ?? [], [adjustmentsQuery.data]);

    const columns = useMemo<ColumnDef<PayrollAdjustmentDTO>[]>(
        () => [
            {
                id: 'employee',
                header: 'Employee',
                cell: ({ row }) => (
                    <span className="text-body text-neutral-700">
                        {employeeLabels.get(row.original.employee_id ?? '') ??
                            row.original.employee_id ??
                            '—'}
                    </span>
                ),
            },
            {
                id: 'type',
                header: 'Type',
                cell: ({ row }) => <AdjustmentTypeChip type={row.original.type} />,
            },
            {
                id: 'code',
                header: 'Code',
                cell: ({ row }) => (
                    <span className="font-mono text-caption text-neutral-600">
                        {row.original.code ?? '—'}
                    </span>
                ),
            },
            {
                id: 'label',
                header: 'Label',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-body text-neutral-700">
                            {row.original.label ?? '—'}
                        </span>
                        {row.original.notes && (
                            <span className="truncate text-caption text-neutral-500">
                                {row.original.notes}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'amount',
                header: 'Amount',
                cell: ({ row }) => (
                    <MoneyCell
                        value={row.original.amount}
                        currency={row.original.currency}
                        tone={
                            (row.original.type ?? '').toUpperCase() === 'DEDUCTION'
                                ? 'deduction'
                                : 'earning'
                        }
                    />
                ),
            },
            {
                id: 'run_scope',
                header: 'Run scope',
                cell: ({ row }) => <RunScopeChip scope={row.original.run_scope} />,
            },
            {
                id: 'source',
                header: 'Source',
                cell: ({ row }) => (
                    <span className="text-caption text-neutral-500">
                        {row.original.source ?? 'MANUAL'}
                    </span>
                ),
            },
            {
                id: 'consumed',
                header: 'Picked up',
                cell: ({ row }) =>
                    row.original.payroll_entry_id ? (
                        <StatusChip
                            text="In payroll"
                            textSize="text-caption"
                            status="SUCCESS"
                            showIcon={false}
                        />
                    ) : (
                        <StatusChip
                            text="Pending"
                            textSize="text-caption"
                            status="INFO"
                            showIcon={false}
                        />
                    ),
            },
            ...(isHrAdmin
                ? [
                      {
                          id: 'actions',
                          header: '',
                          cell: ({ row }) =>
                              row.original.payroll_entry_id ? (
                                  <span className="text-caption text-neutral-400">Locked</span>
                              ) : (
                                  <MyButton
                                      buttonType="text"
                                      scale="small"
                                      layoutVariant="icon"
                                      aria-label={`Remove ${row.original.label ?? 'adjustment'}`}
                                      onClick={() => setPendingDelete(row.original)}
                                  >
                                      <Trash size={16} className="text-danger-600" />
                                  </MyButton>
                              ),
                      } as ColumnDef<PayrollAdjustmentDTO>,
                  ]
                : []),
        ],
        [employeeLabels, isHrAdmin]
    );

    if (!isHrStaff) {
        return (
            <Card className="mx-auto max-w-xl">
                <CardHeader className="flex flex-row items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                        <Lock size={20} />
                    </span>
                    <CardTitle className="text-title">Variable pay is restricted</CardTitle>
                </CardHeader>
                <CardContent className="text-body text-neutral-600">
                    One-off earnings and deductions are visible to HR roles only. Ask an
                    administrator to grant you HR Manager or HR Admin access in this institute.
                </CardContent>
            </Card>
        );
    }

    const tableData: TableData<PayrollAdjustmentDTO> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-body text-neutral-600">
                One-off earnings and deductions for a single month — an incentive, an arrear, a
                recovery. Each one waits here until a payroll run for its month and scope picks it
                up; once a run has, it is locked and can only be undone by rejecting that run.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <MonthPicker label="Month" value={month} onChange={setMonth} />
                {isHrAdmin && (
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        onClick={() => setDialogOpen(true)}
                    >
                        <Plus size={16} />
                        Add adjustment
                    </MyButton>
                )}
            </div>

            {adjustmentsQuery.isError ? (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-6">
                        <div className="flex items-center gap-2 text-body text-danger-600">
                            <Warning size={18} />
                            Could not load adjustments for this month.
                        </div>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onAsyncClick={async () => {
                                await adjustmentsQuery.refetch();
                            }}
                            loadingText="Retrying…"
                        >
                            Retry
                        </MyButton>
                    </CardContent>
                </Card>
            ) : !adjustmentsQuery.isLoading && rows.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 p-6">
                        <p className="text-subtitle text-neutral-700">Nothing extra this month</p>
                        <p className="max-w-xl text-body text-neutral-600">
                            No adjustments recorded for the selected month. Anything you add here
                            will be picked up by the next matching payroll run.
                        </p>
                        {isHrAdmin && (
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                onClick={() => setDialogOpen(true)}
                            >
                                <Plus size={16} />
                                Add adjustment
                            </MyButton>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <MyTable<PayrollAdjustmentDTO>
                    data={tableData}
                    columns={columns}
                    isLoading={adjustmentsQuery.isLoading}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            <AdjustmentDialog open={dialogOpen} onOpenChange={setDialogOpen} month={month} />

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(next) => {
                    if (!next) setPendingDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this adjustment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete?.label ?? 'This adjustment'} will no longer be applied to
                            the next payroll run for {month.month}/{month.year}. This cannot be
                            undone — you would have to add it again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                if (pendingDelete?.id) deleteMutation.mutate(pendingDelete.id);
                            }}
                        >
                            {deleteMutation.isPending ? 'Removing…' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
