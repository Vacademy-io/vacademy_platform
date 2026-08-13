import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetStatus = vi.fn();
vi.mock("@/utils/network-plugin", () => ({
  Network: { getStatus: () => mockGetStatus() },
}));

const mockRecordEvent = vi.fn(async () => "generated-id");
vi.mock("./event-queue", () => ({
  recordEvent: (...args: unknown[]) => (mockRecordEvent as (...a: unknown[]) => unknown)(...args),
}));

const { trackOrQueue, isNetworkError } = await import("./track-or-queue");

beforeEach(() => {
  mockGetStatus.mockReset();
  mockRecordEvent.mockClear();
});

describe("trackOrQueue", () => {
  it("returns false and does not record when online", async () => {
    mockGetStatus.mockResolvedValue({ connected: true });
    const result = await trackOrQueue({
      userId: "u1",
      eventType: "VIDEO",
      context: { slideId: "s1" },
      payload: { a: 1 },
    });
    expect(result).toBe(false);
    expect(mockRecordEvent).not.toHaveBeenCalled();
  });

  it("returns true and records when offline", async () => {
    mockGetStatus.mockResolvedValue({ connected: false });
    const result = await trackOrQueue({
      userId: "u1",
      eventType: "AUDIO",
      context: { slideId: "s2" },
      payload: { b: 2 },
    });
    expect(result).toBe(true);
    expect(mockRecordEvent).toHaveBeenCalledWith({
      userId: "u1",
      eventType: "AUDIO",
      context: { slideId: "s2" },
      payload: { b: 2 },
    });
  });

  it("force:true records without checking connectivity", async () => {
    const result = await trackOrQueue({
      userId: "u1",
      eventType: "DOCUMENT",
      context: {},
      payload: {},
      force: true,
    });
    expect(result).toBe(true);
    expect(mockGetStatus).not.toHaveBeenCalled();
    expect(mockRecordEvent).toHaveBeenCalledTimes(1);
  });
});

describe("isNetworkError", () => {
  it("treats axios ERR_NETWORK (no response) as a network error", () => {
    expect(isNetworkError({ code: "ERR_NETWORK", message: "Network Error" })).toBe(true);
  });

  it("treats a plain 'Network Error' message as a network error", () => {
    expect(isNetworkError(new Error("Network Error"))).toBe(true);
  });

  it("does not treat a server-answered error (has response) as a network error", () => {
    expect(isNetworkError({ code: "ERR_NETWORK", response: { status: 500 } })).toBe(false);
  });

  it("does not treat an unrelated error as a network error", () => {
    expect(isNetworkError(new Error("Something else"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
