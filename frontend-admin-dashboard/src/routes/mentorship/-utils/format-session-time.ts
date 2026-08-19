/**
 * Session date/time formatting, in one place so every mentorship surface agrees.
 *
 * `toLocaleString()` on its own produces "8/14/2026, 2:30:00 PM" — numeric, with
 * seconds nobody needs, and ambiguous between day/month conventions. These give a
 * scannable form instead, and split the parts so a row can lay a date block beside
 * the detail rather than running it all into one line.
 */

const isValid = (d: Date) => !Number.isNaN(d.getTime());

/** Day number, e.g. "14". */
export function dayOfMonth(epochMillis?: number | null): string {
    if (!epochMillis) return '–';
    const d = new Date(epochMillis);
    return isValid(d) ? String(d.getDate()) : '–';
}

/** Short month, upper-cased for the date block, e.g. "AUG". */
export function shortMonth(epochMillis?: number | null): string {
    if (!epochMillis) return '';
    const d = new Date(epochMillis);
    return isValid(d) ? d.toLocaleString(undefined, { month: 'short' }).toUpperCase() : '';
}

/** Time only, e.g. "2:30 PM" — no seconds. */
export function timeOfDay(epochMillis?: number | null): string {
    if (!epochMillis) return '';
    const d = new Date(epochMillis);
    return isValid(d)
        ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : '';
}

/** Weekday + date, e.g. "Thu 14 Aug". Year only when it isn't the current one. */
export function dayAndMonth(epochMillis?: number | null): string {
    if (!epochMillis) return '';
    const d = new Date(epochMillis);
    if (!isValid(d)) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

/** Full "Thu 14 Aug, 2:30 PM" for detail views and single-line summaries. */
export function sessionDateTime(epochMillis?: number | null): string {
    if (!epochMillis) return '—';
    const date = dayAndMonth(epochMillis);
    const time = timeOfDay(epochMillis);
    return date && time ? `${date}, ${time}` : date || time || '—';
}

/**
 * Relative day label for grouping — "Today" / "Tomorrow" / "Yesterday", else the
 * date. Lets a list say when something is without the reader doing date arithmetic.
 */
export function relativeDay(epochMillis?: number | null): string {
    if (!epochMillis) return '';
    const d = new Date(epochMillis);
    if (!isValid(d)) return '';
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(d) - startOf(new Date())) / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    return dayAndMonth(epochMillis);
}
