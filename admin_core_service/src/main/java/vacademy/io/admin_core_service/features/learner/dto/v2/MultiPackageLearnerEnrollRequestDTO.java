package vacademy.io.admin_core_service.features.learner.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MultiPackageLearnerEnrollRequestDTO {

    private UserDTO user;

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("vendor_id")
    private String vendorId;

    @JsonProperty("learner_package_session_enrollments")
    private List<LearnerPackageSessionEnrollmentItemDTO> learnerPackageSessionEnrollments;

    @JsonProperty("payment_initiation_request")
    private PaymentInitiationRequestDTO paymentInitiationRequest;

    @JsonProperty("learner_extra_details")
    private LearnerExtraDetails learnerExtraDetails;

    private String enrollmentType;

}
