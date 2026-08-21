package vacademy.io.community_service.feature.appregistry.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

import java.util.Map;

/**
 * Server-side half of the dashboard's StoreProvider abstraction.
 *
 * <p>This endpoint exists so the store credential never has to reach a browser: signing an App
 * Store Connect JWT or holding a Google service-account key client-side would expose the private
 * key to anyone with devtools.
 *
 * <p>No store integration is wired up yet, so every operation answers <b>501 Not Implemented</b>
 * with a plain explanation. That is a deliberate choice over returning a plausible-looking status:
 * a dashboard that invents "Live" is worse than one that says "go and look". The client renders
 * this as "Manual action required" and links to the right console.
 *
 * <p>When a provider is implemented, it must use the official API and documented auth only —
 * Play Developer API via a service account, App Store Connect via a JWT-signed .p8, Partner Center
 * via Azure AD. Never a scraped console session, a reused browser cookie, or an undocumented
 * endpoint.
 */
@RestController
@RequestMapping("/community-service/super-admin/v1/app-registry/providers")
public class AppRegistryProviderController {

    private static final Map<String, String> CONSOLES = Map.of(
            "android", "https://play.google.com/console",
            "ios", "https://appstoreconnect.apple.com",
            "windows", "https://partner.microsoft.com/dashboard",
            "macos", "https://appstoreconnect.apple.com");

    @GetMapping("/{platform}/{appId}/{operation}")
    public ResponseEntity<Map<String, Object>> operation(@RequestAttribute("user") CustomUserDetails user,
                                                         @PathVariable String platform,
                                                         @PathVariable String appId,
                                                         @PathVariable String operation) {
        SuperAdminAuthUtil.requireSuperAdmin(user);

        String console = CONSOLES.get(platform == null ? "" : platform.toLowerCase());
        if (console == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "manual", false,
                    "message", "Unknown platform: " + platform));
        }

        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
                "manual", true,
                "operation", operation,
                "consoleUrl", console,
                "message", "The server-side store integration for this platform isn't configured yet. "
                        + "Check the store console and record the result in the dashboard."));
    }
}
