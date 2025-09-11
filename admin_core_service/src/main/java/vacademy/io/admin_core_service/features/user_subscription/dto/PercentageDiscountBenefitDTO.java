package vacademy.io.admin_core_service.features.user_subscription.dto;

import lombok.Data;

@Data
public class PercentageDiscountBenefitDTO {
    private double percentage;
    private double maxDiscountAmount;
    private boolean applyMaximumDiscountAmount;
}
