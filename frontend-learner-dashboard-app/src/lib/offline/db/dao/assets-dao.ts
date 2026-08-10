import type { OfflineDbConnection } from "../connection";
import type { AssetDownloadStatus, AssetRow } from "../types";

/** Per-(slide, file) download tracking. Bytes on disk are ref-counted by file_id. */
export const assetsDao = {
    async get(
        db: OfflineDbConnection,
        userId: string,
        fileId: string,
        slideId: string
    ): Promise<AssetRow | null> {
        const rows = await db.query<AssetRow>(
            "SELECT * FROM assets WHERE user_id = ? AND file_id = ? AND slide_id = ?",
            [userId, fileId, slideId]
        );
        return rows[0] ?? null;
    },

    async listBySlide(
        db: OfflineDbConnection,
        userId: string,
        slideId: string
    ): Promise<AssetRow[]> {
        return db.query<AssetRow>("SELECT * FROM assets WHERE user_id = ? AND slide_id = ?", [
            userId,
            slideId,
        ]);
    },

    async listByPackageSession(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string
    ): Promise<AssetRow[]> {
        return db.query<AssetRow>("SELECT * FROM assets WHERE user_id = ? AND package_session_id = ?", [
            userId,
            packageSessionId,
        ]);
    },

    async listByStatus(
        db: OfflineDbConnection,
        userId: string,
        status: AssetDownloadStatus
    ): Promise<AssetRow[]> {
        return db.query<AssetRow>("SELECT * FROM assets WHERE user_id = ? AND status = ?", [
            userId,
            status,
        ]);
    },

    /** Any DOWNLOADED row (other than the given slide) still referencing this file? */
    async countOtherReferences(
        db: OfflineDbConnection,
        userId: string,
        fileId: string,
        excludingSlideId: string
    ): Promise<number> {
        const rows = await db.query<{ n: number }>(
            `SELECT COUNT(*) AS n FROM assets
             WHERE user_id = ? AND file_id = ? AND slide_id != ? AND status = 'DOWNLOADED'`,
            [userId, fileId, excludingSlideId]
        );
        return rows[0]?.n ?? 0;
    },

    async totalDownloadedBytes(db: OfflineDbConnection, userId: string): Promise<number> {
        // DISTINCT by file: shared files occupy disk once.
        const rows = await db.query<{ total: number }>(
            `SELECT COALESCE(SUM(size), 0) AS total FROM (
                SELECT DISTINCT file_id, size FROM assets
                WHERE user_id = ? AND status = 'DOWNLOADED'
             )`,
            [userId]
        );
        return rows[0]?.total ?? 0;
    },

    async upsert(db: OfflineDbConnection, row: AssetRow): Promise<void> {
        await db.run(
            `INSERT INTO assets
                (user_id, file_id, slide_id, package_session_id, size, checksum,
                 nonce, local_path, status, bytes_downloaded, attempt_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, file_id, slide_id) DO UPDATE SET
                package_session_id = excluded.package_session_id,
                size = excluded.size,
                checksum = excluded.checksum,
                nonce = excluded.nonce,
                local_path = excluded.local_path,
                status = excluded.status,
                bytes_downloaded = excluded.bytes_downloaded,
                attempt_count = excluded.attempt_count`,
            [
                row.user_id,
                row.file_id,
                row.slide_id,
                row.package_session_id,
                row.size,
                row.checksum,
                row.nonce,
                row.local_path,
                row.status,
                row.bytes_downloaded,
                row.attempt_count,
            ]
        );
    },

    async updateDownloadProgress(
        db: OfflineDbConnection,
        userId: string,
        fileId: string,
        slideId: string,
        bytesDownloaded: number,
        status: AssetDownloadStatus
    ): Promise<void> {
        await db.run(
            `UPDATE assets SET bytes_downloaded = ?, status = ?
             WHERE user_id = ? AND file_id = ? AND slide_id = ?`,
            [bytesDownloaded, status, userId, fileId, slideId]
        );
    },

    async deleteBySlide(db: OfflineDbConnection, userId: string, slideId: string): Promise<void> {
        await db.run("DELETE FROM assets WHERE user_id = ? AND slide_id = ?", [userId, slideId]);
    },

    async deleteByPackageSession(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string
    ): Promise<void> {
        await db.run("DELETE FROM assets WHERE user_id = ? AND package_session_id = ?", [
            userId,
            packageSessionId,
        ]);
    },
};
