/**
 * Single answer to "should this learner see anything offline at all?".
 *
 * Two independent gates, both required:
 *
 *  1. Platform — `isOfflineSupported()`. Offline is native-only (iOS/Android/
 *     Electron). On plain web the storage is actively hostile: index.html and
 *     public/sw.js nuke caches and service workers on every load, and logout
 *     wipes IndexedDB. Showing a Downloads screen in a browser promises
 *     persistence the platform cannot deliver.
 *  2. Institute — the admin's offline kill switch. A learner whose institute
 *     has offline turned off was still shown an "Offline Downloads" nav entry
 *     and screen that could never hold anything.
 *
 * Only a real server response is treated as an answer. Anything else — no
 * institute id yet, no network, a timeout — is provisional: it reports the last
 * known answer (fail-closed if there has never been one) and keeps retrying in
 * the background. Caching a provisional "no" is what made a fresh install hide
 * Downloads until the app was force-quit: the very first call runs while the app
 * is still booting, `getInstituteId()` isn't populated yet, and that "no" stuck
 * for the entire process lifetime.
 */

import { useEffect, useState } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { OFFLINE_SETTINGS_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import { isOfflineSupported } from "@/lib/offline/platform";
import { Network } from "@/utils/network-plugin";

interface OfflineLearnerSettings {
  enabled: boolean;
  revalidation_days: number;
  max_devices: number;
}

/** Offline UI must not wait on a hanging request; see the timeout note below. */
const SETTINGS_TIMEOUT_MS = 8000;
/** Backoff for re-asking while the answer is still provisional. */
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30_000;

/**
 * Last answer the server actually gave, kept across launches.
 *
 * The in-memory cache dies with the process, so an app opened WITHOUT a
 * connection had nothing to go on and fell back to "not available" — which hid
 * the Downloads screen and every download control at exactly the moment the
 * feature exists for. A learner on a plane saw no way to reach content already
 * on their device. Remembering the last confirmed answer keeps offline mode
 * working offline; the check-in on reconnect is what revokes access if the
 * institute has since turned it off.
 */
const PERSIST_KEY = "offline.institute-enabled";

function readPersisted(): boolean | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw === null ? null : raw === "true";
  } catch {
    return null;
  }
}

function writePersisted(enabled: boolean): void {
  try {
    localStorage.setItem(PERSIST_KEY, String(enabled));
  } catch {
    // private mode / quota — in-memory cache still serves this session
  }
}

/** Set ONLY from a server response. `null` means "still don't really know". */
let cached: boolean | null = null;
let inFlight: Promise<boolean> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_MIN_MS;
let reconnectListenerAttached = false;
/** Mounted gates, notified when the answer changes. */
const subscribers = new Set<(enabled: boolean) => void>();

function notify(enabled: boolean): void {
  subscribers.forEach((subscriber) => subscriber(enabled));
}

/** Clears the cached institute answer (call on logout / institute switch). */
export function resetOfflineAvailabilityCache(): void {
  cached = null;
  inFlight = null;
  retryDelay = RETRY_MIN_MS;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // nothing to clear
  }
}

/**
 * What to report while we still have no server answer: the last confirmed one,
 * or "not available" if this device has never had one. Deliberately does NOT
 * populate `cached` — that would freeze a temporary failure into the session.
 */
function provisionalAnswer(): boolean {
  return readPersisted() ?? false;
}

/**
 * Keeps asking until the server actually answers. Without this, everything that
 * can delay the first attempt — a token not yet written, a cold network, a
 * captive portal — permanently hid the feature for that launch.
 */
function scheduleRetry(): void {
  if (cached !== null || retryTimer !== null) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void fetchInstituteEnabled().then(() => {
      if (cached === null) {
        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
        scheduleRetry();
      }
    });
  }, retryDelay);
}

/** A regained connection is the most likely moment for a provisional answer to become real. */
function attachReconnectRetry(): void {
  if (reconnectListenerAttached) return;
  reconnectListenerAttached = true;
  void Network.addListener("networkStatusChange", (status) => {
    if (!status.connected || cached !== null) return;
    retryDelay = RETRY_MIN_MS;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    scheduleRetry();
  }).catch(() => {
    // no network plugin (web/tests) — the backoff timer still covers us
  });
}

async function fetchInstituteEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const instituteId = await getInstituteId();
      // Not an answer — the learner's institute simply isn't known yet.
      if (!instituteId) return provisionalAnswer();
      const response = await authenticatedAxiosInstance.get<OfflineLearnerSettings>(
        OFFLINE_SETTINGS_URL,
        {
          params: { instituteId },
          // Bounded: an unreachable server makes this hang rather than fail, and
          // the whole offline UI waits on it — the Downloads screen renders
          // blank for as long as the request is outstanding. Time out and treat
          // it as provisional instead of showing nothing indefinitely.
          timeout: SETTINGS_TIMEOUT_MS,
        }
      );
      cached = response.data?.enabled === true;
      writePersisted(cached);
      notify(cached);
      return cached;
    } catch {
      return provisionalAnswer();
    } finally {
      inFlight = null;
    }
  })();

  const answer = await inFlight;
  if (cached === null) {
    // Still provisional — tell the UI what we have and keep trying.
    notify(answer);
    attachReconnectRetry();
    scheduleRetry();
  }
  return answer;
}

/**
 * Re-asks the server, ignoring the session cache. Used by the Downloads screen
 * so an admin turning offline access off (or back on) is reflected the next
 * time the learner opens it, instead of only after an app restart.
 */
export async function refreshOfflineAvailability(): Promise<boolean> {
  if (!isOfflineSupported()) return false;
  cached = null;
  inFlight = null;
  retryDelay = RETRY_MIN_MS;
  return fetchInstituteEnabled();
}

/** Seeds the gate synchronously from the last confirmed answer, before any request. */
export function lastKnownOfflineAvailability(): boolean | null {
  return readPersisted();
}

/**
 * `null` while unknown, so callers can render nothing rather than flashing the
 * offline UI in and then out again.
 */
export function useOfflineAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(() =>
    isOfflineSupported() ? readPersisted() : false
  );

  useEffect(() => {
    let cancelled = false;
    if (!isOfflineSupported()) {
      setAvailable(false);
      return;
    }
    const apply = (enabled: boolean) => {
      if (!cancelled) setAvailable(enabled);
    };
    void fetchInstituteEnabled().then(apply);
    // Re-read whenever the answer is refreshed — by another surface calling
    // refreshOfflineAvailability, or by a background retry finally succeeding.
    subscribers.add(apply);
    return () => {
      cancelled = true;
      subscribers.delete(apply);
    };
  }, []);

  return available;
}
