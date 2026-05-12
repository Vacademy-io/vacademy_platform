package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Discount specification supplied by an admin when applying a discount to a
 * CPO UserPlan — either at the whole-plan (CPO) level or at a single
 * installment level. The same shape is reused on the enrollment path
 * (bulk-assign v3) and the side-view modification endpoints.
 *
 * <p>{@code type} is one of "PERCENTAGE" or "FLAT". For PERCENTAGE, {@code value}
 * is the percent (0–100). For FLAT, {@code value} is the absolute discount
 * amount in the plan's currency. {@code reason} is a free-text note shown in
 * the side-view; it is not used for math.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DiscountSpecDTO {

    public static final String TYPE_PERCENTAGE = "PERCENTAGE";
    public static final String TYPE_FLAT = "FLAT";

    private String type;
    private Double value;
    private String reason;
}
