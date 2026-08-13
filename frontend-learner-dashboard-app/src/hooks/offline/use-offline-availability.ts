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
 * The institute answer is cached in memory for the session and falls back to
 * "not available" on error, so a flaky network can't flash offline UI on and
 * off. It is deliberately fail-closed: better to hide a feature briefly than to
 * advertise one the institute has disabled.
 */

import { useEffect, useState } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { OFFLINE_SETTINGS_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import { isOfflineSupported } from "@/lib/offline/platform";

interface OfflineLearnerSettings {
  enabled: boolean;
  revalidation_days: number;
  max_devices: number;
}

/** Offline UI must not wait on a hanging request; see the timeout note below. */
const SETTINGS_TIMEOUT_MS = 8000;

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

let cached: boolean | null = null;
let inFlight: Promise<boolean> | null = null;
/** Mounted gates, notified when the answer is refreshed. */
const subscribers = new Set<(enabled: boolean) => void>();

/** Clears the cached institute answer (call on logout / institute switch). */
export function resetOfflineAvailabilityCache(): void {
  cached = null;
  inFlight = null;
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // nothing to clear
  }
}

/**
 * What to report when the server can't be reached: the last confirmed answer,
 * or "not available" if this device has never had one. Never-confirmed stays
 * fail-closed — we still don't advertise a feature nobody has granted.
 */
function fallbackWhenUnreachable(): boolean {
  const remembered = readPersisted();
  cached = remembered ?? false;
  subscribers.forEach((notify) => notify(cached === true));
  return cached;
}

async function fetchInstituteEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const instituteId = await getInstituteId();
      if (!instituteId) return fallbackWhenUnreachable();
      const response = await authenticatedAxiosInstance.get<OfflineLearnerSettings>(
        OFFLINE_SETTINGS_URL,
        {
          params: { instituteId },
          // Bounded: an unreachable server makes this hang rather than fail, and
          // the whole offline UI waits on it — the Downloads screen renders
          // blank for as long as the request is outstanding. Time out and treat
          // it as "not available" instead of showing nothing indefinitely.
          timeout: SETTINGS_TIMEOUT_MS,
        }
      );
      cached = response.data?.enabled === true;
      writePersisted(cached);
      subscribers.forEach((notify) => notify(cached === true));
      return cached;
    } catch {
      return fallbackWhenUnreachable();
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
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
    // Re-read whenever another surface refreshes the answer (see
    // refreshOfflineAvailability) so every mounted gate agrees.
    subscribers.add(apply);
    return () => {
      cancelled = true;
      subscribers.delete(apply);
    };
  }, []);

  return available;
}
