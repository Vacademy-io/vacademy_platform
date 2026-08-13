/**
 * React hooks bridging the offline store (SQLite read model) into UI
 * components (plan §B7). Kept separate from `use-offline-store.ts` itself so
 * that store stays a plain state container and components only ever touch
 * the narrow, purpose-built selectors here.
 */

import { useEffect, useState } from "react";
import { useOfflineStore } from "@/stores/offline/use-offline-store";
import type { NodeDownloadStatus } from "@/lib/offline/db/types";
import { getUserId } from "@/constants/getUserId";
import { isOfflineSupported } from "@/lib/offline/platform";

/** Resolves the logged-in learner's userId once (offline rows are always partitioned by it). */
export function useOfflineUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getUserId().then((id) => {
      if (!cancelled) setUserId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return userId;
}

/** Live download status for a single node (subject/module/chapter/slide), or null when unknown/not-yet-hydrated. */
export function useNodeOfflineStatus(nodeId: string | undefined | null): NodeDownloadStatus | null {
  return useOfflineStore((state) => (nodeId ? (state.nodeStatuses[nodeId] ?? null) : null));
}

/** Alias kept for call-site clarity at slide leaves (plan explicitly names both hooks). */
export const useSlideOfflineStatus = useNodeOfflineStatus;

/** True once this device has hydrated *some* offline state for the current user (i.e. offline mode has real data to show). */
export function useHasOfflineData(): boolean {
  return useOfflineStore((state) => Object.keys(state.nodeStatuses).length > 0);
}

export function useIsOfflineFeatureAvailable(): boolean {
  return isOfflineSupported();
}
