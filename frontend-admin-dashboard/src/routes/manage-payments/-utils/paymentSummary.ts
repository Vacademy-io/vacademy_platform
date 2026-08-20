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

/** Which KPI bucket a single payment falls into. */
export type PaymentBucketKey = 'paid' | 'pending' | 'failed';

/**
 * A voided (REJECTED) invoice. It stays visible in the table for audit, but is deliberately
 * absent from every total: cancelled money was never collected and is no longer owed.
 */
export const isCancelledEntry = (entry: PaymentLogEntry): boolean =>
    (entry.current_payment_status || '').toUpperCase() === 'CANCELLED';

/**
 * Classify one payment. "pending" (the money still due) absorbs PAYMENT_PENDING, NOT_INITIATED,
 * null and any other non-paid/non-failed status — which is why selecting the Due tile filters the
 * table here rather than through the API: `payment_status IN (...)` can never match a NULL row.
 */
export const classifyEntry = (entry: PaymentLogEntry): PaymentBucketKey => {
    const status = (
        entry.current_payment_status ||
        entry.payment_log?.payment_status ||
        ''
    ).toUpperCase();
    if (status === 'PAID') return 'paid';
    if (status === 'FAILED') return 'failed';
    return 'pending';
};

/** Aggregate a set of payment entries into Total / Paid / Pending(Due) / Failed buckets. */
export const computePaymentSummary = (entries: PaymentLogEntry[]): PaymentSummary => {
    const summary = emptyPaymentSummary();

    for (const entry of entries) {
        if (isCancelledEntry(entry)) continue;

        const amount = entry.payment_log?.payment_amount || 0;
        const currency = resolveEntryCurrency(entry);

        addToBucket(summary.total, amount, currency);
        addToBucket(summary[classifyEntry(entry)], amount, currency);
    }

    return summary;
};

/** Card amounts are whole units — the paise/cents tail is noise at KPI altitude. */
const formatBucketMoney = (amount: number, currency: string): string =>
    formatMoney(amount, currency, { maximumFractionDigits: 0 });

/**
 * The amount a bucket actually shows on a card: recognized currencies only, summed. Used for the
 * "x% of the total" figure — a ratio, so folding a rare foreign charge into it is harmless, while
 * a count-based share would be badly misleading on institutes whose free (₹0) enrolments outnumber
 * their paid ones.
 */
export const bucketAmountTotal = (amountByCurrency: Record<string, number>): number =>
    Object.entries(amountByCurrency)
        .filter(([currency]) => isRealCurrency(currency))
        .reduce((sum, [, amount]) => sum + amount, 0);

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

/** Billing view of a set of payment rows: billed vs collected vs the balance still owed. */
export interface EntryBilling {
    totalBilled: number;
    collected: number;
    due: number;
    currency: string;
    planCount: number;
    settledPlanCount: number;
}

/**
 * Billing figures derived from the rows already on screen, for when the billing-summary endpoint
 * isn't available (older backend, or the request failed).
 *
 * Groups by enrolment and takes the plan price ONCE per plan, so a ₹50,000 course paid in five
 * instalments is billed at ₹50,000 rather than five times over. GREATEST(price, paid) guards the
 * plans priced at 0 — free enrolments and CPO plans whose amount lives on a fee schedule — which
 * would otherwise report a negative balance as payments land against them.
 *
 * Blind spot worth knowing: enrolments that have never paid anything have no payment rows, so they
 * cannot appear here at all. Only the server-side summary sees those, and it is the one that makes
 * "Due" complete.
 */
export const computeBillingFromEntries = (entries: PaymentLogEntry[]): EntryBilling => {
    // Most common real currency in the set; amounts in anything else are left out of the totals
    // rather than added to a number carrying a different symbol.
    const counts: Record<string, number> = {};
    for (const entry of entries) {
        const c = resolveEntryCurrency(entry);
        if (isRealCurrency(c)) counts[c] = (counts[c] || 0) + 1;
    }
    const primary = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    const countsTowardsAmount = (entry: PaymentLogEntry): boolean => {
        if (!primary) return true;
        const c = resolveEntryCurrency(entry);
        return !isRealCurrency(c) || c === primary;
    };

    /** One learner: the plans they are enrolled on (priced once each) and everything they paid. */
    const learners = new Map<string, { plans: Map<string, number>; paid: number }>();
    let collected = 0;

    for (const entry of entries) {
        const amount = countsTowardsAmount(entry) ? entry.payment_log?.payment_amount || 0 : 0;
        const isPaid = classifyEntry(entry) === 'paid';
        if (isPaid) collected += amount;

        const planId = entry.user_plan?.id;
        // Group by learner, not by plan: an admin-raised invoice carries no user_plan at all, and
        // crediting it only to a plan left learners who paid by invoice owing their whole fee.
        const key = entry.user?.id || entry.user_plan?.user_id || planId;
        if (!key) continue;

        const learner = learners.get(key) ?? { plans: new Map(), paid: 0 };
        if (planId) {
            // The price belongs to the plan, not to the row — record it once, don't accumulate.
            learner.plans.set(planId, entry.user_plan?.payment_plan_dto?.actual_price || 0);
        }
        if (isPaid) learner.paid += amount;
        learners.set(key, learner);
    }

    let due = 0;
    let planCount = 0;
    let settledPlanCount = 0;
    for (const learner of learners.values()) {
        const billed = [...learner.plans.values()].reduce((sum, price) => sum + price, 0);
        planCount += learner.plans.size;
        due += Math.max(0, billed - learner.paid);
        if (billed > 0 && learner.paid >= billed) settledPlanCount += 1;
    }

    return {
        totalBilled: collected + due,
        collected,
        due,
        currency: primary,
        planCount,
        settledPlanCount,
    };
};
