package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.List;

/**
 * Step 1 of Course Page enrollment: collect learner details and create ABANDONED_CART
 * entries for each selected invite. Mirrors EnrollmentFormSubmitDTO but supports
 * multiple invites in a single request.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageFormSubmitRequest {

    private String productPageCode;
    private String instituteId;

    /** Bridge-table IDs (ps_invite_payment_option_id) for the invites the learner selected. */
    private List<String> selectedPsInvitePaymentOptionIds;

    private UserDTO userDetails;
    private LearnerExtraDetails learnerExtraDetails;
    private List<CustomFieldValueDTO> customFieldValues;
}
