/**
 * Offline event flusher (plan §B5 "event-flusher.ts"). Singleton that drains
 * the durable event_queue outbox to the backend's idempotent batch endpoint
 * (Part A4: POST .../learner-tracking/offline-sync/v1/batch).
 *
 * Triggers: network reconnect, a 60s interval, and (native only) the app
 * going to background — mirrors useVideoSync.ts's appStateChange pattern.
 */

import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { OFFLINE_SYNC_BATCH_URL } from "@/constants/urls";
import { Network } from "@/utils/network-plugin";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getOfflineDb, type OfflineDbConnection } from "../db/connection";
import { eventQueueDao } from "../db/dao/event-queue-dao";
import { deviceStateDao } from "../db/dao/device-state-dao";
import type { EventQueueRow } from "../db/types";
import type { OfflineEventContext } from "./event-queue";

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 60_000;
/** Rows at/above this attempt_count stop retrying (plan §B5: backoff x10 -> FAILED_PERMANENT). */
const MAX_ATTEMPTS = 10;

interface BatchEventPayload {
  client_event_id: string;
  seq: number;
  client_ts: number;
  event_type: string;
  slide_id: string | null;
  chapter_id: string | null;
  module_id: string | null;
  subject_id: string | null;
  package_session_id: string | null;
  payload: unknown;
}

interface BatchResultDTO {
  client_event_id: string;
  status: "ACCEPTED" | "DUPLICATE" | "FAILED";
  error_code?: string | null;
}

interface BatchResponse {
  device_status: "ACTIVE" | "REVOKED";
  results: BatchResultDTO[];
}

/**
 * Fired when the backend reports the device as REVOKED after a flush.
 * Empty by default — Phase 9 (lease/revocation) wires the purge+notify flow
 * here so this module has no hard dependency on it.
 */
let onDeviceRevokedHandler: (userId: string) => void = () => {};
export function setOnDeviceRevoked(handler: (userId: string) => void): void {
  onDeviceRevokedHandler = handler;
}

function toBatchEvent(row: EventQueueRow): BatchEventPayload {
  let ctx: OfflineEventContext = {};
  try {
    ctx = row.context ? (JSON.parse(row.context) as OfflineEventContext) : {};
  } catch {
    ctx = {};
  }
  let payload: unknown = {};
  try {
    payload = row.payload ? JSON.parse(row.payload) : {};
  } catch {
    payload = {};
  }
  return {
    client_event_id: row.client_event_id,
    seq: row.seq,
    client_ts: row.client_ts,
    event_type: row.event_type,
    slide_id: ctx.slideId ?? null,
    chapter_id: ctx.chapterId ?? null,
    module_id: ctx.moduleId ?? null,
    subject_id: ctx.subjectId ?? null,
    package_session_id: ctx.packageSessionId ?? null,
    payload,
  };
}

class EventFlusher {
  private inFlight = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private networkListenerHandle: { remove: () => void | Promise<void> } | null = null;
  private appStateListenerHandle: { remove: () => void | Promise<void> } | null = null;

  /** Boot recovery (stale IN_FLIGHT -> PENDING) + wires triggers + does the first flush. Call once per app start / login. */
  async init(userId: string): Promise<void> {
    const db = await getOfflineDb();
    await eventQueueDao.recoverInFlight(db, userId);

    if (!this.networkListenerHandle) {
      this.networkListenerHandle = await Network.addListener("networkStatusChange", (status) => {
        if (status.connected) void this.flush(userId);
      });
    }
    if (!this.intervalHandle) {
      this.intervalHandle = setInterval(() => void this.flush(userId), FLUSH_INTERVAL_MS);
    }
    if (!this.appStateListenerHandle && Capacitor.isNativePlatform()) {
      this.appStateListenerHandle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) void this.flush(userId);
      });
    }

    await this.flush(userId);
  }

  async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.networkListenerHandle) {
      await this.networkListenerHandle.remove();
      this.networkListenerHandle = null;
    }
    if (this.appStateListenerHandle) {
      await this.appStateListenerHandle.remove();
      this.appStateListenerHandle = null;
    }
  }

  /** Drains PENDING rows in <=50-row batches, ordered by seq. Module-level in-flight guard prevents overlapping flushes from the various triggers. */
  async flush(userId: string): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const db = await getOfflineDb();
      const deviceState = await deviceStateDao.get(db, userId);
      if (!deviceState?.device_id) {
        console.debug("[event-flusher] no device registered yet — skipping flush");
        return;
      }

      // Keep draining while a full page came back — more may be pending.
      let more = true;
      while (more) {
        more = await this.flushOneBatch(db, userId, deviceState.device_id);
      }
      await eventQueueDao.deleteSynced(db, userId);
    } catch (error) {
      console.error("[event-flusher] flush failed", error);
    } finally {
      this.inFlight = false;
    }
  }

  private async flushOneBatch(db: OfflineDbConnection, userId: string, deviceId: string): Promise<boolean> {
    const pending = await eventQueueDao.listPending(db, userId, BATCH_SIZE);
    if (pending.length === 0) return false;

    const exhausted = pending.filter((r) => r.attempt_count >= MAX_ATTEMPTS);
    const ready = pending.filter((r) => r.attempt_count < MAX_ATTEMPTS);
    if (exhausted.length > 0) {
      await eventQueueDao.setStatus(
        db,
        userId,
        exhausted.map((r) => r.client_event_id),
        "FAILED_PERMANENT",
        "max sync attempts exceeded"
      );
    }
    if (ready.length === 0) return pending.length === BATCH_SIZE;

    const ids = ready.map((r) => r.client_event_id);
    await eventQueueDao.setStatus(db, userId, ids, "IN_FLIGHT");

    try {
      const response = await authenticatedAxiosInstance.post<BatchResponse>(OFFLINE_SYNC_BATCH_URL, {
        device_id: deviceId,
        events: ready.map(toBatchEvent),
      });
      const { device_status, results } = response.data;

      const synced: string[] = [];
      const retry: string[] = [];
      for (const result of results) {
        if (result.status === "ACCEPTED" || result.status === "DUPLICATE") {
          synced.push(result.client_event_id);
        } else {
          retry.push(result.client_event_id);
        }
      }
      if (synced.length > 0) await eventQueueDao.setStatus(db, userId, synced, "SYNCED");
      if (retry.length > 0) {
        await eventQueueDao.setStatus(db, userId, retry, "PENDING");
        await eventQueueDao.incrementAttempts(db, userId, retry);
      }

      if (device_status === "REVOKED") onDeviceRevokedHandler(userId);

      return pending.length === BATCH_SIZE;
    } catch (error) {
      // Network/transport failure: whole batch goes back to PENDING without
      // bumping attempt_count — a transport error isn't the event's fault.
      await eventQueueDao.setStatus(db, userId, ids, "PENDING");
      console.error("[event-flusher] batch POST failed", error);
      return false;
    }
  }
}

export const eventFlusher = new EventFlusher();
