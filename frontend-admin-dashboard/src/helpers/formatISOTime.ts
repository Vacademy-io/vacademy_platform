export function formatISODateTimeReadable(isoString: string): string {
    // Handle empty or invalid input
    if (!isoString || isoString.trim() === '') {
        return '-';
    }

    const date = new Date(isoString);

    // Check if date is invalid
    if (isNaN(date.getTime())) {
        return '-';
    }

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

    return `${formattedDate} at ${formattedTime}`;
}
