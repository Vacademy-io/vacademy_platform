/**
 * Chat timestamps are recorded in UTC, but service builds before the Instant switch serialise
 * them without a zone marker — and `new Date('2026-08-19T08:47:03')` reads a bare value as
 * *local* time, so a 2:17 PM IST message rendered as 8:47 AM. Force UTC when the marker is
 * missing; values that already carry one (including our optimistic `toISOString()` echoes)
 * pass through untouched.
 */
export const toUtcDate = (raw: string | null | undefined): Date | null => {
    if (!raw) return null;
    const hasZone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
    const date = new Date(hasZone ? raw : `${raw.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Formats on a 12-hour dial and uppercases the AM/PM marker. Without `hour12` a browser
 * reporting en-GB renders "14:16", and en-GB/en-IN both spell the marker lowercase ("pm"),
 * so the clock would read differently for each admin depending on their locale.
 */
const formatWithUpperDayPeriod = (
    date: Date,
    options: Intl.DateTimeFormatOptions,
    locale?: string
): string =>
    new Intl.DateTimeFormat(locale, { ...options, hour12: true })
        .formatToParts(date)
        .map((part) => (part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value))
        .join('');

/** Clock time for a message bubble, e.g. "2:16 PM". `locale` is for tests; UI passes none. */
export const formatClockTime = (date: Date, locale?: string): string =>
    formatWithUpperDayPeriod(date, { hour: 'numeric', minute: '2-digit' }, locale);

/** Date plus clock time, e.g. "19 Aug, 2:16 PM". */
export const formatDateAndClockTime = (date: Date, locale?: string): string =>
    formatWithUpperDayPeriod(
        date,
        { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' },
        locale
    );
