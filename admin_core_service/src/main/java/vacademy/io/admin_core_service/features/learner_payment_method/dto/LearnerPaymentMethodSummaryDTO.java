package vacademy.io.admin_core_service.features.learner_payment_method.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerPaymentMethodSummaryDTO {
    private String vendor;
    private boolean updateSupported;
    private boolean hasSavedPaymentMethod;
    private String cardBrand;
    private String cardLast4;
    private Long cardExpiryMonth;
    private Long cardExpiryYear;
    private LearnerBillingDetailsDTO billingDetails;
    /**
     * Why the section is limited: GATEWAY_NOT_CONFIGURED, NO_CUSTOMER,
     * UNSUPPORTED_GATEWAY, or null when fully available.
     */
    private String reason;
}
