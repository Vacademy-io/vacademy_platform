/**
 * Shared offline/online branch point for the tracking hooks (plan §B5
 * "track-or-queue.ts"). The online path in useVideoSync/usePdfSync/
 * useAudioSync stays completely unchanged (battle-hardened against known
 * backend races) — this only intercepts the offline case so a payload never
 * sits stuck as "pending" in Preferences forever with no connectivity.
 */

import { Network } from "@/utils/network-plugin";
import { recordEvent, type OfflineEventContext, type OfflineEventType } from "./event-queue";

export interface TrackOrQueueInput {
  userId: string;
  eventType: OfflineEventType;
  context: OfflineEventContext;
  /** ActivityLogDTO-shaped payload the hook would otherwise have POSTed. */
  payload: unknown;
  /** Skip the connectivity check and queue unconditionally — used when the caller already knows the normal POST just failed on a network error. */
  force?: boolean;
}

/**
 * Returns `true` when the event was durably queued for later sync (the
 * caller should treat this tick as handled / mark it SYNCED locally and
 * skip its normal POST). Returns `false` when online — the caller should
 * proceed with its normal request unchanged.
 */
export async function trackOrQueue(input: TrackOrQueueInput): Promise<boolean> {
  if (!input.force) {
    const status = await Network.getStatus();
    if (status.connected) return false;
  }
  await recordEvent({
    userId: input.userId,
    eventType: input.eventType,
    context: input.context,
    payload: input.payload,
  });
  return true;
}

/**
 * Heuristic for "this POST failed because there's no connectivity" (as
 * opposed to a 4xx/5xx the backend actually processed) — axios sets
 * `code: "ERR_NETWORK"` and no `response` when the request never reached
 * the server.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; response?: unknown };
  if (err.response) return false; // server answered — not a connectivity issue
  return err.code === "ERR_NETWORK" || err.message === "Network Error";
}
