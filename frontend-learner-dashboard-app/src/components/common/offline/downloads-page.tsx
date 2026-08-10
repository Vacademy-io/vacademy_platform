/**
 * "Downloads" screen (plan §B7): storage used, grouped per-node delete,
 * Clear all, Wi-Fi-only toggle, lease status line.
 */

import { useEffect, useState } from "react";
import { Bell, CloudCheck, DeviceMobile, Trash, WifiHigh, WifiSlash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useOfflineStore } from "@/stores/offline/use-offline-store";
import { useOfflineUserId } from "@/hooks/offline/use-offline-status";
import { downloadManager } from "@/lib/offline/download/download-manager";
import { getOfflineDb } from "@/lib/offline/db/connection";
import { manifestsDao } from "@/lib/offline/db/dao/manifests-dao";
import { noticesDao } from "@/lib/offline/db/dao/notices-dao";
import { deviceStateDao } from "@/lib/offline/db/dao/device-state-dao";
import type { NoticeRow } from "@/lib/offline/db/types";
import { loadPersistedManifest, type OfflineManifest } from "@/services/offline/manifest-service";
import { slidesInSubtree } from "@/lib/offline/download/expander";
import { MyButton } from "@/components/design-system/button";
import { listDevices, selfRevokeDevice, type OfflineDeviceDTO } from "@/services/offline/device-service";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export const DownloadsPage = () => {
  const userId = useOfflineUserId();
  const { storageUsedBytes, wifiOnly, leaseState, setWifiOnly, hydrate } = useOfflineStore();
  const [manifests, setManifests] = useState<OfflineManifest[]>([]);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [devices, setDevices] = useState<OfflineDeviceDTO[]>([]);
  const [thisDeviceRegistrationId, setThisDeviceRegistrationId] = useState<string | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void hydrate(userId);
    void (async () => {
      const db = await getOfflineDb();
      const rows = await manifestsDao.listForUser(db, userId);
      const parsed = await Promise.all(
        rows.map((row) => loadPersistedManifest(userId, row.package_session_id))
      );
      setManifests(parsed.filter((m): m is OfflineManifest => m !== null));
      setNotices(await noticesDao.listUnseen(db, userId));
      const deviceState = await deviceStateDao.get(db, userId);
      setThisDeviceRegistrationId(deviceState?.device_registration_id ?? null);
    })();
  }, [userId, hydrate]);

  const refreshDevices = async () => {
    setDevicesLoading(true);
    try {
      setDevices(await listDevices());
    } catch (error) {
      console.error("[offline] failed to load devices", error);
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (userId) void refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleRevokeDevice = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      await selfRevokeDevice(deviceId);
      await refreshDevices();
      toast.success("Device removed from offline access.");
    } catch (error) {
      console.error("[offline] failed to revoke device", error);
      toast.error("Couldn't remove that device. Please try again.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleDismissNotice = async (id: string) => {
    if (!userId) return;
    const db = await getOfflineDb();
    await noticesDao.markSeen(db, userId, id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  if (!userId) return null;

  const handleDeleteSubject = async (manifest: OfflineManifest, subjectId: string) => {
    setBusy(true);
    try {
      const slideIds = slidesInSubtree(manifest, subjectId, "SUBJECT")
        .filter((ctx) => ctx.slide.downloadable)
        .map((ctx) => ctx.slide.slide_id);
      await downloadManager.deleteNode(userId, manifest.package_session_id, slideIds);
      await hydrate(userId);
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    setBusy(true);
    try {
      for (const manifest of manifests) {
        const slideIds = slidesInSubtree(manifest)
          .filter((ctx) => ctx.slide.downloadable)
          .map((ctx) => ctx.slide.slide_id);
        await downloadManager.deleteNode(userId, manifest.package_session_id, slideIds);
      }
      await hydrate(userId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold text-neutral-800">Downloads</h2>
        <p className="text-body text-neutral-500">Manage what's saved to this device for offline use.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-body font-medium text-neutral-700">Storage used</span>
          <span className="text-body text-neutral-500">{formatBytes(storageUsedBytes)}</span>
        </div>
        <LeaseStatusLine leaseState={leaseState} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2">
          {wifiOnly ? <WifiHigh size={18} /> : <WifiSlash size={18} />}
          <span className="text-body text-neutral-700">Download over Wi-Fi only</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={wifiOnly}
          onClick={() => setWifiOnly(!wifiOnly)}
          className={`h-6 w-11 rounded-full transition-colors ${wifiOnly ? "bg-primary-500" : "bg-neutral-300"}`}
        >
          <span
            className={`block size-5 rounded-full bg-white shadow transition-transform ${wifiOnly ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>

      {notices.length > 0 && (
        <div className="flex flex-col gap-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3"
            >
              <div className="flex items-start gap-2">
                <Bell size={16} className="mt-0.5 shrink-0 text-warning-600" />
                <span className="text-caption text-neutral-700">{notice.message}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleDismissNotice(notice.id)}
                className="shrink-0 text-neutral-400 hover:text-neutral-600"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center gap-2">
          <DeviceMobile size={18} />
          <span className="text-body font-medium text-neutral-700">Offline devices</span>
        </div>
        {devicesLoading && devices.length === 0 && (
          <p className="text-caption text-neutral-400">Loading…</p>
        )}
        {!devicesLoading && devices.length === 0 && (
          <p className="text-caption text-neutral-400">No devices registered for offline access.</p>
        )}
        {devices.map((device) => {
          const isThisDevice = device.id === thisDeviceRegistrationId;
          return (
            <div key={device.id} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-body text-neutral-700">
                  {device.device_name ?? "Unnamed device"}
                  {isThisDevice && <span className="ml-1 text-caption text-primary-500">(this device)</span>}
                </span>
                <span className="text-caption text-neutral-400">{device.platform ?? "unknown"}</span>
              </div>
              <button
                type="button"
                disabled={revokingId === device.id}
                onClick={() => void handleRevokeDevice(device.id)}
                className="inline-flex items-center gap-1 text-caption text-danger-600 hover:underline disabled:opacity-50"
              >
                <Trash size={14} /> Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {manifests.length === 0 && (
          <p className="text-body text-neutral-400">Nothing downloaded yet.</p>
        )}
        {manifests.map((manifest) => (
          <div key={manifest.package_session_id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4">
            {manifest.subjects.map((subject) => (
              <div key={subject.subject_id} className="flex items-center justify-between">
                <span className="text-body text-neutral-700">{subject.subject_name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDeleteSubject(manifest, subject.subject_id)}
                  className="inline-flex items-center gap-1 text-caption text-danger-600 hover:underline disabled:opacity-50"
                >
                  <Trash size={14} /> Delete
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {manifests.length > 0 && (
        <MyButton buttonType="secondary" disable={busy} onClick={() => void handleClearAll()}>
          Clear all downloads
        </MyButton>
      )}
    </div>
  );
};

function LeaseStatusLine({ leaseState }: { leaseState: { kind: string; expiresAt?: number } }) {
  if (leaseState.kind === "valid") {
    return (
      <div className="flex items-center gap-1.5 text-caption text-neutral-500">
        <CloudCheck size={14} className="text-success-600" />
        <span>Offline access valid until {new Date(leaseState.expiresAt ?? 0).toLocaleDateString()}</span>
      </div>
    );
  }
  if (leaseState.kind === "expired") {
    return <div className="text-caption text-warning-600">Offline access needs to reconnect to renew.</div>;
  }
  if (leaseState.kind === "revoked") {
    return <div className="text-caption text-danger-600">Offline access has been revoked by your institute.</div>;
  }
  return <div className="text-caption text-neutral-400">No offline device registered yet.</div>;
}
