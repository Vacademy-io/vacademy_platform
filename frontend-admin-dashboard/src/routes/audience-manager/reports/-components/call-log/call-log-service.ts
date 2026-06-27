/**
 * Call Log tab data layer — the operational, row-level call list (every call,
 * AI + human, inbound + outbound, every provider) for the CRM Reports Center.
 *
 * Backed by the telephony dashboard endpoints (admin-core-service):
 *   POST /v1/telephony/calls/search        — paginated, RBAC-scoped, filtered
 *   POST /v1/telephony/calls/metrics       — KPI strip + worklist chip badges
 *   GET  /v1/telephony/calls/dispositions  — call-outcome catalog (picker)
 *   POST /v1/telephony/calls/{id}/disposition — set a call's outcome
 *   POST /v1/telephony/calls/export        — CSV/XLSX blob
 *   GET  /v1/telephony/calls/{id}/recording — presigned recording URL
 *
 * Request/response payloads are snake_case (backend @JsonNaming contract). The
 * search endpoint returns a Spring Page (camelCase envelope) whose `content`
 * rows are snake_case — adapted here into the MyTable/MyPagination page shape.
 */
import { isAxiosError } from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const CALLS_BASE = `${BASE_URL}/admin-core-service/v1/telephony/calls`;

// ── Shared scope (from the Reports shell) ──────────────────────────────────

export interface CallLogScope {
    instituteId: string;
    /** yyyy-MM-dd (inclusive). */
    fromDate: string;
    /** yyyy-MM-dd (inclusive). */
    toDate: string;
    teamId?: string;
    counsellorUserId?: string;
}

/** Tab-local filters layered on top of the shared scope. */
export interface CallLogFilters {
    direction?: 'INBOUND' | 'OUTBOUND';
    callType?: 'AI' | 'HUMAN';
    providerType?: string;
    statuses?: string[];
    dispositionKeys?: string[];
    fromNumber?: string;
    toNumber?: string;
    leadName?: string;
    hasRecording?: boolean;
    missedInbound?: boolean;
    callbacksDue?: boolean;
    sortBy?: 'TIME' | 'DURATION' | 'STATUS';
    sortDirection?: 'ASC' | 'DESC';
}

/** Build the snake_case search/metrics/export request body. */
function buildSearchBody(scope: CallLogScope, f: CallLogFilters, page?: number, size?: number) {
    return {
        institute_id: scope.instituteId,
        from_date: scope.fromDate,
        to_date: scope.toDate,
        team_id: scope.teamId,
        counsellor_user_id: scope.counsellorUserId,
        direction: f.direction,
        call_type: f.callType,
        provider_type: f.providerType,
        statuses: f.statuses && f.statuses.length ? f.statuses : undefined,
        disposition_keys: f.dispositionKeys && f.dispositionKeys.length ? f.dispositionKeys : undefined,
        from_number: f.fromNumber || undefined,
        to_number: f.toNumber || undefined,
        lead_name: f.leadName || undefined,
        has_recording: f.hasRecording,
        missed_inbound: f.missedInbound,
        callbacks_due: f.callbacksDue,
        sort_by: f.sortBy,
        sort_direction: f.sortDirection,
        page,
        size,
    };
}

// ── Row type (snake_case) ──────────────────────────────────────────────────

export interface CallRow {
    id: string;
    provider_type: string | null;
    call_type: 'AI' | 'HUMAN';
    direction: 'INBOUND' | 'OUTBOUND';
    status: string;
    termination_reason: string | null;
    from_number: string | null;
    to_number: string | null;
    lead_number: string | null;
    caller_id: string | null;
    /** epoch millis (Jackson default for Timestamp) or ISO string — coerce with toMillis. */
    start_time: number | string | null;
    answer_time: number | string | null;
    end_time: number | string | null;
    duration_seconds: number | null;
    has_recording: boolean;
    counsellor_user_id: string | null;
    counsellor_name: string | null;
    response_id: string | null;
    user_id: string | null;
    lead_name: string | null;
    disposition_key: string | null;
    disposition_notes: string | null;
    dispositioned_at: number | string | null;
    ai_disposition: string | null;
    callback_at: number | string | null;
    created_at: number | string | null;
}

/** MyTable / MyPagination page shape. */
export interface CallPage {
    content: CallRow[];
    total_pages: number;
    page_no: number;
    page_size: number;
    total_elements: number;
    last: boolean;
}

// ── POST /search ───────────────────────────────────────────────────────────

export const callLogSearchKey = (scope: CallLogScope, f: CallLogFilters, page: number, size: number) =>
    ['crm-call-log-search', scope, f, page, size] as const;

export async function fetchCallLog(
    scope: CallLogScope,
    f: CallLogFilters,
    page: number,
    size: number
): Promise<CallPage> {
    const { data } = await authenticatedAxiosInstance.post(
        `${CALLS_BASE}/search`,
        buildSearchBody(scope, f, page, size)
    );
    // Spring Page envelope is camelCase; map into the table page shape.
    return {
        content: Array.isArray(data?.content) ? data.content : [],
        total_pages: data?.totalPages ?? 0,
        page_no: data?.number ?? page,
        page_size: data?.size ?? size,
        total_elements: data?.totalElements ?? 0,
        last: data?.last ?? true,
    };
}

// ── POST /metrics ──────────────────────────────────────────────────────────

export interface CallMetrics {
    total_calls: number;
    connected_calls: number;
    connect_rate: number | null;
    total_talk_seconds: number;
    avg_talk_seconds: number | null;
    unique_leads: number;
    inbound_calls: number;
    outbound_calls: number;
    ai_calls: number;
    human_calls: number;
    missed_inbound_due: number;
    callbacks_due: number;
}

export const callLogMetricsKey = (scope: CallLogScope, f: CallLogFilters) =>
    ['crm-call-log-metrics', scope, f] as const;

export async function fetchCallMetrics(scope: CallLogScope, f: CallLogFilters): Promise<CallMetrics> {
    const { data } = await authenticatedAxiosInstance.post(
        `${CALLS_BASE}/metrics`,
        buildSearchBody(scope, f)
    );
    return data;
}

// ── GET /dispositions ──────────────────────────────────────────────────────

export interface DispositionOption {
    id: string;
    disposition_key: string;
    label: string;
    color: string | null;
    category: 'CONNECTED' | 'NOT_CONNECTED' | 'CALLBACK' | 'OTHER' | string;
    maps_to_lead_status: boolean;
}

export const dispositionCatalogKey = (instituteId: string) =>
    ['crm-call-disposition-catalog', instituteId] as const;

export async function fetchDispositionCatalog(instituteId: string): Promise<DispositionOption[]> {
    const { data } = await authenticatedAxiosInstance.get(`${CALLS_BASE}/dispositions`, {
        params: { instituteId },
    });
    return Array.isArray(data) ? data : [];
}

// ── POST /{id}/disposition ─────────────────────────────────────────────────

export interface ApplyDispositionResult {
    call_log_id: string;
    disposition_key: string;
    disposition_label: string;
    disposition_color: string | null;
    category: string;
    dispositioned_at: number | null;
    callback_at: number | null;
    lead_status_synced: boolean;
}

export async function applyDisposition(
    instituteId: string,
    callLogId: string,
    dispositionKey: string,
    notes?: string,
    callbackAtEpochMillis?: number | null
): Promise<ApplyDispositionResult> {
    const { data } = await authenticatedAxiosInstance.post(
        `${CALLS_BASE}/${callLogId}/disposition`,
        {
            disposition_key: dispositionKey,
            notes: notes || undefined,
            callback_at_epoch_millis: callbackAtEpochMillis ?? undefined,
        },
        { params: { instituteId } }
    );
    return data;
}

// ── POST /export (blob) ────────────────────────────────────────────────────

export async function exportCallLog(
    scope: CallLogScope,
    f: CallLogFilters,
    format: 'csv' | 'xlsx'
): Promise<void> {
    const res = await authenticatedAxiosInstance.post(
        `${CALLS_BASE}/export`,
        buildSearchBody(scope, f),
        { params: { format }, responseType: 'blob' }
    );
    const blob = new Blob([res.data], {
        type:
            format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calls-${scope.fromDate}-to-${scope.toDate}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ── GET /{id}/recording ────────────────────────────────────────────────────

export async function fetchRecordingUrl(instituteId: string, callLogId: string): Promise<string | null> {
    const res = await authenticatedAxiosInstance.get(`${CALLS_BASE}/${callLogId}/recording`, {
        params: { instituteId },
    });
    const url = res?.data?.url;
    return typeof url === 'string' && url.length > 0 ? url : null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Coerce a Jackson timestamp (epoch millis number OR ISO string) to millis. */
export function toMillis(v: number | string | null | undefined): number | null {
    if (v == null) return null;
    if (typeof v === 'number') return v;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
}

/**
 * True when the dashboard endpoints aren't deployed on this backend yet
 * (post-merge, pre-deploy). The gateway answers unknown paths with an empty 403
 * rather than 404, so both mean "deploy pending" here.
 */
export function isCallLogEndpointMissing(error: unknown): boolean {
    return isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 403);
}
