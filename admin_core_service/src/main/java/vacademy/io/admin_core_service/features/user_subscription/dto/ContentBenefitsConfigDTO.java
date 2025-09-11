package vacademy.io.admin_core_service.features.user_subscription.dto;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentBenefitsConfigDTO {
    private List<ReferralBenefitTierDTO> referralBenefits;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReferralBenefitTierDTO {
        private ReferralRangeDTO referralRange;
        private List<BenefitDTO> benefits;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ReferralRangeDTO {
        private Integer min;
        private Integer max;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BenefitDTO {
        private List<DeliveryMedium> deliveryMediums;

        // Common fields
        private String templateId;
        private String subject;
        private String body;

        private List<String> fileIds;
    }

    public enum DeliveryMedium {
        EMAIL,
        WHATSAPP
    }
}
