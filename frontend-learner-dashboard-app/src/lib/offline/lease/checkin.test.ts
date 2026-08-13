import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryConnection } from "../db/sqljs-connection";
import { runMigrations } from "../db/migrations";
import type { OfflineDbConnection } from "../db/connection";
import { deviceStateDao } from "../db/dao/device-state-dao";
import { manifestsDao } from "../db/dao/manifests-dao";
import { nodesDao } from "../db/dao/nodes-dao";
import { noticesDao } from "../db/dao/notices-dao";
import { resetBootAnchorForTests } from "./lease-state";

let db: OfflineDbConnection;

vi.mock("../db/connection", () => ({
  getOfflineDb: async () => db,
}));

const mockPost = vi.fn();
vi.mock("@/lib/auth/axiosInstance", () => ({
  default: { post: (...args: unknown[]) => (mockPost as (...a: unknown[]) => unknown)(...args) },
}));
vi.mock("@/constants/urls", () => ({
  OFFLINE_DEVICES_URL: "https://example.test/admin-core-service/learner-offline/v1/devices",
}));

// device-service.ts pulls in @capacitor/device, which has no web shim in
// vitest's node env — stub the whole module since these tests exercise
// performCheckIn/handleDeviceRevoked, not registration.
vi.mock("@/services/offline/device-service", () => ({
  registerDevice: vi.fn(),
}));

const mockPurgePackageSession = vi.fn();
const mockPurgeAllForUser = vi.fn();
vi.mock("../download/download-manager", () => ({
  downloadManager: {
    purgePackageSession: (...args: unknown[]) => mockPurgePackageSession(...args),
    purgeAllForUser: (...args: unknown[]) => mockPurgeAllForUser(...args),
  },
}));

const mockDestroyOfflineKey = vi.fn();
vi.mock("../crypto/keys", () => ({
  destroyOfflineKey: (...args: unknown[]) => mockDestroyOfflineKey(...args),
}));

const mockFlush = vi.fn();
vi.mock("../events/event-flusher", () => ({
  eventFlusher: { flush: (...args: unknown[]) => mockFlush(...args) },
}));

const mockSetLeaseState = vi.fn();
const mockSetRevokedDialogOpen = vi.fn();
const mockSetNodeStatus = vi.fn();
const mockHydrate = vi.fn();
vi.mock("@/stores/offline/use-offline-store", () => ({
  useOfflineStore: {
    getState: () => ({
      setLeaseState: mockSetLeaseState,
      setRevokedDialogOpen: mockSetRevokedDialogOpen,
      setNodeStatus: mockSetNodeStatus,
      hydrate: mockHydrate,
    }),
  },
}));

const { performCheckIn, handleDeviceRevoked } = await import("./checkin");

beforeEach(async () => {
  db = await createInMemoryConnection();
  await runMigrations(db);
  await deviceStateDao.upsert(db, {
    user_id: "u1",
    device_id: "client-device-1",
    device_registration_id: "reg-1",
    lease_expires_at: 1_700_000_000_000,
    last_checkin_at: 1_699_990_000_000,
    last_checkin_monotonic: 0,
    revoked: 0,
  });
  mockPost.mockReset();
  mockPurgePackageSession.mockReset();
  mockPurgeAllForUser.mockReset();
  mockDestroyOfflineKey.mockReset();
  mockFlush.mockReset();
  mockSetLeaseState.mockReset();
  mockSetRevokedDialogOpen.mockReset();
  mockSetNodeStatus.mockReset();
  mockHydrate.mockReset();
  resetBootAnchorForTests();
});

afterEach(() => {
  resetBootAnchorForTests();
});

describe("performCheckIn — lease renewal", () => {
  it("updates device_state with the renewed lease on a plain ACTIVE response", async () => {
    mockPost.mockResolvedValueOnce({
      data: { device_status: "ACTIVE", lease_expires_at: 1_800_000_000_000, revocations: [], manifest_updates: [] },
    });

    await performCheckIn("u1");

    const row = await deviceStateDao.get(db, "u1");
    expect(row?.lease_expires_at).toBe(1_800_000_000_000);
    expect(row?.revoked).toBe(0);
    expect(mockFlush).toHaveBeenCalledWith("u1");
  });

  it("no-ops when no device is registered", async () => {
    await deviceStateDao.delete(db, "u1");
    await performCheckIn("u1");
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("performCheckIn — revocations", () => {
  it("purges the named course and records a notice, without a full-device purge", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        device_status: "ACTIVE",
        lease_expires_at: 1_800_000_000_000,
        revocations: [{ package_session_id: "ps1", reason: "UNENROLLED", action: "PURGE" }],
        manifest_updates: [],
      },
    });

    await performCheckIn("u1");

    expect(mockPurgePackageSession).toHaveBeenCalledWith("u1", "ps1");
    expect(mockPurgeAllForUser).not.toHaveBeenCalled();
    const notices = await noticesDao.listUnseen(db, "u1");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.kind).toBe("UNENROLLED");
    expect(notices[0]?.package_session_id).toBe("ps1");
  });
});

describe("performCheckIn — device REVOKED", () => {
  it("purges everything, destroys the key, flags revoked, and opens the blocking dialog", async () => {
    mockPost.mockResolvedValueOnce({
      data: { device_status: "REVOKED", lease_expires_at: null, revocations: [], manifest_updates: [] },
    });

    await performCheckIn("u1");

    expect(mockPurgeAllForUser).toHaveBeenCalledWith("u1");
    expect(mockDestroyOfflineKey).toHaveBeenCalledWith("u1");
    expect(mockSetRevokedDialogOpen).toHaveBeenCalledWith(true);
    const row = await deviceStateDao.get(db, "u1");
    expect(row?.revoked).toBe(1);
  });
});

describe("handleDeviceRevoked — shared purge path (event-flusher trigger)", () => {
  it("does the same full purge as a REVOKED check-in response", async () => {
    await handleDeviceRevoked("u1");

    expect(mockPurgeAllForUser).toHaveBeenCalledWith("u1");
    expect(mockDestroyOfflineKey).toHaveBeenCalledWith("u1");
    const row = await deviceStateDao.get(db, "u1");
    expect(row?.revoked).toBe(1);
  });
});

describe("performCheckIn — manifest updates", () => {
  it("flags the manifest update_available and root nodes UPDATE_AVAILABLE", async () => {
    await manifestsDao.upsert(db, {
      user_id: "u1",
      package_session_id: "ps1",
      institute_id: "inst1",
      version: 1,
      fetched_at: Date.now(),
      tree_json: "{}",
      update_available: 0,
    });
    await nodesDao.upsert(db, {
      user_id: "u1",
      node_id: "subj1",
      node_type: "SUBJECT",
      package_session_id: "ps1",
      parent_id: null,
      status: "DOWNLOADED",
      bytes_total: 100,
      bytes_done: 100,
    });

    mockPost.mockResolvedValueOnce({
      data: {
        device_status: "ACTIVE",
        lease_expires_at: 1_800_000_000_000,
        revocations: [],
        manifest_updates: [{ package_session_id: "ps1", current_manifest_version: 2 }],
      },
    });

    await performCheckIn("u1");

    const manifest = await manifestsDao.get(db, "u1", "ps1");
    expect(manifest?.update_available).toBe(1);
    const node = await nodesDao.get(db, "u1", "subj1");
    expect(node?.status).toBe("UPDATE_AVAILABLE");
    expect(mockSetNodeStatus).toHaveBeenCalledWith("subj1", "UPDATE_AVAILABLE");
  });
});
