package vacademy.io.community_service.feature.pricing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** A fully priced plan: the headline numbers plus every line that produced them. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuoteResponseDto {

    private String quoteId;          // set only once saved
    private String rateCardVersion;
    private String currency;
    private String currencySymbol;
    private String billingCycle;

    private List<LineItemDto> recurringLines;
    private List<LineItemDto> oneTimeLines;

    /** Recurring total at list, before the billing-cycle adjustment. */
    private BigDecimal recurringAnnual;
    /** Negative for the annual discount, positive for the monthly uplift. */
    private BigDecimal cycleAdjustment;
    private String cycleAdjustmentLabel;
    /** Recurring annual after the cycle adjustment, ex-tax. */
    private BigDecimal recurringAnnualAdjusted;

    private BigDecimal oneTimeTotal;
    private BigDecimal subtotal;      // ex-tax, first year (recurring + one-time)
    private BigDecimal taxRate;
    private BigDecimal taxAmount;
    private String taxLabel;
    /** Everything owed across the first year, inc-tax — NOT what a single payment looks like. */
    private BigDecimal total;

    /**
     * What they actually hand over each payment: the recurring amount for one billing period,
     * inc-tax. One-time fees are deliberately excluded — they are due once, not every period.
     */
    private BigDecimal perPaymentAmount;
    private String perPaymentLabel;
    /** How many payments make up the first year (12, 2 or 1). */
    private int paymentsPerYear;
    /** One-time fees inc-tax, payable with the first invoice. */
    private BigDecimal oneTimeTotalWithTax;

    /** Bullets for the "included at this level, at no extra cost" panel. */
    private List<String> included;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LineItemDto {
        private String code;
        private String label;
        private String detail;      // e.g. "300 learners × ₹200"
        private BigDecimal amount;
        private boolean oneTime;
        /** True when the bracket already covers it — shown struck through at ₹0. */
        private boolean includedFree;
    }
}
