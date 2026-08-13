import { v4 as uuidv4 } from "uuid";
import type { OfflineDbConnection } from "../connection";
import type { NoticeRow, OfflineNoticeKind } from "../types";

/** "Removed by your institute" / lease / update notices surfaced on the downloads screen (plan §B9/§5, migration batch 2). */
export const noticesDao = {
    async insert(
        db: OfflineDbConnection,
        userId: string,
        kind: OfflineNoticeKind,
        packageSessionId: string | null,
        message: string | null
    ): Promise<void> {
        // Dedupe: every check-in (app start, reconnect, 6h tick, pre-download)
        // re-reports the same revocation, which previously stacked up as N
        // identical notice cards. One unseen notice per (kind, course) is
        // enough — refresh its timestamp instead of inserting a duplicate.
        const existing = await db.query<{ id: string }>(
            `SELECT id FROM offline_notices
             WHERE user_id = ? AND kind = ? AND seen = 0
               AND ((package_session_id IS NULL AND ? IS NULL) OR package_session_id = ?)
             LIMIT 1`,
            [userId, kind, packageSessionId, packageSessionId]
        );
        if (existing[0]) {
            await db.run("UPDATE offline_notices SET created_at = ?, message = ? WHERE id = ?", [
                Date.now(),
                message,
                existing[0].id,
            ]);
            return;
        }
        await db.run(
            `INSERT INTO offline_notices (id, user_id, kind, package_session_id, message, created_at, seen)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [uuidv4(), userId, kind, packageSessionId, message, Date.now()]
        );
    },

    async listUnseen(db: OfflineDbConnection, userId: string): Promise<NoticeRow[]> {
        return db.query<NoticeRow>(
            "SELECT * FROM offline_notices WHERE user_id = ? AND seen = 0 ORDER BY created_at DESC",
            [userId]
        );
    },

    async listAll(db: OfflineDbConnection, userId: string): Promise<NoticeRow[]> {
        return db.query<NoticeRow>(
            "SELECT * FROM offline_notices WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );
    },

    async markSeen(db: OfflineDbConnection, userId: string, id: string): Promise<void> {
        await db.run("UPDATE offline_notices SET seen = 1 WHERE user_id = ? AND id = ?", [userId, id]);
    },

    async markAllSeen(db: OfflineDbConnection, userId: string): Promise<void> {
        await db.run("UPDATE offline_notices SET seen = 1 WHERE user_id = ?", [userId]);
    },

    /**
     * Drops notices of the given kinds outright.
     *
     * Used when the condition a notice describes is demonstrably no longer true —
     * e.g. the institute re-enables offline access, which makes a lingering
     * "your institute turned off offline downloads" card actively misleading.
     * These are deleted rather than marked seen so they can never resurface.
     */
    async deleteByKinds(
        db: OfflineDbConnection,
        userId: string,
        kinds: OfflineNoticeKind[]
    ): Promise<void> {
        if (kinds.length === 0) return;
        const placeholders = kinds.map(() => "?").join(", ");
        await db.run(
            `DELETE FROM offline_notices WHERE user_id = ? AND kind IN (${placeholders})`,
            [userId, ...kinds]
        );
    },
};
