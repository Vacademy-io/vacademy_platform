import { describe, expect, it } from "vitest";
import { createInMemoryConnection } from "./sqljs-connection";
import { LATEST_VERSION, runMigrations } from "./migrations";

describe("offline db migrations", () => {
    it("applies the full schema to an empty database", async () => {
        const db = await createInMemoryConnection();
        await runMigrations(db);

        expect(await db.getVersion()).toBe(LATEST_VERSION);

        const tables = await db.query<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        );
        const names = tables.map((t) => t.name);
        for (const expected of [
            "device_state",
            "manifests",
            "nodes",
            "assets",
            "slide_payloads",
            "event_queue",
        ]) {
            expect(names).toContain(expected);
        }
        await db.close();
    });

    it("is a no-op when already at the latest version", async () => {
        const db = await createInMemoryConnection();
        await runMigrations(db);
        await db.run(
            "INSERT INTO nodes (user_id, node_id, node_type, package_session_id, status) VALUES (?, ?, ?, ?, ?)",
            ["u1", "n1", "CHAPTER", "ps1", "DOWNLOADED"]
        );

        await runMigrations(db); // must not wipe or re-create anything

        const rows = await db.query("SELECT * FROM nodes WHERE user_id = ?", ["u1"]);
        expect(rows).toHaveLength(1);
        await db.close();
    });
});
