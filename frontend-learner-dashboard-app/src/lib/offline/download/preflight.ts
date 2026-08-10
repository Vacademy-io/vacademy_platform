/**
 * Preflight checks before starting/resuming a download (plan §B3).
 * Checks: lease validity (device_state, via the tamper-resistant clock math
 * in lease-state.ts — a missing row means "no lease established yet", which
 * we treat as allow, since nothing has been registered to enforce), Wi-Fi
 * (unless the caller passed a per-enqueue cellular override), and free disk
 * space (best-effort — a `null` reading from the not-yet-landed native
 * plugin means "unknown", which we do NOT block on).
 */

import type { OfflineDbConnection } from "../db/connection";
import { deviceStateDao } from "../db/dao/device-state-dao";
import { getFreeDiskSpace } from "../native/offline-media";
import { Network } from "@/utils/network-plugin";
import { isLeaseValid } from "../lease/lease-state";

export type PreflightFailureReason =
  | "LEASE_EXPIRED"
  | "LEASE_REVOKED"
  | "WIFI_REQUIRED"
  | "DISK_FULL"
  | "OFFLINE";

export interface PreflightResult {
  ok: boolean;
  reason?: PreflightFailureReason;
}

export interface PreflightOptions {
  /** User explicitly allowed this one download over cellular (plan §B3 "per-enqueue cellular override"). */
  allowCellular?: boolean;
  /** User's Wi-Fi-only setting (default ON — see use-offline-store `wifiOnly`). */
  wifiOnly: boolean;
  /** Estimated total bytes this job needs, for the disk-space margin check. */
  estimatedBytes: number;
}

/** Required free-space margin: total size × 1.05 + 200 MB (plan §B3). */
export function requiredFreeBytes(estimatedBytes: number): number {
  return Math.ceil(estimatedBytes * 1.05) + 200 * 1024 * 1024;
}

export async function runPreflight(
  db: OfflineDbConnection,
  userId: string,
  options: PreflightOptions
): Promise<PreflightResult> {
  // Lease check (plan §B6). No row yet = nothing registered to enforce = allow.
  const deviceState = await deviceStateDao.get(db, userId);
  if (deviceState?.revoked) {
    return { ok: false, reason: "LEASE_REVOKED" };
  }
  if (deviceState && !isLeaseValid(deviceState)) {
    return { ok: false, reason: "LEASE_EXPIRED" };
  }

  // Network check.
  const status = await Network.getStatus();
  if (!status.connected) {
    return { ok: false, reason: "OFFLINE" };
  }
  if (options.wifiOnly && !options.allowCellular && status.connectionType !== "wifi") {
    return { ok: false, reason: "WIFI_REQUIRED" };
  }

  // Disk space check — best effort; `null` (plugin not available yet) skips
  // the check rather than blocking every download.
  const space = await getFreeDiskSpace();
  if (space !== null) {
    const required = requiredFreeBytes(options.estimatedBytes);
    if (space.freeBytes < required) {
      return { ok: false, reason: "DISK_FULL" };
    }
  }

  return { ok: true };
}
