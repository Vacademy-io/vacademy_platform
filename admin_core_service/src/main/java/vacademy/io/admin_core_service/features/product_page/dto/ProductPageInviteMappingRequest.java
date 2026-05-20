package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageInviteMappingRequest {

    /** PK of package_session_learner_invitation_to_payment_option — pins session + invite + payment option. */
    private String psInvitePaymentOptionId;

    /** Pre-locked PaymentPlan id used for the combined checkout total. */
    private String paymentPlanId;

    private boolean preselected;

    private int displayOrder;
}
