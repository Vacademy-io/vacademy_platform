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
import java.util.ArrayList;
import java.util.List;
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

    /**
     * Refreshes every platform of every live app the registry knows about.
     *
     * <p>This is what makes the status on an institute's settings page <em>tracked</em> rather than
     * <em>remembered</em>: without it a status is only as fresh as the last time an ops person
     * happened to open health-check and press refresh, which for most apps is the day it was
     * registered. Runs on a schedule (see {@code StoreStatusScheduler}).
     *
     * <p>One app's failure never stops the sweep — a revoked Apple key or a Play account that
     * cannot see one package must not cost every other institute its update. Platforms with no
     * credential simply return null from {@link #sync} and are counted as skipped, not failed.
     *
     * @return how many platform rows were refreshed, skipped and errored.
     */
    public SweepResult syncAll() {
        int synced = 0;
        int skipped = 0;
        int failed = 0;

        for (AppRegistration row : repository.findAllByOrderByNameAsc()) {
            if (Boolean.TRUE.equals(row.getArchived())) {
                continue;
            }
            for (String platformKey : enabledPlatformsOf(row)) {
                try {
                    if (sync(row.getId(), platformKey) == null) {
                        skipped++;
                    } else {
                        synced++;
                    }
                } catch (Exception e) {
                    failed++;
                    log.warn("[StoreStatusSync] {} / {} failed to sync: {}",
                            row.getName(), platformKey, e.getMessage());
                }
            }
        }

        log.info("[StoreStatusSync] Sweep finished: {} synced, {} skipped (no credential or no store id), {} failed",
                synced, skipped, failed);
        return new SweepResult(synced, skipped, failed);
    }

    public record SweepResult(int synced, int skipped, int failed) {
    }

    /**
     * The platforms this app is actually shipped on. A platform nobody enabled is registry
     * bookkeeping — syncing it would spend a store API call to learn nothing.
     */
    private List<String> enabledPlatformsOf(AppRegistration row) {
        List<String> enabled = new ArrayList<>();
        try {
            JsonNode platforms = objectMapper.readTree(row.getPayload()).path("platforms");
            platforms.fieldNames().forEachRemaining(name -> {
                if (platforms.path(name).path("enabled").asBoolean(false)) {
                    enabled.add(name.toUpperCase(Locale.ROOT));
                }
            });
        } catch (Exception e) {
            log.warn("[StoreStatusSync] Could not read platforms for record {}: {}", row.getId(), e.getMessage());
        }
        return enabled;
    }

    /**
     * The store had nothing to say about this app under the credential we hold — it belongs to a
     * different developer account, the id is wrong, or the call failed.
     *
     * <p>Returning null means "not synced": the caller answers 501 / manual, and crucially the
     * record keeps whatever status it already had. The alternative — writing NOT_REGISTERED — is
     * an invented fact, and a scheduled sweep would keep re-inventing it every few hours over
     * data a person verified by hand.
     */
    private Result unsyncable(String identifier, String platformKey, String provider) {
        log.info("[StoreStatusSync] {} has nothing for {} on {} under the credential on file — "
                + "leaving the recorded status untouched", provider, identifier, platformKey);
        return null;
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
        // App Store Connect names the Mac platform MAC_OS; the registry calls it MACOS.
        String ascPlatform = "MACOS".equals(platformKey) ? "MAC_OS" : "IOS";
        AppStoreConnectClient.AppStatus ascStatus = client.fetchStatus(bundleId, ascPlatform);
        if (ascStatus == null) {
            // The bundle isn't visible to THIS credential — which is not the same as "no app
            // exists". Vidyayatan's key cannot see Shiksha Nation's or ZOE's apps, because those
            // live in a second Apple team; writing NOT_REGISTERED here would overwrite a verified
            // Live release with a falsehood, on a schedule, for exactly the institutes whose apps
            // are hardest to check by hand. Say nothing instead — see #unsyncable.
            return unsyncable(bundleId, platformKey, "App Store Connect");
        }
        String status = mapAppStoreState(ascStatus.appStoreState());
        String storeUrl = "https://appstoreconnect.apple.com/apps/" + ascStatus.ascAppId() + "/appstore";
        String releasedAt = "LIVE".equals(status) ? ascStatus.createdDate() : "";
        return new Result(status, ascStatus.versionString(), ascStatus.buildNumber(), storeUrl, releasedAt);
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
        if (playStatus == null) {
            return unsyncable(packageName, "ANDROID", "Google Play");
        }
        return new Result(mapPlayReleaseStatus(playStatus.releaseStatus()),
                playStatus.releaseName(),
                playStatus.versionCode(),
                "https://play.google.com/console/developers/app/" + packageName, "");
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
        if (pcStatus == null) {
            return unsyncable(storeId, "WINDOWS", "Partner Center");
        }
        return new Result(mapPartnerCenterStatus(pcStatus.submissionStatus()), "", "",
                "https://partner.microsoft.com/dashboard/products/" + storeId, "");
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
    static String mapAppStoreState(String appStoreState) {
        return switch (appStoreState) {
            // appStoreState — the field Apple is retiring.
            case "READY_FOR_SALE" -> "LIVE";
            case "PREPARE_FOR_SUBMISSION" -> "DRAFT";
            case "WAITING_FOR_REVIEW", "WAITING_FOR_EXPORT_COMPLIANCE" -> "SUBMITTED";
            case "IN_REVIEW" -> "IN_REVIEW";
            case "PENDING_APPLE_RELEASE", "PENDING_DEVELOPER_RELEASE" -> "APPROVED";
            case "REJECTED", "DEVELOPER_REJECTED", "METADATA_REJECTED", "INVALID_BINARY" -> "REJECTED";
            case "DEVELOPER_REMOVED_FROM_SALE", "REMOVED_FROM_SALE" -> "REMOVED";
            case "PENDING_CONTRACT" -> "SUSPENDED";
            case "PROCESSING_FOR_APP_STORE" -> "BUILD_PROCESSING";

            // appVersionState — the field replacing it. Same states, different spellings, and both
            // arrive in the same response today (verified live: a ZOE macOS version reads
            // appStoreState=READY_FOR_SALE and appVersionState=READY_FOR_DISTRIBUTION).
            case "READY_FOR_DISTRIBUTION" -> "LIVE";
            case "READY_FOR_REVIEW" -> "READY_FOR_SUBMISSION";
            case "PROCESSING_FOR_DISTRIBUTION" -> "BUILD_PROCESSING";
            case "ACCEPTED" -> "APPROVED";
            // The version was superseded by a newer one. It is only ever picked when nothing on
            // this platform is live, so what it really says is "the release that was live is gone".
            case "REPLACED_WITH_NEW_VERSION" -> "REMOVED";

            // A platform the app record exists for but has never shipped on — see
            // AppStoreConnectClient#noVersionsStateFor. Passed through rather than mapped.
            case "NOT_REGISTERED" -> "NOT_REGISTERED";

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
