import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { CalendarCheck, Sparkle, Calculator } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MoneyCell } from '@/components/design-system/money-cell';
import {
    MonthPicker,
    formatMonthValue,
    previousMonthValue,
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
import { Card } from '@/components/ui/card';
import { useHrRole } from '@/hooks/use-hr-role';
import { cn } from '@/lib/utils';
import { reportApiError } from '@/lib/report-api-error';
import type { TeachingEmployeeSummaryDTO, TeachingPayLineDTO } from '@/routes/erp/-shared/hr-types';
import { HrEmptyState, HrErrorState } from '@/routes/erp/people/-components/HrStates';
import {
    useMaterializeTeachingPay,
    useSyncTeachingAttendance,
    useTeachingPayPreview,
    useTeachingSummary,
} from '../-hooks/use-teaching-pay';
import {
    NoProfileNote,
    UnratedNote,
    VariablePayStat,
    formatCount,
    formatHours,
} from './variable-pay-shared';

/**
 * Variable Pay → Teaching Pay.
 *
 * Turns hosted live sessions into money in three deliberate steps rather than one
 * button: look at the month, sync the teaching days into HR attendance, then price
 * them. They are separate because each one answers a different question and the
 * middle one writes attendance records that payroll (and leave) also read.
 *
 * Nothing here pays anyone. Materializing writes TEACHING_PAY adjustments, which
 * sit on the Adjustments tab until a regular payroll run for that month consumes
 * them — the same lifecycle as a manually entered adjustment.
 */

/** A teacher's month with their priced line attached, once a preview has been run. */
interface TeachingRow {
    key: string;
    employee_id?: string;
    employee_name?: string;
    employee_code?: string;
    no_employee_profile: boolean;
    sessions_scheduled?: number;
    sessions_with_attendance?: number;
    total_taught_minutes?: number;
    pay?: TeachingPayLineDTO;
}

/** userId is the only id every teacher has — one without an HR profile has no employeeId. */
const rowKeyOf = (row: { user_id?: string; employee_id?: string }) =>
    row.user_id || row.employee_id || '';

/**
 * Summary rows joined to pay lines.
 *
 * Both endpoints derive from the same month of teaching, so this is normally a
 * clean one-to-one join; it still merges over the union of the two lists, because
 * a priced teacher who somehow has no summary row is exactly the case where
 * dropping the row would hide money from the person checking it.
 */
function mergeTeachingRows(
    teachers: TeachingEmployeeSummaryDTO[] | undefined,
    lines: TeachingPayLineDTO[] | undefined
): TeachingRow[] {
    const byKey = new Map<string, TeachingRow>();

    for (const teacher of teachers ?? []) {
        const key = rowKeyOf(teacher);
        if (!key) continue;
        byKey.set(key, {
            key,
            employee_id: teacher.employee_id,
            employee_name: teacher.employee_name,
            employee_code: teacher.employee_code,
            no_employee_profile: teacher.no_employee_profile === true,
            sessions_scheduled: teacher.sessions_scheduled,
            sessions_with_attendance: teacher.sessions_with_attendance,
            total_taught_minutes: teacher.total_taught_minutes,
        });
    }

    for (const line of lines ?? []) {
        const key = rowKeyOf(line);
        if (!key) continue;
        const existing = byKey.get(key);
        if (existing) {
            existing.pay = line;
            continue;
        }
        byKey.set(key, {
            key,
            employee_id: line.employee_id,
            employee_name: line.employee_name,
            employee_code: line.employee_code,
            no_employee_profile: (line.status ?? '') === 'NO_EMPLOYEE_PROFILE',
            sessions_with_attendance: line.sessions_with_attendance,
            total_taught_minutes: line.taught_minutes,
            pay: line,
        });
    }

    return [...byKey.values()];
}

const PAY_STATUS_LABEL: Record<string, { text: string; status: 'SUCCESS' | 'INFO' | 'WARNING' }> = {
    ELIGIBLE: { text: 'Will be created', status: 'INFO' },
    CREATED: { text: 'Adjustment created', status: 'SUCCESS' },
    SKIPPED_EXISTING: { text: 'Already created', status: 'SUCCESS' },
    UNRATED: { text: 'No rate', status: 'WARNING' },
    ZERO_QUANTITY: { text: 'Nothing taught', status: 'INFO' },
    NO_EMPLOYEE_PROFILE: { text: 'No HR profile', status: 'WARNING' },
};

const BASIS_LABEL: Record<string, string> = {
    PER_SESSION: 'per session',
    PER_HOUR: 'per hour',
};

export const TeachingPayTab = () => {
    const { isHrAdmin } = useHrRole();
    const [month, setMonth] = useState<MonthValue>(() => previousMonthValue());
    const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

    const summaryQuery = useTeachingSummary(month, true);
    const previewQuery = useTeachingPayPreview(month);
    const syncMutation = useSyncTeachingAttendance(month);
    const materializeMutation = useMaterializeTeachingPay(month);

    const pay = previewQuery.data;
    const hasPreview = !!pay;

    const rows = useMemo(
        () => mergeTeachingRows(summaryQuery.data?.teachers, pay?.lines),
        [summaryQuery.data, pay]
    );

    const runPreview = async () => {
        const result = await previewQuery.refetch();
        if (result.error) {
            reportApiError(result.error, {
                feature: 'erp-teaching',
                tags: { action: 'pay-preview' },
                fallbackMessage: 'Could not compute teaching pay for this month.',
            });
            return;
        }
        const unrated = result.data?.unrated_count ?? 0;
        toast.success(
            `Priced ${formatCount(result.data?.eligible_count)} teacher(s) for ${formatMonthValue(month)}` +
                (unrated ? ` · ${unrated} skipped for having no rate` : '')
        );
    };

    const handleSync = async () => {
        try {
            const result = await syncMutation.mutateAsync();
            const withoutProfile = result.teachers_without_profile?.length ?? 0;
            toast.success(
                `Attendance synced for ${formatMonthValue(month)} — ${result.created ?? 0} created, ` +
                    `${result.updated ?? 0} updated, ${result.skipped ?? 0} left as they were` +
                    (withoutProfile
                        ? ` · ${withoutProfile} teacher(s) skipped for having no HR profile`
                        : '')
            );
            setSyncConfirmOpen(false);
        } catch (error) {
            // A payroll-locked month is refused here, and the server's message names
            // the run that locked it — far more useful than anything written here,
            // so it is shown verbatim and this fallback only covers a dead network.
            reportApiError(error, {
                feature: 'erp-teaching',
                tags: { action: 'attendance-sync' },
                fallbackMessage: 'Could not sync teaching attendance for this month.',
            });
            setSyncConfirmOpen(false);
        }
    };

    const handleMaterialize = async () => {
        try {
            const result = await materializeMutation.mutateAsync();
            const skipped = result.skipped_existing_count ?? 0;
            const unrated = result.unrated_count ?? 0;
            toast.success(
                `${result.created_count ?? 0} teaching pay adjustment(s) created for ${formatMonthValue(month)}` +
                    (skipped ? ` · ${skipped} already existed` : '') +
                    (unrated ? ` · ${unrated} skipped for having no rate` : '')
            );
            // Invalidation alone would not refresh a query that never auto-runs, and
            // the statuses in the table have just changed from "will be created" to
            // "created" — refetch so the table agrees with what was written.
            await previewQuery.refetch();
        } catch (error) {
            reportApiError(error, {
                feature: 'erp-teaching',
                tags: { action: 'pay-materialize' },
                fallbackMessage: 'Could not create the teaching pay adjustments.',
            });
        }
    };

    const columns = useMemo<ColumnDef<TeachingRow>[]>(() => {
        const base: ColumnDef<TeachingRow>[] = [
            {
                id: 'teacher',
                header: 'Teacher',
                cell: ({ row }) => {
                    const r = row.original;
                    const isUnrated = (r.pay?.status ?? '') === 'UNRATED';
                    return (
                        <div className="flex flex-col gap-0.5">
                            <span
                                className={cn(
                                    'text-body',
                                    r.no_employee_profile ? 'text-neutral-400' : 'text-neutral-700'
                                )}
                            >
                                {r.employee_name || r.employee_code || r.key || '—'}
                            </span>
                            {r.no_employee_profile && <NoProfileNote />}
                            {!r.no_employee_profile && isUnrated && <UnratedNote />}
                        </div>
                    );
                },
            },
            {
                id: 'sessions_scheduled',
                header: 'Sessions scheduled',
                cell: ({ row }) => (
                    <span
                        className={cn(
                            'block text-end tabular-nums',
                            row.original.no_employee_profile
                                ? 'text-neutral-400'
                                : 'text-neutral-600'
                        )}
                    >
                        {formatCount(row.original.sessions_scheduled)}
                    </span>
                ),
            },
            {
                id: 'sessions_attended',
                header: 'Sessions attended',
                cell: ({ row }) => (
                    <span
                        className={cn(
                            'block text-end tabular-nums',
                            row.original.no_employee_profile
                                ? 'text-neutral-400'
                                : 'text-neutral-600'
                        )}
                    >
                        {formatCount(row.original.sessions_with_attendance)}
                    </span>
                ),
            },
            {
                id: 'taught_hours',
                header: 'Taught hours',
                cell: ({ row }) => (
                    <span
                        className={cn(
                            'block text-end tabular-nums',
                            row.original.no_employee_profile
                                ? 'text-neutral-400'
                                : 'text-neutral-600'
                        )}
                    >
                        {formatHours(row.original.total_taught_minutes)}
                    </span>
                ),
            },
        ];

        // Rate and amount only exist once a preview has been run — showing empty
        // columns beforehand would read as "this teacher earns nothing".
        if (!hasPreview) return base;

        return [
            ...base,
            {
                id: 'rate',
                header: 'Rate',
                cell: ({ row }) => {
                    const line = row.original.pay;
                    if (!line?.basis) {
                        return <span className="block text-end text-neutral-300">—</span>;
                    }
                    return (
                        <span className="flex flex-col items-end">
                            <MoneyCell value={line.rate ?? null} />
                            <span className="text-caption text-neutral-500">
                                {BASIS_LABEL[line.basis] ?? line.basis}
                            </span>
                        </span>
                    );
                },
            },
            {
                id: 'amount',
                header: 'Pay',
                cell: ({ row }) => (
                    <MoneyCell value={row.original.pay?.amount ?? null} dashOnZero />
                ),
            },
            {
                id: 'pay_status',
                header: 'Status',
                cell: ({ row }) => {
                    const status = row.original.pay?.status;
                    if (!status) return <span className="text-caption text-neutral-400">—</span>;
                    const meta = PAY_STATUS_LABEL[status];
                    return (
                        <StatusChip
                            text={meta?.text ?? status}
                            textSize="text-caption"
                            status={meta?.status ?? 'INFO'}
                            showIcon={false}
                        />
                    );
                },
            },
        ];
    }, [hasPreview]);

    const tableData: TableData<TeachingRow> = {
        content: rows,
        total_pages: 1,
        page_no: 0,
        page_size: rows.length,
        total_elements: rows.length,
        last: true,
    };

    const eligibleCount = pay?.eligible_count ?? 0;

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-body text-neutral-600">
                What each teacher actually taught this month, and what that is worth. Pay is priced
                from a per-session or per-hour rate on the employee record; materializing it writes
                a TEACHING_PAY adjustment that the next regular payroll run for the month picks up
                and pays. Nothing here pays anyone on its own.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <MonthPicker
                    label="Teaching month"
                    value={month}
                    onChange={setMonth}
                    disableFuture
                />
                {isHrAdmin && (
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => setSyncConfirmOpen(true)}
                    >
                        <CalendarCheck size={16} />
                        Sync attendance
                    </MyButton>
                )}
            </div>

            <Card className="flex flex-wrap items-end justify-between gap-3 p-4">
                <div className="flex flex-col gap-1">
                    <span className="text-subtitle font-medium text-neutral-700">
                        Teaching pay for {formatMonthValue(month)}
                    </span>
                    <span className="max-w-xl text-caption text-neutral-500">
                        Preview prices every attended session against the teacher&apos;s rate
                        without writing anything. Materialize creates one TEACHING_PAY adjustment
                        per rated teacher, and running it twice for the same month is safe — the
                        second run creates nothing.
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onAsyncClick={runPreview}
                        loadingText="Computing…"
                    >
                        <Calculator size={16} />
                        {hasPreview ? 'Recompute preview' : 'Preview pay'}
                    </MyButton>
                    {isHrAdmin && (
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onAsyncClick={handleMaterialize}
                            loadingText="Creating…"
                            disabled={!hasPreview || eligibleCount === 0}
                        >
                            <Sparkle size={16} />
                            Materialize pay
                        </MyButton>
                    )}
                </div>
            </Card>

            {hasPreview && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <VariablePayStat label="Teachers priced" value={pay?.eligible_count ?? 0} />
                    <VariablePayStat label="Total teaching pay" value={pay?.total_amount} isMoney />
                    <VariablePayStat label="No rate set" value={pay?.unrated_count ?? 0} />
                    <VariablePayStat
                        label="Already materialized"
                        value={pay?.skipped_existing_count ?? 0}
                    />
                </div>
            )}

            {summaryQuery.isError ? (
                <HrErrorState
                    message="Could not load teaching activity for this month."
                    onRetry={() => void summaryQuery.refetch()}
                />
            ) : !summaryQuery.isLoading && rows.length === 0 ? (
                <HrEmptyState
                    title="Nobody taught this month"
                    description={`No live sessions were hosted in ${formatMonthValue(month)}, so there is nothing to pay for. Pick another month if you were expecting classes here.`}
                />
            ) : (
                <MyTable<TeachingRow>
                    data={tableData}
                    columns={columns}
                    isLoading={summaryQuery.isLoading}
                    error={null}
                    currentPage={0}
                    scrollable
                />
            )}

            <AlertDialog
                open={syncConfirmOpen}
                onOpenChange={(next) => {
                    if (!syncMutation.isPending) setSyncConfirmOpen(next);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Mark teaching days as present in {formatMonthValue(month)}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Every day a teacher has a session with an attendance log gets a PRESENT
                            attendance record. Days already marked present or on leave are left
                            exactly as they are, and teachers with no HR profile are skipped. If
                            payroll for this month is already locked, the sync will be refused and
                            you will see the reason.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                void handleSync();
                            }}
                        >
                            {syncMutation.isPending ? 'Syncing…' : 'Sync attendance'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
