import { describe, expect, it } from "vitest";
import { createInMemoryConnection } from "../sqljs-connection";
import { runMigrations, MIGRATIONS } from "../migrations";
import { noticesDao } from "./notices-dao";

describe("migrations — batch 2 (offline_notices) applies cleanly over batch 1", () => {
  it("upgrades a DB that already has batch 1 applied, without touching existing tables", async () => {
    const db = await createInMemoryConnection();
    const batch1Only = MIGRATIONS.filter((b) => b.version === 1);
    for (const statement of batch1Only[0]!.statements) {
      await db.execute(statement);
    }
    await db.setVersion(1);
    await db.run(
      "INSERT INTO device_state (user_id, device_id, device_registration_id, revoked) VALUES (?, ?, ?, ?)",
      ["u1", "d1", "r1", 0]
    );

    await runMigrations(db); // applies batch 2 on top

    expect(await db.getVersion()).toBe(2);
    const deviceRows = await db.query("SELECT * FROM device_state WHERE user_id = ?", ["u1"]);
    expect(deviceRows).toHaveLength(1); // batch 1 data untouched

    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'offline_notices'"
    );
    expect(tables).toHaveLength(1);
    await db.close();
  });
});

describe("noticesDao round-trip", () => {
  it("inserts, lists unseen, and marks seen", async () => {
    const db = await createInMemoryConnection();
    await runMigrations(db);

    await noticesDao.insert(db, "u1", "UNENROLLED", "ps1", "You were unenrolled.");
    await noticesDao.insert(db, "u1", "UPDATE_AVAILABLE", "ps2", "New content available.");
    await noticesDao.insert(db, "u2", "DEVICE_REVOKED", null, "Other user's notice.");

    const unseen = await noticesDao.listUnseen(db, "u1");
    expect(unseen).toHaveLength(2);
    expect(unseen.map((n) => n.kind).sort()).toEqual(["UNENROLLED", "UPDATE_AVAILABLE"]);

    await noticesDao.markSeen(db, "u1", unseen[0]!.id);
    expect(await noticesDao.listUnseen(db, "u1")).toHaveLength(1);

    // user_id scoping: u2's notice is untouched and never returned for u1.
    const u2Unseen = await noticesDao.listUnseen(db, "u2");
    expect(u2Unseen).toHaveLength(1);

    await noticesDao.markAllSeen(db, "u1");
    expect(await noticesDao.listUnseen(db, "u1")).toHaveLength(0);
    expect(await noticesDao.listAll(db, "u1")).toHaveLength(2);

    await db.close();
  });
});
