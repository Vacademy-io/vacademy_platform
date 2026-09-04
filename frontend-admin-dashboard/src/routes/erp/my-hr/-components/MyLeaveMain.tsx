import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Info } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
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
import type { LeaveApplicationDTO } from '@/routes/erp/-shared/hr-types';
import {
    formatDays,
    humanizeToken,
    recentLeaveYears,
} from '@/routes/erp/leave/-components/leave-meta';
import {
    HrEmptyState,
    HrErrorState,
    HrLoadingRows,
} from '@/routes/erp/people/-components/HrStates';
import {
    useCancelMyLeave,
    useMyCompOffs,
    useMyHrIdentity,
    useMyLeaveApplications,
    useMyLeaveBalances,
} from '@/routes/erp/my-hr/-hooks/use-my-hr';
import { ApplyLeaveDialog } from './ApplyLeaveDialog';
import { MyHrLoadingCards, MyHrNoProfileState, MyHrStatusChip } from './my-hr-shared';

/** The statuses an employee may still withdraw — anything else is already settled. */
const CANCELLABLE = new Set(['PENDING', 'APPROVED']);

/**
 * The employee's own leave: what is left, what they have asked for, what they
 * have earned back as comp-off.
 *
 * Balance first and applications second, because the question that brings anyone
 * here is "can I take Friday off" — the list of past applications is the
 * follow-up, not the headline.
 */
export const MyLeaveMain = () => {
    const { employeeId, isProfileLoading, hasNoProfile } = useMyHrIdentity();
    const [year, setYear] = useState<number>(() => new Date().getFullYear());
    const [applyOpen, setApplyOpen] = useState(false);
    const [pendingCancel, setPendingCancel] = useState<LeaveApplicationDTO | null>(null);

    const balancesQuery = useMyLeaveBalances(employeeId, year);
    const applicationsQuery = useMyLeaveApplications(employeeId);
    const compOffsQuery = useMyCompOffs(employeeId);
    const cancelMutation = useCancelMyLeave();

    const balances = useMemo(
        () =>
            [...(balancesQuery.data ?? [])].sort((a, b) =>
                (a.leave_type_name ?? '').localeCompare(b.leave_type_name ?? '')
            ),
        [balancesQuery.data]
    );

    const applications = useMemo(
        () =>
            [...(applicationsQuery.data ?? [])].sort((a, b) =>
                (b.from_date ?? '').localeCompare(a.from_date ?? '')
            ),
        [applicationsQuery.data]
    );

    const compOffs = useMemo(
        () =>
            [...(compOffsQuery.data ?? [])].sort((a, b) =>
                (b.worked_on_date ?? '').localeCompare(a.worked_on_date ?? '')
            ),
        [compOffsQuery.data]
    );

    const confirmCancel = async () => {
        if (!pendingCancel?.id) return;
        try {
            await cancelMutation.mutateAsync(pendingCancel.id);
            toast.success('Leave withdrawn');
            setPendingCancel(null);
        } catch (error) {
            // A cancellation the backend refuses (payroll has locked the month)
            // needs its own sentence, and the dialog is already closing — a toast
            // is the right place for this one.
            reportApiError(error, {
                feature: 'erp-my-hr',
                tags: { action: 'cancel-my-leave' },
                fallbackMessage: 'Could not withdraw this leave.',
                toastDuration: 8000,
            });
            setPendingCancel(null);
        }
    };

    if (isProfileLoading) return <HrLoadingRows rows={4} />;
    if (hasNoProfile) return <MyHrNoProfileState />;

    return (
        <div className="flex flex-col gap-6">
            <p className="max-w-3xl text-body text-muted-foreground">
                Your leave balance, the applications you have sent, and any comp-off you have
                earned. Days only leave your balance once an application is approved.
            </p>

            <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-title text-foreground">Balance</h2>
                        <MyDropdown
                            currentValue={String(year)}
                            dropdownList={recentLeaveYears().map(String)}
                            handleChange={(value) => setYear(Number(value))}
                        />
                    </div>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        type="button"
                        onClick={() => setApplyOpen(true)}
                    >
                        <CalendarPlus size={16} /> Apply for leave
                    </MyButton>
                </div>

                {balancesQuery.isLoading ? (
                    <MyHrLoadingCards />
                ) : balancesQuery.isError ? (
                    <HrErrorState
                        message="Couldn't load your leave balance."
                        onRetry={() => void balancesQuery.refetch()}
                    />
                ) : balances.length === 0 ? (
                    <HrEmptyState
                        title={`No leave balance for ${year}`}
                        description="Balances appear once your HR team has a leave policy running for your employment type. You can still apply — the balance is checked when it's approved."
                    />
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {balances.map((balance) => (
                            <Card
                                key={balance.id ?? balance.leave_type_id}
                                className="flex flex-col gap-1 p-4"
                            >
                                <span className="text-caption text-muted-foreground">
                                    {balance.leave_type_name || 'Leave'}
                                </span>
                                <span className="text-h3 font-semibold tabular-nums text-foreground">
                                    {formatDays(balance.closing_balance)}
                                </span>
                                <span className="text-caption text-muted-foreground">
                                    days left · {formatDays(balance.used)} used this year
                                </span>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-title text-foreground">My applications</h2>
                {applicationsQuery.isLoading ? (
                    <HrLoadingRows rows={3} />
                ) : applicationsQuery.isError ? (
                    <HrErrorState
                        message="Couldn't load your leave applications."
                        onRetry={() => void applicationsQuery.refetch()}
                    />
                ) : applications.length === 0 ? (
                    <HrEmptyState
                        title="You haven't applied for any leave"
                        description="Everything you apply for shows up here with its status, and stays until it is approved, rejected or withdrawn."
                    >
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            type="button"
                            onClick={() => setApplyOpen(true)}
                        >
                            Apply for leave
                        </MyButton>
                    </HrEmptyState>
                ) : (
                    <div className="flex flex-col gap-2">
                        {applications.map((application) => {
                            const status = (application.status ?? '').toUpperCase();
                            return (
                                <Card
                                    key={application.id}
                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-subtitle font-medium text-foreground">
                                                {application.leave_type_name || 'Leave'}
                                            </span>
                                            <MyHrStatusChip status={application.status} />
                                        </div>
                                        <span className="text-body text-muted-foreground">
                                            {application.from_date
                                                ? `${formatDate(application.from_date)} → ${formatDate(
                                                      application.to_date || application.from_date
                                                  )}`
                                                : '—'}
                                            {' · '}
                                            {formatDays(application.total_days)} day(s)
                                            {application.is_half_day
                                                ? ` · half day${
                                                      application.half_day_type
                                                          ? ` (${humanizeToken(application.half_day_type)})`
                                                          : ''
                                                  }`
                                                : ''}
                                        </span>
                                        {application.reason && (
                                            <span className="text-caption text-muted-foreground">
                                                You wrote: {application.reason}
                                            </span>
                                        )}
                                        {application.rejection_reason && (
                                            <span className="text-caption text-danger-600">
                                                Turned down: {application.rejection_reason}
                                            </span>
                                        )}
                                    </div>
                                    {CANCELLABLE.has(status) && (
                                        <MyButton
                                            buttonType="secondary"
                                            scale="small"
                                            type="button"
                                            className="w-full sm:w-auto"
                                            onClick={() => setPendingCancel(application)}
                                        >
                                            Withdraw
                                        </MyButton>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-title text-foreground">My comp-off</h2>
                <p className="max-w-3xl text-body text-muted-foreground">
                    Days you worked when you did not have to. Once approved they are added to your
                    comp-off balance and expire on the date shown, whether or not you use them.
                </p>
                {compOffsQuery.isLoading ? (
                    <HrLoadingRows rows={2} />
                ) : compOffsQuery.isError ? (
                    <HrErrorState
                        message="Couldn't load your comp-off."
                        onRetry={() => void compOffsQuery.refetch()}
                    />
                ) : compOffs.length === 0 ? (
                    <HrEmptyState
                        title="No comp-off recorded"
                        description="If you work a holiday or a weekly off, your HR team records it here and it becomes leave you can take later."
                    />
                ) : (
                    <div className="flex flex-col gap-2">
                        {compOffs.map((compOff) => (
                            <Card
                                key={compOff.id}
                                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="text-body text-foreground">
                                        Worked{' '}
                                        {compOff.worked_on_date
                                            ? formatDate(compOff.worked_on_date)
                                            : '—'}
                                        {' · '}
                                        {formatDays(compOff.earned_days)} day(s) earned
                                    </span>
                                    <span className="text-caption text-muted-foreground">
                                        {compOff.expiry_date
                                            ? `Expires ${formatDate(compOff.expiry_date)}`
                                            : 'No expiry recorded'}
                                        {compOff.used ? ' · already used' : ''}
                                    </span>
                                </div>
                                <MyHrStatusChip status={compOff.status} />
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            <p className="flex items-start gap-2 text-caption text-muted-foreground">
                <Info size={14} className="mt-0.5 shrink-0" />
                Withdrawing an approved leave puts the days back in your balance and clears the
                on-leave days from your attendance. If payroll has already closed that month, it
                cannot be withdrawn and you will be told so.
            </p>

            {employeeId && (
                <ApplyLeaveDialog
                    open={applyOpen}
                    onOpenChange={setApplyOpen}
                    employeeId={employeeId}
                    balances={balances}
                />
            )}

            <AlertDialog
                open={!!pendingCancel}
                onOpenChange={(open) => !open && setPendingCancel(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Withdraw this leave?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingCancel
                                ? `Your ${pendingCancel.leave_type_name || 'leave'} from ${
                                      pendingCancel.from_date
                                          ? formatDate(pendingCancel.from_date)
                                          : 'that date'
                                  } will be withdrawn. If it was already approved, the days go back into your balance.`
                                : ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void confirmCancel()}>
                            Withdraw
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
