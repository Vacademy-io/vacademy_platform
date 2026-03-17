package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Default values for enrollment imports
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentDefaultsDTO {

    @JsonProperty("package_session_id")
    private String packageSessionId;

    @JsonProperty("payment_option_id")
    private String paymentOptionId;

    @JsonProperty("payment_plan_id")
    private String paymentPlanId;

    @JsonProperty("enroll_invite_id")
    private String enrollInviteId;

    /**
     * Institute Payment Gateway Mapping ID for creating
     * UserInstitutePaymentGatewayMapping
     */
    @JsonProperty("institute_payment_gateway_mapping_id")
    private String institutePaymentGatewayMappingId;
}
