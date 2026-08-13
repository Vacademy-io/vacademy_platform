import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureBootAnchor, estimateNow, isLeaseValid, resetBootAnchorForTests } from "./lease-state";

describe("lease-state clock math", () => {
  beforeEach(() => {
    resetBootAnchorForTests();
  });
  afterEach(() => {
    resetBootAnchorForTests();
    vi.restoreAllMocks();
  });

  it("is valid when now is well before lease_expires_at", () => {
    const now = Date.now();
    expect(
      isLeaseValid({ lease_expires_at: now + 60_000, last_checkin_at: now - 1_000, revoked: 0 })
    ).toBe(true);
  });

  it("is expired once elapsed time passes lease_expires_at", () => {
    const now = Date.now();
    expect(
      isLeaseValid({ lease_expires_at: now - 60_000, last_checkin_at: now - 120_000, revoked: 0 })
    ).toBe(false);
  });

  it("treats a revoked device as invalid regardless of lease timing", () => {
    const now = Date.now();
    expect(
      isLeaseValid({ lease_expires_at: now + 60_000, last_checkin_at: now, revoked: 1 })
    ).toBe(false);
  });

  it("treats a missing row / no lease yet as valid (nothing to enforce)", () => {
    expect(isLeaseValid(null)).toBe(true);
    expect(isLeaseValid({ lease_expires_at: null, last_checkin_at: null, revoked: 0 })).toBe(true);
  });

  it("is NOT fooled by the wall clock being set backward — monotonic elapsed still counts", () => {
    const bootWallclock = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(bootWallclock);
    vi.spyOn(performance, "now").mockReturnValue(0);
    ensureBootAnchor(); // anchors at (bootWallclock, monotonic=0)

    // Last check-in was 1 minute before boot; lease is 5 minutes from check-in
    // (i.e. 4 minutes from boot). 10 minutes of *monotonic* time pass, but the
    // attacker also winds the wall clock back to right at boot time.
    const lastCheckinAt = bootWallclock - 60_000;
    const leaseExpiresAt = lastCheckinAt + 5 * 60_000;

    vi.spyOn(Date, "now").mockReturnValue(bootWallclock); // clock set back to boot
    vi.spyOn(performance, "now").mockReturnValue(10 * 60_000); // but 10 real minutes elapsed

    expect(estimateNow(lastCheckinAt)).toBeGreaterThan(leaseExpiresAt);
    expect(isLeaseValid({ lease_expires_at: leaseExpiresAt, last_checkin_at: lastCheckinAt, revoked: 0 })).toBe(
      false
    );
  });

  it("is NOT fooled by the wall clock being set forward into looking still-valid", () => {
    // A forward-set clock can only ever push the estimate to "more expired,"
    // never less — max(wallclock, monotonic) means neither delta alone can
    // shrink the estimate below the monotonic floor.
    const bootWallclock = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(bootWallclock);
    vi.spyOn(performance, "now").mockReturnValue(0);
    ensureBootAnchor();

    const lastCheckinAt = bootWallclock;
    const leaseExpiresAt = lastCheckinAt + 5 * 60_000;

    // Only 1 real minute has passed (monotonic), but the wall clock is
    // spoofed 100 minutes into the future.
    vi.spyOn(Date, "now").mockReturnValue(bootWallclock + 100 * 60_000);
    vi.spyOn(performance, "now").mockReturnValue(1 * 60_000);

    // The spoofed-forward wallclock elapsed (100 min) wins the max() against
    // the true monotonic elapsed (1 min) — this deliberately reports expired
    // rather than risk under-enforcing; see lease-state.ts's doc comment.
    expect(isLeaseValid({ lease_expires_at: leaseExpiresAt, last_checkin_at: lastCheckinAt, revoked: 0 })).toBe(
      false
    );
  });
});
