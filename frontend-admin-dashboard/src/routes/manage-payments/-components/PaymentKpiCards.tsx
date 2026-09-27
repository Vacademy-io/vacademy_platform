import {
    CalendarBlank,
    CheckCircle,
    Clock,
    HourglassMedium,
    Receipt,
    Wallet,
    XCircle,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/utils/payment-currency';
import type { PaymentSummary } from '../-utils/paymentSummary';
import { summarizeBucketAmount } from '../-utils/paymentSummary';

/**
 * Every status the cards and the segmented switch can be set to. Three of them describe payment
 * records (paid / pending / failed, plus 'total' for all of them and 'abandoned' for stale
 * checkouts); 'due' and 'upcoming' describe balances — money a learner with access owes, which
 * usually has no payment record at all. Keeping them apart is the whole point: an institute can
 * have ₹85,000 due and zero pending transactions, or ₹5 lakh of abandoned checkouts and nothing owed.
 */
export type SummaryStatusKey =
    | 'total'
    | 'paid'
    | 'outstanding'
    | 'due'
    | 'upcoming'
    | 'pending'
    | 'abandoned'
    | 'failed';

/** The cards an admin can switch on or off (Total and Abandoned are tabs only). */
export type KpiCardKey = Exclude<SummaryStatusKey, 'total' | 'abandoned'>;

/** The statuses that map onto payment records, so they can filter the table. */
export type RecordStatusKey = Exclude<SummaryStatusKey, 'outstanding' | 'due' | 'upcoming'>;

/**
 * Billing figures from the server: what came in, what learners with access still owe, and what
 * falls due next. Drives the Collected / Due / Upcoming cards — payment records alone cannot see an
 * unpaid balance. See fetchBillingSummary.
 */
export interface KpiBilling {
    collected: number;
    /** Overdue right now. */
    due: number;
    /** Falls due within `upcomingDays`. Expected, not yet owed. */
    upcoming: number;
    upcomingDays: number;
    learnersOwing: number;
    learnersUpcoming: number;
    /** Priced one-time plans an admin activated with no payment recorded — a hygiene hint. */
    activatedWithoutPaymentCount: number;
    /**
     * Everything still to collect on live enrolments, whatever its due date. Due and Upcoming are
     * date slices of it — an institute whose instalments all fall due next quarter has Due and
     * Upcoming at zero and lakhs outstanding.
     */
    outstanding: number;
    learnersOutstanding: number;
    /**
     * Everything expected but not yet owed, whatever the date (every future instalment and
     * invoice, plus renewals within the horizon). Absent on an older server.
     */
    upcomingAll?: number;
    learnersUpcomingAll?: number;
    /** Earliest future due date carrying money, yyyy-MM-dd. */
    nextDueDate?: string | null;
    /**
     * The institute runs instalment plans. Their next instalment is often months out, so the
     * 30-day Upcoming would read ₹0 — Upcoming shows every future instalment instead.
     */
    usesInstallments?: boolean;
    currency: string;
}

/** Upcoming covers every future instalment rather than the next N days. */
const upcomingIsAllFuture = (billing?: KpiBilling | null): boolean =>
    !!billing?.usesInstallments && typeof billing.upcomingAll === 'number';

const formatDueDate = (iso?: string | null): string | null => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Tailwind needs literal class names, so the xl column count is looked up, not interpolated. */
const XL_COLS: Record<number, string> = {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
};

interface PaymentKpiCardsProps {
    summary: PaymentSummary;
    /**
     * Source for Collected / Due / Upcoming. Without it Collected falls back to the paid records
     * and the two balance cards show a dash — there is no honest client-side substitute for them.
     */
    billing?: KpiBilling | null;
    isLoading?: boolean;
    /** Which card is currently reflected in the active status filter. */
    activeKey?: SummaryStatusKey;
    /** When given, each record/balance card acts as a one-click filter for the table below. */
    onSelect?: (key: SummaryStatusKey) => void;
    /** Cards the admin chose to show (see useKpiCardPrefs). Omit for the built-in defaults. */
    visibleKeys?: Set<KpiCardKey>;
    className?: string;
}

interface CardDef {
    key: KpiCardKey;
    label: string;
    /** One line spelling out what the number actually is, so two "pending"s can't be confused. */
    caption: string;
    icon: typeof Receipt;
    iconClass: string;
    accentClass: string;
    /** Balance cards need the server; record cards are computed from the rows on screen. */
    source: 'billing' | 'records';
    /** Which record bucket backs the card when `source` is 'records'. */
    bucket?: 'paid' | 'pending' | 'failed';
}

/**
 * Collected / Outstanding / Due / Upcoming / Pending / Failed.
 *
 * The rule behind Due: a learner owes money only when they have been granted access and an
 * obligation on it is unpaid — an overdue instalment, a lapsed subscription renewal, an unpaid
 * invoice. Pending and Failed are transactions at the gateway, not balances; a stale pending row
 * is an abandoned checkout and is in neither (see the Abandoned segment).
 */
const CARDS: CardDef[] = [
    {
        key: 'paid',
        label: 'Collected',
        caption: 'Money received',
        icon: CheckCircle,
        iconClass: 'bg-success-50 text-success-600',
        accentClass: 'bg-success-500',
        source: 'billing',
        bucket: 'paid',
    },
    {
        key: 'outstanding',
        label: 'Outstanding',
        caption: 'Still to collect — every unpaid instalment & invoice',
        icon: Wallet,
        iconClass: 'bg-neutral-100 text-neutral-700',
        accentClass: 'bg-neutral-500',
        source: 'billing',
    },
    {
        key: 'due',
        label: 'Due',
        caption: 'Overdue on instalments, renewals & invoices',
        icon: HourglassMedium,
        iconClass: 'bg-warning-50 text-warning-600',
        accentClass: 'bg-warning-500',
        source: 'billing',
    },
    {
        key: 'upcoming',
        label: 'Upcoming',
        caption: 'Falls due soon — expected, not yet owed',
        icon: CalendarBlank,
        iconClass: 'bg-primary-50 text-primary-500',
        accentClass: 'bg-primary-500',
        source: 'billing',
    },
    {
        key: 'pending',
        label: 'Payment pending',
        caption: 'Checkouts awaiting the gateway',
        icon: Clock,
        iconClass: 'bg-info-50 text-info-600',
        accentClass: 'bg-info-500',
        source: 'records',
        bucket: 'pending',
    },
    {
        key: 'failed',
        label: 'Failed',
        caption: 'Online transactions declined',
        icon: XCircle,
        iconClass: 'bg-danger-50 text-danger-600',
        accentClass: 'bg-danger-500',
        source: 'records',
        bucket: 'failed',
    },
];

/**
 * Is there money still to collect that is not yet overdue? Only then does Outstanding say
 * something Due does not. A subscription-only institute's outstanding IS its overdue renewals, so
 * the card would just repeat Due — it stays hidden and those screens look exactly as they did.
 */
export const hasNotYetDueBalance = (billing?: KpiBilling | null): boolean =>
    !!billing && billing.outstanding - billing.due > 0.005;

const plural = (n: number, one: string, many: string) =>
    `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * The KPI row shown on both Manage Payments and the Payment Dashboard — same buckets, same maths,
 * same wording, so the two screens can never disagree about how much has been collected.
 */
export function PaymentKpiCards({
    summary,
    billing,
    isLoading,
    activeKey = 'total',
    onSelect,
    visibleKeys,
    className,
}: PaymentKpiCardsProps) {
    const cards = visibleKeys
        ? CARDS.filter((card) => visibleKeys.has(card.key))
        : CARDS.filter((card) => card.key !== 'outstanding' || hasNotYetDueBalance(billing));
    const allFuture = upcomingIsAllFuture(billing);
    if (cards.length === 0) return null;
    const money = (amount: number) =>
        formatMoney(amount, billing?.currency ?? '', { maximumFractionDigits: 0 });

    return (
        <div
            className={cn(
                'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
                XL_COLS[Math.max(cards.length, 3)],
                className
            )}
        >
            {cards.map((card) => {
                const bucket = card.bucket ? summary[card.bucket] : undefined;
                const recordAmount = bucket ? summarizeBucketAmount(bucket.amountByCurrency) : null;

                let amountDisplay = '—';
                let amountTooltip: string | undefined;
                let meta = '';
                let hint: string | undefined;
                let caption = card.caption;

                switch (card.key) {
                    case 'paid':
                        // Prefer the server's figure (it also counts invoice payments); the paid
                        // records are the fallback, never the two summed.
                        amountDisplay = billing
                            ? money(billing.collected)
                            : recordAmount?.display || '—';
                        amountTooltip =
                            !billing && recordAmount?.full
                                ? `Total amount: ${recordAmount.full}`
                                : undefined;
                        meta = plural(bucket?.count ?? 0, 'payment', 'payments');
                        break;
                    case 'outstanding':
                        amountDisplay = billing ? money(billing.outstanding) : '—';
                        meta = billing
                            ? plural(billing.learnersOutstanding, 'learner', 'learners')
                            : 'Needs the billing summary';
                        break;
                    case 'due':
                        amountDisplay = billing ? money(billing.due) : '—';
                        meta = billing
                            ? plural(billing.learnersOwing, 'learner owing', 'learners owing')
                            : 'Needs the billing summary';
                        if (billing && billing.activatedWithoutPaymentCount > 0) {
                            hint = `${plural(
                                billing.activatedWithoutPaymentCount,
                                'plan',
                                'plans'
                            )} activated without a recorded payment`;
                        }
                        break;
                    case 'upcoming':
                        if (billing && allFuture) {
                            const next = formatDueDate(billing.nextDueDate);
                            amountDisplay = money(billing.upcomingAll ?? 0);
                            meta = `${plural(billing.learnersUpcomingAll ?? 0, 'learner', 'learners')}${
                                next ? ` · next due ${next}` : ''
                            }`;
                            caption = 'Future instalments — expected, not yet owed';
                            break;
                        }
                        amountDisplay = billing ? money(billing.upcoming) : '—';
                        meta = billing
                            ? `${plural(billing.learnersUpcoming, 'learner', 'learners')} · next ${
                                  billing.upcomingDays
                              } days`
                            : 'Needs the billing summary';
                        break;
                    case 'pending':
                        amountDisplay = recordAmount?.display || '—';
                        amountTooltip = recordAmount?.full
                            ? `Total amount: ${recordAmount.full}`
                            : undefined;
                        meta = plural(bucket?.count ?? 0, 'in progress', 'in progress');
                        if (summary.abandoned.count > 0) {
                            hint = `${plural(
                                summary.abandoned.count,
                                'abandoned checkout',
                                'abandoned checkouts'
                            )} not counted`;
                        }
                        break;
                    case 'failed':
                        amountDisplay = recordAmount?.display || '—';
                        amountTooltip = recordAmount?.full
                            ? `Total amount: ${recordAmount.full}`
                            : undefined;
                        meta = plural(bucket?.count ?? 0, 'declined', 'declined');
                        break;
                }

                const isActive = activeKey === card.key;
                const Icon = card.icon;
                // The 30-day Upcoming is informational — there is no list behind it. With
                // instalments it opens the learners and their next instalment.
                const interactive = Boolean(onSelect) && (card.key !== 'upcoming' || allFuture);

                const content = (
                    <>
                        <div className="flex items-center gap-2">
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
                            {isLoading ? ' ' : meta}
                        </div>

                        <div className="mt-0.5 text-2xs text-neutral-400">{caption}</div>

                        {!isLoading && hint && (
                            <div className="mt-1 text-2xs font-medium text-warning-600">{hint}</div>
                        )}

                        <div className="mt-auto pt-3">
                            <div className={cn('h-1 w-10 rounded-full', card.accentClass)} />
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
