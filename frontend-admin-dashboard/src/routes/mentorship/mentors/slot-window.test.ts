import { describe, expect, it } from 'vitest';
import { groupSlotsByDay, isoDate, slotWindow } from '@/routes/mentorship/-utils/slot-window';

/**
 * The slot picker groups times by the viewer's local day. Getting this wrong files a
 * late-evening slot under the wrong date for anyone whose timezone differs from the
 * booking page's — which is most of the point of showing slots in local time at all.
 */
describe('slot window', () => {
    it('formats dates as yyyy-MM-dd in local time', () => {
        expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(isoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
    });

    it('opens on today and covers seven days', () => {
        const range = slotWindow(0);
        expect(range.days).toHaveLength(7);
        expect(range.from).toBe(isoDate(new Date()));
        expect(range.to).toBe(isoDate(range.days[6] as Date));
    });

    it('steps a whole week per offset, with no gap or overlap', () => {
        const first = slotWindow(0);
        const second = slotWindow(1);
        const dayAfterFirst = new Date(first.days[6] as Date);
        dayAfterFirst.setDate(dayAfterFirst.getDate() + 1);
        expect(second.from).toBe(isoDate(dayAfterFirst));
    });

    it('buckets slots by the local day of the parsed instant, not the ISO text', () => {
        // 23:30 in Kolkata is the SAME local day for a Kolkata viewer; the grouping is
        // done off the Date, so whichever zone the test runs in the two 30-minute-apart
        // slots must land on the same day as each other.
        const a = new Date(2026, 5, 10, 23, 0).toISOString();
        const b = new Date(2026, 5, 10, 23, 30).toISOString();
        const byDay = groupSlotsByDay([a, b]);
        expect(Object.keys(byDay)).toEqual(['2026-06-10']);
        expect(byDay['2026-06-10']).toHaveLength(2);
    });

    it('separates slots that fall on different local days', () => {
        const byDay = groupSlotsByDay([
            new Date(2026, 5, 10, 12, 0).toISOString(),
            new Date(2026, 5, 11, 12, 0).toISOString(),
        ]);
        expect(Object.keys(byDay).sort()).toEqual(['2026-06-10', '2026-06-11']);
    });

    it('skips unparseable slots instead of producing an "Invalid Date" bucket', () => {
        const byDay = groupSlotsByDay(['not-a-date', new Date(2026, 5, 10, 12, 0).toISOString()]);
        expect(Object.keys(byDay)).toEqual(['2026-06-10']);
    });

    it('returns an empty map for no slots', () => {
        expect(groupSlotsByDay([])).toEqual({});
    });
});
