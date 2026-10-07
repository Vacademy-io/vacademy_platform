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
    /** Only populated for institutes that turned the follow-up fields on
     *  (Settings -> Lead settings -> Follow-up fields); null everywhere else. */
    student_response: string | null;
    follow_up_mode: string | null;
    next_action: string | null;
    lead_name: string | null;
    lead_mobile: string | null;
    lead_user_id: string | null;
    /** Hydrated only on this endpoint — a completed follow-up is the only view of
     *  the lead the row gets, so it has to stand on its own. */
    lead_email: string | null;
    lead_source: string | null;
    lead_status: string | null;
    lead_tier: string | null;
    assigned_counselor_name: string | null;
    /** Form answers keyed by custom_field_id, same shape as the leads endpoint. */
    custom_field_values?: Record<string, string | null>;
    custom_field_metadata?: Record<
        string,
        { fieldName?: string; field_name?: string; fieldType?: string; field_type?: string }
    >;
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
