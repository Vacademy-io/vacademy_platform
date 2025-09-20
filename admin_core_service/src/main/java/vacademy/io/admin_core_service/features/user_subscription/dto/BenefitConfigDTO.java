package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
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
public class BenefitConfigDTO {

    private List<BenefitTierDTO> tiers;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BenefitTierDTO {
        private String tierName;
        private ReferralRangeDTO referralRange;
        private Integer vestingDays;
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
        private String description;
        private BenefitType type;

        @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXTERNAL_PROPERTY, property = "type")
        @JsonSubTypes({
                @JsonSubTypes.Type(value = PointBenefitValue.class, name = "POINTS"),
                @JsonSubTypes.Type(value = ContentBenefitValue.class, name = "CONTENT"),
                @JsonSubTypes.Type(value = FlatDiscountValue.class, name = "FLAT_DISCOUNT"),
                @JsonSubTypes.Type(value = PercentageDiscountValue.class, name = "PERCENTAGE_DISCOUNT"),
                @JsonSubTypes.Type(value = MembershipExtensionValue.class, name = "FREE_MEMBERSHIP_DAYS")
        })
        private Object value;
        private List<PointTriggerDTO> pointTriggers;
    }

    public enum BenefitType {
        POINTS, CONTENT, FLAT_DISCOUNT, PERCENTAGE_DISCOUNT, FREE_MEMBERSHIP_DAYS
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PointTriggerDTO {
        private Integer pointsRequired;
        private List<BenefitDTO> benefits;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PointBenefitValue {
        private Integer points;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ContentBenefitValue {
        private List<DeliveryMedium> deliveryMediums;
        private String templateId, subject, body;
        private List<String> fileIds;
        public enum DeliveryMedium { EMAIL, WHATSAPP }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FlatDiscountValue {
        private Double amount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PercentageDiscountValue {
        private Double percentage;
        private Double maxDiscount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MembershipExtensionValue {
        private Integer days;
    }
}