import type { OfflineDbConnection } from "../connection";
import type { NodeDownloadStatus, NodeRow } from "../types";

/** Per-node download intent/rollup state. */
export const nodesDao = {
    async get(db: OfflineDbConnection, userId: string, nodeId: string): Promise<NodeRow | null> {
        const rows = await db.query<NodeRow>(
            "SELECT * FROM nodes WHERE user_id = ? AND node_id = ?",
            [userId, nodeId]
        );
        return rows[0] ?? null;
    },

    /** How many of the given node ids are DOWNLOADED — one query, not N reads. */
    async countDownloaded(
        db: OfflineDbConnection,
        userId: string,
        nodeIds: string[]
    ): Promise<number> {
        if (nodeIds.length === 0) return 0;
        const placeholders = nodeIds.map(() => "?").join(", ");
        const rows = await db.query<{ c: number }>(
            `SELECT COUNT(*) AS c FROM nodes
             WHERE user_id = ? AND status = 'DOWNLOADED' AND node_id IN (${placeholders})`,
            [userId, ...nodeIds]
        );
        return Number(rows[0]?.c ?? 0);
    },

    async listByPackageSession(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string
    ): Promise<NodeRow[]> {
        return db.query<NodeRow>(
            "SELECT * FROM nodes WHERE user_id = ? AND package_session_id = ?",
            [userId, packageSessionId]
        );
    },

    /** Re-parents a node (used to attach pre-COURSE subject rows to the course root). */
    async setParent(
        db: OfflineDbConnection,
        userId: string,
        nodeId: string,
        parentId: string | null
    ): Promise<void> {
        await db.run("UPDATE nodes SET parent_id = ? WHERE user_id = ? AND node_id = ?", [
            parentId,
            userId,
            nodeId,
        ]);
    },

    async listChildren(
        db: OfflineDbConnection,
        userId: string,
        parentId: string
    ): Promise<NodeRow[]> {
        return db.query<NodeRow>("SELECT * FROM nodes WHERE user_id = ? AND parent_id = ?", [
            userId,
            parentId,
        ]);
    },

    async upsert(db: OfflineDbConnection, row: NodeRow): Promise<void> {
        await db.run(
            `INSERT INTO nodes
                (user_id, node_id, node_type, package_session_id, parent_id,
                 status, bytes_total, bytes_done)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id, node_id) DO UPDATE SET
                node_type = excluded.node_type,
                package_session_id = excluded.package_session_id,
                parent_id = excluded.parent_id,
                status = excluded.status,
                bytes_total = excluded.bytes_total,
                bytes_done = excluded.bytes_done`,
            [
                row.user_id,
                row.node_id,
                row.node_type,
                row.package_session_id,
                row.parent_id,
                row.status,
                row.bytes_total,
                row.bytes_done,
            ]
        );
    },

    async setStatus(
        db: OfflineDbConnection,
        userId: string,
        nodeId: string,
        status: NodeDownloadStatus
    ): Promise<void> {
        await db.run("UPDATE nodes SET status = ? WHERE user_id = ? AND node_id = ?", [
            status,
            userId,
            nodeId,
        ]);
    },

    async updateProgress(
        db: OfflineDbConnection,
        userId: string,
        nodeId: string,
        bytesDone: number
    ): Promise<void> {
        await db.run("UPDATE nodes SET bytes_done = ? WHERE user_id = ? AND node_id = ?", [
            bytesDone,
            userId,
            nodeId,
        ]);
    },

    async deleteByPackageSession(
        db: OfflineDbConnection,
        userId: string,
        packageSessionId: string
    ): Promise<void> {
        await db.run("DELETE FROM nodes WHERE user_id = ? AND package_session_id = ?", [
            userId,
            packageSessionId,
        ]);
    },

    async delete(db: OfflineDbConnection, userId: string, nodeId: string): Promise<void> {
        await db.run("DELETE FROM nodes WHERE user_id = ? AND node_id = ?", [userId, nodeId]);
    },
};
