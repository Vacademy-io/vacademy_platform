package vacademy.io.admin_core_service.features.app_status.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Read-only view of an institute's registered white-label apps and their per-platform store
 * status — returned by GET /admin-core-service/institute/app-registry/v1/status.
 *
 * <p>Registration itself (uploading icons, filling in store metadata, linking bundle/package
 * ids) stays an ops-only workflow in the health-check dashboard's App Registration module —
 * this endpoint is deliberately read-only so an institute admin can see where their app stands
 * without being able to edit a record that belongs to the platform team.
 */
@Data
@Builder
public class AppStatusResponse {

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("apps")
    private List<RegisteredApp> apps;

    @Data
    @Builder
    public static class RegisteredApp {
        @JsonProperty("id")
        private String id;

        @JsonProperty("name")
        private String name;

        @JsonProperty("display_name")
        private String displayName;

        @JsonProperty("package_name")
        private String packageName;

        @JsonProperty("platforms")
        private List<PlatformStatus> platforms;
    }

    @Data
    @Builder
    public static class PlatformStatus {
        /** ANDROID / IOS / WINDOWS / MACOS — matches the health-check dashboard's Platform enum. */
        @JsonProperty("platform")
        private String platform;

        @JsonProperty("enabled")
        private boolean enabled;

        /** One of the health-check dashboard's StoreStatus values (e.g. LIVE, IN_REVIEW, REJECTED). */
        @JsonProperty("status")
        private String status;

        @JsonProperty("store_url")
        private String storeUrl;

        @JsonProperty("current_version")
        private String currentVersion;

        @JsonProperty("current_build")
        private String currentBuild;

        @JsonProperty("released_at")
        private String releasedAt;

        @JsonProperty("last_synced_at")
        private String lastSyncedAt;
    }
}
