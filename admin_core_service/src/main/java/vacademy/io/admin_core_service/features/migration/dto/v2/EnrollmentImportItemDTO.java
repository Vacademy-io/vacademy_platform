package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Individual enrollment item for import
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentImportItemDTO {

    // ===== User Identification =====

    /**
     * Email to find the user (required)
     */
    @JsonProperty("email")
    private String email;

    /**
     * External ID (e.g., Keap contact ID) - alternative identifier
     */
    @JsonProperty("external_id")
    private String externalId;

    // ===== Course/Batch Linkage =====

    /**
     * Package Session ID (required or from defaults)
     */
    @JsonProperty("package_session_id")
    private String packageSessionId;

    /**
     * Enroll Invite ID (optional - uses default for package session)
     */
    @JsonProperty("enroll_invite_id")
    private String enrollInviteId;

    // ===== Learner Status =====

    /**
     * Status of the learner: ACTIVE, INVITED, PENDING_FOR_APPROVAL, EXPIRED,
     * CANCELLED
     */
    @JsonProperty("learner_status")
    private String learnerStatus;

    // ===== Payment Configuration =====

    /**
     * Payment type: SUBSCRIPTION, ONE_TIME, FREE
     */
    @JsonProperty("payment_type")
    private String paymentType;

    /**
     * Subscription details (when payment_type = SUBSCRIPTION)
     */
    @JsonProperty("subscription")
    private SubscriptionImportDTO subscription;

    /**
     * One-time payment details (when payment_type = ONE_TIME)
     */
    @JsonProperty("one_time")
    private OneTimePaymentImportDTO oneTime;

    /**
     * Payment Option ID (optional - uses default)
     */
    @JsonProperty("payment_option_id")
    private String paymentOptionId;

    /**
     * Payment Plan ID (optional - uses default)
     */
    @JsonProperty("payment_plan_id")
    private String paymentPlanId;

    // ===== Payment History =====

    /**
     * Historical payment logs to import
     */
    @JsonProperty("payment_history")
    private List<PaymentHistoryImportDTO> paymentHistory;

    // ===== Practice Configuration =====

    /**
     * Practice/SubOrg configuration (for org-associated package sessions)
     */
    @JsonProperty("practice")
    private PracticeEnrollmentDTO practice;

    // ===== External Reference =====

    /**
     * External subscription ID from source CRM
     */
    @JsonProperty("external_subscription_id")
    private String externalSubscriptionId;

    // Helper methods
    public String getEffectiveLearnerStatus() {
        return learnerStatus != null ? learnerStatus.toUpperCase() : "ACTIVE";
    }

    public String getEffectivePaymentType() {
        return paymentType != null ? paymentType.toUpperCase() : "ONE_TIME";
    }

    public boolean isSubscription() {
        return "SUBSCRIPTION".equalsIgnoreCase(paymentType);
    }

    public boolean isOneTime() {
        return "ONE_TIME".equalsIgnoreCase(paymentType);
    }

    public boolean isFree() {
        return "FREE".equalsIgnoreCase(paymentType);
    }

    public boolean hasPractice() {
        return practice != null;
    }

    public boolean isPracticeRootAdmin() {
        return practice != null && "ROOT_ADMIN".equalsIgnoreCase(practice.getRole());
    }

    public boolean isPracticeMember() {
        return practice != null && !isPracticeRootAdmin();
    }
}
