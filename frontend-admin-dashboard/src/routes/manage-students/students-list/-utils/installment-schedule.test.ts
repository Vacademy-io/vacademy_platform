import { describe, expect, it } from 'vitest';
import {
    addMonthsIso,
    equalSplit,
    generateDueDates,
    partsFromFeeTypes,
    rowsFromRule,
    validateSchedule,
    type SchedulePart,
} from './installment-schedule';
import type { CPOFeeType } from '@/routes/financial-management/fee-plans/-types/cpo-types';

// These cases mirror InstallmentScheduleServiceTest on the backend: the wizard's preview
// must show exactly the rows the backend writes.

const fee = (total: number, split = true): SchedulePart => ({ feeTypeName: 'Fee', total, split });

describe('installment schedule maths', () => {
    it('splits into whole units with the remainder on installment #1', () => {
        expect(equalSplit(40000, 3)).toEqual([13334, 13333, 13333]);
        expect(equalSplit(1000.5, 2)).toEqual([500.5, 500]);
    });

    it('counts every-N-days from the first due date', () => {
        expect(generateDueDates('2026-10-15', 4, 'DAYS', 30)).toEqual([
            '2026-10-15',
            '2026-11-14',
            '2026-12-14',
            '2027-01-13',
        ]);
    });

    it('keeps the day of month for monthly gaps without drifting', () => {
        expect(generateDueDates('2026-01-31', 4, 'MONTHS', 1)).toEqual([
            '2026-01-31',
            '2026-02-28',
            '2026-03-31',
            '2026-04-30',
        ]);
        expect(addMonthsIso('2026-11-30', 3)).toBe('2027-02-28');
    });

    it('sums each split fee per installment', () => {
        const rows = rowsFromRule(
            { count: 3, interval: { unit: 'MONTHS', value: 1 }, first_due_date: '2026-11-01' },
            [fee(30000), fee(6000)]
        );
        expect(rows.map((r) => r.amount)).toEqual([12000, 12000, 12000]);
    });

    it('treats template installments or has_installment as split, others as upfront', () => {
        const feeTypes = [
            {
                name: 'Tuition',
                assigned_fee_value: { amount: 0, has_installment: false, installments: [{ amount: 5000 }, { amount: 5000 }] },
            },
            { name: 'Admission', assigned_fee_value: { amount: 2000, has_installment: false, installments: [] } },
            { name: 'Course', assigned_fee_value: { amount: 9000, has_installment: true, installments: [] } },
        ] as unknown as CPOFeeType[];
        expect(partsFromFeeTypes(feeTypes)).toEqual([
            { feeTypeName: 'Tuition', total: 10000, split: true },
            { feeTypeName: 'Admission', total: 2000, split: false },
            { feeTypeName: 'Course', total: 9000, split: true },
        ]);
    });
});

describe('validateSchedule', () => {
    const rule = { count: 4, interval: { unit: 'DAYS' as const, value: 30 }, first_due_date: '2026-10-15' };

    it('accepts a plain rule', () => {
        expect(validateSchedule(rule, [fee(40000)], 60)).toBeNull();
    });

    it('rejects edited amounts that do not add up to the fee', () => {
        const err = validateSchedule(
            { ...rule, rows: [{ due_date: '2026-10-15', amount: 20000 }, { due_date: '2026-11-15', amount: 10000 }] },
            [fee(40000)],
            60
        );
        expect(err?.key).toBe('schedule.errors.amountMismatch');
    });

    it('rejects a mix of rows with and without amounts', () => {
        const err = validateSchedule(
            { ...rule, rows: [{ due_date: '2026-10-15', amount: 40000 }, { due_date: '2026-11-15', amount: null }] },
            [fee(40000)],
            60
        );
        expect(err?.key).toBe('schedule.errors.mixedAmounts');
    });

    it('rejects dates out of order', () => {
        const err = validateSchedule(
            { rows: [{ due_date: '2026-11-15' }, { due_date: '2026-10-15' }] },
            [fee(40000)],
            60
        );
        expect(err?.key).toBe('schedule.errors.datesOutOfOrder');
    });

    it('honours the plan maximum and a plan with nothing to split', () => {
        expect(validateSchedule({ ...rule, count: 7 }, [fee(40000)], 6)?.key).toBe('schedule.errors.countRange');
        expect(validateSchedule(rule, [fee(5000, false)], 60)?.key).toBe('schedule.errors.nothingToSplit');
    });
});
