package vacademy.io.community_service.feature.appregistry.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.appregistry.service.StoreStatusSyncService;

import java.util.Map;
import java.util.Set;

/**
 * Server-side half of the dashboard's StoreProvider abstraction.
 *
 * <p>This endpoint exists so the store credential never has to reach a browser: signing an App
 * Store Connect JWT or holding a Google service-account key client-side would expose the private
 * key to anyone with devtools.
 *
 * <p>Live today: IOS and MACOS, via {@link StoreStatusSyncService} (App Store Connect API — the
 * only store credential present in vacademy-secrets as of this writing). ANDROID (Play Developer
 * API, needs a Google Cloud service-account key) and WINDOWS (Partner Center, needs Azure AD) have
 * no credential configured, so they still answer <b>501 Not Implemented</b> with a plain
 * explanation — a dashboard that invents "Live" for a store it can't actually reach is worse than
 * one that says "go and look". The client renders that as "Manual action required" and links to
 * the right console. The same 501 fallback covers iOS/macOS operations this sync doesn't cover
 * yet ({@code getReviews}) and any request where the app record has no bundle id filled in.
 *
 * <p>When a new provider is wired up, it must use the official API and documented auth only —
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

    /** Operations {@link StoreStatusSyncService#sync} can answer from one App Store Connect call. */
    private static final Set<String> LIVE_OPERATIONS = Set.of(
            "getAppStatus", "getLatestVersion", "getBuildStatus", "getReleaseStatus", "getSubmissionStatus");

    private final StoreStatusSyncService storeStatusSyncService;

    public AppRegistryProviderController(StoreStatusSyncService storeStatusSyncService) {
        this.storeStatusSyncService = storeStatusSyncService;
    }

    @GetMapping("/{platform}/{appId}/{operation}")
    public ResponseEntity<Map<String, Object>> operation(@RequestAttribute("user") CustomUserDetails user,
                                                         @PathVariable String platform,
                                                         @PathVariable String appId,
                                                         @PathVariable String operation) {
        SuperAdminAuthUtil.requireSuperAdmin(user);

        String platformKey = platform == null ? "" : platform.toLowerCase();
        String console = CONSOLES.get(platformKey);
        if (console == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "manual", false,
                    "message", "Unknown platform: " + platform));
        }

        if (LIVE_OPERATIONS.contains(operation)) {
            Map<String, Object> full = storeStatusSyncService.sync(appId, platform);
            if (full != null) {
                return ResponseEntity.ok(sliceFor(operation, full));
            }
        }

        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
                "manual", true,
                "operation", operation,
                "consoleUrl", console,
                "message", notConfiguredMessage(platformKey, operation)));
    }

    /**
     * Each provider operation is a different slice of the same App Store Connect lookup — one API
     * call already fetches everything {@code getAppStatus} needs, so the narrower operations just
     * pick out the fields the frontend's {@code ProviderResult<T>} type expects for that call
     * rather than re-fetching.
     */
    private static Map<String, Object> sliceFor(String operation, Map<String, Object> full) {
        return switch (operation) {
            case "getLatestVersion" -> Map.of("version", full.get("version"), "build", full.get("build"));
            case "getBuildStatus" -> Map.of("status", full.get("status"));
            case "getReleaseStatus" -> Map.of("status", full.get("status"), "releasedAt", full.get("releasedAt"));
            case "getSubmissionStatus" -> Map.of("status", full.get("status"));
            default -> full; // getAppStatus
        };
    }

    private static String notConfiguredMessage(String platformKey, String operation) {
        if ("android".equals(platformKey)) {
            return "The Play Developer API isn't configured on the server yet — it needs a Google Cloud "
                    + "service-account JSON key with Play Console API access. Check the store console and "
                    + "record the result in the dashboard.";
        }
        if ("windows".equals(platformKey)) {
            return "The Microsoft Partner Center API isn't configured on the server yet — it needs an "
                    + "Azure AD app registration with Partner Center access. Check the store console and "
                    + "record the result in the dashboard.";
        }
        if ("getReviews".equals(operation)) {
            return "Review sync isn't implemented yet — check App Store Connect directly.";
        }
        return "This app's Bundle ID isn't filled in yet, or the App Store Connect credential isn't "
                + "configured on the server. Check the store console and record the result in the dashboard.";
    }
}
