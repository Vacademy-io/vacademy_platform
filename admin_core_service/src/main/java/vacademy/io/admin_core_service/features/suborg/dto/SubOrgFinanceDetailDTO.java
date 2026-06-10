package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

/**
 * Response payload for {@code GET /admin-core-service/institute/v1/sub-org/finance-detail}.
 *
 * Two concerns are bundled here: (1) the sub-org admin's own payment plan — including the
 * CPO installment ledger when the sub-org was purchased via CPO — and (2) the learner roster
 * for the sub-org with each learner's outstanding dues (mostly zero, since learners ride FREE
 * under the scoped invites, but populated if a learner was enrolled with their own CPO).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgFinanceDetailDTO {

    private String subOrgId;
    private String subOrgName;

    /** Admin-level payment summary for the user who bought the sub-org subscription. */
    private AdminPayment adminPayment;

    /** Per-learner enrollment + outstanding-dues row. */
    private List<LearnerRow> learners;

    private Totals totals;

    /** Aggregate seat usage for the sub-org. {@code total} is null when no cap is set. */
    private SeatUsage seatUsage;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AdminPayment {
        private String userId;
        private String fullName;
        private String userPlanId;
        private String paymentType;          // FREE / ONE_TIME / SUBSCRIPTION / CPO
        private String complexPaymentOptionId;
        private String userPlanStatus;       // ACTIVE / PENDING_FOR_PAYMENT / ...
        private Date startDate;
        private Date endDate;

        // CPO fields — null for non-CPO admin plans.
        private BigDecimal totalAmount;          // sum(original_amount) across all installments
        private BigDecimal paidAmount;           // sum(amount_paid)
        private BigDecimal outstandingAmount;    // sum(amount_expected - amount_paid) for unpaid rows
        private Integer installmentCount;
        private Integer pendingInstallmentsCount;
        private Installment nextDue;
        private List<Installment> installments;  // full ledger
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class LearnerRow {
        private String userId;
        private String fullName;
        /** Kept for backward-compat: the learner's first package session. */
        private String packageSessionId;
        /** Every package session this learner is actively enrolled into under the sub-org. */
        private List<String> packageSessionIds;
        private String userPlanId;
        private Date enrolledDate;

        // Populated when learner has SFP rows (rare — only if learner was enrolled via CPO,
        // not via a FREE scoped invite). Zero otherwise.
        private BigDecimal outstandingAmount;
        private Integer pendingInstallmentsCount;
        private Installment nextDue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Installment {
        private String studentFeePaymentId;
        private BigDecimal amountExpected;
        private BigDecimal amountPaid;
        private Date dueDate;
        private String status;                // PENDING / PARTIAL_PAID / PAID / WAIVED / OVERDUE
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Totals {
        private Integer learnerCount;
        private BigDecimal totalOutstanding;   // admin + learners combined
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SeatUsage {
        private Integer used;
        private Integer total;       // null when sub-org has no cap configured
        private Integer remaining;   // total - used, null when total is null
    }
}
