package io.vacademy.student.app.offlinedownloads;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import io.vacademy.student.app.MainActivity;

/**
 * Foreground service that keeps offline downloads running while the app is backgrounded,
 * and surfaces their progress as a notification.
 *
 * Why a service at all: the download queue itself lives in JS (download-manager.ts). Android
 * freezes a backgrounded WebView's timers and can kill the process outright under memory
 * pressure, which silently stalls a half-finished download. A running foreground service marks
 * the process as user-visible, so the JS keeps executing and the queue survives until it drains.
 *
 * The service owns no download logic — it is a lifetime + notification holder that JS starts
 * when work is queued, updates as assets complete, and stops when the queue drains.
 */
public class OfflineDownloadService extends Service {

    public static final String ACTION_START = "io.vacademy.student.app.offline.START";
    public static final String ACTION_UPDATE = "io.vacademy.student.app.offline.UPDATE";
    public static final String ACTION_STOP = "io.vacademy.student.app.offline.STOP";
    /** Queue drained: leave a "ready for offline use" notification behind, then stand down. */
    public static final String ACTION_COMPLETE = "io.vacademy.student.app.offline.COMPLETE";

    public static final String EXTRA_DONE = "done";
    public static final String EXTRA_TOTAL = "total";
    public static final String EXTRA_TITLE = "title";

    private static final String CHANNEL_ID = "offline_downloads";
    private static final int NOTIFICATION_ID = 4711;
    /** Safety valve: a wake lock so a long download isn't suspended by deep doze mid-transfer. */
    private static final long WAKE_LOCK_TIMEOUT_MS = 60 * 60 * 1000L;

    private PowerManager.WakeLock wakeLock;

    /**
     * True between startForeground() and teardown. Android 12+ rejects
     * startForegroundService() from the background (logcat: "code:DENIED"), which is exactly
     * where a long download lives — so once we're running, progress updates must be posted
     * straight to the NotificationManager instead of re-entering through startForegroundService.
     * Without that the counter froze at whatever it read when the app left the foreground.
     */
    private static volatile boolean running = false;

    public static boolean isRunning() {
        return running;
    }

    /**
     * Updates the progress notification in place. Safe from the background: posting a
     * notification is unrestricted, only *starting* a foreground service is.
     */
    /** Posts the completion summary regardless of service state (used when it already stopped). */
    public static void postSummary(Context context, int done, int total, String title) {
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureChannel(context);
        manager.notify(NOTIFICATION_ID, buildNotification(context, done, total, title));
    }

    public static void postProgress(Context context, int done, int total, String title) {
        // A progress tick can race the final stop(). Posting after teardown would
        // resurrect a notification with no service (and no download) behind it.
        if (!running) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        manager.notify(NOTIFICATION_ID, buildNotification(context, done, total, title));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            running = false;
            releaseWakeLock();
            stopForeground(true);
            // stopForeground only removes the notification the service itself owns.
            // Progress updates are posted via NotificationManager (they have to be —
            // Android 12+ rejects re-entering startForegroundService from the
            // background), so a late update can outlive the service and strand a
            // "downloading" notification in the shade forever. Cancel explicitly.
            NotificationManager manager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(NOTIFICATION_ID);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_COMPLETE.equals(action)) {
            int doneCount = intent == null ? 0 : intent.getIntExtra(EXTRA_DONE, 0);
            int totalCount = intent == null ? 0 : intent.getIntExtra(EXTRA_TOTAL, 0);
            String doneTitle = intent == null ? null : intent.getStringExtra(EXTRA_TITLE);
            running = false;
            releaseWakeLock();
            // DETACH (not remove): the summary notification has to outlive the
            // service, otherwise a download that finishes in a few seconds leaves
            // the learner with no evidence it ever ran.
            stopForeground(Service.STOP_FOREGROUND_DETACH);
            NotificationManager doneManager =
                    (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (doneManager != null) {
                doneManager.notify(NOTIFICATION_ID,
                        buildNotification(this, doneCount, totalCount, doneTitle));
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        int done = intent == null ? 0 : intent.getIntExtra(EXTRA_DONE, 0);
        int total = intent == null ? 0 : intent.getIntExtra(EXTRA_TOTAL, 0);
        String title = intent == null ? null : intent.getStringExtra(EXTRA_TITLE);

        try {
            startForeground(NOTIFICATION_ID, buildNotification(this, done, total, title));
            running = true;
        } catch (Exception e) {
            Log.e("OfflineDl", "startForeground FAILED: " + e, e);
            running = false;
        }
        acquireWakeLock();

        // START_STICKY would have Android restart us with a null intent after a process kill,
        // resurrecting a notification with no JS queue behind it. The queue is already durable
        // in SQLite and resumes via downloadManager.init(), so let the service die with us.
        return START_NOT_STICKY;
    }

    /**
     * The learner swiped the app off the recents list. That destroys the WebView (and with it the
     * JS download queue), so the transfer is over whether we like it or not — keeping the service
     * alive would only strand an "ongoing download" notification that never advances. The queue is
     * durable in SQLite and resumes on next launch via downloadManager.init().
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        running = false;
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        releaseWakeLock();
        super.onDestroy();
    }

    private static Notification buildNotification(Context context, int done, int total, String title) {
        int pending = Math.max(0, total - done);
        String text = total <= 0
                ? "Preparing downloads…"
                : pending == 0
                        ? done + " of " + total + " ready for offline use"
                        : done + " of " + total + " downloaded · " + pending + " pending";

        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                0,
                new Intent(context, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle(title == null || title.isEmpty() ? "Downloading for offline use" : title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentIntent(contentIntent)
                .setOngoing(pending > 0)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        if (total > 0 && pending > 0) {
            builder.setProgress(total, done, false);
        } else if (total > 0) {
            builder.setProgress(0, 0, false);
            builder.setSmallIcon(android.R.drawable.stat_sys_download_done);
            builder.setAutoCancel(true);
        } else {
            builder.setProgress(0, 0, true);
        }

        return builder.build();
    }

    private void createChannel() {
        ensureChannel(this);
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Offline downloads", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Progress of content saved for offline use");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vacademy:offline-download");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }
}
