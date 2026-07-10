package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class WhiteLabelSetupResponse {

    @JsonProperty("setup_complete")
    private boolean setupComplete;

    @JsonProperty("learner_portal_url")
    private String learnerPortalUrl;

    @JsonProperty("admin_portal_url")
    private String adminPortalUrl;

    @JsonProperty("teacher_portal_url")
    private String teacherPortalUrl;

    /** DNS records that were created / updated in Cloudflare. */
    @JsonProperty("dns_records_configured")
    private List<DnsRecordResult> dnsRecordsConfigured;

    /**
     * Cloudflare Pages custom domains that were attached to the SPA projects.
     * This is what actually makes the host SERVE the app — a DNS CNAME alone is
     * not enough. Empty when Pages provisioning is not configured on the deployment.
     */
    @JsonProperty("pages_domains_configured")
    private List<PagesDomainResult> pagesDomainsConfigured;

    /** Non-fatal warnings (e.g. teacher domain skipped because not supplied). */
    @JsonProperty("warnings")
    private List<String> warnings;

    @Data
    @Builder
    public static class DnsRecordResult {
        @JsonProperty("type")
        private String type; // e.g. "CNAME"

        @JsonProperty("name")
        private String name; // e.g. "learn.myschool.com"

        @JsonProperty("target")
        private String target; // e.g. "learner.vacademy.io"

        @JsonProperty("proxied")
        private boolean proxied;

        @JsonProperty("cloudflare_record_id")
        private String cloudflareRecordId;

        @JsonProperty("action")
        private String action; // "CREATED" or "UPDATED"
    }

    @Data
    @Builder
    public static class PagesDomainResult {
        /** Cloudflare Pages project the domain was attached to. */
        @JsonProperty("project")
        private String project;

        /** The host attached, e.g. "learn.myschool.com". */
        @JsonProperty("name")
        private String name;

        /**
         * Cloudflare's activation status for the custom domain, e.g.
         * "active", "pending", "initializing". Custom (external) domains stay
         * "pending" until the customer points DNS and Cloudflare validates.
         */
        @JsonProperty("status")
        private String status;

        /** "CREATED" (newly attached) or "EXISTS" (already attached). */
        @JsonProperty("action")
        private String action;

        /**
         * CNAME target the customer must set at their DNS provider for an
         * external custom domain (i.e. "<project>.pages.dev"). For in-zone
         * *.vacademy.io hosts Cloudflare creates the DNS record automatically,
         * so this is informational only.
         */
        @JsonProperty("pages_cname_target")
        private String pagesCnameTarget;
    }
}
