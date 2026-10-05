import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { COMPLETED_LEAD_FOLLOWUPS } from '@/constants/urls';

/**
 * Completed follow-ups — one row per closed follow-up, newest first.
 *
 * Deliberately NOT the leads endpoint the other buckets use. A counsellor who
 * rings a lead today and books the next call for Friday closes one follow-up
 * and opens another; that lead belongs in this list for the call that happened
 * and in Upcoming for the one that has not. Listing leads here would show it as
 * finished while Friday is still open.
 */

export interface CompletedFollowUp {
    id: string;
    audience_response_id: string;
    schedule_time: string | null;
    closed_at: string | null;
    closed_by: string | null;
    closer_reason: string | null;
    content: string | null;
    lead_name: string | null;
    lead_mobile: string | null;
    lead_user_id: string | null;
}

export interface CompletedFollowUpsPage {
    content: CompletedFollowUp[];
    totalElements: number;
    totalPages: number;
    last: boolean;
}

export async function fetchCompletedFollowUps(params: {
    instituteId: string;
    counsellorUserId?: string;
    /** Name, phone or email. Matched the same way the leads list matches it. */
    search?: string;
    /** closed_at window, ISO instants. Both optional — omit for all time. */
    closedFrom?: string;
    closedTo?: string;
    page: number;
    size: number;
}): Promise<CompletedFollowUpsPage | undefined> {
    const res = await authenticatedAxiosInstance.get(COMPLETED_LEAD_FOLLOWUPS, {
        params: {
            instituteId: params.instituteId,
            counsellorUserId: params.counsellorUserId,
            search: params.search || undefined,
            closedFrom: params.closedFrom,
            closedTo: params.closedTo,
            page: params.page,
            size: params.size,
        },
    });
    return res?.data;
}
