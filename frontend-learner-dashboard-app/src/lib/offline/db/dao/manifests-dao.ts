import type { OfflineDbConnection } from "../connection";
import type { ManifestRow } from "../types";

/** Manifest snapshots per (user, package_session). tree_json drives offline nav. */
export const manifestsDao = {
    async get(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string
    ): Promise<ManifestRow | null> {
        const rows = await db.query<ManifestRow>(
            "SELECT * FROM manifests WHERE user_id = ? AND package_session_id = ?",
            [userId, packageSessionId]
        );
        return rows[0] ?? null;
    },

    async listForUser(db: OfflineDbConnection, userId: string): Promise<ManifestRow[]> {
        return db.query<ManifestRow>(
            "SELECT * FROM manifests WHERE user_id = ? ORDER BY fetched_at DESC",
            [userId]
        );
    },

    async upsert(db: OfflineDbConnection, row: ManifestRow): Promise<void> {
        await db.run(
            `INSERT INTO manifests
                (user_id, package_session_id, institute_id, version, fetched_at,
                 tree_json, update_available)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, package_session_id) DO UPDATE SET
                institute_id = excluded.institute_id,
                version = excluded.version,
                fetched_at = excluded.fetched_at,
                tree_json = excluded.tree_json,
                update_available = excluded.update_available`,
            [
                row.user_id,
                row.package_session_id,
                row.institute_id,
                row.version,
                row.fetched_at,
                row.tree_json,
                row.update_available,
            ]
        );
    },

    async setUpdateAvailable(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string,
        updateAvailable: boolean
    ): Promise<void> {
        await db.run(
            "UPDATE manifests SET update_available = ? WHERE user_id = ? AND package_session_id = ?",
            [updateAvailable ? 1 : 0, userId, packageSessionId]
        );
    },

    async delete(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string
    ): Promise<void> {
        await db.run("DELETE FROM manifests WHERE user_id = ? AND package_session_id = ?", [
            userId,
            packageSessionId,
        ]);
    },
};
