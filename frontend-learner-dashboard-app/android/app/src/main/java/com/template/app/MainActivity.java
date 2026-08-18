package io.vacademy.student.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import io.vacademy.student.app.immersive.ImmersivePlugin;
import io.vacademy.student.app.offlinedownloads.OfflineDownloadsPlugin;
import io.vacademy.student.app.offlinemedia.OfflineMediaPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // OfflineMediaPlugin is a local, in-repo plugin (no npm package), so it isn't present in
        // capacitor.plugins.json's auto-registration list and must be registered manually, before
        // super.onCreate() (which is where the Bridge/WebView actually gets constructed).
        registerPlugin(OfflineMediaPlugin.class);
        registerPlugin(OfflineDownloadsPlugin.class);
        registerPlugin(ImmersivePlugin.class);
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge rendering so WebView extends behind status bar and navigation bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
