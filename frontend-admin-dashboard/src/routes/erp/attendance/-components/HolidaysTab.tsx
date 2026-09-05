import { useMemo, useState } from 'react';
import { CalendarX, ListPlus, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { StatusChip } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
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
import { formatDate } from '@/lib/formatters';
import { reportApiError } from '@/lib/report-api-error';
import { humanizeToken } from '@/routes/erp/people/-components/EmployeeFields';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
} from '@/routes/erp/people/-components/HrStates';
import type { HolidayDTO } from '@/routes/erp/-shared/hr-types';
import { useDeleteHoliday, useHolidays } from '../-hooks/use-attendance';
import { monthOf } from './attendance-meta';
import { BulkHolidaysDialog } from './BulkHolidaysDialog';
import { HolidayDialog } from './HolidayDialog';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

/** The years worth offering: last year (still being corrected) through next year (being planned). */
const selectableYears = (): number[] => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
};

/**
 * The institute's holiday calendar for one year.
 *
 * Grouped by month rather than listed flat: a holiday calendar is read to answer
 * "what's closed in March", and a 20-row flat list makes that a scan. Attendance
 * marks these days HOLIDAY automatically, which is why they are configured here
 * and not marked by hand on the daily board.
 */
export const HolidaysTab = ({ isHrAdmin }: { isHrAdmin: boolean }) => {
    const [year, setYear] = useState<number>(() => new Date().getFullYear());
    const [editing, setEditing] = useState<HolidayDTO | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<HolidayDTO | null>(null);

    const query = useHolidays(year);
    const deleteMutation = useDeleteHoliday(year);

    const grouped = useMemo(() => {
        const buckets = new Map<number, HolidayDTO[]>();
        (query.data ?? []).forEach((holiday) => {
            const { month } = monthOf(holiday.date ?? '');
            const list = buckets.get(month) ?? [];
            list.push(holiday);
            buckets.set(month, list);
        });
        return Array.from(buckets.entries())
            .sort(([a], [b]) => a - b)
            .map(([month, holidays]) => ({
                month,
                holidays: holidays
                    .slice()
                    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
            }));
    }, [query.data]);

    const total = query.data?.length ?? 0;

    const confirmDelete = async () => {
        if (!pendingDelete?.id) return;
        try {
            await deleteMutation.mutateAsync(pendingDelete.id);
            toast.success('Holiday removed');
            setPendingDelete(null);
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-attendance',
                tags: { action: 'delete-holiday' },
                fallbackMessage: 'Could not remove the holiday.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-2xl text-body text-muted-foreground">
                    Days the institute is closed. Attendance marks these HOLIDAY on its own, so a
                    day missing from this calendar counts as a working day nobody turned up for.
                </p>
                {isHrAdmin && (
                    <div className="flex flex-wrap items-center gap-3">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setBulkOpen(true)}
                        >
                            <ListPlus size={18} /> Add several
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
                            <Plus size={18} /> Add holiday
                        </MyButton>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="w-32">
                    <MyDropdown
                        currentValue={String(year)}
                        dropdownList={selectableYears().map((option) => String(option))}
                        handleChange={(value) => setYear(Number(value))}
                    />
                </div>
                <span className="text-caption text-muted-foreground">
                    {total} {total === 1 ? 'holiday' : 'holidays'} in {year}
                </span>
            </div>

            {query.isLoading ? (
                <HrLoadingRows rows={3} />
            ) : query.isError ? (
                <HrErrorState
                    message="Couldn't load the holiday calendar."
                    onRetry={() => void query.refetch()}
                />
            ) : grouped.length === 0 ? (
                <HrEmptyState
                    icon={<CalendarX size={36} className="text-muted-foreground" />}
                    title={`No holidays set for ${year}`}
                    description="Publish the year's calendar here — attendance and payroll both read it."
                >
                    {isHrAdmin && (
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={() => setBulkOpen(true)}
                        >
                            <ListPlus size={18} /> Add the year&apos;s holidays
                        </MyButton>
                    )}
                </HrEmptyState>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {grouped.map((group) => (
                        <Card key={group.month} className="flex flex-col gap-3 p-4">
                            <h3 className="text-subtitle font-medium text-foreground">
                                {MONTH_NAMES[group.month - 1] ?? `Month ${group.month}`}
                            </h3>
                            <ul className="flex flex-col gap-3">
                                {group.holidays.map((holiday) => (
                                    <li
                                        key={holiday.id ?? `${holiday.date}-${holiday.name}`}
                                        className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                                    >
                                        <div className="flex min-w-0 flex-col gap-1">
                                            <span className="truncate text-body font-semibold text-foreground">
                                                {holiday.name || 'Holiday'}
                                            </span>
                                            <span className="text-caption text-muted-foreground">
                                                {holiday.date ? formatDate(holiday.date) : '—'}
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {holiday.type && (
                                                    <StatusChip
                                                        text={humanizeToken(holiday.type)}
                                                        textSize="text-caption"
                                                        status="INFO"
                                                        showIcon={false}
                                                    />
                                                )}
                                                {holiday.is_optional && (
                                                    <StatusChip
                                                        text="Optional"
                                                        textSize="text-caption"
                                                        status="WARNING"
                                                        showIcon={false}
                                                    />
                                                )}
                                            </div>
                                            {holiday.description && (
                                                <span className="text-caption text-muted-foreground">
                                                    {holiday.description}
                                                </span>
                                            )}
                                        </div>
                                        {isHrAdmin && (
                                            <div className="flex shrink-0 items-center gap-1">
                                                <MyButton
                                                    type="button"
                                                    buttonType="text"
                                                    scale="small"
                                                    layoutVariant="icon"
                                                    aria-label={`Edit ${holiday.name ?? 'holiday'}`}
                                                    onClick={() => {
                                                        setEditing(holiday);
                                                        setDialogOpen(true);
                                                    }}
                                                >
                                                    <PencilSimple size={15} />
                                                </MyButton>
                                                <MyButton
                                                    type="button"
                                                    buttonType="text"
                                                    scale="small"
                                                    layoutVariant="icon"
                                                    aria-label={`Remove ${holiday.name ?? 'holiday'}`}
                                                    onClick={() => setPendingDelete(holiday)}
                                                >
                                                    <Trash size={15} className="text-danger-600" />
                                                </MyButton>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    ))}
                </div>
            )}

            {isHrAdmin && (
                <>
                    <HolidayDialog
                        open={dialogOpen}
                        onOpenChange={setDialogOpen}
                        holiday={editing}
                        year={year}
                    />
                    <BulkHolidaysDialog open={bulkOpen} onOpenChange={setBulkOpen} year={year} />
                    <AlertDialog
                        open={!!pendingDelete}
                        onOpenChange={(open) => !open && setPendingDelete(null)}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Remove this holiday?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {pendingDelete
                                        ? `${pendingDelete.name ?? 'This holiday'} on ${
                                              pendingDelete.date
                                                  ? formatDate(pendingDelete.date)
                                                  : 'an unknown date'
                                          } becomes an ordinary working day. Attendance already recorded for it is not changed.`
                                        : ''}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void confirmDelete()}>
                                    Remove
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    );
};
