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
}
