package vacademy.io.community_service.feature.pricing.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * A plan configuration to price. Products are selected independently, each carrying its own
 * chosen plan and (where the model needs one) a quantity.
 */
@Data
public class QuoteRequestDto {

    /** Links the quote to the lead when the prospect came from the onboarding form. */
    private String submissionId;
    private String slug;

    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String organizationName;

    private String currency = "INR";          // INR | USD
    private String billingCycle = "ANNUAL";   // MONTHLY | HALF_YEARLY | ANNUAL

    private List<SelectionDto> selections = new ArrayList<>();

    /** Internal mode only: a custom development line agreed with the prospect. */
    private String customFeatureLabel;
    private BigDecimal customFeatureAmount;

    @Data
    public static class SelectionDto {
        private String productCode;
        /** Omit for single-plan products — the first active plan is used. */
        private String planCode;
        /** Seats, sub-orgs, or sessions per month, depending on the product's model. */
        private Integer quantity;
        /** Internal mode only: replaces the plan's unit price. */
        private BigDecimal priceOverride;
    }
}
