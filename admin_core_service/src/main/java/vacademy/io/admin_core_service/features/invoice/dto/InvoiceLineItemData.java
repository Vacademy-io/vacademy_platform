package vacademy.io.admin_core_service.features.invoice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Internal data structure for invoice line items
 * Used during invoice generation and template rendering
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceLineItemData {
    private String itemType; // PLAN, DISCOUNT, TAX, COUPON, REFERRAL
    private String description;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal amount;
    private String sourceId;
}


