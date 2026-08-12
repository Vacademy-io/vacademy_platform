package io.vacademy.student.app.offlinedownloads;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Native `OfflineDownloads` Capacitor plugin (Android). Local, in-repo plugin — no npm package —
 * so it is registered explicitly by {@code MainActivity.onCreate()}.
 *
 * Thin control surface over {@link OfflineDownloadService}; the queue itself stays in JS.
 *  - `start({done, total, title})` — begin/refresh the foreground service + progress notification.
 *  - `update({done, total, title})` — same thing, kept separate for call-site readability.
 *  - `stop()` — drop the notification and let the process be backgrounded normally.
 *
 * All methods are no-ops that still resolve on platforms/SDK levels where the service can't be
 * started, so JS never has to branch on availability.
 */
@CapacitorPlugin(
        name = "OfflineDownloads",
        permissions = {
            @Permission(alias = OfflineDownloadsPlugin.NOTIFICATIONS, strings = { Manifest.permission.POST_NOTIFICATIONS })
        })
public class OfflineDownloadsPlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";

    /**
     * Asks for POST_NOTIFICATIONS if this build needs it (Android 13+) and it isn't granted yet.
     *
     * The app otherwise only requests this as part of the *push* opt-in, so a learner who
     * declined push would download content with no visible progress at all. Resolves
     * {@code {granted: boolean}} either way — a refusal must never block the download itself,
     * it just means the transfer runs without a progress notification.
     */
    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            resolveGranted(call, true);
            return;
        }
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            resolveGranted(call, true);
            return;
        }
        requestPermissionForAlias(NOTIFICATIONS, call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        resolveGranted(call, getPermissionState(NOTIFICATIONS) == PermissionState.GRANTED);
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        send(OfflineDownloadService.ACTION_START, call);
    }

    @PluginMethod
    public void update(PluginCall call) {
        send(OfflineDownloadService.ACTION_UPDATE, call);
    }

    /**
     * Queue drained — leave a "ready for offline use" summary up and stand the service down.
     *
     * Deliberately does NOT go through startForegroundService(): the service is already
     * running (so a plain startService reaches it), and if it isn't, we just post the
     * summary directly rather than spinning up a foreground service only to stop it.
     */
    @PluginMethod
    public void complete(PluginCall call) {
        int done = call.getInt("done", 0);
        int total = call.getInt("total", 0);
        String title = call.getString("title", "");
        try {
            if (OfflineDownloadService.isRunning()) {
                Intent intent = new Intent(getContext(), OfflineDownloadService.class);
                intent.setAction(OfflineDownloadService.ACTION_COMPLETE);
                intent.putExtra(OfflineDownloadService.EXTRA_DONE, done);
                intent.putExtra(OfflineDownloadService.EXTRA_TOTAL, total);
                intent.putExtra(OfflineDownloadService.EXTRA_TITLE, title);
                getContext().startService(intent);
            } else {
                OfflineDownloadService.postSummary(getContext(), done, total, title);
            }
        } catch (Exception e) {
            // Best-effort: a missing summary must never surface as a download failure.
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), OfflineDownloadService.class);
            intent.setAction(OfflineDownloadService.ACTION_STOP);
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            // Stopping is best-effort — a failure here must never surface to the learner.
            call.resolve();
        }
    }

    private void send(String action, PluginCall call) {
        try {
            // Already running: post the updated notification directly. Re-entering through
            // startForegroundService() from the background is rejected on Android 12+
            // ("code:DENIED" in logcat), which froze the progress counter for the entire
            // background portion of a download — the case this feature exists for.
            if (OfflineDownloadService.isRunning()) {
                OfflineDownloadService.postProgress(
                        getContext(),
                        call.getInt("done", 0),
                        call.getInt("total", 0),
                        call.getString("title", ""));
                JSObject ok = new JSObject();
                ok.put("started", true);
                call.resolve(ok);
                return;
            }

            Intent intent = new Intent(getContext(), OfflineDownloadService.class);
            intent.setAction(action);
            intent.putExtra(OfflineDownloadService.EXTRA_DONE, call.getInt("done", 0));
            intent.putExtra(OfflineDownloadService.EXTRA_TOTAL, call.getInt("total", 0));
            intent.putExtra(OfflineDownloadService.EXTRA_TITLE, call.getString("title", ""));

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            // Background-start restrictions can reject this (e.g. app already backgrounded on
            // some OEM builds). Downloads still run while the app is foregrounded, so degrade
            // quietly rather than failing the download itself.
            JSObject ret = new JSObject();
            ret.put("started", false);
            call.resolve(ret);
        }
    }
}
