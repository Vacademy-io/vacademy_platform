package vacademy.io.admin_core_service.features.course.dto.bulk;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payment configuration for bulk course creation.
 * 
 * Resolution order:
 * 1. If paymentOptionId is provided, use that existing Payment Option.
 * 2. If paymentType is provided, create a new Payment Option with the specified
 * type.
 * 3. If nothing is provided, use the Institute's default Payment Option.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkCoursePaymentConfigDTO {

    /**
     * Optional: ID of an existing PaymentOption to use.
     * If provided, all other fields are ignored.
     */
    private String paymentOptionId;

    /**
     * Payment type: FREE, ONE_TIME, SUBSCRIPTION, DONATION
     * Required if creating a new payment option without paymentOptionId.
     */
    private String paymentType;

    /**
     * Price for the payment plan.
     * Required for ONE_TIME and SUBSCRIPTION types.
     * Ignored for FREE type.
     */
    private Double price;

    /**
     * Original/elevated price (shown as strike-through).
     * Optional. If not provided, same as price.
     */
    private Double elevatedPrice;

    /**
     * Currency code (e.g., INR, USD).
     * Defaults to INR if not provided.
     */
    private String currency;

    /**
     * Validity in days for ONE_TIME payments.
     * Defaults to 365 (1 year) if not provided.
     */
    private Integer validityInDays;

    /**
     * Name for the payment option.
     * If not provided, will be auto-generated based on type.
     */
    private String paymentOptionName;

    /**
     * Name for the payment plan.
     * If not provided, will be auto-generated.
     */
    private String planName;

    /**
     * Whether admin approval is required for enrollment.
     * Defaults to false.
     */
    private Boolean requireApproval;

    /**
     * Returns effective currency, defaulting to INR.
     */
    public String getEffectiveCurrency() {
        return currency != null && !currency.isBlank() ? currency : "INR";
    }

    /**
     * Returns effective validity in days, defaulting to 365.
     */
    public int getEffectiveValidityInDays() {
        return validityInDays != null ? validityInDays : 365;
    }

    /**
     * Returns effective elevated price, defaulting to actual price.
     */
    public double getEffectiveElevatedPrice() {
        if (elevatedPrice != null) {
            return elevatedPrice;
        }
        return price != null ? price : 0.0;
    }

    /**
     * Returns whether approval is required, defaulting to false.
     */
    public boolean isEffectiveRequireApproval() {
        return requireApproval != null && requireApproval;
    }
}
