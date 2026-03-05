package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Current white-label status for an institute — returned by the GET /status
 * endpoint.
 */
@Data
@Builder
public class WhiteLabelStatusResponse {

    @JsonProperty("is_configured")
    private boolean isConfigured;

    /**
     * True only when CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are present in
     * this deployment's
     * environment. If false the frontend must hide the DNS automation UI entirely.
     */
    @JsonProperty("cloudflare_enabled")
    private boolean cloudflareEnabled;

    @JsonProperty("domain_type")
    private String domainType; // "VACADEMY_SUBDOMAIN" or "CUSTOM" — null if not configured

    @JsonProperty("learner_portal_url")
    private String learnerPortalUrl;

    @JsonProperty("admin_portal_url")
    private String adminPortalUrl;

    @JsonProperty("teacher_portal_url")
    private String teacherPortalUrl;

    @JsonProperty("routing_entries")
    private List<RoutingEntry> routingEntries;

    @Data
    @Builder
    public static class RoutingEntry {
        @JsonProperty("id")
        private String id;

        @JsonProperty("role")
        private String role;

        @JsonProperty("domain")
        private String domain;

        @JsonProperty("subdomain")
        private String subdomain;
    }
}
