package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * One course the learner has selected at checkout.
 * Carries the bridge-row id (which resolves invite + session + payment option)
 * and the pre-locked plan, plus the price for server-side total validation.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageSelectedMappingDTO {

    private String psInvitePaymentOptionId;
    private String paymentPlanId;

    /** Client-computed price — server re-validates against PaymentPlan.actualPrice. */
    private Double amount;
}
