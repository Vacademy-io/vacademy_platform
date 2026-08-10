/**
 * Offline event queue (plan §B5 "event-queue.ts"). Durable SQLite outbox for
 * learning-activity events recorded while the learner was offline (or a
 * tracking POST failed on a network error) — inserted here with a monotonic
 * per-user `seq`, batched out to the backend by `event-flusher.ts`.
 */

import { v4 as uuidv4 } from "uuid";
import { getOfflineDb } from "../db/connection";
import { eventQueueDao } from "../db/dao/event-queue-dao";
import type { EventQueueRow } from "../db/types";

/** Mirrors the backend's OfflineSyncEventRequestDTO.eventType values (A4). */
export type OfflineEventType =
  | "VIDEO"
  | "DOCUMENT"
  | "HTML_VIDEO"
  | "AUDIO"
  | "QUESTION"
  | "QUIZ"
  | "ASSIGNMENT"
  | "DOWNLOAD_STATE";

export interface OfflineEventContext {
  slideId?: string | null;
  chapterId?: string | null;
  moduleId?: string | null;
  subjectId?: string | null;
  packageSessionId?: string | null;
}

export interface RecordEventInput {
  userId: string;
  eventType: OfflineEventType;
  context: OfflineEventContext;
  /** ActivityLogDTO-shaped payload (DOWNLOAD_STATE uses its own small shape). Serialized verbatim into the outbox row; the flusher forwards it as-is to the batch endpoint's `payload` field. */
  payload: unknown;
}

/**
 * Appends one event to the durable outbox. Returns the generated
 * client_event_id (the dedup key the backend's ledger keys off).
 */
export async function recordEvent(input: RecordEventInput): Promise<string> {
  const db = await getOfflineDb();
  const clientEventId = uuidv4();
  const seq = await eventQueueDao.nextSeq(db, input.userId);
  const row: EventQueueRow = {
    client_event_id: clientEventId,
    user_id: input.userId,
    seq,
    client_ts: Date.now(),
    event_type: input.eventType,
    context: JSON.stringify(input.context ?? {}),
    payload: JSON.stringify(input.payload ?? {}),
    sync_status: "PENDING",
    attempt_count: 0,
    last_error: null,
  };
  await eventQueueDao.insert(db, row);
  return clientEventId;
}

/**
 * Download-manager helper: records a DOWNLOAD_STATE event when a slide
 * finishes downloading or its offline copy is deleted, so the backend's
 * `offline_download_state` telemetry (plan A5) stays in sync once
 * connectivity returns.
 */
export async function recordDownloadStateEvent(
  userId: string,
  slideId: string,
  packageSessionId: string,
  state: "DOWNLOADED" | "DELETED"
): Promise<void> {
  await recordEvent({
    userId,
    eventType: "DOWNLOAD_STATE",
    context: { slideId, packageSessionId },
    payload: {
      slide_id: slideId,
      package_session_id: packageSessionId,
      status: state,
    },
  });
}
