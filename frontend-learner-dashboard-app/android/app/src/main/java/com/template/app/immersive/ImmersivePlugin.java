package io.vacademy.student.app.immersive;

import android.app.Activity;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native `Immersive` Capacitor plugin (Android). Local, in-repo plugin — no npm package — so it is
 * registered explicitly by {@code MainActivity.onCreate()}, same as the offline plugins.
 *
 * Hides the status bar and the navigation bar for the duration of a live assessment attempt.
 *
 * Why this needs to be native: {@code MainActivity} runs
 * {@code WindowCompat.setDecorFitsSystemWindows(window, false)}, so the WebView already draws behind
 * both system bars — but they stay on screen, overlapping the exam's own header and footer. Nothing
 * in JS can hide them; the HTML Fullscreen API that the proctoring hook uses does not take Android's
 * system bars down in a Capacitor WebView.
 *
 * Bars are hidden with {@code BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE} rather than being made
 * unreachable: a learner must always be able to swipe them back to reach the system Back/Home
 * controls. Trapping someone inside an exam with no way out is not proctoring, it is a bug.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {

    private WindowInsetsControllerCompat controller() {
        Activity activity = getActivity();
        if (activity == null) return null;
        Window window = activity.getWindow();
        if (window == null) return null;
        View decorView = window.getDecorView();
        if (decorView == null) return null;
        return WindowCompat.getInsetsController(window, decorView);
    }

    @PluginMethod
    public void enable(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        activity.runOnUiThread(() -> {
            WindowInsetsControllerCompat insetsController = controller();
            if (insetsController == null) {
                call.reject("No window");
                return;
            }
            insetsController.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            insetsController.hide(WindowInsetsCompat.Type.systemBars());
            call.resolve();
        });
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        activity.runOnUiThread(() -> {
            WindowInsetsControllerCompat insetsController = controller();
            if (insetsController == null) {
                call.reject("No window");
                return;
            }
            insetsController.show(WindowInsetsCompat.Type.systemBars());
            call.resolve();
        });
    }
}
