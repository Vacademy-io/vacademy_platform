package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PaymentLogFilterRequestDTO {
    private String instituteId;

    /**
     * Optional filter by user ID. When provided, only payment logs for this user are returned.
     */
    private String userId;

    private LocalDateTime startDateInUtc;

    private LocalDateTime endDateInUtc;

    private List<String> packageSessionIds;

    private List<String> enrollInviteIds;

    private List<String> paymentStatuses;    private Map<String, String> sortColumns;

    private List<String> userPlanStatuses;

    /**
     * Filter by UserPlan source: List of sources (USER, SUB_ORG)
     */
    private List<String> sources;

    /**
     * Filter by high-level payment type. Each token maps to a specific predicate:
     * SUB_ORG_ADMIN (enroll_invite.tag=SUB_ORG), SUB_ORG_LEARNER (enroll_invite.tag=SUBORG_LEARNER),
     * LIVE_CLASS (payment_option.source=LIVE_SESSION), COURSE (payment_option.source=PACKAGE_SESSION),
     * CPO (payment_option.type=CPO), ENROLL_INVITE (enroll_invite.tag=DEFAULT),
     * USER_INVOICE (admin-generated invoice, invoice.source=ADMIN_MANUAL).
     * Multiple values are OR-combined.
     */
    private List<String> paymentTypes;

    /**
     * Free-text search across user name / email / phone (resolved via the auth service) and the
     * payment amount. Matching payment logs are those whose user matches OR whose amount contains
     * this string.
     */
    private String searchString;
}

