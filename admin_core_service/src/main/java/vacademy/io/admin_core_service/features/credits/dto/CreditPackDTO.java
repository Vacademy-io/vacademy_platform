package vacademy.io.admin_core_service.features.credits.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * One pack as displayed in the pack-picker UI for the institute's resolved
 * currency. All amounts are in minor units (paise / cents). The frontend uses
 * {@link #displayPriceMajor} for human display and the *_minor fields for the
 * Razorpay-Checkout {@code amount} parameter only as a sanity check — the
 * server is the only authority on price (CreditPackService re-resolves
 * server-side when the order is created).
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreditPackDTO {
    private String packId;
    private String code;
    private String name;
    private BigDecimal credits;
    private String currency;

    private long baseAmountMinor;
    private long taxAmountMinor;
    private long totalAmountMinor;
    private int taxRateBps;            // combined CGST+SGST or IGST in bps; 0 for export

    private String displayPriceMajor;  // "₹548.70" / "$25.00"
    private String displayBaseMajor;
    private String displayTaxMajor;

    private String hsnSacCode;
    private String badge;              // "Most Popular" / null
    private boolean isExport;
}
