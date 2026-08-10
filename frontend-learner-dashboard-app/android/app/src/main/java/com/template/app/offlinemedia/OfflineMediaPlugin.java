package io.vacademy.student.app.offlinemedia;

import android.os.StatFs;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;

/**
 * Native `OfflineMedia` Capacitor plugin (Android). Local, in-repo plugin — no npm package —
 * so it is not auto-registered via `capacitor.plugins.json`; registered explicitly by
 * `MainActivity.onCreate()` via `registerPlugin(OfflineMediaPlugin.class)`.
 *
 * Provides:
 *  - `getFreeDiskSpace()` — bytes available on the volume backing the app's private files dir.
 *  - `openAsset({path, keyB64, nonceB64, mimeType})` — registers a decrypt session for an
 *    on-disk ciphertext file and returns `{token, url}`. `url` is
 *    `http://127.0.0.1:<port>/<token>/stream`, served by {@link OfflineMediaServer} (a tiny
 *    localhost-only HTTP responder — see that class's doc comment for why a localhost server was
 *    chosen over trying to hook `shouldInterceptRequest`), directly usable as an HTML5
 *    `<video>` src with Range/206 support for seeking.
 *  - `closeAsset({token})` — drops the session and zeroizes its key material.
 */
@CapacitorPlugin(name = "OfflineMedia")
public class OfflineMediaPlugin extends Plugin {

    @PluginMethod
    public void getFreeDiskSpace(PluginCall call) {
        try {
            StatFs stat = new StatFs(getContext().getFilesDir().getPath());
            long bytes = stat.getAvailableBytes();
            JSObject ret = new JSObject();
            ret.put("bytes", bytes);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read free disk space: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openAsset(PluginCall call) {
        String path = call.getString("path");
        String keyB64 = call.getString("keyB64");
        String nonceB64 = call.getString("nonceB64");
        String mimeType = call.getString("mimeType");

        if (path == null) {
            call.reject("Missing required parameter: path");
            return;
        }
        if (keyB64 == null) {
            call.reject("Missing required parameter: keyB64");
            return;
        }
        if (nonceB64 == null) {
            call.reject("Missing required parameter: nonceB64");
            return;
        }

        byte[] key;
        byte[] nonce;
        try {
            key = Base64.decode(keyB64, Base64.NO_WRAP);
            nonce = Base64.decode(nonceB64, Base64.NO_WRAP);
        } catch (IllegalArgumentException e) {
            call.reject("keyB64/nonceB64 must be valid base64: " + e.getMessage());
            return;
        }

        if (key.length != 32) {
            call.reject("keyB64 must decode to 32 bytes (AES-256), got " + key.length);
            return;
        }
        if (nonce.length != 16) {
            call.reject("nonceB64 must decode to 16 bytes, got " + nonce.length);
            return;
        }

        File file = new File(path);
        if (!file.exists()) {
            call.reject("File does not exist at path: " + path);
            return;
        }

        String resolvedMimeType = mimeType != null ? mimeType : guessMimeType(path);

        try {
            int port = OfflineMediaServer.INSTANCE.ensureStarted();
            String token = OfflineMediaSessionStore.INSTANCE.open(path, key, nonce, resolvedMimeType);

            JSObject ret = new JSObject();
            ret.put("token", token);
            ret.put("url", "http://127.0.0.1:" + port + "/" + token + "/stream");
            call.resolve(ret);
        } catch (IOException e) {
            call.reject("Failed to start OfflineMedia localhost server: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void closeAsset(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.reject("Missing required parameter: token");
            return;
        }
        OfflineMediaSessionStore.INSTANCE.close(token);
        call.resolve();
    }

    private static String guessMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".webm")) return "video/webm";
        return "video/mp4";
    }
}
