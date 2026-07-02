package io.vacademy.admin.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.autofill.AutofillManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android WebView autofill can hijack the InputConnection of a text field
        // that looks like part of a credential form (e.g. a "username" next to a
        // password). When that happens the field gets focus but NO keyboard — both
        // the soft keyboard and hardware key input are swallowed — while the
        // password field keeps working. Opting the WebView (and its descendants)
        // out of autofill, and disabling the app's autofill service, restores a
        // normal IME connection for every input.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                View webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                }
                AutofillManager autofillManager = getSystemService(AutofillManager.class);
                if (autofillManager != null) {
                    autofillManager.disableAutofillServices();
                }
            } catch (Exception ignored) {
                // Autofill tweaks are best-effort; never block app start on them.
            }
        }
    }
}
