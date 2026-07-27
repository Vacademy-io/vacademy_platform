import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_PAYMENT_COLLECTION_SUMMARY } from '@/constants/urls';

export interface CollectionDailyPoint {
    date: string; // YYYY-MM-DD (UTC)
    amount: number;
    count: number;
}

export interface CollectionSummary {
    total_amount: number;
    total_count: number;
    currency: string | null;
    daily: CollectionDailyPoint[];
}

export interface CollectionSummaryRequest {
    institute_id: string;
    /** Optional — scope to one sub-org (sums that sub-org's collected payments). */
    sub_org_id?: string;
    /** Optional ISO local date-time (YYYY-MM-DDTHH:mm:ss); omit for all-time. */
    start_date_in_utc?: string;
    end_date_in_utc?: string;
}

/** Time windows for the "amount collected" panel. `days: null` = all time. */
export type CollectionRangeKey = '3d' | '7d' | '24d' | 'all';
export const COLLECTION_RANGES: {
    key: CollectionRangeKey;
    label: string;
    days: number | null;
}[] = [
    { key: '3d', label: '3 days', days: 3 },
    { key: '7d', label: '7 days', days: 7 },
    { key: '24d', label: '24 days', days: 24 },
    { key: 'all', label: 'All', days: null },
];

/** ISO local date-time (no timezone suffix) that the backend parses as LocalDateTime. */
const toLocalIso = (d: Date): string => d.toISOString().slice(0, 19);

/**
 * Build the {start,end} window for a range, relative to now. Returns undefined
 * dates for 'all' so the backend sums from epoch.
 */
export function rangeToWindow(range: CollectionRangeKey): {
    start_date_in_utc?: string;
    end_date_in_utc?: string;
} {
    const cfg = COLLECTION_RANGES.find((r) => r.key === range);
    if (!cfg || cfg.days == null) return {};
    const end = new Date();
    const start = new Date(end.getTime() - cfg.days * 24 * 60 * 60 * 1000);
    return { start_date_in_utc: toLocalIso(start), end_date_in_utc: toLocalIso(end) };
}

export async function fetchCollectionSummary(
    request: CollectionSummaryRequest
): Promise<CollectionSummary> {
    const res = await authenticatedAxiosInstance.post(
        GET_PAYMENT_COLLECTION_SUMMARY,
        request
    );
    const d = (res.data ?? {}) as Partial<CollectionSummary>;
    return {
        total_amount: typeof d.total_amount === 'number' ? d.total_amount : 0,
        total_count: typeof d.total_count === 'number' ? d.total_count : 0,
        currency: d.currency ?? null,
        daily: Array.isArray(d.daily) ? d.daily : [],
    };
}
