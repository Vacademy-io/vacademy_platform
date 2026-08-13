import type { OfflineDbConnection } from "../connection";
import type { EventQueueRow, EventSyncStatus } from "../types";

/** Durable outbox of offline learning-activity events (plan §B5). */
export const eventQueueDao = {
    async insert(db: OfflineDbConnection, row: EventQueueRow): Promise<void> {
        await db.run(
            `INSERT INTO event_queue
                (client_event_id, user_id, seq, client_ts, event_type, context,
                 payload, sync_status, attempt_count, last_error)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.client_event_id,
                row.user_id,
                row.seq,
                row.client_ts,
                row.event_type,
                row.context,
                row.payload,
                row.sync_status,
                row.attempt_count,
                row.last_error,
            ]
        );
    },

    /** Next per-user monotonic sequence number. */
    async nextSeq(db: OfflineDbConnection, userId: string): Promise<number> {
        const rows = await db.query<{ max_seq: number | null }>(
            "SELECT MAX(seq) AS max_seq FROM event_queue WHERE user_id = ?",
            [userId]
        );
        return (rows[0]?.max_seq ?? 0) + 1;
    },

    async listPending(
        db: OfflineDbConnection,
        userId: string,
        limit: number
    ): Promise<EventQueueRow[]> {
        return db.query<EventQueueRow>(
            `SELECT * FROM event_queue
             WHERE user_id = ? AND sync_status = 'PENDING'
             ORDER BY seq ASC LIMIT ?`,
            [userId, limit]
        );
    },

    async setStatus(
        db: OfflineDbConnection,
        userId: string,
        clientEventIds: string[],
        status: EventSyncStatus,
        lastError: string | null = null
    ): Promise<void> {
        if (clientEventIds.length === 0) return;
        const placeholders = clientEventIds.map(() => "?").join(", ");
        await db.run(
            `UPDATE event_queue SET sync_status = ?, last_error = ?
             WHERE user_id = ? AND client_event_id IN (${placeholders})`,
            [status, lastError, userId, ...clientEventIds]
        );
    },

    async incrementAttempts(
        db: OfflineDbConnection,
        userId: string,
        clientEventIds: string[]
    ): Promise<void> {
        if (clientEventIds.length === 0) return;
        const placeholders = clientEventIds.map(() => "?").join(", ");
        await db.run(
            `UPDATE event_queue SET attempt_count = attempt_count + 1
             WHERE user_id = ? AND client_event_id IN (${placeholders})`,
            [userId, ...clientEventIds]
        );
    },

    /** Boot recovery: demote stale IN_FLIGHT rows back to PENDING. */
    async recoverInFlight(db: OfflineDbConnection, userId: string): Promise<void> {
        await db.run(
            `UPDATE event_queue SET sync_status = 'PENDING'
             WHERE user_id = ? AND sync_status = 'IN_FLIGHT'`,
            [userId]
        );
    },

    async countByStatus(
        db: OfflineDbConnection,
        userId: string,
        status: EventSyncStatus
    ): Promise<number> {
        const rows = await db.query<{ n: number }>(
            "SELECT COUNT(*) AS n FROM event_queue WHERE user_id = ? AND sync_status = ?",
            [userId, status]
        );
        return rows[0]?.n ?? 0;
    },

    async deleteSynced(db: OfflineDbConnection, userId: string): Promise<void> {
        await db.run("DELETE FROM event_queue WHERE user_id = ? AND sync_status = 'SYNCED'", [
            userId,
        ]);
    },
};
