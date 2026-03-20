package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Request payload for the white-label setup wizard.
 *
 * Contains a list of domain entries. Each entry maps a domain to a role
 * (LEARNER, ADMIN, TEACHER).
 * Multiple entries can share the same role (e.g., 2 learner domains).
 * Exactly one entry per role should be marked {@code is_primary = true} — that
 * domain becomes
 * the institute table's portal URL for that role.
 */
@Data
public class WhiteLabelSetupRequest {

    @JsonProperty("entries")
    private List<DomainEntry> entries;

    @Data
    public static class DomainEntry {

        /** LEARNER, ADMIN, or TEACHER */
        @JsonProperty("role")
        private String role;

        /**
         * Full domain name, e.g. "learn.myschool.com" or "myschool.vacademy.io".
         * Must NOT include protocol (https://).
         */
        @JsonProperty("domain")
        private String domain;

        /**
         * If true, this domain is used as the institute table's portal URL for this
         * role.
         * At most one primary per role is allowed.
         */
        @JsonProperty("is_primary")
        private boolean isPrimary;

        /** Optional per-domain routing config (theme, auth, tabs, etc.) */
        @JsonProperty("routing_config")
        private PortalRoutingConfig routingConfig;
    }
}
