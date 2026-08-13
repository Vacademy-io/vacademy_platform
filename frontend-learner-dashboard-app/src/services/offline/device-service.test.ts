import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();
vi.mock("@/lib/auth/axiosInstance", () => ({
  default: {
    post: (...args: unknown[]) => (mockPost as (...a: unknown[]) => unknown)(...args),
    get: (...args: unknown[]) => (mockGet as (...a: unknown[]) => unknown)(...args),
    delete: (...args: unknown[]) => (mockDelete as (...a: unknown[]) => unknown)(...args),
  },
}));
vi.mock("@/constants/urls", () => ({
  OFFLINE_DEVICES_URL: "https://example.test/admin-core-service/learner-offline/v1/devices",
}));
vi.mock("@/constants/helper", () => ({
  getInstituteId: vi.fn(async () => "inst1"),
}));
vi.mock("@capacitor/device", () => ({
  Device: {
    getId: vi.fn(async () => ({ identifier: "client-device-abc" })),
    getInfo: vi.fn(async () => ({ name: "Test Phone", model: "Pixel", platform: "android" })),
  },
}));

const { registerDevice, listDevices, selfRevokeDevice, DeviceLimitReachedError } = await import(
  "./device-service"
);

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  mockDelete.mockReset();
});

describe("registerDevice", () => {
  it("returns the registered device on success", async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: "dev-1", device_name: "Test Phone", platform: "android", status: "ACTIVE", client_device_id: "client-device-abc" },
    });

    const result = await registerDevice();

    expect(result.status).toBe("registered");
    if (result.status === "registered") {
      expect(result.device.id).toBe("dev-1");
    }
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining("/register"),
      expect.objectContaining({ device_id: "client-device-abc", platform: "android" }),
      expect.objectContaining({ params: { instituteId: "inst1" } })
    );
  });

  it("surfaces DEVICE_LIMIT_REACHED (409) with the current device list", async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          code: "DEVICE_LIMIT_REACHED",
          message: "Maximum offline devices reached.",
          devices: [{ id: "dev-1", device_name: "Old Phone", platform: "ios", status: "ACTIVE" }],
        },
      },
    });

    const result = await registerDevice();

    expect(result.status).toBe("limit_reached");
    if (result.status === "limit_reached") {
      expect(result.devices).toHaveLength(1);
      expect(result.message).toBe("Maximum offline devices reached.");
    }
  });

  it("returns a generic error result on any other failure", async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500 }, message: "boom" });

    const result = await registerDevice();

    expect(result.status).toBe("error");
  });
});

describe("listDevices / selfRevokeDevice", () => {
  it("GETs the device list with instituteId", async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: "dev-1" }] });
    const devices = await listDevices();
    expect(devices).toHaveLength(1);
    expect(mockGet).toHaveBeenCalledWith(expect.any(String), { params: { instituteId: "inst1" } });
  });

  it("DELETEs a device by id", async () => {
    mockDelete.mockResolvedValueOnce({ data: "Device revoked" });
    await selfRevokeDevice("dev-1");
    expect(mockDelete).toHaveBeenCalledWith(expect.stringContaining("/dev-1"));
  });
});

describe("DeviceLimitReachedError", () => {
  it("carries the device list for the caller to render", () => {
    const err = new DeviceLimitReachedError([{ id: "dev-1" } as never], "limit reached");
    expect(err.devices).toHaveLength(1);
    expect(err.message).toBe("limit reached");
  });
});
