/**
 * Lease clock math (plan §B6). A lease is valid until `lease_expires_at`
 * (server clock, ms epoch) as measured from the last successful check-in.
 * Wall-clock alone is trivially defeated by setting the device clock back,
 * so we also track elapsed time via `performance.now()`, which is monotonic
 * *within a single app run* but resets to 0 on relaunch.
 *
 * To bridge app restarts we record a "boot anchor" the first time this
 * module is touched in a run: `{ bootWallclock: Date.now(), bootMonotonic:
 * performance.now() }`. For any later instant, `monotonicElapsedSinceBoot +
 * (bootWallclock - lastCheckinAt)` reconstructs elapsed real time without
 * trusting the *current* wall clock at all — only the (much harder to
 * manipulate) delta recorded at boot.
 *
 * `now_est = last_checkin_at + max(wallclockElapsed, monotonicElapsed)`:
 * taking the max means a clock set *backward* can't shrink the estimate
 * (monotonic floor holds), while a clock set *forward* can't be used to
 * fool the check the other way either, since it would only ever inflate
 * `now_est` toward "more expired," never less. This is a deterrent against
 * casual tampering, not a cryptographic guarantee — a rooted device with a
 * frozen monotonic clock and a fixed system clock could still defeat it;
 * the real backstop is that content is useless without the device-local key
 * regardless of lease state.
 */

interface BootAnchor {
  bootWallclock: number;
  bootMonotonic: number;
}

let anchor: BootAnchor | null = null;

/** Records this run's boot anchor once. Idempotent — later calls are no-ops. Call from useOfflineCheckin's init. */
export function ensureBootAnchor(): BootAnchor {
  if (!anchor) {
    anchor = { bootWallclock: Date.now(), bootMonotonic: performance.now() };
  }
  return anchor;
}

/** Test-only: clears the module-level anchor so each test run starts fresh. */
export function resetBootAnchorForTests(): void {
  anchor = null;
}

/**
 * Conservative "now" estimate anchored off the last check-in, per the
 * module doc comment's max(wallclock, monotonic) rule.
 */
export function estimateNow(lastCheckinAt: number): number {
  const { bootWallclock, bootMonotonic } = ensureBootAnchor();
  const monotonicElapsedSinceBoot = performance.now() - bootMonotonic;
  const wallclockElapsed = Date.now() - lastCheckinAt;
  const monotonicElapsed = bootWallclock - lastCheckinAt + monotonicElapsedSinceBoot;
  return lastCheckinAt + Math.max(wallclockElapsed, monotonicElapsed);
}

export interface LeaseCheckInput {
  lease_expires_at: number | null;
  last_checkin_at: number | null;
  revoked: number | boolean;
}

/** True when the device is neither revoked nor past its (tamper-resistant) estimated lease expiry. No row / no lease yet → valid (nothing to enforce). */
export function isLeaseValid(state: LeaseCheckInput | null): boolean {
  if (!state) return true;
  if (state.revoked) return false;
  if (!state.lease_expires_at) return true;
  if (!state.last_checkin_at) {
    // No check-in anchor to build the monotonic estimate from — fall back
    // to a plain wall-clock comparison rather than treating it as "valid".
    return Date.now() < state.lease_expires_at;
  }
  return estimateNow(state.last_checkin_at) < state.lease_expires_at;
}
