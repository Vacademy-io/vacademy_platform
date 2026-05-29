package vacademy.io.admin_core_service.features.user_subscription.dto.coupon;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AppliedDiscountInputDTO {

    /** "PERCENTAGE" or "FLAT". Case-insensitive on validate but persisted as sent. */
    @NotBlank
    private String discountType;

    @NotNull
    @Positive
    private Double discountPoint;

    /** Required when discountType is PERCENTAGE; cap on the computed discount. */
    private Double maxDiscountPoint;

    private String currency;
}
