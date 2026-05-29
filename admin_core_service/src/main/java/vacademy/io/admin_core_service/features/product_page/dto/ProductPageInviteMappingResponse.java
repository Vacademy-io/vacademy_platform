package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageInviteMappingResponse {

    private String id;

    /** Bridge table PK (package_session_learner_invitation_to_payment_option.id). */
    private String psInvitePaymentOptionId;

    /** Derived from psInvitePaymentOption for convenience. */
    private String enrollInviteId;
    private String packageSessionId;
    private String paymentOptionId;

    private String paymentPlanId;
    private PaymentPlanDTO paymentPlan;

    private boolean preselected;
    private int displayOrder;
    private String status;

    /** Resolved from the linked PackageSession hierarchy for display on the learner catalog. */
    private String packageId;
    private String packageName;
    private String levelName;
    private String sessionName;

    /** Payment option type (ONE_TIME, SUBSCRIPTION, FREE, DONATION, CPO). */
    private String paymentOptionType;

    /** For CPO: the preview media of the course (file ID). */
    private String coursePreviewImageMediaId;

    /** For CPO: short description of the course. */
    private String aboutTheCourseHtml;
}
