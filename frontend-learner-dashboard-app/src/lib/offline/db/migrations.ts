/**
 * Forward-only migrations for the offline SQLite DB (plan §B2).
 *
 * Schema state is tracked with SQLite's built-in `PRAGMA user_version` (a
 * plain integer on the DB header) rather than a migrations-log table. Each
 * entry in `MIGRATIONS` is an ordered, idempotent batch of SQL statements;
 * batches only ever get appended, never edited in place, so a device that
 * already applied batch 1 never re-runs it — it just moves on to whatever
 * batches are newer than its stored `user_version`.
 *
 * `schema.sql` (batch 1) is the full initial schema and is the single source
 * of truth for the plan's six offline tables.
 *
 * This module depends only on the minimal `OfflineDbConnection` contract
 * (see connection.ts) — not on @capacitor-community/sqlite's types directly
 * — so it can run unmodified against the real plugin, the web jeep-sqlite
 * fallback, or an in-memory sql.js connection in tests.
 */

import schemaSqlV1 from "./schema.sql?raw";
import type { OfflineDbConnection } from "./connection";

export interface MigrationBatch {
  /** Target user_version after this batch is applied. Must be sequential (1, 2, 3, ...). */
  version: number;
  /** Human-readable label for logs. */
  label: string;
  /** Ordered SQL statements to run inside this batch's transaction. */
  statements: string[];
}

/**
 * Splits a .sql file's contents into individual statements. Strips `--`
 * line comments and blank lines, splits on `;`. Good enough for our DDL
 * (CREATE TABLE / CREATE INDEX only — no stored procedures, no semicolons
 * inside string literals).
 */
export function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

export const MIGRATIONS: MigrationBatch[] = [
  {
    version: 1,
    label: "initial_schema",
    statements: splitStatements(schemaSqlV1),
  },
  // Batch 2 (plan §B9/§5 "Removed by your institute" notices): a small
  // table beats reusing schema_meta — notices need their own rows (one per
  // revocation/removal), not a single keyed blob.
  {
    version: 2,
    label: "add_offline_notices",
    statements: [
      `CREATE TABLE IF NOT EXISTS offline_notices (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        package_session_id TEXT,
        message TEXT,
        created_at INTEGER NOT NULL,
        seen INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_offline_notices_user_seen
        ON offline_notices (user_id, seen)`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce(
  (max, batch) => Math.max(max, batch.version),
  0
);

/**
 * Applies every migration batch newer than the DB's current `user_version`,
 * in order, each inside its own transaction. Throws on failure so the caller
 * (connection.ts) can decide whether to retry or fall back to a destructive
 * rebuild — this module never deletes data itself.
 */
export async function runMigrations(db: OfflineDbConnection): Promise<void> {
  const currentVersion = await db.getVersion();

  const pending = MIGRATIONS.filter((batch) => batch.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  for (const batch of pending) {
    await db.beginTransaction();
    try {
      for (const statement of batch.statements) {
        await db.execute(statement);
      }
      await db.setVersion(batch.version);
      await db.commitTransaction();
    } catch (error) {
      try {
        await db.rollbackTransaction();
      } catch {
        // best-effort — connection may already be in a bad state
      }
      throw new Error(
        `[offline-db] migration batch ${batch.version} (${batch.label}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
