package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReferralDetailDTO {
    private UserDTO userDetail;
    private String status;
    private String referralMappingId;
    private String couponCode;
    private List<ReferralBenefitLogDTO> benefitLogs;
}
