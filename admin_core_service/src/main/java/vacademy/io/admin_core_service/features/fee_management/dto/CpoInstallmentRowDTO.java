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
import java.util.Date;

/** One installment as rendered in the side-view payment history. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CpoInstallmentRowDTO {

    private String id;
    private String aftInstallmentId;

    private BigDecimal originalAmount;
    private BigDecimal amountExpected;
    private BigDecimal amountPaid;
    private BigDecimal outstanding;

    private Date startDate;
    private Date dueDate;
    private String status;

    /** Per-installment discount currently in effect (from user_plan.discount_json). */
    private UserPlanDiscountJson.InstallmentDiscountEntry installmentDiscount;

    /** Manual amount override currently in effect (from user_plan.discount_json). */
    private UserPlanDiscountJson.ManualAmountOverrideEntry manualAmountOverride;
}
