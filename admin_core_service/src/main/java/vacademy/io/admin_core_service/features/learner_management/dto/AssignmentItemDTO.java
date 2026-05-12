package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssignmentItemDTO {

    private String packageSessionId;

    /** null → auto-resolve DEFAULT invite for this package session */
    private String enrollInviteId;

    /** null → auto-resolve from the resolved invite */
    private String paymentOptionId;

    /** null → auto-resolve from the resolved payment option */
    private String planId;

    /** null → use invite/plan config; explicit value overrides */
    private Integer accessDays;

    private List<CustomFieldValueDTO> customFieldValues;

    /**
     * For CPO payment options only. Amount admin chooses to record as paid right now.
     * Allowed range: [1, total CPO contract value]. Null or 0 means no payment is recorded —
     * the learner will still get all installment rows (PENDING) and can pay each online later.
     */
    private Double cpoPaymentAmount;

    /**
     * For CPO payment options only. One of:
     *   "SKIP"    → enroll only, no payment recorded (default when null)
     *   "OFFLINE" → admin records a cash/offline collection of cpoPaymentAmount; that amount
     *               is allocated FIFO against the freshly-generated installment rows and an
     *               Invoice is generated.
     */
    private String cpoPaymentMode;

    /**
     * Structured per-learner CPO configuration: per-installment date/amount/discount
     * overrides, whole-CPO discount, and the offline-payment fields above in a
     * single nested object.
     *
     * <p>When non-null, this supersedes {@link #cpoPaymentAmount} / {@link #cpoPaymentMode}
     * for this assignment. When null, the legacy fields apply unchanged.
     */
    private CpoEnrollmentConfigDTO cpoConfig;
}
