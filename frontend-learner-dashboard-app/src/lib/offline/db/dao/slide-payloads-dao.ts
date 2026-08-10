import type { OfflineDbConnection } from "../connection";
import type { SlidePayloadRow } from "../types";

/** Encrypted JSON payloads (quiz/question/doc slides) for offline rendering. */
export const slidePayloadsDao = {
    async get(
        db: OfflineDbConnection,
        userId: string,
        slideId: string
    ): Promise<SlidePayloadRow | null> {
        const rows = await db.query<SlidePayloadRow>(
            "SELECT * FROM slide_payloads WHERE user_id = ? AND slide_id = ?",
            [userId, slideId]
        );
        return rows[0] ?? null;
    },

    async upsert(db: OfflineDbConnection, row: SlidePayloadRow): Promise<void> {
        await db.run(
            `INSERT INTO slide_payloads
                (user_id, slide_id, manifest_version, ciphertext, nonce, key_ref)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, slide_id) DO UPDATE SET
                manifest_version = excluded.manifest_version,
                ciphertext = excluded.ciphertext,
                nonce = excluded.nonce,
                key_ref = excluded.key_ref`,
            [row.user_id, row.slide_id, row.manifest_version, row.ciphertext, row.nonce, row.key_ref]
        );
    },

    async delete(db: OfflineDbConnection, userId: string, slideId: string): Promise<void> {
        await db.run("DELETE FROM slide_payloads WHERE user_id = ? AND slide_id = ?", [
            userId,
            slideId,
        ]);
    },

    async deleteAllForUser(db: OfflineDbConnection, userId: string): Promise<void> {
        await db.run("DELETE FROM slide_payloads WHERE user_id = ?", [userId]);
    },
};
