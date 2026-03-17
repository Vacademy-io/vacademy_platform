package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PackageSessionToPaymentOptionDTO {
    private String packageSessionId;
    private String id;
    private PaymentOptionDTO paymentOption;
    private String enrollInviteId;
    private String status;
    private String cpoId;
}
