import { TokenKey } from '@/constants/auth/tokens';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { drainPending } from '@/lib/perf/network-health';

/**
 * Ships a minute of real-user latency to the backend, from a sampled fraction of
 * sessions.
 *
 * This exists so the health portal can answer "which institute is having a bad time,
 * and is it us or their connection?" without anyone having to reconstruct it from
 * container logs after the fact.
 *
 * Three deliberate choices:
 *
 * 1) A bare `fetch`, not the shared axios instance. That instance is instrumented by
 *    this very feature, so posting through it would record the upload's own latency
 *    and feed it into the next upload — a loop that inflates the numbers it reports.
 *    (network-health also filters `/v1/perf/` defensively, so this is belt and
 *    braces.) It also avoids an import cycle: axiosInstance already imports
 *    network-health.
 *
 * 2) Session sampling, not request sampling. A sampled session reports all of its
 *    minutes, so its numbers stay internally consistent; sampling individual requests
 *    would leave every session with a partial, non-comparable picture.
 *
 * 3) Failures are swallowed and the batch is dropped, never retried. Telemetry that
 *    queues and retries during an outage adds load exactly when the platform can least
 *    afford it — which is the moment this data is most likely to be lost anyway.
 */

/** Fraction of sessions that report at all. */
const SAMPLE_RATE = 0.1;
/** How often a sampled session ships what it has accumulated. */
const REPORT_INTERVAL_MS = 60_000;
const SAMPLING_STORAGE_KEY = 'vacademy.perf.rum.sampled';

/**
 * Decide once per session and remember it, so a session does not flip between
 * reporting and not reporting as components remount.
 */
function isSampledSession(): boolean {
    try {
        const stored = sessionStorage.getItem(SAMPLING_STORAGE_KEY);
        if (stored === 'y') return true;
        if (stored === 'n') return false;
        const sampled = Math.random() < SAMPLE_RATE;
        sessionStorage.setItem(SAMPLING_STORAGE_KEY, sampled ? 'y' : 'n');
        return sampled;
    } catch {
        // Private mode, or storage disabled. Default to not reporting: a missing
        // sample costs us a data point, a surprise one costs the user bandwidth.
        return false;
    }
}

async function sendReport(): Promise<void> {
    const payload = drainPending();
    if (!payload) return;

    const token = getTokenFromCookie(TokenKey.accessToken);
    if (!token) return;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
    const instituteId = getInstituteId();
    if (instituteId) headers['clientId'] = instituteId;

    try {
        await fetch(`${BASE_URL}/admin-core-service/v1/perf/rum`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            // Survives the page being closed mid-flight. Unlike sendBeacon, keepalive
            // still allows the Authorization header the endpoint requires.
            keepalive: true,
        });
    } catch {
        // Dropped on purpose — see (3) above.
    }
}

/**
 * Begin reporting if this session was sampled. Returns a stop function; safe to call
 * when the session was not sampled (it simply does nothing).
 */
export function startRumReporting(): () => void {
    if (typeof window === 'undefined' || !isSampledSession()) {
        return () => {};
    }

    let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
        // An idle background tab has nothing worth sending, and its timers are
        // throttled anyway.
        if (typeof document !== 'undefined' && document.hidden) return;
        void sendReport();
    }, REPORT_INTERVAL_MS);

    // Best effort flush of the final partial minute as the tab goes away.
    const onHide = () => {
        if (document.visibilityState === 'hidden') void sendReport();
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
        if (timer) clearInterval(timer);
        timer = null;
        document.removeEventListener('visibilitychange', onHide);
    };
}
