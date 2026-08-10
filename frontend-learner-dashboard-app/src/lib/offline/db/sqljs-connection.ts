/**
 * In-memory OfflineDbConnection backed by sql.js — used ONLY by vitest
 * (never bundled into the app; nothing under src/ imports it outside tests).
 * Lets migrations + DAOs run against a real SQL engine without native plugins.
 */

import initSqlJs, { type Database } from "sql.js";
import type { OfflineDbConnection } from "./connection";

class SqlJsConnection implements OfflineDbConnection {
    constructor(private readonly db: Database) {}

    async execute(sql: string): Promise<void> {
        this.db.exec(sql);
    }

    async run(sql: string, params: unknown[] = []): Promise<void> {
        const stmt = this.db.prepare(sql);
        try {
            stmt.run(params as never[]);
        } finally {
            stmt.free();
        }
    }

    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
        const stmt = this.db.prepare(sql);
        const rows: T[] = [];
        try {
            stmt.bind(params as never[]);
            while (stmt.step()) {
                rows.push(stmt.getAsObject() as T);
            }
        } finally {
            stmt.free();
        }
        return rows;
    }

    async getVersion(): Promise<number> {
        const rows = await this.query<{ user_version: number }>("PRAGMA user_version");
        return rows[0]?.user_version ?? 0;
    }

    async setVersion(version: number): Promise<void> {
        this.db.exec(`PRAGMA user_version = ${Math.floor(version)}`);
    }

    async beginTransaction(): Promise<void> {
        this.db.exec("BEGIN");
    }

    async commitTransaction(): Promise<void> {
        this.db.exec("COMMIT");
    }

    async rollbackTransaction(): Promise<void> {
        this.db.exec("ROLLBACK");
    }

    async close(): Promise<void> {
        this.db.close();
    }
}

export async function createInMemoryConnection(): Promise<OfflineDbConnection> {
    const SQL = await initSqlJs();
    return new SqlJsConnection(new SQL.Database());
}
