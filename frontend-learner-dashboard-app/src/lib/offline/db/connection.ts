/**
 * Offline SQLite connection singleton (plan §B2).
 *
 * All DB access goes through the minimal `OfflineDbConnection` contract so
 * migrations and DAOs run unmodified against the native plugin, the web
 * jeep-sqlite fallback, or an in-memory sql.js engine in tests
 * (see sqljs-connection.ts).
 *
 * Corruption policy: this is a local cache/outbox DB — if migrations fail in
 * a way that suggests a corrupt file, we destructively rebuild (delete +
 * recreate). Downloaded nodes reset to NOT_DOWNLOADED and orphaned .enc files
 * are garbage-collected by the download manager on next init.
 */

import {
    CapacitorSQLite,
    SQLiteConnection,
    type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import { runMigrations } from "./migrations";

export const OFFLINE_DB_NAME = "vacademy_offline";

/** Minimal SQL surface migrations + DAOs depend on. */
export interface OfflineDbConnection {
    /** DDL / statements without params. */
    execute(sql: string): Promise<void>;
    /** Parameterized write. */
    run(sql: string, params?: unknown[]): Promise<void>;
    /** Parameterized read; returns row objects. */
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
    getVersion(): Promise<number>;
    setVersion(version: number): Promise<void>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    close(): Promise<void>;
}

/** Adapter over @capacitor-community/sqlite's SQLiteDBConnection. */
class CapacitorDbConnection implements OfflineDbConnection {
    constructor(private readonly db: SQLiteDBConnection) {}

    async execute(sql: string): Promise<void> {
        // transaction=false: migrations manage their own transactions.
        await this.db.execute(sql, false);
    }

    async run(sql: string, params: unknown[] = []): Promise<void> {
        await this.db.run(sql, params as never[], false);
    }

    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
        const result = await this.db.query(sql, params as never[]);
        return (result.values ?? []) as T[];
    }

    async getVersion(): Promise<number> {
        const rows = await this.query<{ user_version: number }>("PRAGMA user_version");
        return rows[0]?.user_version ?? 0;
    }

    async setVersion(version: number): Promise<void> {
        await this.execute(`PRAGMA user_version = ${Math.floor(version)}`);
    }

    async beginTransaction(): Promise<void> {
        await this.db.beginTransaction();
    }

    async commitTransaction(): Promise<void> {
        await this.db.commitTransaction();
    }

    async rollbackTransaction(): Promise<void> {
        await this.db.rollbackTransaction();
    }

    async close(): Promise<void> {
        await this.db.close();
    }
}

let sqliteConnection: SQLiteConnection | null = null;
let openPromise: Promise<OfflineDbConnection> | null = null;

async function openRaw(): Promise<SQLiteDBConnection> {
    sqliteConnection = sqliteConnection ?? new SQLiteConnection(CapacitorSQLite);

    if (Capacitor.getPlatform() === "web") {
        // Plain web is gated off by isOfflineSupported(); this path only runs
        // in dev tooling. It requires the <jeep-sqlite> custom element to be
        // registered by the caller before opening (jeep-sqlite/loader).
        await sqliteConnection.initWebStore();
    }

    const consistency = await sqliteConnection.checkConnectionsConsistency();
    const existing = await sqliteConnection.isConnection(OFFLINE_DB_NAME, false);
    const db =
        consistency.result && existing.result
            ? await sqliteConnection.retrieveConnection(OFFLINE_DB_NAME, false)
            : await sqliteConnection.createConnection(
                  OFFLINE_DB_NAME,
                  false,
                  "no-encryption",
                  1,
                  false
              );
    await db.open();
    return db;
}

async function destroyDatabase(): Promise<void> {
    try {
        if (sqliteConnection) {
            await sqliteConnection.closeConnection(OFFLINE_DB_NAME, false);
        }
    } catch {
        // already closed
    }
    try {
        await CapacitorSQLite.deleteDatabase({ database: OFFLINE_DB_NAME });
    } catch {
        // nothing to delete
    }
}

/**
 * Opens (once) the offline DB and applies pending migrations. On migration
 * failure, destructively rebuilds the DB and retries once.
 */
export function getOfflineDb(): Promise<OfflineDbConnection> {
    if (openPromise) return openPromise;

    openPromise = (async () => {
        let connection = new CapacitorDbConnection(await openRaw());
        try {
            await runMigrations(connection);
        } catch (error) {
            console.error("[offline-db] migration failed, rebuilding database", error);
            try {
                await connection.close();
            } catch {
                // best-effort
            }
            await destroyDatabase();
            connection = new CapacitorDbConnection(await openRaw());
            await runMigrations(connection);
        }
        return connection;
    })();

    openPromise.catch(() => {
        // Allow a later retry instead of caching the rejection forever.
        openPromise = null;
    });

    return openPromise;
}

/** Test/logout hook: close and forget the singleton. */
export async function closeOfflineDb(): Promise<void> {
    const pending = openPromise;
    openPromise = null;
    if (!pending) return;
    try {
        const connection = await pending;
        await connection.close();
        if (sqliteConnection) {
            await sqliteConnection.closeConnection(OFFLINE_DB_NAME, false);
        }
    } catch {
        // already closed / never opened
    }
}
