/**
 * Zustand store mirroring offline state for the UI (plan §B7).
 * Source of truth is the offline SQLite DB; this store is a read model
 * hydrated on init and updated by the download manager / lease loop.
 */

import { create } from "zustand";
import { Preferences } from "@capacitor/preferences";
import { getOfflineDb } from "@/lib/offline/db/connection";
import { assetsDao } from "@/lib/offline/db/dao/assets-dao";
import { deviceStateDao } from "@/lib/offline/db/dao/device-state-dao";
import { eventQueueDao } from "@/lib/offline/db/dao/event-queue-dao";
import { nodesDao } from "@/lib/offline/db/dao/nodes-dao";
import { manifestsDao } from "@/lib/offline/db/dao/manifests-dao";
import type { NodeDownloadStatus } from "@/lib/offline/db/types";
import { isLeaseValid } from "@/lib/offline/lease/lease-state";

export type LeaseState =
    | { kind: "none" }
    | { kind: "valid"; expiresAt: number }
    | { kind: "expired"; expiredAt: number }
    | { kind: "revoked" };

export interface QueueSummary {
    pendingEvents: number;
    downloadingNodes: number;
}

interface OfflineStoreState {
    hydratedForUserId: string | null;
    /** node_id → download status, across all of this user's manifests. */
    nodeStatuses: Record<string, NodeDownloadStatus>;
    queueSummary: QueueSummary;
    storageUsedBytes: number;
    leaseState: LeaseState;
    /** Learner setting: only download on Wi-Fi (default ON, plan §2.2/NFR). */
    wifiOnly: boolean;
    /** True when the app is operating from offline snapshots (no network). */
    isOfflineMode: boolean;
    /** Blocking "this device was revoked" dialog (plan §B6 device-revoked path). */
    revokedDialogOpen: boolean;

    setNodeStatus: (nodeId: string, status: NodeDownloadStatus) => void;
    setWifiOnly: (wifiOnly: boolean) => void;
    setOfflineMode: (isOfflineMode: boolean) => void;
    setLeaseState: (leaseState: LeaseState) => void;
    setRevokedDialogOpen: (open: boolean) => void;
    /** Rebuild the read model from SQLite for the given user. */
    hydrate: (userId: string) => Promise<void>;
    /** Restores the persisted Wi-Fi-only preference. */
    loadWifiOnly: () => Promise<void>;
    reset: () => void;
}

/** Preferences key backing the Wi-Fi-only download setting. */
const WIFI_ONLY_KEY = "offline.wifiOnly";

const initialState = {
    hydratedForUserId: null,
    nodeStatuses: {},
    queueSummary: { pendingEvents: 0, downloadingNodes: 0 },
    storageUsedBytes: 0,
    leaseState: { kind: "none" } as LeaseState,
    wifiOnly: true,
    isOfflineMode: false,
    revokedDialogOpen: false,
};

export const useOfflineStore = create<OfflineStoreState>((set) => ({
    ...initialState,

    setNodeStatus: (nodeId, status) =>
        set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),

    setWifiOnly: (wifiOnly) => {
        set({ wifiOnly });
        // Persist: this store is plain (no persist middleware), so without this
        // the setting silently snapped back to Wi-Fi-only on every full page
        // load. A learner on mobile data would turn it off, navigate, and find
        // their downloads mysteriously waiting again.
        void Preferences.set({ key: WIFI_ONLY_KEY, value: wifiOnly ? "1" : "0" }).catch(() => {});
    },

    /** Restores the persisted Wi-Fi-only preference. Call once at offline init. */
    loadWifiOnly: async () => {
        try {
            const { value } = await Preferences.get({ key: WIFI_ONLY_KEY });
            if (value === "0" || value === "1") set({ wifiOnly: value === "1" });
        } catch {
            // keep the safe default (Wi-Fi only ON)
        }
    },

    setOfflineMode: (isOfflineMode) => set({ isOfflineMode }),
    setLeaseState: (leaseState) => set({ leaseState }),
    setRevokedDialogOpen: (revokedDialogOpen) => set({ revokedDialogOpen }),

    hydrate: async (userId) => {
        const db = await getOfflineDb();

        const [manifests, deviceState, pendingEvents, storageUsedBytes] = await Promise.all([
            manifestsDao.listForUser(db, userId),
            deviceStateDao.get(db, userId),
            eventQueueDao.countByStatus(db, userId, "PENDING"),
            assetsDao.totalDownloadedBytes(db, userId),
        ]);

        const nodeStatuses: Record<string, NodeDownloadStatus> = {};
        let downloadingNodes = 0;
        for (const manifest of manifests) {
            const nodes = await nodesDao.listByPackageSession(
                db,
                userId,
                manifest.package_session_id
            );
            for (const node of nodes) {
                nodeStatuses[node.node_id] = node.status;
                if (node.status === "DOWNLOADING" || node.status === "QUEUED") {
                    downloadingNodes++;
                }
            }
        }

        let leaseState: LeaseState = { kind: "none" };
        if (deviceState?.revoked) {
            leaseState = { kind: "revoked" };
        } else if (deviceState?.lease_expires_at) {
            leaseState = isLeaseValid(deviceState)
                ? { kind: "valid", expiresAt: deviceState.lease_expires_at }
                : { kind: "expired", expiredAt: deviceState.lease_expires_at };
        }

        set({
            hydratedForUserId: userId,
            nodeStatuses,
            queueSummary: { pendingEvents, downloadingNodes },
            storageUsedBytes,
            leaseState,
        });
    },

    reset: () => set({ ...initialState }),
}));
