package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UpdateEnrollInvitePackageSessionPaymentOptionDTO {
    private String enrollInviteId;
    private List<UpdatePaymentOptionDTO> updatePaymentOptions;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class UpdatePaymentOptionDTO {
        private String oldPackageSessionPaymentOptionId;
        private PackageSessionToPaymentOptionDTO newPackageSessionPaymentOption;
    }
}
