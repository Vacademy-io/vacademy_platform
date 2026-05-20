package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.auth.dto.learner.ReferRequestDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

/**
 * Step 2 of Course Page enrollment: combined payment for all selected invites.
 * The backend validates the total, calls the payment gateway once, then splits
 * the fulfillment into per-invite enrollment + payment_log_line_item records.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageEnrollRequest {

    private String productPageCode;
    private String instituteId;
    private String userId;

    private List<ProductPageSelectedMappingDTO> selectedMappings;

    /** Optional coupon applied at the cart step. */
    private String couponCode;

    private UserDTO user;
    private LearnerExtraDetails learnerExtraDetails;
    private ReferRequestDTO referRequest;
    private List<CustomFieldValueDTO> customFieldValues;

    /**
     * Payment initiation request with the COMBINED total amount.
     * The amount field must equal sum(selectedMappings.amount) minus coupon discount.
     * The server re-validates this before charging.
     */
    private PaymentInitiationRequestDTO paymentInitiationRequest;
}
