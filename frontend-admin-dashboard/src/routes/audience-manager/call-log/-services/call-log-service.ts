/**
 * Call Log tab data layer — the operational, row-level call list (every call,
 * AI + human, inbound + outbound, every provider) for the CRM Reports Center.
 *
 * Backed by the telephony dashboard endpoints (admin-core-service):
 *   POST /v1/telephony/calls/search        — paginated, RBAC-scoped, filtered
 *   POST /v1/telephony/calls/metrics       — KPI strip + worklist chip badges
 *   GET  /v1/telephony/calls/dispositions  — call-outcome catalog (picker; settable only)
 *   GET  /v1/telephony/calls/dispositions/options — full filter vocabulary (catalog + AI)
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

// ── Per-call technical diagnostics (voice-bot contract, rulesVersion 1) ─────

export type CallHealth = 'GREEN' | 'AMBER' | 'RED';
/** A fault never fires GREEN — it is either a warning or a breakage. */
export type CallFaultLevel = 'AMBER' | 'RED';

/**
 * The fault vocabulary is CLOSED and APPEND-ONLY — it mirrors
 * `voice_bot_service/app/diagnostics.py` (ALL_FAULTS), which is the source of
 * truth. Renaming a code silently breaks every call already stored, so codes are
 * only ever added. The order here is also the bot's HEADLINE_PRIORITY, i.e. the
 * order faults must be shown in.
 */
export const CALL_FAULT_CODES = [
    'CRASH',
    'TTS_WEDGE',
    'REPLY_UNPLAYED',
    'ANSWER_DELETED',
    'DEAD_AIR',
    'FALSE_REASK',
    'LIKELY_MACHINE',
    'STT_DEAF',
    'SLOW_TTS',
    'SLOW_LLM',
    'TRANSFER_FAILED',
    'PROMPT_UNFILLED',
] as const;
export type CallFaultCode = (typeof CALL_FAULT_CODES)[number];

/**
 * Verbatim `diagnostics` blob the voice bot posts with its end-of-call report
 * (see `voice_bot_service/app/diagnostics.py::to_payload`). camelCase inside —
 * it is stored and re-served exactly as the bot produced it, not re-serialized
 * through the snake_case telephony contract.
 *
 * EVERY field is optional: a call recorded before this shipped, or by a bot
 * version that predates a key, simply omits it, and the UI must degrade to
 * "not reported" rather than inventing a value. In particular
 * `turnTaking.answersDeleted === null` means NOT MEASURED and must never be
 * rendered as 0 — see the honesty note in the bot module's docstring.
 */
export interface CallDiagnostics {
    rulesVersion?: number | null;
    health?: CallHealth | null;
    /** Sorted fault codes. Unknown (newer-bot) codes may appear — render them raw. */
    faults?: string[] | null;
    faultLevels?: Record<string, CallFaultLevel> | null;
    headline?: string | null;
    headlineText?: string | null;
    tts?: {
        letterlessSkipped?: number | null;
        wedges?: number | null;
        wedgeReconnects?: number | null;
        stalls?: number | null;
        stallCapHit?: boolean | null;
        silentGenerations?: number | null;
        ttfbP50?: number | null;
        ttfbP95?: number | null;
        ttfbMax?: number | null;
    } | null;
    playout?: {
        repliesGenerated?: number | null;
        repliesNeverPlayed?: number | null;
    } | null;
    turnTaking?: {
        userTurns?: number | null;
        botTurns?: number | null;
        bargeIns?: number | null;
        orphanReasks?: number | null;
        orphanFalseReasks?: number | null;
        nudges?: number | null;
        idleHangup?: boolean | null;
        capFarewell?: boolean | null;
        /** null = NOT MEASURED. Never render as 0. */
        answersDeleted?: number | null;
        /** The discarded caller answers, verbatim (bounded to 20 by the bot). */
        answersDeletedSamples?: string[] | null;
        answersDeletedSrc?: 'measured' | null;
    } | null;
    latency?: {
        llmTtfbP50?: number | null;
        llmTtfbP95?: number | null;
        sttTtfbP50?: number | null;
        sttTtfbP95?: number | null;
        deadAirP95?: number | null;
        deadAirMax?: number | null;
    } | null;
    setup?: {
        greetPath?: string | null;
        greetDelaySecs?: number | null;
        setupSecs?: number | null;
    } | null;
    machine?: {
        score?: number | null;
        markers?: string[] | null;
        firstUserSecs?: number | null;
        longestUserSecs?: number | null;
        /** Always "inferred" in v1 — this is a heuristic, not a measurement. */
        src?: 'inferred' | null;
    } | null;
    infra?: {
        sttReconnects?: number | null;
        promptUnfilled?: string[] | null;
        crash?: string | null;
        transferRequested?: boolean | null;
        transferRegistered?: boolean | null;
    } | null;
    /** Set (with health = null) when the bot's own payload build failed. */
    error?: string | null;
}

/**
 * The non-sensitive summary of a verdict: `CallDetailDTO.diagHealth/diagFaults`,
 * which the backend serves to every dashboard viewer (the full blob is gated —
 * see {@link CallDetail.diagnostics}). Snake_case on the wire like the rest of
 * the telephony contract; the camelCase spellings are accepted too so the UI
 * doesn't silently read "not reported" if a payload ever lands unconverted.
 *
 * Declared on {@link CallRow} as well, even though the search DTO does not carry
 * them today: the list reads them opportunistically, so the day the row gains a
 * verdict the dots light up with no frontend change, and until then the row
 * simply says "not reported" rather than guessing.
 */
export interface CallHealthFields {
    diag_health?: CallHealth | null;
    diagHealth?: CallHealth | null;
    diag_faults?: string[] | null;
    diagFaults?: string[] | null;
}

export function rowCallHealth(row: CallHealthFields): CallHealth | null {
    return row.diag_health ?? row.diagHealth ?? null;
}

export function rowCallFaults(row: CallHealthFields): string[] {
    const faults = row.diag_faults ?? row.diagFaults;
    return Array.isArray(faults) ? faults : [];
}

// ── Row type (snake_case) ──────────────────────────────────────────────────

export interface CallRow extends CallHealthFields {
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
    /** IVR option the inbound caller chose, e.g. "1 · Shivir Info". */
    ivr_selection: string | null;
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
    /**
     * Whether a counsellor may APPLY this outcome. False for AI-sourced outcomes —
     * they're reported by the agent and only exist to be filtered on; `POST
     * /{id}/disposition` rejects them. Absent on an older backend ⇒ treat as settable
     * (that backend only ever returned catalog rows).
     */
    settable?: boolean;
    /** CATALOG | AI_SETTINGS | AI_AGENT | OBSERVED — where the outcome was declared. */
    source?: string;
}

export const dispositionCatalogKey = (instituteId: string) =>
    ['crm-call-disposition-catalog', instituteId] as const;

/**
 * The outcomes a counsellor may SET — `call_disposition_catalog` only. This is the
 * quick-disposition picker's list and the only vocabulary the apply endpoint accepts.
 */
export async function fetchDispositionCatalog(instituteId: string): Promise<DispositionOption[]> {
    const { data } = await authenticatedAxiosInstance.get(`${CALLS_BASE}/dispositions`, {
        params: { instituteId },
    });
    return Array.isArray(data) ? data : [];
}

// ── GET /dispositions/options (filter vocabulary) ──────────────────────────

export const dispositionOptionsKey = (instituteId: string) =>
    ['crm-call-disposition-options', instituteId] as const;

/**
 * The wider vocabulary the Disposition FILTER must offer: the settable catalog plus
 * the AI outcomes the institute configured in Settings → AI Calling (built-ins,
 * custom outcomes, assign/stop lists), the ones its AI agents declare, and the ones
 * its calls have actually returned.
 *
 * The catalog alone can't drive this filter: an AI call's outcome lives in
 * `ai_call_result.disposition` and is never a catalog code, so on an AI-heavy
 * institute every option matched zero rows.
 *
 * Falls back to the catalog when the endpoint isn't deployed yet, so the dropdown
 * degrades to its old contents instead of emptying.
 */
export async function fetchDispositionFilterOptions(
    instituteId: string
): Promise<DispositionOption[]> {
    try {
        const { data } = await authenticatedAxiosInstance.get(`${CALLS_BASE}/dispositions/options`, {
            params: { instituteId },
        });
        if (Array.isArray(data) && data.length) return data;
    } catch (error) {
        if (!isCallLogEndpointMissing(error)) throw error;
    }
    return fetchDispositionCatalog(instituteId);
}

/** Alphanumerics only, upper-cased — mirrors the backend's disposition match key. */
export function normalizeDispositionKey(raw: string | null | undefined): string {
    return raw ? raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
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

// ── GET /{id}/detail ───────────────────────────────────────────────────────

/** One curated provider diagnostic field (hangup cause, SIP/cause code, error, …). */
export interface CallDetailKeyVal {
    label: string;
    value: string;
}

/** Deep per-call detail — richer than the search row, used by the "more details" popover. */
export interface CallDetail extends CallHealthFields {
    id: string;
    provider_type: string | null;
    direction: 'INBOUND' | 'OUTBOUND' | null;
    status: string | null;
    termination_reason: string | null;
    provider_call_id: string | null;
    start_time: number | string | null;
    answer_time: number | string | null;
    end_time: number | string | null;
    duration_seconds: number | null;
    price: number | null;
    provider_details: CallDetailKeyVal[];
    /** Verbatim provider webhook body — present only for callers who may unmask numbers. */
    raw_provider_response: string | null;
    /** Highest-priority fired fault code, e.g. "TTS_WEDGE". */
    diag_headline?: string | null;
    /** Human sentence for {@link diag_headline}, written by the bot. */
    diag_headline_text?: string | null;
    /** Threshold-set version the verdict was computed under. */
    diag_rules_version?: number | null;
    /**
     * Full technical diagnostics for AI calls. Three ways this is null, and the
     * UI must tell them apart:
     *   1. not an AI call / recorded before diagnostics shipped → nothing to show;
     *   2. the caller lacks VIEW_CALL_NUMBERS — the blob carries verbatim caller
     *      utterances (`turnTaking.answersDeletedSamples`) and raw crash text, so
     *      the backend withholds it while still sending the summary fields above;
     *   3. the backend predates the field entirely.
     * Absence is never "healthy".
     */
    diagnostics?: CallDiagnostics | null;
}

export const callDetailKey = (instituteId: string, callLogId: string) =>
    ['crm-call-log-detail', instituteId, callLogId] as const;

export async function fetchCallDetail(instituteId: string, callLogId: string): Promise<CallDetail> {
    const { data } = await authenticatedAxiosInstance.get(`${CALLS_BASE}/${callLogId}/detail`, {
        params: { instituteId },
    });
    return {
        ...data,
        provider_details: Array.isArray(data?.provider_details) ? data.provider_details : [],
        // Explicit so an older backend (no slice 3) resolves to null rather than
        // `undefined` — the health sheet distinguishes "not reported" from "loading".
        diagnostics: (data?.diagnostics as CallDiagnostics | undefined) ?? null,
    };
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
