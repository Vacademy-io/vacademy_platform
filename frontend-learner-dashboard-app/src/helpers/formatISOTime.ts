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

export { parseApiDate };
