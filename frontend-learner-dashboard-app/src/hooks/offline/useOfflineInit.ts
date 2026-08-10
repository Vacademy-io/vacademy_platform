/**
 * Mounts the offline subsystem's background singletons (plan §B5 point 5):
 * the download manager's boot recovery/resume queue (Phase 6/7) and the
 * event flusher's boot recovery/sync loop (Phase 8). Both are no-ops behind
 * `isOfflineSupported()` (plain web has the feature off entirely — see
 * `src/lib/offline/platform.ts`).
 *
 * Call once from the authenticated app shell (`src/routes/__root.tsx`) once
 * the learner's userId is known.
 */

import { useEffect } from "react";
import { isOfflineSupported } from "@/lib/offline/platform";
import { downloadManager } from "@/lib/offline/download/download-manager";
import { eventFlusher } from "@/lib/offline/events/event-flusher";
import { useOfflineCheckin } from "./useOfflineCheckin";

export function useOfflineInit(userId: string | null | undefined): void {
  // Lease check-in loop (plan §B6) — a sibling hook, mounted alongside the
  // download manager / event flusher singletons below. Composing it as a
  // hook call here (rather than an imperative init/dispose pair) keeps its
  // own network-listener + interval lifecycle self-contained.
  useOfflineCheckin(userId);

  useEffect(() => {
    if (!userId || !isOfflineSupported()) return;

    let cancelled = false;
    void (async () => {
      try {
        await downloadManager.init(userId);
        if (cancelled) return;
        await eventFlusher.init(userId);
      } catch (error) {
        console.error("[useOfflineInit] failed to initialize offline subsystem", error);
      }
    })();

    return () => {
      cancelled = true;
      void eventFlusher.stop();
      void downloadManager.dispose();
    };
  }, [userId]);
}
