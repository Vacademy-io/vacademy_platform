package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkAssignResultItemDTO {

    private String userId;
    private String userEmail;
    private String packageSessionId;

    /**
     * SUCCESS | SKIPPED | FAILED
     */
    private String status;

    /**
     * What was actually done:
     * CREATED | RE_ENROLLED | NONE
     */
    private String actionTaken;

    private String mappingId;
    private String userPlanId;
    private String enrollInviteIdUsed;

    /** Human-readable explanation (especially useful for SKIPPED / FAILED) */
    private String message;

    /**
     * Resolved payment option type — e.g. FREE, ONE_TIME, SUBSCRIPTION, DONATION, CPO.
     * Lets the frontend branch on CPO without re-fetching the invite.
     */
    private String paymentOptionType;

    /** Total contract value of the CPO (only populated when paymentOptionType=CPO). */
    private Double cpoTotalAmount;

    /** Number of installments in the CPO (only populated when paymentOptionType=CPO). */
    private Integer cpoInstallmentCount;

    /**
     * Amount recorded as paid right now for a CPO assignment.
     * Null when no payment was recorded (the SKIP path).
     */
    private Double cpoInitialPaymentAmount;

    /**
     * "OFFLINE" if an offline payment was (or would be) recorded; "SKIP" otherwise.
     * Only populated when paymentOptionType=CPO.
     */
    private String cpoInitialPaymentMode;
}
