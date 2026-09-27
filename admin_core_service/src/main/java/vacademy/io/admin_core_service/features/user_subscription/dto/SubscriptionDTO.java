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

    // Manual renewal ("pay to continue" on the subscriptions page): the plan
    // price + gateway coordinates the learner app needs to build the
    // user-plan-payment request with PaymentType RENEWAL. Rendered when
    // canRenewManually is true (autopay off / cancelled / failed / expired).
    private Double planPrice;
    private String vendorId;
    private boolean canRenewManually;

    /**
     * True when the plan's invite has AUTOPAY_SETTING.ENABLED — gates the
     * "also enable auto-pay for future renewals" option on manual renewal.
     */
    private boolean autopayAvailable;

    /**
     * True when at least one other plan is flagged switchable for this membership —
     * gates the "Change plan" entry point so the UI never opens an empty picker.
     */
    private boolean canChangePlan;

    /**
     * A downgrade the learner has already booked for the end of the cycle. Surfaced here
     * so the card can say "you move to X on <date>" without a second round trip — without
     * it, "you're on Monthly" quietly stops being true at the next renewal.
     */
    private vacademy.io.admin_core_service.features.plan_change.dto.ScheduledPlanChangeDTO scheduledPlanChange;
}
