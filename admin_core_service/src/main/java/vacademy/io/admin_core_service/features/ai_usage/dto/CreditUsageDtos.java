package vacademy.io.admin_core_service.features.ai_usage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for the per-user AI credit usage views (academy-credits).
 * All values are derived from credit_transactions (net of refunds) joined to
 * the institute user directory (users / user_role / roles).
 */
public class CreditUsageDtos {

    /** One row in the per-user usage list. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserUsageRow {
        private String userId;
        private String name;
        private String email;
        /** Comma-separated role names the user holds in this institute. */
        private String roles;
        private double totalCredits;
        private long requestCount;
    }

    /** One credit deduction in a user's drill-down log. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UsageLogRow {
        private String id;
        /** Epoch millis. */
        private Long createdAt;
        private String requestType;
        private String model;
        private double credits;
        private String description;
    }

    /** Per-role rollup used to build the role sub-tabs (with counts). */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleSummaryRow {
        private String role;
        private long userCount;
        private double totalCredits;
    }
}
