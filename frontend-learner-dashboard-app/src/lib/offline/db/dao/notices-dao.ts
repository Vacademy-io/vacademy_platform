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
};
