/**
 * Lease check-in loop (plan §B6). `checkinLoop` is a singleton mirroring the
 * `eventFlusher` pattern (init/stop, network-reconnect + interval triggers)
 * so the two subsystems compose the same way in `useOfflineInit`. Wires
 * `event-flusher.ts`'s `setOnDeviceRevoked` hook to the shared
 * `handleDeviceRevoked` purge so a revocation discovered mid-sync-flush and
 * one discovered at check-in both converge on the same cleanup.
 */

import { useEffect } from "react";
import { Network } from "@/utils/network-plugin";
import { isOfflineSupported } from "@/lib/offline/platform";
import { performCheckIn, handleDeviceRevoked } from "@/lib/offline/lease/checkin";
import { setOnDeviceRevoked } from "@/lib/offline/events/event-flusher";

const CHECKIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h, per plan §B6

class CheckinLoop {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private networkListenerHandle: { remove: () => void | Promise<void> } | null = null;
  private wired = false;

  /** Wires triggers + runs an immediate check-in if online. Call once per app start / login. */
  async init(userId: string): Promise<void> {
    if (!this.wired) {
      setOnDeviceRevoked((revokedUserId) => void handleDeviceRevoked(revokedUserId));
      this.wired = true;
    }

    if (!this.networkListenerHandle) {
      this.networkListenerHandle = await Network.addListener("networkStatusChange", (status) => {
        if (status.connected) void performCheckIn(userId);
      });
    }
    if (!this.intervalHandle) {
      this.intervalHandle = setInterval(() => void performCheckIn(userId), CHECKIN_INTERVAL_MS);
    }

    const status = await Network.getStatus();
    if (status.connected) void performCheckIn(userId);
  }

  async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.networkListenerHandle) {
      await this.networkListenerHandle.remove();
      this.networkListenerHandle = null;
    }
  }
}

export const checkinLoop = new CheckinLoop();

/** Mounts the check-in loop for the given user. No-op on plain web / logged out (plan §B1 platform scoping). */
export function useOfflineCheckin(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId || !isOfflineSupported()) return;

    void checkinLoop.init(userId);

    return () => {
      void checkinLoop.stop();
    };
  }, [userId]);
}
