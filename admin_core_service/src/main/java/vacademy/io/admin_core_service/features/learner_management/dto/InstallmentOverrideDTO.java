package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.fee_management.dto.DiscountSpecDTO;

import java.time.LocalDate;

/**
 * Per-installment override the admin supplies at bulk-assign time. Identifies
 * the template row via {@code aftInstallmentId} (the {@code i_id} the
 * generator stamps onto the matching StudentFeePayment) and supplies any
 * combination of date/amount/discount edits.
 *
 * <p>All fields are optional except {@code aftInstallmentId}. A null leaves
 * the generator's default for that field untouched.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstallmentOverrideDTO {

    /** Matches StudentFeePayment.iId — the aft_installment template id. */
    private String aftInstallmentId;

    private LocalDate startDate;
    private LocalDate dueDate;

    /**
     * Explicit amount override. Mutually exclusive with {@code discount} —
     * if both are set, the explicit amount wins and the discount is recorded
     * as a manual-override audit entry.
     */
    private Double amount;

    private DiscountSpecDTO discount;
}
