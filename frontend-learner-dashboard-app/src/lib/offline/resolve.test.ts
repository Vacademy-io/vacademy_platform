import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetStatus = vi.fn();
vi.mock("@/utils/network-plugin", () => ({
  Network: { getStatus: () => mockGetStatus() },
}));

const mockIsOfflineSupported = vi.fn(() => true);
vi.mock("./platform", () => ({
  isOfflineSupported: () => mockIsOfflineSupported(),
}));

const mockDeviceStateGet = vi.fn();
vi.mock("./db/dao/device-state-dao", () => ({
  deviceStateDao: { get: () => mockDeviceStateGet() },
}));

const mockAssetGet = vi.fn();
vi.mock("./db/dao/assets-dao", () => ({
  assetsDao: {
    get: () => mockAssetGet(),
    listBySlide: vi.fn(async () => []),
  },
}));

vi.mock("./db/connection", () => ({ getOfflineDb: vi.fn(async () => ({})) }));

const mockGetKey = vi.fn(async () => "fake-key" as unknown as CryptoKey);
const mockGetRawKey = vi.fn(async () => "cmF3LWtleQ==");
vi.mock("./crypto/keys", () => ({
  getOrCreateOfflineKey: () => mockGetKey(),
  getRawOfflineKeyB64: () => mockGetRawKey(),
}));

vi.mock("./crypto/decrypt", () => ({
  decryptAssetToBlob: vi.fn(async () => new Blob(["decrypted"])),
  base64ToBytes: vi.fn(() => new Uint8Array()),
}));

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    readFile: vi.fn(async () => ({ data: "AAAA" })),
    getUri: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///app-data/${path}` })),
  },
  Directory: { Data: "DATA" },
}));

const mockOpenAsset = vi.fn(async (_req: unknown) => ({ token: "tok-1", url: "offline-media://tok-1/stream" }));
const mockCloseAsset = vi.fn(async (_token: string) => undefined);
vi.mock("./native/offline-media", () => ({
  openAsset: (req: unknown) => mockOpenAsset(req),
  closeAsset: (token: string) => mockCloseAsset(token),
}));

import { resolveSlideSource } from "./resolve";

const baseParams = {
  userId: "user1",
  fileId: "file1",
  slideId: "slide1",
  mimeType: "application/pdf",
  resolveRemoteUrl: vi.fn(async () => "https://cdn.example.com/signed-url"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsOfflineSupported.mockReturnValue(true);
  mockDeviceStateGet.mockResolvedValue(null);
});

describe("resolveSlideSource decision table", () => {
  it("online → always remote, regardless of local downloaded copy", async () => {
    mockGetStatus.mockResolvedValue({ connected: true });
    mockAssetGet.mockResolvedValue({ status: "DOWNLOADED", local_path: "x", nonce: "n" });

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("remote");
    expect(result.url).toBe("https://cdn.example.com/signed-url");
  });

  it("offline + platform unsupported → unavailable-offline", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockIsOfflineSupported.mockReturnValue(false);

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("unavailable-offline");
  });

  it("offline + device revoked → locked(REVOKED)", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 1 });

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("locked");
    expect(result.lockReason).toBe("REVOKED");
  });

  it("offline + lease expired → locked(LEASE_EXPIRED)", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 0, lease_expires_at: Date.now() - 1000 });

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("locked");
    expect(result.lockReason).toBe("LEASE_EXPIRED");
  });

  it("offline + valid lease + no local asset → unavailable-offline", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 0, lease_expires_at: Date.now() + 1000 });
    mockAssetGet.mockResolvedValue(null);

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("unavailable-offline");
  });

  it("offline + valid lease + downloaded non-video asset → offline-blob", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 0, lease_expires_at: Date.now() + 1000 });
    mockAssetGet.mockResolvedValue({
      status: "DOWNLOADED",
      local_path: "offline/user1/assets/file1.enc",
      nonce: "bm9uY2U=",
    });

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("offline-blob");
    expect(result.url).toMatch(/^blob:|^http/); // jsdom/node URL.createObjectURL shim
  });

  it("offline + valid lease + downloaded VIDEO asset → offline-stream via native OfflineMedia.openAsset", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 0, lease_expires_at: Date.now() + 1000 });
    mockAssetGet.mockResolvedValue({
      status: "DOWNLOADED",
      local_path: "offline/user1/assets/file1.enc",
      nonce: "bm9uY2U=",
    });

    const result = await resolveSlideSource({ ...baseParams, stream: true });

    expect(result.kind).toBe("offline-stream");
    expect(result.url).toBe("offline-media://tok-1/stream");
    expect(typeof result.release).toBe("function");
    expect(mockOpenAsset).toHaveBeenCalledWith(
      expect.objectContaining({ key: "cmF3LWtleQ==", nonce: "bm9uY2U=" })
    );

    result.release?.();
    expect(mockCloseAsset).toHaveBeenCalledWith("tok-1");
  });

  it("offline + video open fails (native plugin unavailable) → unavailable-offline", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 0, lease_expires_at: Date.now() + 1000 });
    mockAssetGet.mockResolvedValue({
      status: "DOWNLOADED",
      local_path: "offline/user1/assets/file1.enc",
      nonce: "bm9uY2U=",
    });
    mockOpenAsset.mockRejectedValueOnce(new Error("plugin unavailable"));

    const result = await resolveSlideSource({ ...baseParams, stream: true });

    expect(result.kind).toBe("unavailable-offline");
  });

  it("offline + valid lease + asset still PENDING (not fully downloaded) → unavailable-offline", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    mockDeviceStateGet.mockResolvedValue({ revoked: 0, lease_expires_at: Date.now() + 1000 });
    mockAssetGet.mockResolvedValue({ status: "PENDING", local_path: null, nonce: null });

    const result = await resolveSlideSource(baseParams);

    expect(result.kind).toBe("unavailable-offline");
  });
});
