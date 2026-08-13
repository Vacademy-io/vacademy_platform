import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryConnection } from "../db/sqljs-connection";
import { runMigrations } from "../db/migrations";
import type { OfflineDbConnection } from "../db/connection";
import { eventQueueDao } from "../db/dao/event-queue-dao";
import { recordDownloadStateEvent, recordEvent } from "./event-queue";

vi.mock("../db/connection", () => ({
  getOfflineDb: async () => db,
}));

let db: OfflineDbConnection;

beforeEach(async () => {
  db = await createInMemoryConnection();
  await runMigrations(db);
});

describe("recordEvent", () => {
  it("assigns a monotonic per-user seq and inserts a PENDING row", async () => {
    const id1 = await recordEvent({
      userId: "u1",
      eventType: "VIDEO",
      context: { slideId: "s1", packageSessionId: "ps1" },
      payload: { foo: "bar" },
    });
    const id2 = await recordEvent({
      userId: "u1",
      eventType: "AUDIO",
      context: { slideId: "s2" },
      payload: { baz: 1 },
    });

    expect(id1).not.toBe(id2);
    const pending = await eventQueueDao.listPending(db, "u1", 50);
    expect(pending).toHaveLength(2);
    expect(pending[0]?.seq).toBe(1);
    expect(pending[1]?.seq).toBe(2);
    expect(pending[0]?.event_type).toBe("VIDEO");
    expect(JSON.parse(pending[0]?.context ?? "{}")).toEqual({
      slideId: "s1",
      packageSessionId: "ps1",
    });
    expect(JSON.parse(pending[0]?.payload ?? "{}")).toEqual({ foo: "bar" });
    expect(pending[0]?.sync_status).toBe("PENDING");
  });

  it("keeps per-user sequences independent", async () => {
    await recordEvent({ userId: "u1", eventType: "VIDEO", context: {}, payload: {} });
    await recordEvent({ userId: "u2", eventType: "VIDEO", context: {}, payload: {} });
    const u2Pending = await eventQueueDao.listPending(db, "u2", 50);
    expect(u2Pending[0]?.seq).toBe(1);
  });
});

describe("recordDownloadStateEvent", () => {
  it("queues a DOWNLOAD_STATE event with the slide/package-session context", async () => {
    await recordDownloadStateEvent("u1", "slide-1", "ps-1", "DOWNLOADED");
    const pending = await eventQueueDao.listPending(db, "u1", 50);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.event_type).toBe("DOWNLOAD_STATE");
    expect(JSON.parse(pending[0]?.payload ?? "{}")).toMatchObject({
      slide_id: "slide-1",
      package_session_id: "ps-1",
      status: "DOWNLOADED",
    });
  });
});
