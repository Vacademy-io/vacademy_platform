import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { placeCall, type PlaceCallResponse } from './services/place-call';
import { fetchCallHistory } from './services/call-history';
import { TELEPHONY_CALL_EVENTS } from '@/constants/urls';

/**
 * Normalised call status pushed from the backend SSE stream — mirrors the
 * Java enum CallStatus.
 */
type CallStatus =
    | 'INITIATED'
    | 'QUEUED'
    | 'COUNSELLOR_RINGING'
    | 'COUNSELLOR_ANSWERED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'NO_ANSWER'
    | 'BUSY'
    | 'FAILED'
    | 'CANCELLED';

interface CallEvent {
    correlationId: string;
    providerCallId?: string;
    status: CallStatus;
    durationSeconds?: number | null;
    recordingUrl?: string | null;
}

const TERMINAL: ReadonlySet<CallStatus> = new Set<CallStatus>([
    'COMPLETED',
    'NO_ANSWER',
    'BUSY',
    'FAILED',
    'CANCELLED',
]);

const formatDuration = (s?: number | null): string => {
    if (!s || s <= 0) return '';
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
};

const labelFor = (status: CallStatus, durationSeconds?: number | null): string => {
    switch (status) {
        case 'INITIATED':
        case 'QUEUED':
        case 'COUNSELLOR_RINGING':
            return 'Ringing your phone…';
        case 'COUNSELLOR_ANSWERED':
            return 'Connecting the lead…';
        case 'IN_PROGRESS':
            return 'Connected · live';
        case 'COMPLETED': {
            const d = formatDuration(durationSeconds);
            return d ? `Call ended · ${d}` : 'Call ended';
        }
        case 'NO_ANSWER':
            return 'No answer';
        case 'BUSY':
            return 'Lead is busy';
        case 'FAILED':
            return 'Call failed';
        case 'CANCELLED':
            return 'Call cancelled';
        default:
            return 'Call in progress';
    }
};

interface UsePlaceCallOptions {
    /** Extra query keys to invalidate when a call terminates (lists / KPIs). */
    invalidateKeys?: QueryKey[];
}

/**
 * Mutation hook for the recent-leads Call action. On click:
 *   1. POST /v1/telephony/calls/connect → returns a callLogId + SSE URL.
 *   2. Open EventSource on the SSE URL — server fans webhook updates to us.
 *   3. Update a single toast.loading() in place as the status moves through
 *      QUEUED → COUNSELLOR_RINGING → COUNSELLOR_ANSWERED → IN_PROGRESS →
 *      terminal. Toast becomes the live status surface; no polling.
 *   4. On terminal status, close the stream, swap to success/error toast,
 *      invalidate caller-supplied query keys so the row reflects the new call.
 */
export function usePlaceCall({ invalidateKeys = [] }: UsePlaceCallOptions = {}) {
    const queryClient = useQueryClient();
    const instituteId = getCurrentInstituteId() ?? '';

    const onSuccess = useCallback(
        (resp: PlaceCallResponse, vars: { responseId: string; userId?: string }) => {
            // One toast id, updated in place so the sales person sees one
            // continuously-evolving status row instead of stacked toasts.
            const toastId = toast.loading('Ringing your phone…', { duration: Infinity });

            // SSE — server publishes one "status" event per webhook callback.
            // EventSource can't send Authorization headers; the callLogId UUID
            // (returned only to the counsellor who placed the call) is the
            // capability token. The endpoint is on the public-paths list so
            // we do NOT pass `withCredentials: true` — sending credentials to
            // a public endpoint breaks CORS preflight on most setups, and the
            // server doesn't need them here anyway.
            const url = TELEPHONY_CALL_EVENTS(resp.callLogId);
            const es = new EventSource(url);

            // Tracks whether the toast has already been resolved (terminal
            // event received OR fallback poll determined the call is done).
            // Anything that fires after this point is a no-op.
            let resolved = false;
            // Track whether ANY real event has arrived. If yes and SSE errors,
            // we assume the connection dropped on the terminal frame rather
            // than the call truly stalling — the row in DB has the truth.
            let receivedAnyEvent = false;
            // Recovery timer: when SSE errors, give it a few seconds, then
            // poll the call log to determine the actual final state.
            let recoveryTimer: number | null = null;
            const clearRecoveryTimer = () => {
                if (recoveryTimer !== null) {
                    window.clearTimeout(recoveryTimer);
                    recoveryTimer = null;
                }
            };

            const resolveAs = (kind: 'success' | 'error' | 'silent', message?: string) => {
                if (resolved) return;
                resolved = true;
                clearRecoveryTimer();
                try {
                    es.close();
                } catch {
                    /* noop */
                }
                if (kind === 'success' && message) {
                    toast.success(message, { id: toastId, duration: 4000 });
                } else if (kind === 'error' && message) {
                    toast.error(message, { id: toastId, duration: 4000 });
                } else {
                    // Silent close — just dismiss the loading toast.
                    toast.dismiss(toastId);
                }
                queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
                queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
                queryClient.invalidateQueries({ queryKey: ['latest-notes-batch'] });
                queryClient.invalidateQueries({ queryKey: ['telephony-call-history'] });
                for (const key of invalidateKeys) {
                    queryClient.invalidateQueries({ queryKey: key });
                }
            };

            es.addEventListener('status', (e) => {
                let ev: CallEvent;
                try {
                    ev = JSON.parse((e as MessageEvent).data) as CallEvent;
                } catch {
                    return;
                }
                receivedAnyEvent = true;
                clearRecoveryTimer();
                const text = labelFor(ev.status, ev.durationSeconds);
                if (ev.status === 'COMPLETED') {
                    resolveAs('success', text);
                } else if (TERMINAL.has(ev.status)) {
                    resolveAs('error', text);
                } else {
                    toast.loading(text, { id: toastId, duration: Infinity });
                }
            });

            // Heartbeat pings — connection is healthy.
            es.addEventListener('ping', () => clearRecoveryTimer());

            es.onerror = () => {
                if (resolved) return;
                if (recoveryTimer !== null) return;  // already scheduled
                // The most common reason we hit onerror after a real call:
                // server's complete() closed the stream microseconds before the
                // final terminal frame reached the browser. Wait briefly, then
                // poll the call log via the history endpoint — the DB has the
                // truth. (If a real network drop happened mid-call, the poll
                // will return the latest known status and we render that.)
                recoveryTimer = window.setTimeout(async () => {
                    recoveryTimer = null;
                    if (resolved) return;
                    const userId = vars.userId;
                    if (!userId) {
                        // No userId to look up by → close silently rather than
                        // false-flag the call as lost.
                        resolveAs('silent');
                        return;
                    }
                    try {
                        const history = await fetchCallHistory(userId, instituteId, 0, 5);
                        const row = history?.content?.find((c) => c.id === resp.callLogId);
                        if (!row) {
                            resolveAs('silent');
                            return;
                        }
                        const text = labelFor(row.status as CallStatus, row.durationSeconds);
                        if (row.status === 'COMPLETED') {
                            resolveAs('success', text);
                        } else if (TERMINAL.has(row.status as CallStatus)) {
                            resolveAs('error', text);
                        } else if (receivedAnyEvent) {
                            // We saw events but the row isn't terminal yet —
                            // SSE genuinely dropped mid-call. Soft message.
                            toast.message('Live updates lost · check call history shortly', {
                                id: toastId,
                                duration: 6000,
                            });
                            resolved = true;
                            try { es.close(); } catch { /* noop */ }
                        } else {
                            resolveAs('silent');
                        }
                    } catch {
                        // Polling failed — close silently rather than show a
                        // false "lost updates" message.
                        resolveAs('silent');
                    }
                }, 4000);
            };
        },
        [queryClient, invalidateKeys, instituteId]
    );

    return useMutation({
        mutationFn: (vars: {
            responseId: string;
            userId?: string;
            preferredNumberId?: string;
        }) =>
            placeCall({
                instituteId,
                responseId: vars.responseId,
                userId: vars.userId,
                preferredNumberId: vars.preferredNumberId,
            }),
        onSuccess,
        onError: (err) => toast.error(extractServerErrorMessage(err)),
    });
}

/**
 * Pulls the human-readable error out of an axios/server error.
 *
 * The backend's GlobalExceptionHandler returns an ErrorInfo body with shape:
 *   { url, ex, responseCode, date }
 * where `ex` is the actual VacademyException message
 * (e.g. "Your Exotel account is out of balance. Top up at my.exotel.com…").
 *
 * Plain `err.message` on an axios error is just "Request failed with status
 * code 510" — useless to the counsellor. We dig into the response body first
 * and fall back to the generic message only if we can't find anything.
 */
function extractServerErrorMessage(err: unknown): string {
    if (err && typeof err === 'object') {
        const e = err as {
            response?: { data?: { ex?: string; message?: string } };
            message?: string;
        };
        if (e.response?.data?.ex && typeof e.response.data.ex === 'string') {
            return e.response.data.ex;
        }
        if (e.response?.data?.message && typeof e.response.data.message === 'string') {
            return e.response.data.message;
        }
        if (typeof e.message === 'string') return e.message;
    }
    return 'Could not place call';
}
