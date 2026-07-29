package vacademy.io.community_service.feature.pricing.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** A product and its plans, as the builder renders them. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductDto {
    private String code;
    private String name;
    private String tagline;
    private String icon;
    /** PER_LEARNER_TIER | FLAT_ANNUAL | ONE_TIME | SEAT_BASED | COUNT_BASED | USAGE */
    private String pricingModel;

    private BigDecimal basePrice;
    private BigDecimal unitPrice;
    private Integer includedUnits;
    private String unitLabel;
    private int minQuantity;

    /** Only sellable alongside this product. */
    private String requiresProductCode;
    /** Its tier follows whichever plan was chosen for that product. */
    private String mirrorsProductCode;

    /** Cheapest active plan, for the "from ₹X" hint on a collapsed card. */
    private BigDecimal fromPrice;
    private List<PlanDto> plans;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PlanDto {
        private String code;
        private String name;
        private String description;
        private Integer unitCount;
        private BigDecimal price;
        /** What this plan costs per year at list, already multiplied out for learner tiers. */
        private BigDecimal annualPrice;
        private boolean popular;
        private List<FeatureDto> features;
        /** Other products this plan bundles in for free. */
        private List<InclusionDto> inclusions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class InclusionDto {
        private String productCode;
        /** Name of the included product, so the FE can label it without a lookup. */
        private String productName;
        /** Null means any plan of that product; set means only that plan is free. */
        private String planCode;
        /** Null means the whole product; a number means that many units are free. */
        private Integer quantity;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FeatureDto {
        private String label;
        private boolean included;
    }
}
