import type { PaymentLogEntry } from '@/types/payment-logs';
import { formatMoney, isRealCurrency, resolveEntryCurrency } from '@/utils/payment-currency';

/** A single KPI bucket: how many payments and their total amount, split by currency. */
export interface StatBucket {
    count: number;
    amountByCurrency: Record<string, number>;
}

export interface PaymentSummary {
    total: StatBucket;
    paid: StatBucket;
    pending: StatBucket;
    failed: StatBucket;
}

const emptyBucket = (): StatBucket => ({ count: 0, amountByCurrency: {} });

export const emptyPaymentSummary = (): PaymentSummary => ({
    total: emptyBucket(),
    paid: emptyBucket(),
    pending: emptyBucket(),
    failed: emptyBucket(),
});

const addToBucket = (bucket: StatBucket, amount: number, currency: string) => {
    bucket.count += 1;
    if (amount) {
        const key = currency || 'N/A';
        bucket.amountByCurrency[key] = (bucket.amountByCurrency[key] || 0) + amount;
    }
};

/**
 * Aggregate a set of payment entries into Total / Paid / Pending / Failed buckets.
 * "Pending" absorbs PAYMENT_PENDING, NOT_INITIATED, null and any non-paid/non-failed status.
 */
export const computePaymentSummary = (entries: PaymentLogEntry[]): PaymentSummary => {
    const summary = emptyPaymentSummary();

    for (const entry of entries) {
        const amount = entry.payment_log?.payment_amount || 0;
        const currency = resolveEntryCurrency(entry);
        const status = (
            entry.current_payment_status ||
            entry.payment_log?.payment_status ||
            ''
        ).toUpperCase();

        addToBucket(summary.total, amount, currency);
        if (status === 'PAID') {
            addToBucket(summary.paid, amount, currency);
        } else if (status === 'FAILED') {
            addToBucket(summary.failed, amount, currency);
        } else {
            addToBucket(summary.pending, amount, currency);
        }
    }

    return summary;
};

/** Card amounts are whole units — the paise/cents tail is noise at KPI altitude. */
const formatBucketMoney = (amount: number, currency: string): string =>
    formatMoney(amount, currency, { maximumFractionDigits: 0 });

export interface BucketAmountSummary {
    /** Amounts in recognized currencies, joined (e.g. "₹13,000" or "₹13,000 + $40"). '' if none. */
    display: string;
    /** Full breakdown incl. blank/unknown currencies, for a hover tooltip. */
    full: string;
}

/**
 * Summarize a bucket's amount for display. Only amounts in a recognized currency are shown on the
 * card (so blank/garbage currency codes in the data don't produce confusing bare numbers). The full
 * breakdown — including unknown-currency amounts — is kept for a tooltip.
 */
export const summarizeBucketAmount = (
    amountByCurrency: Record<string, number>
): BucketAmountSummary => {
    const entries = Object.entries(amountByCurrency).sort((a, b) => b[1] - a[1]);
    const display = entries
        .filter(([currency]) => isRealCurrency(currency))
        .map(([currency, amount]) => formatBucketMoney(amount, currency))
        .join(' + ');
    const full = entries
        .map(([currency, amount]) => formatBucketMoney(amount, currency))
        .join(' + ');
    return { display, full };
};
