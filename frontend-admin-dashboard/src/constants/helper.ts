import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export const convertToLocalDateTime = (dateString: string): string => {
    if (!dateString) return '';

    const date = new Date(dateString);

    const options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'UTC', // ← Force UTC output
    };

    // Use en-GB for day-month-year ordering
    const formatted = new Intl.DateTimeFormat('en-GB', options).format(date);

    return formatted.replace(',', '').replace(/\s(am|pm)/i, (match) => match.toUpperCase());
};

export function extractDateTime(utcDate: string) {
    const [date, time] = [
        utcDate.split(' ').slice(0, 3).join(' '),
        utcDate.split(' ').slice(3).join(' '),
    ];

    return { date, time };
}

export function getInstituteId(): string | undefined {
    return getCurrentInstituteId();
}

export function getDateFromUTCString(utcString: string): string {
    const date = new Date(utcString);
    // Format: YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function extractTextFromHTML(htmlString: string) {
    if (!htmlString) return '';
    return htmlString.replace(/<[^>]*>/g, '');
}
