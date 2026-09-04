import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { ArrowsClockwise, Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyTable, type TableData } from '@/components/design-system/table';
import { useHrRole } from '@/hooks/use-hr-role';
import { formatDate } from '@/lib/formatters';
import { reportApiError } from '@/lib/report-api-error';
import { EmployeePicker } from '@/routes/erp/-shared/EmployeePicker';
import type { CompOffDTO } from '@/routes/erp/-shared/hr-types';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
} from '@/routes/erp/people/-components/HrStates';
import { useActOnCompOff, useCompOffs } from '@/routes/erp/leave/-hooks/use-leave';
import { DaysCell, LeaveStatusChip, employeeLabel } from './leave-meta';

/**
 * Comp-off earned for working a holiday or a weekly off.
 *
 * Approving one is a credit, not a permission: the days land in the employee's
 * COMP_OFF balance and expire on the date shown, whether or not they are used.
 * That expiry is why the column is in the table rather than buried in a detail
 * panel — approving a comp-off that expires next week is a different decision
 * from approving one that expires in three months.
 */
export const CompOffTab = () => {
    const { isHrAdmin } = useHrRole();
    const [employeeId, setEmployeeId] = useState<string | undefined>();
    const [actingId, setActingId] = useState<string | null>(null);

    const query = useCompOffs(employeeId);
    const mutation = useActOnCompOff();

    const rows = useMemo(
        () =>
            [...(query.data ?? [])].sort((a, b) =>
                (b.worked_on_date ?? '').localeCompare(a.worked_on_date ?? '')
            ),
        [query.data]
    );

    const act = async (compOff: CompOffDTO, status: 'APPROVED' | 'REJECTED') => {
        if (!compOff.id) return;
        setActingId(compOff.id);
        try {
            await mutation.mutateAsync({ id: compOff.id, status });
            toast.success(status === 'APPROVED' ? 'Comp-off approved' : 'Comp-off rejected');
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-leave',
                tags: { action: status === 'APPROVED' ? 'approve-comp-off' : 'reject-comp-off' },
                fallbackMessage: 'Could not update this comp-off.',
            });
        } finally {
            setActingId(null);
        }
    };

    const columns = useMemo<ColumnDef<CompOffDTO>[]>(
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
                id: 'worked_on_date',
                header: 'Worked on',
                size: 140,
                cell: ({ row }) => (
                    <span className="text-body text-foreground">
                        {row.original.worked_on_date
                            ? formatDate(row.original.worked_on_date)
                            : '—'}
                    </span>
                ),
            },
            {
                id: 'earned_days',
                header: 'Earned days',
                size: 120,
                cell: ({ row }) => <DaysCell value={row.original.earned_days} />,
            },
            {
                id: 'expiry_date',
                header: 'Expires',
                size: 140,
                cell: ({ row }) => (
                    <span className="text-body text-muted-foreground">
                        {row.original.expiry_date ? formatDate(row.original.expiry_date) : '—'}
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
                          size: 170,
                          cell: ({ row }) => {
                              if ((row.original.status ?? '').toUpperCase() !== 'PENDING') {
                                  return null;
                              }
                              const busy = actingId === row.original.id;
                              return (
                                  <div className="flex items-center justify-end gap-2">
                                      <MyButton
                                          buttonType="secondary"
                                          scale="small"
                                          type="button"
                                          disable={busy}
                                          onAsyncClick={() => act(row.original, 'APPROVED')}
                                          loadingText="Approving…"
                                      >
                                          Approve
                                      </MyButton>
                                      <MyButton
                                          buttonType="text"
                                          scale="small"
                                          type="button"
                                          disable={busy}
                                          onAsyncClick={() => act(row.original, 'REJECTED')}
                                          loadingText="Rejecting…"
                                      >
                                          Reject
                                      </MyButton>
                                  </div>
                              );
                          },
                      } as ColumnDef<CompOffDTO>,
                  ]
                : []),
        ],
        // `act` is stable enough for the table's purposes; only the admin flag and the
        // in-flight row change what a cell renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isHrAdmin, actingId]
    );

    const tableData: TableData<CompOffDTO> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-body text-muted-foreground">
                Days an employee worked when they did not have to. Approving one credits their
                COMP_OFF balance with the earned days, which then expire on the date shown — an
                unused comp-off is not carried forward past it.
            </p>

            <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-80">
                    <span className="mb-1 block text-caption text-muted-foreground">Employee</span>
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
                <HrLoadingRows rows={4} />
            ) : query.isError ? (
                <HrErrorState
                    message="Couldn't load comp-off records."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    title="No comp-off recorded"
                    description={
                        employeeId
                            ? 'This employee has not claimed any comp-off yet.'
                            : 'Comp-off appears here when an employee claims a day they worked on a holiday or weekly off.'
                    }
                />
            ) : (
                <MyTable<CompOffDTO>
                    data={tableData}
                    columns={columns}
                    isLoading={false}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            <p className="flex items-start gap-2 text-caption text-muted-foreground">
                <Info size={14} className="mt-0.5 shrink-0" />
                Approved comp-off shows up as a COMP_OFF row in the balances table above, where it
                behaves like any other leave type until it expires.
            </p>
        </div>
    );
};
