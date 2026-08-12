/**
 * Thin wrapper around the custom `OfflineDownloads` Capacitor plugin.
 *
 *  - Android: android/app/src/main/java/com/template/app/offlinedownloads/*.java, registered via
 *    MainActivity.onCreate() -> registerPlugin(OfflineDownloadsPlugin.class). Runs a `dataSync`
 *    foreground service so the JS download queue keeps executing while the app is backgrounded,
 *    and shows the "N of M downloaded · K pending" progress notification.
 *  - iOS / Electron / web: not implemented — every method degrades to a no-op, so the download
 *    engine never has to branch on platform. (iOS keeps short background execution windows via
 *    the OS rather than a user-visible service; wiring that up is a separate change.)
 *
 * The queue itself is owned entirely by download-manager.ts — this module only mirrors its
 * progress into the OS so the learner can see it and Android keeps us alive.
 */

import { registerPlugin } from "@capacitor/core";
import { getCurrentPlatform } from "../platform";

export interface OfflineDownloadProgress {
  /** Assets finished so far in the current run. */
  done: number;
  /** Total assets in the current run (done + pending + in-flight). */
  total: number;
  /** Optional notification title override. */
  title?: string;
}

interface OfflineDownloadsPlugin {
  start(options: OfflineDownloadProgress): Promise<{ started: boolean }>;
  update(options: OfflineDownloadProgress): Promise<{ started: boolean }>;
  complete(options: OfflineDownloadProgress): Promise<void>;
  stop(): Promise<void>;
  ensureNotificationPermission(): Promise<{ granted: boolean }>;
}

const plugin = registerPlugin<OfflineDownloadsPlugin>("OfflineDownloads");

/** Only Android implements the foreground service today. */
const isSupported = (): boolean => getCurrentPlatform() === "android";

/**
 * Asks for notification permission (Android 13+) so download progress is actually visible.
 * Returns false if unavailable or declined; the caller downloads either way.
 */
export async function ensureDownloadNotificationPermission(): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    const { granted } = await plugin.ensureNotificationPermission();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Starts (or refreshes) the foreground service + progress notification. Safe to call on every
 * progress tick — Android coalesces repeated startForegroundService calls onto the same service.
 */
export async function startDownloadNotification(progress: OfflineDownloadProgress): Promise<void> {
  if (!isSupported()) return;
  try {
    await plugin.start(progress);
  } catch {
    // Never let notification plumbing break an actual download.
  }
}

export async function updateDownloadNotification(progress: OfflineDownloadProgress): Promise<void> {
  if (!isSupported()) return;
  try {
    await plugin.update(progress);
  } catch {
    // ignore
  }
}

/**
 * Queue drained with work actually done: leaves a "N of N ready for offline use"
 * summary the learner can see and dismiss, and stands the service down.
 *
 * Without this a small download (a few seconds) would post a notification and
 * silently erase it again, so the learner saw nothing at all.
 */
export async function completeDownloadNotification(
  progress: OfflineDownloadProgress
): Promise<void> {
  if (!isSupported()) return;
  try {
    await plugin.complete(progress);
  } catch {
    // ignore
  }
}

/** Drops the notification and releases the wake lock. Call when the queue drains. */
export async function stopDownloadNotification(): Promise<void> {
  if (!isSupported()) return;
  try {
    await plugin.stop();
  } catch {
    // ignore
  }
}
