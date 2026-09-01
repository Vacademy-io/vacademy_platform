import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusChip, type StatusType } from '@/components/design-system/status-chips';
import { Skeleton } from '@/components/ui/skeleton';
import { WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/payment-currency';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import {
    fetchLearnerPlanBreakdown,
    type BillingSummaryRequest,
    type OutstandingLearner,
} from '@/services/payment-logs';

interface DueLearnerDetailSheetProps {
    learner: OutstandingLearner | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The window and course scope the Due row was computed under. */
    filters?: BillingSummaryRequest;
}

const money = (amount: number, currency?: string | null): string =>
    formatMoney(amount, currency || '', { maximumFractionDigits: 0 });

const initialsOf = (name?: string | null): string => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
};

/**
 * How a plan status reads on screen. Anything not listed falls through to the raw status rather
 * than being hidden, so an institute with a status we have not seen still gets a legible row.
 */
const STATUS_META: Record<string, { label: string; chip: StatusType }> = {
    ACTIVE: { label: 'Active', chip: 'SUCCESS' },
    PENDING_FOR_PAYMENT: { label: 'Awaiting payment', chip: 'WARNING' },
    PENDING: { label: 'Pending', chip: 'INFO' },
    CANCELED: { label: 'Cancelled', chip: 'DANGER' },
    CANCELLED: { label: 'Cancelled', chip: 'DANGER' },
    TERMINATED: { label: 'Terminated', chip: 'DANGER' },
    EXPIRED: { label: 'Expired', chip: 'DANGER' },
    DELETED: { label: 'Deleted', chip: 'DANGER' },
    INACTIVE: { label: 'Inactive', chip: 'INFO' },
    PAYMENT_FAILED: { label: 'Payment failed', chip: 'DANGER' },
    INVITED: { label: 'Invited', chip: 'INFO' },
};

const statusMeta = (status?: string | null) =>
    STATUS_META[(status || '').toUpperCase()] ?? {
        label: status || '—',
        chip: 'INFO' as StatusType,
    };

/**
 * Every enrolment behind one learner's Due row.
 *
 * The Due list nets a learner down to a single figure, which left an admin who had just cancelled
 * somebody's plan with no way to check the cancellation was honoured — the row simply stayed, and
 * the "+N more" hint named nothing. This shows the plans themselves: the ones still billed, and
 * the cancelled/expired ones greyed out and explicitly worth ₹0.
 */
export function DueLearnerDetailSheet({
    learner,
    open,
    onOpenChange,
    filters,
}: DueLearnerDetailSheetProps) {
    const courseTerm = getTerminology(ContentTerms.Course, SystemTerms.Course);

    const {
        data: plans,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['learner-plan-breakdown', learner?.user_id, filters],
        queryFn: () => fetchLearnerPlanBreakdown(learner!.user_id, filters),
        // Only ask once the sheet is actually open — the Due list can be 40+ rows deep.
        enabled: open && Boolean(learner?.user_id),
        staleTime: 60_000,
        retry: false,
    });

    const counted = (plans ?? []).filter((plan) => plan.counts_towards_due);
    const excluded = (plans ?? []).filter((plan) => !plan.counts_towards_due);
    const currency = learner?.currency ?? plans?.[0]?.currency ?? '';

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>Balance breakdown</SheetTitle>
                </SheetHeader>

                {learner && (
                    <div className="mt-4 space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-body font-semibold text-primary-600">
                                {initialsOf(learner.full_name)}
                            </span>
                            <div className="min-w-0">
                                <div className="truncate font-semibold text-neutral-700">
                                    {learner.full_name || '—'}
                                </div>
                                <div className="truncate text-caption text-neutral-500">
                                    {learner.email || learner.mobile_number || ''}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-lg border border-neutral-200 p-3">
                            {(
                                [
                                    ['Billed', learner.billed, 'text-neutral-700'],
                                    ['Paid', learner.paid, 'text-success-600'],
                                    ['Due', learner.due, 'text-warning-600'],
                                ] as const
                            ).map(([label, value, tone]) => (
                                <div key={label}>
                                    <div className="text-2xs uppercase tracking-wide text-neutral-500">
                                        {label}
                                    </div>
                                    <div className={cn('text-body font-semibold tabular-nums', tone)}>
                                        {money(value, currency)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {isLoading && (
                            <div className="space-y-2">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        )}

                        {!isLoading && error != null && (
                            <p className="text-caption text-danger-600">
                                Could not load this learner&apos;s enrolments. The totals above are
                                still accurate.
                            </p>
                        )}

                        {!isLoading && error == null && (
                            <>
                                <section className="space-y-2">
                                    <h3 className="text-caption font-semibold text-neutral-600">
                                        Counted towards this balance ({counted.length})
                                    </h3>
                                    {counted.length === 0 ? (
                                        <p className="text-caption text-neutral-500">
                                            No live enrolments.
                                        </p>
                                    ) : (
                                        counted.map((plan) => (
                                            <div
                                                key={plan.user_plan_id}
                                                className="rounded-lg border border-neutral-200 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="min-w-0 font-medium text-neutral-700">
                                                        {plan.course_name || `—`}
                                                    </span>
                                                    <StatusChip
                                                        text={statusMeta(plan.plan_status).label}
                                                        status={statusMeta(plan.plan_status).chip}
                                                        showIcon={false}
                                                    />
                                                </div>
                                                <div className="mt-2 flex items-center gap-4 text-caption tabular-nums text-neutral-600">
                                                    <span>
                                                        Billed {money(plan.billed, plan.currency)}
                                                    </span>
                                                    <span>Paid {money(plan.paid, plan.currency)}</span>
                                                    <span className="font-semibold text-warning-600">
                                                        Due {money(plan.due, plan.currency)}
                                                    </span>
                                                </div>
                                                {plan.payment_type && (
                                                    <div className="mt-1 text-2xs text-neutral-500">
                                                        {plan.payment_type}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </section>

                                {excluded.length > 0 && (
                                    <section className="space-y-2">
                                        <h3 className="flex items-center gap-1.5 text-caption font-semibold text-neutral-600">
                                            <WarningCircle size={14} weight="duotone" />
                                            Not counted ({excluded.length})
                                        </h3>
                                        <p className="text-2xs text-neutral-500">
                                            {`Cancelled, terminated and expired enrolments are shown for reference. They add nothing to the balance, whatever the ${courseTerm.toLowerCase()} originally cost.`}
                                        </p>
                                        {excluded.map((plan) => (
                                            <div
                                                key={plan.user_plan_id}
                                                className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="min-w-0 text-neutral-500 line-through">
                                                        {plan.course_name || '—'}
                                                    </span>
                                                    <StatusChip
                                                        text={statusMeta(plan.plan_status).label}
                                                        status={statusMeta(plan.plan_status).chip}
                                                        showIcon={false}
                                                    />
                                                </div>
                                                <div className="mt-2 flex items-center gap-4 text-caption tabular-nums text-neutral-500">
                                                    <span className="line-through">
                                                        {money(plan.billed, plan.currency)}
                                                    </span>
                                                    <span className="font-semibold text-neutral-600">
                                                        Due {money(0, plan.currency)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
