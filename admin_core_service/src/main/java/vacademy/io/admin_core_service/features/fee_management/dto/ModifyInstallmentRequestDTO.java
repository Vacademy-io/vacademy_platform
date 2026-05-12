package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Side-view modification for a single installment. Any subset of fields may be
 * supplied; nulls mean "no change to this field." {@code amount} and
 * {@code discount} are mutually exclusive — if both are set the explicit
 * amount wins and the discount is treated as the audit reason.
 *
 * <p>To remove an existing per-installment discount, pass
 * {@code clear_discount=true} (the discount field is otherwise interpreted as
 * "leave existing alone"). Same for amount via {@code clear_amount_override}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ModifyInstallmentRequestDTO {

    private LocalDate startDate;
    private LocalDate dueDate;

    private Double amount;
    private boolean clearAmountOverride;

    private DiscountSpecDTO discount;
    private boolean clearDiscount;
}
