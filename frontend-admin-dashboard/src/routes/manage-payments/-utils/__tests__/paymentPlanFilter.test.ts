import { describe, expect, it } from 'vitest';
import {
    derivePaymentPlanOptions,
    filterEntriesByPaymentPlan,
    paymentPlanKey,
} from '../paymentPlanFilter';
import type { PaymentLogEntry } from '@/types/payment-logs';

const withPlan = (name: string | null | undefined, id = 'p1'): PaymentLogEntry =>
    ({
        payment_log: { id: `log-${id}-${name}` },
        user_plan: { payment_plan_dto: name === undefined ? undefined : { id, name } },
    }) as unknown as PaymentLogEntry;

/** An admin-invoice row: no user_plan at all. */
const invoiceRow = (): PaymentLogEntry =>
    ({ payment_log: { id: 'inv' }, user_plan: null }) as unknown as PaymentLogEntry;

describe('paymentPlanKey', () => {
    it('uses the trimmed plan name', () => {
        expect(paymentPlanKey(withPlan('  Monthly '))).toBe('Monthly');
    });

    it('is null for rows without a plan or with a blank name', () => {
        expect(paymentPlanKey(invoiceRow())).toBeNull();
        expect(paymentPlanKey(withPlan(undefined))).toBeNull();
        expect(paymentPlanKey(withPlan(null))).toBeNull();
        expect(paymentPlanKey(withPlan('   '))).toBeNull();
    });
});

describe('derivePaymentPlanOptions', () => {
    it('lists each plan name once, sorted case-insensitively, skipping plan-less rows', () => {
        const entries = [
            withPlan('Yearly', 'a'),
            withPlan('monthly', 'b'),
            withPlan('Yearly', 'c'), // same name from another enroll invite
            invoiceRow(),
            withPlan('Quarterly', 'd'),
        ];
        expect(derivePaymentPlanOptions(entries)).toEqual([
            { value: 'monthly', label: 'monthly' },
            { value: 'Quarterly', label: 'Quarterly' },
            { value: 'Yearly', label: 'Yearly' },
        ]);
    });

    it('is empty when nothing is loaded', () => {
        expect(derivePaymentPlanOptions([])).toEqual([]);
    });
});

describe('filterEntriesByPaymentPlan', () => {
    const monthlyA = withPlan('Monthly', 'a');
    const monthlyB = withPlan('Monthly', 'b');
    const yearly = withPlan('Yearly', 'c');
    const invoice = invoiceRow();
    const entries = [monthlyA, invoice, yearly, monthlyB];

    it('returns the same array untouched when nothing is selected', () => {
        expect(filterEntriesByPaymentPlan(entries, [])).toBe(entries);
    });

    it('keeps every row carrying a selected plan name, regardless of plan id', () => {
        expect(
            filterEntriesByPaymentPlan(entries, [{ value: 'Monthly', label: 'Monthly' }])
        ).toEqual([monthlyA, monthlyB]);
    });

    it('OR-combines several selected plans', () => {
        expect(
            filterEntriesByPaymentPlan(entries, [
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Yearly', label: 'Yearly' },
            ])
        ).toEqual([monthlyA, yearly, monthlyB]);
    });

    it('never matches plan-less rows once a plan is selected', () => {
        const result = filterEntriesByPaymentPlan(entries, [{ value: 'Yearly', label: 'Yearly' }]);
        expect(result).toEqual([yearly]);
        expect(result).not.toContain(invoice);
    });
});
