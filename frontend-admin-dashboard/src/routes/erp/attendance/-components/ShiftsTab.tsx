import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Clock, PencilSimple, Plus, UsersThree } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { StatusChip } from '@/components/design-system/status-chips';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
} from '@/routes/erp/people/-components/HrStates';
import type { ShiftDTO } from '@/routes/erp/-shared/hr-types';
import { useShifts } from '../-hooks/use-attendance';
import { toNumber, formatClockTime } from './attendance-meta';
import { AssignShiftDialog } from './AssignShiftDialog';
import { ShiftDialog } from './ShiftDialog';

/**
 * The institute's shifts, and who is on them.
 *
 * A shift is what makes a check-in interpretable: without one, a stamp at 09:47
 * is neither late nor on time. The default shift covers everyone not explicitly
 * assigned, which is why it is called out in the table rather than buried.
 */
export const ShiftsTab = ({ isHrAdmin }: { isHrAdmin: boolean }) => {
    const query = useShifts();
    const [editing, setEditing] = useState<ShiftDTO | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);

    const rows = useMemo(() => query.data ?? [], [query.data]);

    const columns = useMemo<ColumnDef<ShiftDTO>[]>(() => {
        const base: ColumnDef<ShiftDTO>[] = [
            {
                id: 'name',
                header: 'Shift',
                size: 220,
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="flex items-center gap-2 truncate text-body font-semibold text-foreground">
                            {row.original.name || row.original.code || 'Shift'}
                            {row.original.is_default && (
                                <StatusChip
                                    text="Default"
                                    textSize="text-caption"
                                    status="INFO"
                                    showIcon={false}
                                />
                            )}
                        </span>
                        {row.original.code && (
                            <span className="text-caption text-muted-foreground">
                                {row.original.code}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                id: 'timing',
                header: 'Timing',
                size: 160,
                cell: ({ row }) => (
                    <span className="text-body tabular-nums text-foreground">
                        {formatClockTime(row.original.start_time)} –{' '}
                        {formatClockTime(row.original.end_time)}
                        {row.original.is_night_shift && (
                            <span className="ms-2 text-caption text-muted-foreground">night</span>
                        )}
                    </span>
                ),
            },
            {
                id: 'break',
                header: 'Break',
                size: 100,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-muted-foreground">
                        {row.original.break_duration_min
                            ? `${row.original.break_duration_min} min`
                            : '—'}
                    </span>
                ),
            },
            {
                id: 'grace',
                header: 'Grace',
                size: 100,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-muted-foreground">
                        {row.original.grace_period_min
                            ? `${row.original.grace_period_min} min`
                            : '—'}
                    </span>
                ),
            },
            {
                id: 'thresholds',
                header: 'Full / half day',
                size: 140,
                cell: ({ row }) => (
                    <span className="block text-end text-body tabular-nums text-foreground">
                        {toNumber(row.original.min_hours_full_day) || '—'} /{' '}
                        {toNumber(row.original.min_hours_half_day) || '—'} h
                    </span>
                ),
            },
        ];

        if (isHrAdmin) {
            base.push({
                id: 'actions',
                header: '',
                size: 100,
                cell: ({ row }) => (
                    <div className="flex justify-end">
                        <MyButton
                            type="button"
                            buttonType="text"
                            scale="small"
                            layoutVariant="icon"
                            aria-label={`Edit ${row.original.name ?? 'shift'}`}
                            onClick={() => {
                                setEditing(row.original);
                                setDialogOpen(true);
                            }}
                        >
                            <PencilSimple size={15} />
                        </MyButton>
                    </div>
                ),
            });
        }

        return base;
    }, [isHrAdmin]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-2xl text-body text-muted-foreground">
                    Working hours, breaks and the thresholds that decide whether a day counts as
                    full, half or absent. Employees with no assignment fall on the default shift.
                </p>
                {isHrAdmin && (
                    <div className="flex flex-wrap items-center gap-3">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            disable={rows.length === 0}
                            onClick={() => setAssignOpen(true)}
                        >
                            <UsersThree size={18} /> Assign to employees
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={() => {
                                setEditing(null);
                                setDialogOpen(true);
                            }}
                        >
                            <Plus size={18} /> Add shift
                        </MyButton>
                    </div>
                )}
            </div>

            {query.isLoading ? (
                <HrLoadingRows rows={3} />
            ) : query.isError ? (
                <HrErrorState
                    message="Couldn't load shifts."
                    onRetry={() => void query.refetch()}
                />
            ) : rows.length === 0 ? (
                <HrEmptyState
                    icon={<Clock size={36} className="text-muted-foreground" />}
                    title="No shifts defined yet"
                    description="Add at least one shift and mark it default — until then a check-in has no hours to be measured against."
                >
                    {isHrAdmin && (
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={() => {
                                setEditing(null);
                                setDialogOpen(true);
                            }}
                        >
                            <Plus size={18} /> Add the first shift
                        </MyButton>
                    )}
                </HrEmptyState>
            ) : (
                <MyTable<ShiftDTO>
                    data={{
                        content: rows,
                        total_pages: 1,
                        page_no: 0,
                        page_size: rows.length,
                        total_elements: rows.length,
                        last: true,
                    }}
                    columns={columns}
                    isLoading={false}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            {isHrAdmin && (
                <>
                    <ShiftDialog open={dialogOpen} onOpenChange={setDialogOpen} shift={editing} />
                    <AssignShiftDialog
                        open={assignOpen}
                        onOpenChange={setAssignOpen}
                        shifts={rows}
                    />
                </>
            )}
        </div>
    );
};
