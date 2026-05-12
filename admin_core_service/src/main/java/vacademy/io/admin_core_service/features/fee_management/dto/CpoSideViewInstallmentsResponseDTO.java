package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDiscountJson;

import java.math.BigDecimal;
import java.util.List;

/**
 * Aggregated side-view payload: per-UserPlan installment ledger plus discount
 * snapshot. Drives the admin "payment history" tab.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CpoSideViewInstallmentsResponseDTO {

    private String userPlanId;
    private String userId;
    private String cpoId;

    /** Sum of original_amount across all installments (template gross). */
    private BigDecimal grossTotal;

    /** Sum of amount_expected across all installments (post all discounts). */
    private BigDecimal netTotal;

    /** Sum of amount_paid across all installments. */
    private BigDecimal paidTotal;

    /** netTotal − paidTotal. Negative values indicate overpayment. */
    private BigDecimal outstandingTotal;

    /** Whole-CPO discount currently in effect. Null if none. */
    private UserPlanDiscountJson.DiscountEntry cpoDiscount;

    private List<CpoInstallmentRowDTO> installments;

    /** Audit trail (apply/modify/remove events). Most recent last. */
    private List<UserPlanDiscountJson.HistoryEntry> history;
}
