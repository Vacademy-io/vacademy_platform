package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ContentBenefitsConfigDTO {

    private List<ReferralBenefitTierDTO> referralBenefits;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReferralBenefitTierDTO {
        private String tierName; // <-- added
        private ReferralRangeDTO referralRange;

        // recursive list of tiers
        private List<ReferralBenefitTierDTO> referralBenefits;

        // leaf-level benefits
        private List<BenefitDTO> benefits;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReferralRangeDTO {
        private Integer min;
        private Integer max;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
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
