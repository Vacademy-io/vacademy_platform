package vacademy.io.community_service.feature.appregistry.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.community_service.feature.appregistry.entity.AppRegistration;
import vacademy.io.community_service.feature.appregistry.repository.AppRegistrationRepository;
import vacademy.io.community_service.feature.appregistry.store.AppStoreConnectClient;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;

/**
 * Live status sync for the two platforms with a real credential today — IOS and MACOS both go
 * through App Store Connect (same API, same .p8 key). ANDROID (Play Developer API) and WINDOWS
 * (Partner Center) have no service-account/Azure-AD credential configured anywhere in
 * vacademy-secrets yet, so {@link #sync} simply isn't called for them — the controller keeps
 * answering those with the existing "manual action required" 501.
 *
 * <p>A successful sync also writes the fetched status/version/build back into the stored
 * {@code AppRegistration.payload}, so an institute admin reading the status endpoint sees the
 * same freshly-synced data an ops person just pulled in health-check — not stale, manually-typed
 * values from whenever someone last edited the record by hand.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StoreStatusSyncService {

    private final AppRegistrationRepository repository;
    private final AppStoreConnectClient appStoreConnectClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * @return the AppStatusResult-shaped fields for the dashboard's {@code getAppStatus} contract,
     *         or null when this platform/appId combination can't be synced live — either no
     *         credential is configured, the record/bundle id is missing, or the call to Apple
     *         failed. The controller treats null as "fall back to manual".
     */
    @Transactional
    public Map<String, Object> sync(String recordId, String platform) {
        if (!"IOS".equalsIgnoreCase(platform) && !"MACOS".equalsIgnoreCase(platform)) {
            return null;
        }
        if (!appStoreConnectClient.isConfigured()) {
            return null;
        }

        AppRegistration row = repository.findById(recordId).orElse(null);
        if (row == null) {
            return null;
        }

        ObjectNode record;
        try {
            record = (ObjectNode) objectMapper.readTree(row.getPayload());
        } catch (JsonProcessingException e) {
            log.warn("[StoreStatusSync] Stored record {} is not valid JSON, skipping sync", recordId);
            return null;
        }

        String platformKey = platform.toUpperCase(Locale.ROOT);
        JsonNode platformNode = record.path("platforms").path(platformKey);
        String bundleId = platformNode.path("fields").path("bundle_id").asText("");
        if (bundleId.isBlank()) {
            return null;
        }

        AppStoreConnectClient.AppStatus ascStatus = appStoreConnectClient.fetchStatus(bundleId);
        String status = ascStatus == null ? "NOT_REGISTERED" : mapAppStoreState(ascStatus.appStoreState());
        String version = ascStatus == null ? "" : ascStatus.versionString();
        String build = ascStatus == null ? "" : ascStatus.buildNumber();
        String storeUrl = ascStatus == null ? ""
                : "https://appstoreconnect.apple.com/apps/" + ascStatus.ascAppId() + "/appstore";
        String releasedAt = "LIVE".equals(status) && ascStatus != null ? ascStatus.createdDate() : "";
        String syncedAt = Instant.now().toString();

        persist(row, record, platformKey, status, version, build, storeUrl, releasedAt, syncedAt);

        return Map.of(
                "status", status,
                "version", version,
                "build", build,
                "releasedAt", releasedAt,
                // OTA (Capacitor bundle) rollout status is a separate system this integration has
                // no visibility into — never fabricated, always reported as unknown.
                "otaStatus", "NONE",
                "storeUrl", storeUrl);
    }

    private void persist(AppRegistration row, ObjectNode record, String platformKey, String status,
                          String version, String build, String storeUrl, String releasedAt, String syncedAt) {
        ObjectNode platforms = (ObjectNode) record.path("platforms");
        ObjectNode platformNode = (ObjectNode) platforms.path(platformKey);
        platformNode.put("status", status);
        if (!version.isBlank()) platformNode.put("currentVersion", version);
        if (!build.isBlank()) platformNode.put("currentBuild", build);
        if (!storeUrl.isBlank()) platformNode.put("storeUrl", storeUrl);
        if (!releasedAt.isBlank()) platformNode.put("releasedAt", releasedAt);
        platformNode.put("lastSyncedAt", syncedAt);
        record.put("updatedAt", syncedAt);

        try {
            row.setPayload(objectMapper.writeValueAsString(record));
            repository.save(row);
        } catch (JsonProcessingException e) {
            log.warn("[StoreStatusSync] Could not serialise synced record {}: {}", row.getId(), e.getMessage());
        }
    }

    /**
     * Maps App Store Connect's {@code appStoreState} to the dashboard's StoreStatus enum. Unmapped
     * / unrecognised states fall back to SUBMITTED rather than a guess in either direction — that
     * reads as "something is in flight, go check" rather than falsely implying success or failure.
     */
    private static String mapAppStoreState(String appStoreState) {
        return switch (appStoreState) {
            case "READY_FOR_SALE" -> "LIVE";
            case "PREPARE_FOR_SUBMISSION" -> "DRAFT";
            case "WAITING_FOR_REVIEW", "WAITING_FOR_EXPORT_COMPLIANCE" -> "SUBMITTED";
            case "IN_REVIEW" -> "IN_REVIEW";
            case "PENDING_APPLE_RELEASE", "PENDING_DEVELOPER_RELEASE" -> "APPROVED";
            case "REJECTED", "DEVELOPER_REJECTED", "METADATA_REJECTED", "INVALID_BINARY" -> "REJECTED";
            case "DEVELOPER_REMOVED_FROM_SALE", "REMOVED_FROM_SALE" -> "REMOVED";
            case "PENDING_CONTRACT" -> "SUSPENDED";
            case "PROCESSING_FOR_APP_STORE" -> "BUILD_PROCESSING";
            default -> "SUBMITTED";
        };
    }
}
