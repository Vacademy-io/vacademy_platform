import { StatusType } from '@/components/design-system/status-chips';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { BookingInstanceDTO, BookingInstanceStatus } from '../-types/meetings-types';

/**
 * Parse a backend UTC timestamp defensively: honour an explicit offset/Z when
 * present, otherwise treat the value as UTC (the *_utc fields are UTC even
 * when serialized without a zone marker).
 */
export const parseUtc = (value: string): Date => {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized)) {
        return new Date(normalized);
    }
    return new Date(`${normalized}Z`);
};

/** Serialize a local Date as ISO-8601 with the browser's UTC offset. */
export const toIsoWithOffset = (d: Date): string => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const tzo = -d.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
        `${dif}${pad(Math.floor(Math.abs(tzo) / 60))}:${pad(Math.abs(tzo) % 60)}`
    );
};

export const statusToChip = (status: BookingInstanceStatus): StatusType => {
    switch ((status || '').toUpperCase()) {
        case 'CONFIRMED':
            return 'SUCCESS';
        case 'PENDING':
        case 'RESCHEDULED':
            return 'WARNING';
        case 'CANCELLED':
        case 'NO_SHOW':
            return 'DANGER';
        default:
            return 'INFO';
    }
};

/** Group bookings by local day (yyyy-MM-dd), each day sorted by start time. */
export const groupBookingsByDay = (
    bookings: BookingInstanceDTO[]
): Array<{ dayKey: string; date: Date; items: BookingInstanceDTO[] }> => {
    const byDay = new Map<string, BookingInstanceDTO[]>();
    for (const booking of bookings) {
        const start = parseUtc(booking.scheduled_start_utc);
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        const key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
        const list = byDay.get(key) ?? [];
        list.push(booking);
        byDay.set(key, list);
    }
    return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dayKey, items]) => ({
            dayKey,
            date: new Date(`${dayKey}T00:00:00`),
            items: items.sort(
                (a, b) =>
                    parseUtc(a.scheduled_start_utc).getTime() -
                    parseUtc(b.scheduled_start_utc).getTime()
            ),
        }));
};

/**
 * Public booking link for a page slug (public page itself ships in Phase 2).
 * The page lives on the LEARNER portal — mirror createCampaignLink.ts: portal
 * base from BASE_URL_LEARNER_DASHBOARD (https:// prefixed when missing) with
 * the current institute id and slug as query params.
 */
export const publicBookingLink = (slug: string | null | undefined): string | null => {
    if (!slug) return null;
    const instituteId = getCurrentInstituteId();
    const rawBase = BASE_URL_LEARNER_DASHBOARD;
    const portalBase =
        rawBase.startsWith('http://') || rawBase.startsWith('https://')
            ? rawBase
            : `https://${rawBase}`;
    return `${portalBase}/booking-response?instituteId=${encodeURIComponent(instituteId || '')}&slug=${encodeURIComponent(slug)}`;
};

/** A short list of common IANA timezones for the booking-page form. */
export const COMMON_TIMEZONES: string[] = [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Asia/Riyadh',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Australia/Sydney',
    'UTC',
];

export const browserTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
