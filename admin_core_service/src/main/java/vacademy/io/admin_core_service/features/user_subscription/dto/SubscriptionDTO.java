package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.Date;
import java.util.List;

/**
 * Learner-facing view of one subscription (a UserPlan) and its autopay mandate.
 * Powers the course-details "cancel subscription" button, the profile
 * billing/remove-mandate row, and the student-view cancellation flow.
 *
 * Serialized snake_case to match the learner app's other payment endpoints
 * (e.g. LearnerPaymentMethodSummaryDTO): user_plan_id, has_active_mandate, ...
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubscriptionDTO {
    private String userPlanId;
    private String planName;
    private String status;           // ACTIVE | CANCELED | EXPIRED | ...
    private Date endDate;            // access valid until this date
    private Date nextChargeAt;
    private Boolean autoRenewalEnabled;
    private Boolean isTrial;

    // Mandate (null if the plan has no registered autopay mandate)
    private String vendor;           // RAZORPAY | EWAY | ...
    private String mandateStatus;    // ACTIVE | REVOKED | FAILED | null
    private Double mandateMaxAmount;
    private String currency;

    /** True when there is a live (non-revoked) mandate — drives "show cancel". */
    private boolean hasActiveMandate;

    /** Package sessions (courses) this subscription grants — for per-course UI. */
    private List<String> packageSessionIds;
}
