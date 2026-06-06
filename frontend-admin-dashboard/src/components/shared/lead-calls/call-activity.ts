/**
 * Call-activity model + vendor-ready telephony abstraction.
 *
 * A "Call Log" timeline event can carry a recording (uploaded or recorded in the
 * browser) plus structured call details. All of this is stored in the timeline
 * event's existing `metadata` JSONB column — no schema change — using the
 * snake_case keys in {@link CALL_METADATA_KEYS}.
 *
 * The {@link CallProvider} abstraction below makes this extensible: today the two
 * built-in *sources* (upload / browser recording) cannot place a call, but a
 * future third-party vendor (Twilio, Exotel, Knowlarity, Plivo, …) is added by
 * implementing CallProvider and calling {@link registerCallProvider}. Once a
 * provider with `canPlaceCall` is configured, the Call Log UI can surface a
 * "Call now" action that dials via the vendor and later attaches the vendor's
 * recording — without touching the timeline data model.
 *
 * Backend counterpart to build when a vendor is chosen (mirror the existing
 * Live Session Provider pattern in admin_core_service):
 *   - common_service: `TelephonyProvider` enum (TWILIO, EXOTEL, …)
 *   - `InstituteTelephonyProviderConfig` entity (institute_id, provider,
 *     config_json, status) + repository
 *   - `CallProviderStrategy` interface { placeCall, getRecording, getCallStatus }
 *   - `CallProviderFactory` (enum → impl) + `CallProviderService` (loads config,
 *     dispatches) mirroring LiveSessionProviderFactory / *Service
 *   - `CallController`: POST /place-call, GET /call/{id}/recording
 * The frontend then implements a CallProvider that calls those endpoints.
 */

import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// ─── Domain types ────────────────────────────────────────────────────────────

/**
 * Where a recording came from. Extensible: a future telephony vendor registers
 * its own id (e.g. 'TWILIO') and uses it as the source.
 */
export type CallRecordingSource = 'MANUAL_UPLOAD' | 'BROWSER_RECORDING' | (string & {});

export type CallDirection = 'INBOUND' | 'OUTBOUND';

// Call outcome / disposition options shown in the Call Log dropdown.
// Hard-coded list — add/remove entries here (keep CALL_OUTCOMES and
// CALL_OUTCOME_LABELS in sync; the key is what's stored, the label is shown).
export const CALL_OUTCOMES = [
    'CONNECTED',
    'NO_ANSWER',
    'BUSY',
    'LEFT_VOICEMAIL',
    'CALL_BACK_LATER',
    'NOT_REACHABLE',
    'SWITCHED_OFF',
    'WRONG_NUMBER',
    'INTERESTED',
    'NOT_INTERESTED',
    'FOLLOW_UP_SCHEDULED',
    'DEMO_SCHEDULED',
    'CONVERTED',
    'DO_NOT_CALL',
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number] | (string & {});

export const CALL_OUTCOME_LABELS: Record<string, string> = {
    CONNECTED: 'Connected',
    NO_ANSWER: 'No answer',
    BUSY: 'Busy',
    LEFT_VOICEMAIL: 'Left voicemail',
    CALL_BACK_LATER: 'Call back later',
    NOT_REACHABLE: 'Not reachable',
    SWITCHED_OFF: 'Switched off',
    WRONG_NUMBER: 'Wrong number',
    INTERESTED: 'Interested',
    NOT_INTERESTED: 'Not interested',
    FOLLOW_UP_SCHEDULED: 'Follow-up scheduled',
    DEMO_SCHEDULED: 'Demo scheduled',
    CONVERTED: 'Converted',
    DO_NOT_CALL: 'Do not call',
};

export interface CallRecording {
    source: CallRecordingSource;
    /** Public, playable URL. */
    url: string;
    /** media-service file id (so the URL can be re-resolved later if it expires). */
    fileId?: string;
    mimeType?: string;
    durationSeconds?: number;
}

export interface CallActivity {
    direction?: CallDirection;
    outcome?: CallOutcome;
    phoneNumber?: string;
    /** Vendor id, when the call was placed/recorded by a telephony vendor. */
    provider?: string;
    /** Vendor call id (SID). */
    externalCallId?: string;
    /** Our telephony_call_log row id — set when the note was created from the
     *  Call History panel, so the note can be linked back to that specific call. */
    telephonyCallLogId?: string;
    recording?: CallRecording;
}

// ─── Timeline metadata (de)serialization ─────────────────────────────────────

/**
 * Keys reserved for call activity inside a timeline event's `metadata`. The
 * timeline renders unknown metadata keys as generic badges, so the display layer
 * must exclude these (see {@link stripCallMetadata}) and render the dedicated
 * call card instead.
 */
export const CALL_METADATA_KEYS = [
    'recording_source',
    'recording_url',
    'recording_file_id',
    'recording_mime_type',
    'recording_duration_seconds',
    'call_direction',
    'call_outcome',
    'phone_number',
    'call_provider',
    'external_call_id',
    // Internal telephony_call_log row id — set when the note was created from a
    // specific call in the Call History panel. Lets us later look up which
    // notes belong to which call without scanning all timeline events.
    'telephony_call_log_id',
] as const;

export function callActivityToMetadata(call: CallActivity): Record<string, unknown> {
    const m: Record<string, unknown> = {};
    if (call.direction) m.call_direction = call.direction;
    if (call.outcome) m.call_outcome = call.outcome;
    if (call.phoneNumber?.trim()) m.phone_number = call.phoneNumber.trim();
    if (call.provider) m.call_provider = call.provider;
    if (call.externalCallId) m.external_call_id = call.externalCallId;
    if (call.telephonyCallLogId) m.telephony_call_log_id = call.telephonyCallLogId;
    if (call.recording) {
        m.recording_source = call.recording.source;
        m.recording_url = call.recording.url;
        if (call.recording.fileId) m.recording_file_id = call.recording.fileId;
        if (call.recording.mimeType) m.recording_mime_type = call.recording.mimeType;
        if (call.recording.durationSeconds != null) {
            m.recording_duration_seconds = Math.round(call.recording.durationSeconds);
        }
    }
    return m;
}

export function callActivityFromMetadata(
    metadata: Record<string, unknown> | null | undefined
): CallActivity | null {
    if (!metadata) return null;
    const hasCall = CALL_METADATA_KEYS.some((k) => metadata[k] != null);
    if (!hasCall) return null;

    const recordingUrl = metadata.recording_url as string | undefined;
    const recording: CallRecording | undefined = recordingUrl
        ? {
              source: (metadata.recording_source as CallRecordingSource) ?? 'MANUAL_UPLOAD',
              url: recordingUrl,
              fileId: metadata.recording_file_id as string | undefined,
              mimeType: metadata.recording_mime_type as string | undefined,
              durationSeconds: metadata.recording_duration_seconds as number | undefined,
          }
        : undefined;

    return {
        direction: metadata.call_direction as CallDirection | undefined,
        outcome: metadata.call_outcome as CallOutcome | undefined,
        phoneNumber: metadata.phone_number as string | undefined,
        provider: metadata.call_provider as string | undefined,
        externalCallId: metadata.external_call_id as string | undefined,
        telephonyCallLogId: metadata.telephony_call_log_id as string | undefined,
        recording,
    };
}

/** True when the call activity has any meaningful content worth persisting. */
export function isCallActivityEmpty(call: CallActivity | null | undefined): boolean {
    if (!call) return true;
    return (
        !call.recording &&
        !call.direction &&
        !call.outcome &&
        !call.phoneNumber?.trim() &&
        !call.externalCallId
    );
}

/**
 * Drop call-activity keys so the generic metadata badge renderer doesn't show
 * raw URLs / file ids. Returns any *other* metadata untouched.
 */
export function stripCallMetadata(
    metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    if (!metadata) return {};
    const reserved = CALL_METADATA_KEYS as readonly string[];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata)) {
        if (!reserved.includes(k)) out[k] = v;
    }
    return out;
}

export function formatCallDuration(totalSeconds: number | undefined): string {
    if (totalSeconds == null || !isFinite(totalSeconds) || totalSeconds < 0) return '';
    const s = Math.round(totalSeconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
}

// ─── Vendor-ready provider abstraction ───────────────────────────────────────

export interface PlaceCallArgs {
    phoneNumber: string;
    leadId: string;
    leadType?: string;
}

export interface PlaceCallResult {
    externalCallId: string;
    provider: string;
}

/**
 * A telephony provider. Built-in recording sources don't implement this (they
 * can't place calls); a future vendor does, then registers via
 * {@link registerCallProvider}.
 */
export interface CallProvider {
    id: string;
    label: string;
    /** Whether this provider can place an outbound call from the dashboard. */
    canPlaceCall: boolean;
    placeCall?(args: PlaceCallArgs): Promise<PlaceCallResult>;
    /** Resolve the vendor's recording for a completed call. */
    fetchRecording?(externalCallId: string): Promise<CallRecording>;
}

const providerRegistry = new Map<string, CallProvider>();

export function registerCallProvider(provider: CallProvider): void {
    providerRegistry.set(provider.id, provider);
}

export function getCallProvider(id: string): CallProvider | undefined {
    return providerRegistry.get(id);
}

export function listCallProviders(): CallProvider[] {
    return Array.from(providerRegistry.values());
}

/**
 * Providers that can actually place a call (used to decide whether to show a
 * "Call now" button). Empty until a vendor is registered.
 */
export function getDialableProviders(): CallProvider[] {
    return listCallProviders().filter(
        (p) => p.canPlaceCall && typeof p.placeCall === 'function'
    );
}

// ─── Auth context for media uploads ──────────────────────────────────────────

/** Resolve the current user + institute ids for media-service uploads. */
export function getMediaUploadContext(): { userId: string; instituteId?: string } {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken) as
        | { userId?: string; sub?: string; authorities?: Record<string, unknown> }
        | null
        | undefined;
    const instituteId = data?.authorities ? Object.keys(data.authorities)[0] : undefined;
    const userId = data?.userId || data?.sub || '';
    return { userId, instituteId };
}
