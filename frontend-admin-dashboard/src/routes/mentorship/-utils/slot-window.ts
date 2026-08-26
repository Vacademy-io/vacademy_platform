/**
 * Date helpers for the mentor slot picker.
 *
 * The picker works in rolling 7-day windows starting today rather than calendar
 * weeks: an admin scheduling a session cares about "the next few days", and a
 * calendar week that opens on a Monday would show four dead days every Friday.
 */

/** "yyyy-MM-dd" in the viewer's own timezone — the format the slots API expects. */
export function isoDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight today, so windows never drift as the clock moves through the day. */
function startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface SlotWindow {
    /** Inclusive first day, "yyyy-MM-dd". */
    from: string;
    /** Inclusive last day, "yyyy-MM-dd". */
    to: string;
    /** The seven days in the window, for rendering the day strip. */
    days: Date[];
}

/** The `offsetWeeks`-th rolling 7-day window from today. Offset 0 starts today. */
export function slotWindow(offsetWeeks: number): SlotWindow {
    const first = startOfToday();
    first.setDate(first.getDate() + offsetWeeks * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(first);
        d.setDate(first.getDate() + i);
        return d;
    });
    return {
        from: isoDate(days[0] as Date),
        to: isoDate(days[6] as Date),
        days,
    };
}

/**
 * Bucket slot timestamps by the local day they fall on.
 *
 * Grouping happens on the CLIENT, off the parsed instant, not by slicing the ISO
 * string: the API returns each slot with the requested zone's offset, and a 9:00 pm
 * slot in one zone is the next day in another. Slicing the text would file it under
 * the wrong day for exactly the users who most need the conversion to be right.
 */
export function groupSlotsByDay(slots: string[]): Record<string, string[]> {
    const byDay: Record<string, string[]> = {};
    for (const slot of slots) {
        const at = new Date(slot);
        if (Number.isNaN(at.getTime())) continue;
        const key = isoDate(at);
        (byDay[key] ??= []).push(slot);
    }
    return byDay;
}

/** The viewer's IANA timezone, falling back to UTC where Intl is unavailable. */
export function browserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}
