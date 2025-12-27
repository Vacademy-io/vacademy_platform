
package vacademy.io.admin_core_service.features.migration.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.Map;

@Data
public class MigrationConfigDTO {

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("payment_option_id")
    private String paymentOptionId;

    @JsonProperty("payment_plan_id")
    private String paymentPlanId;

    @JsonProperty("enroll_invite_id")
    private String enrollInviteId;

    @JsonProperty("package_session_id")
    private String packageSessionId;

    @JsonProperty("payment_gateway_mapping_id")
    private String paymentGatewayMappingId;

    @JsonProperty("ssigm_type_id")
    private String ssigmTypeId;

    @JsonProperty("custom_field_mapping")
    private Map<String, String> customFieldMapping;
}
