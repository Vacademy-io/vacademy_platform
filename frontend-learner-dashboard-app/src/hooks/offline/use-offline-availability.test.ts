/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** First backoff step in use-offline-availability.ts. */
const RETRY_TICK = 1000;

const mockGetInstituteId = vi.fn();
vi.mock("@/constants/helper", () => ({
  getInstituteId: () => mockGetInstituteId(),
}));

const mockGet = vi.fn();
vi.mock("@/lib/auth/axiosInstance", () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock("@/lib/offline/platform", () => ({ isOfflineSupported: () => true }));

vi.mock("@/utils/network-plugin", () => ({
  Network: { addListener: vi.fn(async () => ({ remove: vi.fn() })) },
}));

vi.mock("@/constants/urls", () => ({ OFFLINE_SETTINGS_URL: "/settings" }));

/** Fresh module per test — the gate deliberately keeps process-wide state. */
async function loadGate() {
  vi.resetModules();
  return import("./use-offline-availability");
}

describe("offline availability gate", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetInstituteId.mockReset();
    mockGet.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The fresh-install bug: the first call lands while the app is still booting,
   * before the institute id is stored. Caching that "no" meant the learner had
   * to force-quit the app before Downloads appeared.
   */
  it("retries until the institute id exists instead of caching the early miss", async () => {
    vi.useFakeTimers();
    const gate = await loadGate();
    mockGetInstituteId.mockResolvedValueOnce(null).mockResolvedValue("inst-1");
    mockGet.mockResolvedValue({ data: { enabled: true } });

    expect(await gate.refreshOfflineAvailability()).toBe(false); // nothing known — fail closed
    expect(mockGet).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(RETRY_TICK);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(gate.lastKnownOfflineAvailability()).toBe(true);
  });

  it("does not cache a failed request, so the next ask re-hits the server", async () => {
    const gate = await loadGate();
    mockGetInstituteId.mockResolvedValue("inst-1");
    mockGet
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ data: { enabled: true } });

    expect(await gate.refreshOfflineAvailability()).toBe(false);
    expect(await gate.refreshOfflineAvailability()).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("caches a real answer, so repeat asks don't re-hit the server", async () => {
    const gate = await loadGate();
    mockGetInstituteId.mockResolvedValue("inst-1");
    mockGet.mockResolvedValue({ data: { enabled: true } });

    expect(await gate.refreshOfflineAvailability()).toBe(true);
    const { useOfflineAvailable } = gate;
    expect(typeof useOfflineAvailable).toBe("function");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  /** A relaunch with no connectivity must still surface Downloads. */
  it("remembers a confirmed answer across launches", async () => {
    const gate = await loadGate();
    mockGetInstituteId.mockResolvedValue("inst-1");
    mockGet.mockResolvedValue({ data: { enabled: true } });
    expect(await gate.refreshOfflineAvailability()).toBe(true);

    const relaunched = await loadGate(); // new process, same localStorage
    mockGet.mockRejectedValue(new Error("offline"));
    expect(relaunched.lastKnownOfflineAvailability()).toBe(true);
    expect(await relaunched.refreshOfflineAvailability()).toBe(true);
  });
});

