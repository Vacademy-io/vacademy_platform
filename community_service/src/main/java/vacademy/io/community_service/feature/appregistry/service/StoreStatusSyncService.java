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
import vacademy.io.community_service.feature.appregistry.store.GooglePlayClient;
import vacademy.io.community_service.feature.appregistry.store.MicrosoftPartnerCenterClient;
import vacademy.io.community_service.feature.appregistry.store.StoreCredentialResolver;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;

/**
 * Live status sync across all four platforms — which provider client is actually reachable
 * depends entirely on whether a credential exists for this institute (see
 * {@link StoreCredentialResolver}). When none does, {@link #sync} returns null and the caller
 * falls back to the existing "manual action required" 501 response — never a fabricated status.
 *
 * <p>App Store Connect (IOS/MACOS) is the only one of the four verified against real, live data
 * this was built and tested against — see {@link AppStoreConnectClient}'s javadoc for what that
 * caught. {@link GooglePlayClient} and {@link MicrosoftPartnerCenterClient} are written to their
 * providers' documented API shapes but have never run against a real credential; treat their
 * status-mapping as reviewed, not proven, until the first institute with a real Play/Partner
 * Center credential exercises them.
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
    private final StoreCredentialResolver storeCredentialResolver;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * @return the AppStatusResult-shaped fields for the dashboard's {@code getAppStatus} contract,
     *         or null when this platform/appId combination can't be synced live — no credential
     *         configured for this institute+platform, the record/identifier field is missing, or
     *         the call to the store failed. The controller treats null as "fall back to manual".
     */
    @Transactional
    public Map<String, Object> sync(String recordId, String platform) {
        String platformKey = platform == null ? "" : platform.toUpperCase(Locale.ROOT);
        if (!"IOS".equals(platformKey) && !"MACOS".equals(platformKey)
                && !"ANDROID".equals(platformKey) && !"WINDOWS".equals(platformKey)) {
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

        String instituteId = record.path("basics").path("instituteId").asText(null);
        JsonNode platformNode = record.path("platforms").path(platformKey);

        Result result = switch (platformKey) {
            case "IOS", "MACOS" -> syncApple(platformNode, instituteId, platformKey);
            case "ANDROID" -> syncGooglePlay(platformNode, instituteId);
            case "WINDOWS" -> syncPartnerCenter(platformNode, instituteId);
            default -> null;
        };
        if (result == null) {
            return null;
        }

        String syncedAt = Instant.now().toString();
        persist(row, record, platformKey, result, syncedAt);

        return Map.of(
                "status", result.status,
                "version", result.version,
                "build", result.build,
                "releasedAt", result.releasedAt,
                // OTA (Capacitor bundle) rollout status is a separate system this integration has
                // no visibility into — never fabricated, always reported as unknown.
                "otaStatus", "NONE",
                "storeUrl", result.storeUrl);
    }

    /** Common shape every provider branch reduces to before the shared persist/response step. */
    private record Result(String status, String version, String build, String storeUrl, String releasedAt) {
    }

    private Result syncApple(JsonNode platformNode, String instituteId, String platformKey) {
        String bundleId = platformNode.path("fields").path("bundle_id").asText("");
        if (bundleId.isBlank()) {
            return null;
        }
        AppStoreConnectClient client = storeCredentialResolver.resolveAppStoreConnect(instituteId, platformKey);
        if (client == null) {
            return null;
        }
        AppStoreConnectClient.AppStatus ascStatus = client.fetchStatus(bundleId);
        String status = ascStatus == null ? "NOT_REGISTERED" : mapAppStoreState(ascStatus.appStoreState());
        String storeUrl = ascStatus == null ? ""
                : "https://appstoreconnect.apple.com/apps/" + ascStatus.ascAppId() + "/appstore";
        String releasedAt = "LIVE".equals(status) && ascStatus != null ? ascStatus.createdDate() : "";
        return new Result(status,
                ascStatus == null ? "" : ascStatus.versionString(),
                ascStatus == null ? "" : ascStatus.buildNumber(),
                storeUrl, releasedAt);
    }

    private Result syncGooglePlay(JsonNode platformNode, String instituteId) {
        String packageName = platformNode.path("fields").path("package_name").asText("");
        if (packageName.isBlank()) {
            return null;
        }
        GooglePlayClient client = storeCredentialResolver.resolveGooglePlay(instituteId);
        if (client == null) {
            return null;
        }
        GooglePlayClient.AppStatus playStatus = client.fetchStatus(packageName);
        String status = playStatus == null ? "NOT_REGISTERED" : mapPlayReleaseStatus(playStatus.releaseStatus());
        String storeUrl = playStatus == null ? ""
                : "https://play.google.com/console/developers/app/" + packageName;
        return new Result(status,
                playStatus == null ? "" : playStatus.releaseName(),
                playStatus == null ? "" : playStatus.versionCode(),
                storeUrl, "");
    }

    private Result syncPartnerCenter(JsonNode platformNode, String instituteId) {
        String storeId = platformNode.path("fields").path("store_id").asText("");
        if (storeId.isBlank()) {
            return null;
        }
        MicrosoftPartnerCenterClient client = storeCredentialResolver.resolvePartnerCenter(instituteId);
        if (client == null) {
            return null;
        }
        MicrosoftPartnerCenterClient.AppStatus pcStatus = client.fetchStatus(storeId);
        String status = pcStatus == null ? "NOT_REGISTERED" : mapPartnerCenterStatus(pcStatus.submissionStatus());
        String storeUrl = pcStatus == null ? ""
                : "https://partner.microsoft.com/dashboard/products/" + storeId;
        return new Result(status, "", "", storeUrl, "");
    }

    private void persist(AppRegistration row, ObjectNode record, String platformKey, Result result,
                          String syncedAt) {
        ObjectNode platforms = (ObjectNode) record.path("platforms");
        ObjectNode platformNode = (ObjectNode) platforms.path(platformKey);
        platformNode.put("status", result.status);
        if (!result.version.isBlank()) platformNode.put("currentVersion", result.version);
        if (!result.build.isBlank()) platformNode.put("currentBuild", result.build);
        if (!result.storeUrl.isBlank()) platformNode.put("storeUrl", result.storeUrl);
        if (!result.releasedAt.isBlank()) platformNode.put("releasedAt", result.releasedAt);
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

    /**
     * Maps a Play production-track release's {@code status} field to the dashboard's StoreStatus.
     * Per Google's documented values: draft, inProgress, halted, completed. Unverified against a
     * real account — see this class's javadoc.
     */
    private static String mapPlayReleaseStatus(String releaseStatus) {
        return switch (releaseStatus) {
            case "completed" -> "LIVE";
            case "inProgress" -> "SUBMITTED";
            case "halted" -> "SUSPENDED";
            case "draft" -> "DRAFT";
            default -> "SUBMITTED";
        };
    }

    /**
     * Maps a Microsoft Store submission's {@code status} field to the dashboard's StoreStatus.
     * Unverified against a real account — see this class's javadoc.
     */
    private static String mapPartnerCenterStatus(String submissionStatus) {
        return switch (submissionStatus) {
            case "Published" -> "LIVE";
            case "Release" -> "APPROVED";
            case "Certification" -> "IN_REVIEW";
            case "PendingCommit", "CommitStarted", "PreProcessing", "Signing" -> "SUBMITTED";
            case "Failed", "PublishFailed", "PreProcessingFailed", "CertificationFailed", "ReleaseFailed" -> "REJECTED";
            case "Canceled" -> "REMOVED";
            case "None" -> "DRAFT";
            default -> "SUBMITTED";
        };
    }
}
