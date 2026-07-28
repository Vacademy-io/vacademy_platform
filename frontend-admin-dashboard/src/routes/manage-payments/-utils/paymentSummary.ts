import type { PaymentLogEntry } from '@/types/payment-logs';

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
        const currency = entry.payment_log?.currency || '';
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

/** A currency is "real" only if it is a valid ISO 4217 code (so it renders a ₹/$/… symbol). */
const isRealCurrency = (currency: string): boolean => {
    if (!currency || currency === 'N/A') return false;
    try {
        new Intl.NumberFormat(undefined, { style: 'currency', currency });
        return true;
    } catch {
        return false;
    }
};

const formatMoney = (amount: number, currency: string): string => {
    if (isRealCurrency(currency)) {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    }
    // Unknown / blank currency — show a plain number (used only in the hover breakdown).
    return `${currency && currency !== 'N/A' ? currency + ' ' : ''}${amount.toLocaleString()}`;
};

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
        .map(([currency, amount]) => formatMoney(amount, currency))
        .join(' + ');
    const full = entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' + ');
    return { display, full };
};
