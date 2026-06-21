package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Builder;
import lombok.Data;
import lombok.Singular;

import java.util.List;

/**
 * Result of a live connection health check for an ad-platform connector.
 *
 * Verifies the whole lead-delivery chain (not just that OAuth completed):
 * token validity, page→app webhook subscription, lead-read access, and a
 * recent-lead heartbeat. Each {@link Check} carries an actionable remediation
 * so the admin sees exactly what to fix instead of a dead "0 leads".
 */
@Data
@Builder
public class ConnectorHealthDTO {

    private String connectorId;
    private String vendor;

    /** VERIFIED | DEGRADED | ACTION_REQUIRED | BROKEN | UNKNOWN */
    private String overall;

    /** ISO timestamp of the most recent lead received via this connector, or null. */
    private String lastLeadAt;

    @Singular
    private List<Check> checks;

    @Data
    @Builder
    public static class Check {
        /** TOKEN | SUBSCRIPTION | LEAD_READ | HEARTBEAT */
        private String key;
        private String label;
        /** PASS | WARN | FAIL | SKIP */
        private String status;
        private String message;
        /** Actionable hint shown when status is WARN/FAIL; null otherwise. */
        private String remediation;
    }
}
