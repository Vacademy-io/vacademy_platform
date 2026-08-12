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
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { isOfflineSupported } from "@/lib/offline/platform";
import { downloadManager } from "@/lib/offline/download/download-manager";
import { eventFlusher } from "@/lib/offline/events/event-flusher";
import { getOfflineDb } from "@/lib/offline/db/connection";
import { manifestsDao } from "@/lib/offline/db/dao/manifests-dao";
import { noticesDao } from "@/lib/offline/db/dao/notices-dao";
import { Network } from "@/utils/network-plugin";
import { useOfflineStore } from "@/stores/offline/use-offline-store";
import { useOfflineCheckin } from "./useOfflineCheckin";
import { useOfflineAvailable } from "./use-offline-availability";

export function useOfflineInit(userId: string | null | undefined): void {
  // Lease check-in loop (plan §B6) — a sibling hook, mounted alongside the
  // download manager / event flusher singletons below. Composing it as a
  // hook call here (rather than an imperative init/dispose pair) keeps its
  // own network-listener + interval lifecycle self-contained.
  useOfflineCheckin(userId);

  // Institute kill switch. When the admin has offline turned off we start none
  // of it — no device registration, no manifest fetches, no offline prompts —
  // so the feature is genuinely absent rather than merely hidden.
  const offlineAvailable = useOfflineAvailable();

  useEffect(() => {
    if (!userId || !isOfflineSupported() || offlineAvailable !== true) return;

    let cancelled = false;
    void (async () => {
      try {
        // Offline is on again, so any "your institute turned off offline
        // downloads" / revoked card is stale and actively misleading. Clear it
        // before anything else renders.
        try {
          const db = await getOfflineDb();
          await noticesDao.deleteByKinds(db, userId, ["OFFLINE_DISABLED", "DEVICE_REVOKED"]);
        } catch {
          // best-effort — never block init over a notice
        }
        if (cancelled) return;
        // Restore the Wi-Fi-only preference BEFORE the download manager starts
        // draining the queue — otherwise the first preflight runs against the
        // default (Wi-Fi only ON) and parks jobs a cellular learner had opted in to.
        await useOfflineStore.getState().loadWifiOnly();
        if (cancelled) return;
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
  }, [userId, offlineAvailable]);

  // Offline-detection prompt (user feedback 2026-08-11). Two rules:
  //  - evaluate the CURRENT status on mount, so launching the app already
  //    offline shows the prompt (not only on a later transition);
  //  - on reconnect, DISMISS the prompt rather than firing anything — the
  //    earlier version only reacted to change events, so the toast could
  //    surface at the moment connectivity came back.
  const navigate = useNavigate();
  useEffect(() => {
    if (!userId || !isOfflineSupported() || offlineAvailable !== true) return;
    let removed = false;
    let handle: { remove: () => void | Promise<void> } | null = null;

    const OFFLINE_TOAST_ID = "offline-mode-prompt";

    const applyStatus = (connected: boolean) => {
      if (removed) return;
      if (connected) {
        toast.dismiss(OFFLINE_TOAST_ID);
        return;
      }
      void (async () => {
        try {
          const db = await getOfflineDb();
          const manifests = await manifestsDao.listForUser(db, userId);
          if (removed || manifests.length === 0) return;
          toast.info("You're offline", {
            id: OFFLINE_TOAST_ID, // dedupe repeated flaps
            description: "Your downloaded content is still available.",
            action: { label: "Go to Downloads", onClick: () => navigate({ to: "/downloads" }) },
            duration: Infinity, // stays until reconnect dismisses it
          });
        } catch {
          // best-effort — never break the app over a prompt
        }
      })();
    };

    // Initial evaluation on mount.
    void Network.getStatus()
      .then((status) => applyStatus(status.connected))
      .catch(() => {});

    void Network.addListener("networkStatusChange", (status) => {
      applyStatus(status.connected);
    }).then((h) => {
      if (removed) void h.remove();
      else handle = h;
    });

    return () => {
      removed = true;
      toast.dismiss(OFFLINE_TOAST_ID);
      void handle?.remove();
    };
  }, [userId, navigate, offlineAvailable]);
}
