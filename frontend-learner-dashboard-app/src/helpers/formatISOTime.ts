function parseApiDate(isoString?: string | null): Date | null {
    if (!isoString) return null;
    let value = isoString.trim();
    // If backend sends naive timestamp (no timezone), assume UTC and append 'Z'
    const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
    if (!hasTimezone) {
        value += 'Z';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatISODateTimeReadable(isoString: string): string {
    const date = parseApiDate(isoString);
    if (!date) return '';

    const dateOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };

    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    };

    const formattedDate = date.toLocaleDateString(undefined, dateOptions);
    const formattedTime = date.toLocaleTimeString(undefined, timeOptions);

    return `${formattedTime}, ${formattedDate}`;
}

export function formatLocalDateTime(isoString?: string | null): string | null {
    const date = parseApiDate(isoString);
    if (!date) return null;

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    };

    return date.toLocaleString(undefined, options);
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Short, human "3 min ago" style stamp for feed-like lists (doubts, replies).
 * Falls back to an absolute date past a week, and always formats in the
 * caller's active locale (pass i18n.language) so Hindi/Arabic learners don't
 * silently get browser-locale output.
 */
export function formatRelativeTime(isoString?: string | null, locale?: string): string {
    const date = parseApiDate(isoString);
    if (!date) return '';

    const diffMs = date.getTime() - Date.now();
    const absMs = Math.abs(diffMs);

    if (absMs < 7 * DAY_MS) {
        const rtf = new Intl.RelativeTimeFormat(locale || undefined, { numeric: 'auto' });
        if (absMs < MINUTE_MS) return rtf.format(0, 'second');
        if (absMs < HOUR_MS) return rtf.format(Math.round(diffMs / MINUTE_MS), 'minute');
        if (absMs < DAY_MS) return rtf.format(Math.round(diffMs / HOUR_MS), 'hour');
        return rtf.format(Math.round(diffMs / DAY_MS), 'day');
    }

    return date.toLocaleDateString(locale || undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export { parseApiDate };
