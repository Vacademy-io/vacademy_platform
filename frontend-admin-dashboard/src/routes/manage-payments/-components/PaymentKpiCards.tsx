import { CheckCircle, Clock, HourglassMedium, Receipt, XCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/utils/payment-currency';
import type { PaymentSummary } from '../-utils/paymentSummary';
import { bucketAmountTotal, summarizeBucketAmount } from '../-utils/paymentSummary';

/**
 * The five KPI cards. Four describe payment records; 'due' describes a balance — money a learner
 * owes on their enrolment, which usually has no payment record at all. Keeping them apart is the
 * whole point: an institute can have ₹85,000 due and zero pending transactions.
 */
export type SummaryStatusKey = 'total' | 'paid' | 'due' | 'pending' | 'failed';

/** The cards that map onto an actual payment record, so they can filter the table. */
export type RecordStatusKey = Exclude<SummaryStatusKey, 'due'>;

/**
 * Billing figures from the server: what learners were billed, what they paid, and the difference.
 * When present these drive the Total / Collected / Due cards, because payment records alone cannot
 * see an unpaid balance — see fetchBillingSummary.
 */
export interface KpiBilling {
    totalBilled: number;
    collected: number;
    due: number;
    currency: string;
    /** Live enrolments behind the figures. */
    planCount: number;
    settledPlanCount: number;
}

interface PaymentKpiCardsProps {
    summary: PaymentSummary;
    /** Preferred source for Total / Collected / Due. Falls back to `summary` when absent. */
    billing?: KpiBilling | null;
    /** Accurate total count from the paginated response (across all filtered results). */
    totalCount?: number;
    isLoading?: boolean;
    /** True when the summary was computed from a capped subset of results. */
    truncated?: boolean;
    /** Which card is currently reflected in the active status filter. */
    activeKey?: SummaryStatusKey;
    /** When given, each card acts as a one-click status filter for the table below. */
    onSelect?: (key: SummaryStatusKey) => void;
    className?: string;
}

interface CardDef {
    key: SummaryStatusKey;
    label: string;
    /** Trailing word(s) on the count line, e.g. "980 settled". */
    hint: string;
    /** One line spelling out what the number actually is, so two "pending"s can't be confused. */
    caption: string;
    icon: typeof Receipt;
    iconClass: string;
    barClass: string;
    /** Which summary bucket backs the amount when no server billing figures are available. */
    bucket: 'total' | 'paid' | 'pending' | 'due' | 'failed';
}

/**
 * Total / Collected / Due / Failed — the four numbers an admin actually asks for. "Due" is every
 * record that has not settled (PAYMENT_PENDING, NOT_INITIATED, blank), which is the money still
 * owed to the institute; "Failed" is money that was attempted and bounced, kept separate so a
 * retry-able failure is never mistaken for an unbilled due.
 */
const CARDS: CardDef[] = [
    {
        key: 'total',
        label: 'Total payment',
        hint: 'payments',
        caption: 'Billed to learners',
        icon: Receipt,
        iconClass: 'bg-primary-50 text-primary-500',
        barClass: 'bg-primary-500',
        bucket: 'total',
    },
    {
        key: 'paid',
        label: 'Collected payment',
        hint: 'settled',
        caption: 'Money received',
        icon: CheckCircle,
        iconClass: 'bg-success-50 text-success-600',
        barClass: 'bg-success-500',
        bucket: 'paid',
    },
    {
        key: 'due',
        label: 'Due payment',
        hint: 'awaiting payment',
        caption: 'Balance owed on enrolments',
        icon: HourglassMedium,
        iconClass: 'bg-warning-50 text-warning-600',
        barClass: 'bg-warning-500',
        // 'due', not 'pending': an unfinished payment on a cancelled or terminated enrolment is an
        // abandoned checkout, not money owed. Only this card makes that distinction — "Payment
        // pending" below is about gateway traffic and deliberately still counts them.
        bucket: 'due',
    },
    {
        key: 'pending',
        label: 'Payment pending',
        hint: 'in progress',
        caption: 'Online transactions not completed',
        icon: Clock,
        iconClass: 'bg-info-50 text-info-600',
        barClass: 'bg-info-500',
        bucket: 'pending',
    },
    {
        key: 'failed',
        label: 'Failed payment',
        hint: 'declined',
        caption: 'Online transactions declined',
        icon: XCircle,
        iconClass: 'bg-danger-50 text-danger-600',
        barClass: 'bg-danger-500',
        bucket: 'failed',
    },
];

/**
 * Which billing figure each card shows. Pending and Failed have none by design — they count
 * transactions at the gateway, not what anyone was billed.
 */
const BILLING_AMOUNT: Partial<Record<SummaryStatusKey, (b: KpiBilling) => number>> = {
    total: (b) => b.totalBilled,
    paid: (b) => b.collected,
    due: (b) => b.due,
};

/** Meta line under each headline while billing figures are driving the cards. */
const BILLING_META: Partial<Record<SummaryStatusKey, (b: KpiBilling, count: number) => string>> = {
    total: (b) =>
        `${b.planCount.toLocaleString()} ${b.planCount === 1 ? 'enrolment' : 'enrolments'} billed`,
    paid: (b) => `${b.settledPlanCount.toLocaleString()} fully paid up`,
    due: (b) => {
        const owing = Math.max(0, b.planCount - b.settledPlanCount);
        return `${owing.toLocaleString()} ${owing === 1 ? 'learner' : 'learners'} still owing`;
    },
};

/**
 * The KPI row shown on both Manage Payments and the Payment Dashboard — same buckets, same maths,
 * same wording, so the two screens can never disagree about how much has been collected.
 */
export function PaymentKpiCards({
    summary,
    billing,
    totalCount,
    isLoading,
    truncated,
    activeKey = 'total',
    onSelect,
    className,
}: PaymentKpiCardsProps) {
    const overallCount = totalCount != null ? totalCount : summary.total.count;
    // Share the headline is measured in: money when there is any, otherwise the record count.
    const billedAmount = billing
        ? billing.totalBilled
        : bucketAmountTotal(summary.total.amountByCurrency);
    const shareIsAmount = billedAmount > 0;

    return (
        <div
            className={cn(
                'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
                className
            )}
        >
            {CARDS.map((card) => {
                const bucket = summary[card.bucket];
                const count = card.key === 'total' ? overallCount : bucket.count;
                // Without server figures each card falls back to its own record bucket — for 'due'
                // that is summary.due, the unsettled rows minus the ones on a dead enrolment.
                const amount = summarizeBucketAmount(bucket.amountByCurrency);
                const billed = billing ? BILLING_AMOUNT[card.key]?.(billing) : undefined;
                const truncatedSuffix = card.key === 'total' && truncated && !billing ? '+' : '';
                const amountDisplay =
                    billed != null
                        ? formatMoney(billed, billing?.currency ?? '', { maximumFractionDigits: 0 })
                        : amount.display
                          ? `${amount.display}${truncatedSuffix}`
                          : '—';
                const amountTooltip =
                    billed == null && amount.full ? `Total amount: ${amount.full}` : undefined;
                const shareAmount = billing
                    ? BILLING_AMOUNT[card.key]?.(billing) ??
                      bucketAmountTotal(bucket.amountByCurrency)
                    : bucketAmountTotal(bucket.amountByCurrency);
                const share = shareIsAmount
                    ? Math.round((shareAmount / billedAmount) * 100)
                    : overallCount > 0
                      ? Math.round((bucket.count / overallCount) * 100)
                      : 0;
                const isActive = activeKey === card.key;
                const Icon = card.icon;
                const interactive = Boolean(onSelect);

                const content = (
                    <>
                        <div className="flex items-start justify-between gap-2">
                            <span className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'flex size-7 shrink-0 items-center justify-center rounded-lg',
                                        card.iconClass
                                    )}
                                >
                                    <Icon size={15} weight="duotone" />
                                </span>
                                <span className="text-2xs font-semibold uppercase tracking-wide text-neutral-500">
                                    {card.label}
                                </span>
                            </span>
                            {!isLoading && card.key !== 'total' && (
                                <span
                                    title={
                                        shareIsAmount
                                            ? 'Share of the total amount billed'
                                            : 'Share of the payment count'
                                    }
                                    className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-neutral-500"
                                >
                                    {share}%
                                </span>
                            )}
                        </div>

                        {isLoading ? (
                            <Skeleton className="mt-3 h-7 w-28" />
                        ) : (
                            <div
                                className="mt-3 text-h3 font-bold tabular-nums text-neutral-800"
                                title={amountTooltip}
                            >
                                {amountDisplay}
                            </div>
                        )}

                        <div className="mt-0.5 text-caption text-neutral-500">
                            {isLoading
                                ? ' '
                                : billing && BILLING_META[card.key]
                                  ? BILLING_META[card.key]!(billing, count)
                                  : `${count.toLocaleString()} ${
                                        card.key === 'total' && count === 1 ? 'payment' : card.hint
                                    }`}
                        </div>

                        <div className="mt-0.5 text-2xs text-neutral-400">{card.caption}</div>

                        <div className="mt-3 h-1 overflow-hidden rounded-full bg-neutral-100">
                            <div
                                className={cn('h-full rounded-full transition-all', card.barClass)}
                                style={{
                                    width: `${card.key === 'total' ? 100 : Math.min(100, share)}%`,
                                }}
                            />
                        </div>
                    </>
                );

                const cardClass = cn(
                    'flex flex-col rounded-xl border bg-white p-4 text-left transition-all',
                    isActive && interactive
                        ? 'border-primary-300 shadow-sm ring-1 ring-primary-100'
                        : 'border-neutral-200',
                    interactive && 'cursor-pointer hover:border-neutral-300 hover:shadow-sm'
                );

                if (!interactive) {
                    return (
                        <div key={card.key} className={cardClass}>
                            {content}
                        </div>
                    );
                }

                return (
                    <button
                        key={card.key}
                        type="button"
                        onClick={() => onSelect?.(card.key)}
                        aria-pressed={isActive}
                        className={cardClass}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    );
}
