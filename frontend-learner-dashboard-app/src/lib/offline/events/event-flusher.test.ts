import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryConnection } from "../db/sqljs-connection";
import { runMigrations } from "../db/migrations";
import type { OfflineDbConnection } from "../db/connection";
import { eventQueueDao } from "../db/dao/event-queue-dao";
import { deviceStateDao } from "../db/dao/device-state-dao";
import type { EventQueueRow } from "../db/types";

let db: OfflineDbConnection;

vi.mock("../db/connection", () => ({
  getOfflineDb: async () => db,
}));

const mockPost = vi.fn();
vi.mock("@/lib/auth/axiosInstance", () => ({
  default: { post: (...args: unknown[]) => (mockPost as (...a: unknown[]) => unknown)(...args) },
}));
// urls.ts computes BASE_URL from `window.location` at import time — this
// suite runs under vitest's "node" environment (no window), so stub the one
// constant this module needs rather than pulling in the whole url file.
vi.mock("@/constants/urls", () => ({
  OFFLINE_SYNC_BATCH_URL: "https://example.test/offline-sync/batch",
}));

const mockAddListener = vi.fn(async () => ({ remove: vi.fn() }));
vi.mock("@/utils/network-plugin", () => ({
  Network: { addListener: (...args: unknown[]) => (mockAddListener as (...a: unknown[]) => unknown)(...args) },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

// Imported after the mocks above so the module under test picks them up.
const { eventFlusher, setOnDeviceRevoked } = await import("./event-flusher");

const row = (id: string, seq: number, attempts = 0): EventQueueRow => ({
  client_event_id: id,
  user_id: "u1",
  seq,
  client_ts: 1_700_000_000_000 + seq,
  event_type: "VIDEO",
  context: JSON.stringify({ slideId: "s1", packageSessionId: "ps1" }),
  payload: JSON.stringify({ foo: "bar" }),
  sync_status: "PENDING",
  attempt_count: attempts,
  last_error: null,
});

beforeEach(async () => {
  db = await createInMemoryConnection();
  await runMigrations(db);
  await deviceStateDao.upsert(db, {
    user_id: "u1",
    device_id: "device-1",
    device_registration_id: "reg-1",
    lease_expires_at: null,
    last_checkin_at: null,
    last_checkin_monotonic: null,
    revoked: 0,
  });
  mockPost.mockReset();
  setOnDeviceRevoked(() => {});
});

afterEach(async () => {
  await eventFlusher.stop();
});

describe("event-flusher result handling", () => {
  it("marks ACCEPTED and DUPLICATE as SYNCED, deletes them, and leaves FAILED as retryable PENDING", async () => {
    await eventQueueDao.insert(db, row("e1", 1));
    await eventQueueDao.insert(db, row("e2", 2));
    await eventQueueDao.insert(db, row("e3", 3));
    mockPost.mockResolvedValueOnce({
      data: {
        device_status: "ACTIVE",
        results: [
          { client_event_id: "e1", status: "ACCEPTED" },
          { client_event_id: "e2", status: "DUPLICATE" },
          { client_event_id: "e3", status: "FAILED", error_code: "SOME_ERROR" },
        ],
      },
    });

    await eventFlusher.flush("u1");

    const pending = await eventQueueDao.listPending(db, "u1", 50);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.client_event_id).toBe("e3");
    expect(pending[0]?.attempt_count).toBe(1);
    expect(await eventQueueDao.countByStatus(db, "u1", "SYNCED")).toBe(0); // deleteSynced ran
  });

  it("moves rows at the attempt cap to FAILED_PERMANENT without sending them", async () => {
    await eventQueueDao.insert(db, row("e1", 1, 10));
    await eventQueueDao.insert(db, row("e2", 2, 0));
    mockPost.mockResolvedValueOnce({
      data: { device_status: "ACTIVE", results: [{ client_event_id: "e2", status: "ACCEPTED" }] },
    });

    await eventFlusher.flush("u1");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const sentIds = (mockPost.mock.calls[0]?.[1] as { events: Array<{ client_event_id: string }> })
      .events.map((e) => e.client_event_id);
    expect(sentIds).toEqual(["e2"]);
    expect(await eventQueueDao.countByStatus(db, "u1", "FAILED_PERMANENT")).toBe(1);
  });

  it("puts the whole batch back to PENDING on a network/transport error, without bumping attempt_count", async () => {
    await eventQueueDao.insert(db, row("e1", 1));
    mockPost.mockRejectedValueOnce(new Error("Network Error"));

    await eventFlusher.flush("u1");

    const pending = await eventQueueDao.listPending(db, "u1", 50);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.attempt_count).toBe(0);
  });

  it("skips the flush entirely when no device is registered", async () => {
    await deviceStateDao.delete(db, "u1");
    await eventQueueDao.insert(db, row("e1", 1));

    await eventFlusher.flush("u1");

    expect(mockPost).not.toHaveBeenCalled();
    expect(await eventQueueDao.countByStatus(db, "u1", "PENDING")).toBe(1);
  });

  it("fires onDeviceRevoked when the response reports device_status REVOKED", async () => {
    const revoked = vi.fn();
    setOnDeviceRevoked(revoked);
    await eventQueueDao.insert(db, row("e1", 1));
    mockPost.mockResolvedValueOnce({
      data: { device_status: "REVOKED", results: [{ client_event_id: "e1", status: "ACCEPTED" }] },
    });

    await eventFlusher.flush("u1");

    expect(revoked).toHaveBeenCalledWith("u1");
  });
});

describe("boot recovery", () => {
  it("init() demotes stale IN_FLIGHT rows back to PENDING before flushing", async () => {
    await eventQueueDao.insert(db, row("e1", 1));
    await eventQueueDao.setStatus(db, "u1", ["e1"], "IN_FLIGHT");
    mockPost.mockResolvedValueOnce({
      data: { device_status: "ACTIVE", results: [{ client_event_id: "e1", status: "ACCEPTED" }] },
    });

    await eventFlusher.init("u1");

    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe("seq-ordered batching", () => {
  it("sends pending events in seq order", async () => {
    await eventQueueDao.insert(db, row("e3", 3));
    await eventQueueDao.insert(db, row("e1", 1));
    await eventQueueDao.insert(db, row("e2", 2));
    mockPost.mockResolvedValueOnce({
      data: {
        device_status: "ACTIVE",
        results: [
          { client_event_id: "e1", status: "ACCEPTED" },
          { client_event_id: "e2", status: "ACCEPTED" },
          { client_event_id: "e3", status: "ACCEPTED" },
        ],
      },
    });

    await eventFlusher.flush("u1");

    const sentIds = (mockPost.mock.calls[0]?.[1] as { events: Array<{ client_event_id: string }> })
      .events.map((e) => e.client_event_id);
    expect(sentIds).toEqual(["e1", "e2", "e3"]);
  });
});
