import { cn } from '@/lib/utils';
import type { PaymentSummary } from '../-utils/paymentSummary';
import { summarizeBucketAmount } from '../-utils/paymentSummary';

/** The status value each KPI card filters the table down to (total = clear the status filter). */
export type SummaryStatusKey = 'total' | 'paid' | 'pending' | 'failed';

interface PaymentSummaryCardsProps {
    summary: PaymentSummary;
    /** Accurate total count from the paginated response (across all filtered results). */
    totalCount?: number;
    isLoading?: boolean;
    /** True when the summary was computed from a capped subset of results. */
    truncated?: boolean;
    /** Which card is currently reflected in the active status filter. */
    activeKey?: SummaryStatusKey;
    /** Clicking a card toggles the matching status filter. */
    onSelect?: (key: SummaryStatusKey) => void;
}

const CARDS: { key: SummaryStatusKey; label: string; dot: string }[] = [
    { key: 'total', label: 'Total', dot: 'bg-primary-500' },
    { key: 'paid', label: 'Collected', dot: 'bg-success-500' },
    { key: 'pending', label: 'Pending', dot: 'bg-warning-500' },
    { key: 'failed', label: 'Failed', dot: 'bg-danger-500' },
];

/**
 * The four KPI tiles — one joined, hairline-separated card (matching the redesign). Each shows the
 * total amount collected in that bucket as the headline and the payment count as the meta line, and
 * acts as a one-click status filter for the table below.
 */
export function PaymentSummaryCards({
    summary,
    totalCount,
    isLoading,
    truncated,
    activeKey = 'total',
    onSelect,
}: PaymentSummaryCardsProps) {
    return (
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-4 sm:gap-px">
            {CARDS.map((card) => {
                const bucket = summary[card.key];
                const count =
                    card.key === 'total' && totalCount != null ? totalCount : bucket.count;
                const amount = summarizeBucketAmount(bucket.amountByCurrency);
                const truncatedSuffix = card.key === 'total' && truncated ? '+' : '';
                const amountDisplay = amount.display ? `${amount.display}${truncatedSuffix}` : '—';
                const amountTooltip = amount.full ? `Total amount: ${amount.full}` : undefined;
                const isActive = activeKey === card.key;
                return (
                    <button
                        key={card.key}
                        type="button"
                        onClick={onSelect ? () => onSelect(card.key) : undefined}
                        aria-pressed={isActive}
                        title={amountTooltip}
                        className={cn(
                            'flex flex-col gap-1 px-4 py-3.5 text-left transition-colors',
                            isActive ? 'bg-neutral-50' : 'bg-white',
                            onSelect && 'cursor-pointer hover:bg-neutral-50'
                        )}
                    >
                        <span className="flex items-center gap-1.5">
                            <span className={cn('size-1.5 rounded-full', card.dot)} />
                            <span className="text-2xs font-semibold uppercase tracking-wide text-neutral-500">
                                {card.label}
                            </span>
                        </span>
                        <span className="text-xl font-bold tabular-nums text-neutral-800">
                            {isLoading ? '—' : amountDisplay}
                        </span>
                        <span className="text-caption text-neutral-400">
                            {isLoading
                                ? ' '
                                : `${count.toLocaleString()} ${count === 1 ? 'payment' : 'payments'}`}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
