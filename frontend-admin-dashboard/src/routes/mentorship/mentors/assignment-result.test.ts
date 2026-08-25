import { describe, expect, it } from 'vitest';
import {
    assignmentNeedsAttention,
    assignmentResultMessage,
} from '@/routes/mentorship/-utils/assignment-result';

/**
 * Every student an admin selected must be accounted for in the toast. Before mentor
 * capacity existed, assigned + skipped always covered the whole selection; capacity
 * added a third outcome, and silently dropping it is the failure mode these pin.
 */
describe('assignmentResultMessage', () => {
    it('reports a clean run plainly', () => {
        expect(assignmentResultMessage({ assigned: 5, skipped: 0 })).toBe('Assigned 5');
    });

    it('names already-assigned students on a manual run', () => {
        expect(assignmentResultMessage({ assigned: 3, skipped: 2 }, 'manual')).toBe(
            'Assigned 3, 2 already assigned'
        );
    });

    it('names skipped students on a bulk run', () => {
        expect(assignmentResultMessage({ assigned: 3, skipped: 2 }, 'bulk')).toBe(
            'Assigned 3, 2 skipped'
        );
    });

    it('never hides students dropped for capacity', () => {
        const message = assignmentResultMessage(
            { assigned: 6, skipped: 0, capacity_full: 4 },
            'manual'
        );
        expect(message).toContain('4 left out');
        expect(message).toContain('limit');
    });

    it('accounts for all three outcomes at once', () => {
        const message = assignmentResultMessage(
            { assigned: 1, skipped: 2, capacity_full: 3 },
            'bulk'
        );
        expect(message).toBe(
            'Assigned 1, 2 skipped, 3 left out — all mentors at their limit'
        );
    });

    it('tells a bulk admin the whole mentor group is full, not just one mentor', () => {
        const result = { assigned: 0, skipped: 0, capacity_full: 2 };
        expect(assignmentResultMessage(result, 'bulk')).toContain('all mentors at their limit');
        expect(assignmentResultMessage(result, 'manual')).toContain('mentor is at their limit');
    });

    it('treats a server that omits the new field as no capacity blocking', () => {
        // Older/rolling deploys won't send capacity_full at all.
        expect(assignmentResultMessage({ assigned: 2, skipped: 1 })).toBe(
            'Assigned 2, 1 already assigned'
        );
    });

    it('tolerates missing counts rather than printing undefined', () => {
        expect(
            assignmentResultMessage({} as unknown as Parameters<typeof assignmentResultMessage>[0])
        ).toBe('Assigned 0');
    });
});

describe('assignmentNeedsAttention', () => {
    it('flags a run that left someone out for capacity', () => {
        expect(assignmentNeedsAttention({ assigned: 6, skipped: 0, capacity_full: 4 })).toBe(true);
    });

    it('flags a run that placed nobody, even without capacity blocking', () => {
        // "Assigned 0" is never a success worth a green toast.
        expect(assignmentNeedsAttention({ assigned: 0, skipped: 3 })).toBe(true);
    });

    it('stays quiet for a fully successful run', () => {
        expect(assignmentNeedsAttention({ assigned: 5, skipped: 0, capacity_full: 0 })).toBe(false);
    });

    it('does not flag a partially-skipped run that still placed students', () => {
        expect(assignmentNeedsAttention({ assigned: 4, skipped: 1 })).toBe(false);
    });
});
