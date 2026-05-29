package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;

/**
 * Request to enroll a learner in a CPO payment option on a product page WITHOUT
 * initiating payment. This creates the UserPlan + StudentFeePayment rows so the
 * learner can then select and pay individual installments via the open CPO fee endpoints.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageCpoEnrollRequest {

    private String productPageCode;
    private String instituteId;

    /** Bridge-table ID (ps_invite_payment_option_id) for the CPO invite the learner selected. */
    private String psInvitePaymentOptionId;

    /** Payment plan ID linked to the CPO payment option. */
    private String paymentPlanId;

    private UserDTO userDetails;
    private LearnerExtraDetails learnerExtraDetails;
    private List<CustomFieldValueDTO> customFieldValues;
}
