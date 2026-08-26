import { describe, expect, it } from 'vitest';
import {
    ALL_TIME_RANGE,
    customRange,
    formatRangeLabel,
    rangeToLocalIsoWindow,
    resolvePreset,
} from '../dateRange';
import { classifyEntry, computeBillingFromEntries, computePaymentSummary } from '../paymentSummary';
import { computePaymentAnalytics } from '../paymentAnalytics';
import type { PaymentLogEntry } from '@/types/payment-logs';

/**
 * The two things the payment KPIs can get quietly wrong.
 *
 * 1. The window. Presets are cut on the admin's own day boundaries but sent as UTC instants — get
 *    that backwards and "Today" starts at 5:30am, which nobody notices until a day's collections
 *    look short.
 * 2. The buckets. "Due" has to absorb the rows whose payment_status is NULL (NOT_INITIATED);
 *    if it doesn't, money that was never collected simply disappears from the total owed.
 */

const entry = (status: string | null, amount: number, currency = 'INR'): PaymentLogEntry =>
    ({
        payment_log: { payment_status: status, payment_amount: amount, currency },
        current_payment_status: status ?? 'NOT_INITIATED',
    }) as unknown as PaymentLogEntry;

describe('date range presets', () => {
    it('opens "today" at local midnight, not UTC midnight', () => {
        const { start, end } = resolvePreset('today');
        const startDate = new Date(start);
        expect(startDate.getHours()).toBe(0);
        expect(startDate.getMinutes()).toBe(0);
        expect(new Date(end).getTime()).toBeGreaterThanOrEqual(startDate.getTime());
    });

    it('covers whole days for the closed windows', () => {
        const yesterday = resolvePreset('yesterday');
        expect(new Date(yesterday.start).getHours()).toBe(0);
        expect(new Date(yesterday.end).getHours()).toBe(23);

        const lastMonth = resolvePreset('last_month');
        expect(new Date(lastMonth.start).getDate()).toBe(1);
        // The window must close before this month starts.
        expect(new Date(lastMonth.end).getMonth()).toBe((new Date().getMonth() + 11) % 12);
    });

    it('spans the right number of days for the rolling ranges', () => {
        const { start, end } = resolvePreset('7d');
        const days = (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;
        // 6 whole days back plus the elapsed part of today.
        expect(days).toBeGreaterThan(6);
        expect(days).toBeLessThan(7);
    });

    it('leaves "all time" unbounded, and sends no window to the API', () => {
        expect(resolvePreset('all')).toEqual(ALL_TIME_RANGE);
        expect(rangeToLocalIsoWindow(ALL_TIME_RANGE)).toEqual({
            start: undefined,
            end: undefined,
        });
    });

    it('hands the API a LocalDateTime with no offset suffix', () => {
        const w = rangeToLocalIsoWindow(resolvePreset('30d'));
        expect(w.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        expect(w.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });
});

describe('custom range', () => {
    it('normalises a backwards selection and covers both end days in full', () => {
        const later = new Date(2026, 7, 12);
        const earlier = new Date(2026, 6, 3);
        const range = customRange(later, earlier);
        expect(new Date(range.start).getTime()).toBeLessThan(new Date(range.end).getTime());
        expect(new Date(range.start).getDate()).toBe(3);
        expect(new Date(range.end).getHours()).toBe(23);
    });

    it('labels a preset by name and a custom window by its dates', () => {
        expect(formatRangeLabel(resolvePreset('30d'))).toBe('Last 30 days');
        expect(formatRangeLabel(ALL_TIME_RANGE)).toBe('All time');
        const oneDay = customRange(new Date(2026, 7, 12), new Date(2026, 7, 12));
        expect(formatRangeLabel(oneDay)).not.toContain('–');
    });
});

describe('payment buckets', () => {
    it('treats an un-initiated payment as due, not as failed', () => {
        expect(classifyEntry(entry('PAID', 100))).toBe('paid');
        expect(classifyEntry(entry('FAILED', 100))).toBe('failed');
        expect(classifyEntry(entry('PAYMENT_PENDING', 100))).toBe('pending');
        expect(classifyEntry(entry(null, 100))).toBe('pending');
    });

    it('sums total / collected / due / failed per currency', () => {
        const summary = computePaymentSummary([
            entry('PAID', 1000),
            entry('PAID', 500),
            entry('PAYMENT_PENDING', 300),
            entry(null, 200),
            entry('FAILED', 100),
        ]);

        expect(summary.total.count).toBe(5);
        expect(summary.total.amountByCurrency.INR).toBe(2100);
        expect(summary.paid.amountByCurrency.INR).toBe(1500);
        // Due covers both the pending and the never-initiated row.
        expect(summary.pending.count).toBe(2);
        expect(summary.pending.amountByCurrency.INR).toBe(500);
        expect(summary.failed.amountByCurrency.INR).toBe(100);
    });

    it('keeps a foreign charge in its own currency bucket', () => {
        const summary = computePaymentSummary([entry('PAID', 1000), entry('PAID', 40, 'USD')]);
        expect(summary.paid.amountByCurrency).toEqual({ INR: 1000, USD: 40 });
    });
});

describe('billing derived from payment rows', () => {
    /** A payment on a plan: one row of a course priced at `planPrice`, paid by `userId`. */
    const planEntry = (
        planId: string,
        planPrice: number,
        amount: number,
        status: string | null = 'PAID',
        userId = `user-of-${planId}`
    ): PaymentLogEntry =>
        ({
            payment_log: { payment_status: status, payment_amount: amount, currency: 'INR' },
            current_payment_status: status ?? 'NOT_INITIATED',
            user: { id: userId },
            user_plan: {
                id: planId,
                user_id: userId,
                payment_plan_dto: { actual_price: planPrice },
            },
        }) as unknown as PaymentLogEntry;

    it('prices an instalment plan once, not once per instalment', () => {
        // ₹50,000 course, two instalments paid — the balance is ₹32,000, not another ₹100,000.
        const billing = computeBillingFromEntries([
            planEntry('plan-1', 50000, 10000),
            planEntry('plan-1', 50000, 8000),
        ]);
        expect(billing.collected).toBe(18000);
        expect(billing.due).toBe(32000);
        expect(billing.totalBilled).toBe(50000);
        expect(billing.planCount).toBe(1);
        expect(billing.settledPlanCount).toBe(0);
    });

    it('keeps Total = Collected + Due across several enrolments', () => {
        const billing = computeBillingFromEntries([
            planEntry('plan-1', 50000, 10000),
            planEntry('plan-2', 20000, 20000),
            planEntry('plan-3', 30000, 5000, 'PAYMENT_PENDING'),
        ]);
        expect(billing.collected).toBe(30000);
        expect(billing.due).toBe(70000); // 40k + 0 + 30k
        expect(billing.totalBilled).toBe(billing.collected + billing.due);
        expect(billing.settledPlanCount).toBe(1);
    });

    it('never reports a negative balance on a zero-priced or over-collected plan', () => {
        const billing = computeBillingFromEntries([
            planEntry('free-plan', 0, 0),
            planEntry('cpo-plan', 0, 8000),
            planEntry('over-paid', 5000, 6000),
        ]);
        expect(billing.due).toBe(0);
        expect(billing.totalBilled).toBe(billing.collected);
    });
});

describe('invoice payments credited to the learner', () => {
    const planEntry = (
        planId: string,
        planPrice: number,
        amount: number,
        userId: string
    ): PaymentLogEntry =>
        ({
            payment_log: { payment_status: 'PAID', payment_amount: amount, currency: 'INR' },
            current_payment_status: 'PAID',
            user: { id: userId },
            user_plan: {
                id: planId,
                user_id: userId,
                payment_plan_dto: { actual_price: planPrice },
            },
        }) as unknown as PaymentLogEntry;

    const invoiceEntry = (userId: string, amount: number): PaymentLogEntry =>
        ({
            payment_log: { payment_status: 'PAID', payment_amount: amount, currency: 'INR' },
            current_payment_status: 'PAID',
            user: { id: userId },
        }) as unknown as PaymentLogEntry;

    /**
     * An enrolment paid off by an admin-raised invoice: the payment carries no user_plan, so
     * crediting it to the plan alone reported the learner as owing their whole course fee while
     * the table right below listed the payment that settled part of it.
     */
    it('reduces a course balance by an invoice payment from the same learner', () => {
        const billing = computeBillingFromEntries([
            // ₹70,000 course, ₹10,000 paid by invoice (no plan on the payment row).
            planEntry('plan-gopal', 70000, 0, 'gopal'),
            invoiceEntry('gopal', 10000),
        ]);
        expect(billing.collected).toBe(10000);
        expect(billing.due).toBe(60000);
        expect(billing.totalBilled).toBe(70000);
    });

    it('does not invent a balance for an invoice payer who was never enrolled', () => {
        const billing = computeBillingFromEntries([invoiceEntry('deepak', 10000)]);
        expect(billing.collected).toBe(10000);
        expect(billing.due).toBe(0);
        expect(billing.planCount).toBe(0);
    });
});

describe('cancelled (voided invoice) entries', () => {
    const entry = (status: string, amount: number): PaymentLogEntry =>
        ({
            payment_log: { payment_amount: amount, currency: 'INR' },
            user_plan: null,
            current_payment_status: status,
            user: {},
        }) as unknown as PaymentLogEntry;

    it('keeps a voided invoice out of every bucket', () => {
        // It stays in the table for audit, but cancelled money is neither collected nor owed.
        const summary = computePaymentSummary([
            entry('PAID', 1000),
            entry('CANCELLED', 5000),
            entry('NOT_INITIATED', 2000),
        ]);
        expect(summary.total.count).toBe(2);
        expect(summary.total.amountByCurrency['INR']).toBe(3000);
        expect(summary.paid.amountByCurrency['INR']).toBe(1000);
        expect(summary.pending.amountByCurrency['INR']).toBe(2000);
    });

    it('counts an unpaid invoice as pending, not paid', () => {
        const summary = computePaymentSummary([entry('NOT_INITIATED', 8500)]);
        expect(summary.pending.count).toBe(1);
        expect(summary.paid.count).toBe(0);
    });
});

describe('dashboard analytics vs KPI cards', () => {
    const entry = (status: string, amount: number): PaymentLogEntry =>
        ({
            payment_log: {
                payment_amount: amount,
                currency: 'INR',
                created_at: '2026-08-18T10:00:00Z',
            },
            user_plan: null,
            current_payment_status: status,
            user: {},
        }) as unknown as PaymentLogEntry;

    it('drops voided invoices from analytics, matching the cards', () => {
        // The two share classifyEntry deliberately; if analytics kept a cancelled row it would
        // report it as still-due while the cards ignored it.
        const rows = [entry('PAID', 1000), entry('CANCELLED', 5000)];
        const analytics = computePaymentAnalytics(rows);
        const summary = computePaymentSummary(rows);

        expect(analytics.totalEntries).toBe(summary.total.count);
        expect(analytics.outstanding.count).toBe(summary.pending.count);
        expect(analytics.outstanding.amount).toBe(0);
        expect(analytics.collected.amount).toBe(1000);
    });
});
