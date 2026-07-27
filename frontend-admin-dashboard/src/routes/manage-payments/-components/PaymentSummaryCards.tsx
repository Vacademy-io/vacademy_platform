import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PaymentSummary } from '../-utils/paymentSummary';
import { summarizeBucketAmount } from '../-utils/paymentSummary';

interface PaymentSummaryCardsProps {
    summary: PaymentSummary;
    /** Accurate total count from the paginated response (across all filtered results). */
    totalCount?: number;
    isLoading?: boolean;
    /** True when the summary was computed from a capped subset of results. */
    truncated?: boolean;
}

const CARDS = [
    { key: 'total', label: 'Total Payments', dot: 'bg-primary-500' },
    { key: 'paid', label: 'Paid', dot: 'bg-success-500' },
    { key: 'pending', label: 'Pending', dot: 'bg-warning-500' },
    { key: 'failed', label: 'Failed', dot: 'bg-danger-500' },
] as const;

export function PaymentSummaryCards({
    summary,
    totalCount,
    isLoading,
    truncated,
}: PaymentSummaryCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {CARDS.map((card) => {
                const bucket = summary[card.key];
                const count =
                    card.key === 'total' && totalCount != null ? totalCount : bucket.count;
                const amount = summarizeBucketAmount(bucket.amountByCurrency);
                const truncatedSuffix = card.key === 'total' && truncated ? '+' : '';
                const amountDisplay = amount.display
                    ? `Amount: ${amount.display}${truncatedSuffix}`
                    : 'Amount: —';
                const amountTooltip = amount.full
                    ? `Total amount: ${amount.full}`
                    : 'No amount recorded';
                return (
                    <Card key={card.key} className="p-4">
                        <div className="flex items-center gap-2">
                            <span className={cn('size-2 rounded-full', card.dot)} />
                            <p className="text-caption font-medium text-neutral-500">
                                {card.label}
                            </p>
                        </div>
                        {/* Count of payments (headline) */}
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-h3 font-semibold text-neutral-700">
                                {isLoading ? '—' : count.toLocaleString()}
                            </span>
                            <span className="text-caption text-neutral-500">
                                {count === 1 ? 'payment' : 'payments'}
                            </span>
                        </div>
                        {card.key !== 'total' && (
                        <p
                            className="mt-1 truncate text-caption text-neutral-500"
                            title={amountTooltip}
                        >
                            {isLoading ? ' ' : amountDisplay}
                        </p>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
