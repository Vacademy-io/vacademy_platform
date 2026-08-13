import type { OfflineDbConnection } from "../connection";

/**
 * Tiny key/value helper over schema_meta. Used for per-course route context
 * (`offline.route.<packageSessionId>`) so the Downloads screen can deep-link
 * back into the slides view (courseId/levelId aren't part of the manifest).
 */
export const metaDao = {
    async get(db: OfflineDbConnection, key: string): Promise<string | null> {
        const rows = await db.query<{ value: string }>(
            "SELECT value FROM schema_meta WHERE key = ?",
            [key]
        );
        return rows[0]?.value ?? null;
    },

    async set(db: OfflineDbConnection, key: string, value: string): Promise<void> {
        await db.run(
            `INSERT INTO schema_meta (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
            [key, value]
        );
    },
};

export const routeContextKey = (packageSessionId: string) => `offline.route.${packageSessionId}`;

export interface OfflineRouteContext {
    courseId?: string;
    levelId?: string;
    sessionId?: string;
}
