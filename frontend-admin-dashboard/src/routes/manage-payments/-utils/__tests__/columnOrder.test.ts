import { describe, expect, it } from 'vitest';
import { orderColumnIds } from '@/components/shared/leads/use-lead-column-prefs';

/**
 * The reconciliation between a saved column order and the columns a table actually has —
 * what keeps the Manage Payments layout stable as columns come and go.
 * The cases that matter are the ones where the two disagree: a column shipped after the
 * admin last dragged anything, a column that only exists for some institutes, and an id
 * left over from a layout that no longer applies.
 */
describe('orderColumnIds', () => {
    const natural = ['date', 'user', 'amount', 'status', 'invoice', 'txn', 'plan'];

    it('falls back to the natural order when nothing is saved', () => {
        expect(orderColumnIds(natural, [])).toEqual(natural);
    });

    it('applies a saved order', () => {
        expect(
            orderColumnIds(natural, ['invoice', 'date', 'user', 'amount', 'status', 'txn', 'plan'])
        ).toEqual(['invoice', 'date', 'user', 'amount', 'status', 'txn', 'plan']);
    });

    it('keeps a newly shipped column in its natural slot instead of exiling it to the end', () => {
        // Saved before the Invoice column existed.
        const saved = ['date', 'user', 'amount', 'status', 'txn', 'plan'];
        expect(orderColumnIds(natural, saved)).toEqual(natural);
    });

    it('anchors an unknown column to the saved column it naturally follows', () => {
        // 'status' moved to the end, so 'invoice' (which naturally follows it) goes with it.
        const saved = ['txn', 'plan', 'date', 'user', 'amount', 'status'];
        expect(orderColumnIds(natural, saved)).toEqual([
            'txn',
            'plan',
            'date',
            'user',
            'amount',
            'status',
            'invoice',
        ]);
    });

    it('keeps an unknown column first when no saved column precedes it', () => {
        const saved = ['user', 'amount', 'status', 'invoice', 'txn', 'plan'];
        expect(orderColumnIds(natural, saved)).toEqual(natural);
    });

    it('drops saved ids for columns this table does not have', () => {
        const saved = ['org_name', 'user', 'date', 'amount', 'status', 'invoice', 'txn', 'plan'];
        expect(orderColumnIds(natural, saved)).toEqual([
            'user',
            'date',
            'amount',
            'status',
            'invoice',
            'txn',
            'plan',
        ]);
    });

    it('ignores a saved order that shares no columns with the table', () => {
        expect(orderColumnIds(natural, ['a', 'b', 'c'])).toEqual(natural);
    });
});
