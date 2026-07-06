package vacademy.io.admin_core_service.features.invoice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLogLineItem;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Internal data structure for building invoice information
 * Used during invoice generation process
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceData {
    // User information
    private UserDTO user;
    
    // Institute information
    private Institute institute;
    
    // Plan information
    private UserPlan userPlan;
    private PaymentPlan paymentPlan;
    
    // Payment information
    private PaymentLog paymentLog;
    private List<PaymentLogLineItem> paymentLogLineItems;
    
    // Invoice details
    private String invoiceNumber;
    private LocalDateTime invoiceDate;
    private LocalDateTime dueDate;
    
    // Financial details
    private BigDecimal planPrice;
    private BigDecimal discountAmount;
    private BigDecimal taxAmount;
    private BigDecimal subtotal;
    private BigDecimal totalAmount;
    private String currency;
    
    // Tax configuration
    private Boolean taxIncluded;
    private BigDecimal taxRate;
    private String taxLabel;
    
    // Payment details
    private String paymentMethod;
    private String transactionId;
    private LocalDateTime paymentDate;
    
    // Line items for template
    private List<InvoiceLineItemData> lineItems;

    // Free-text notes shown in the invoice (maps to {{notes}}).
    private String notes;

    /**
     * Admin-supplied per-invoice overrides for editable text placeholders, keyed by
     * placeholder name (e.g. {@code user_name}, {@code institute_address},
     * {@code invoice_number}, {@code tax_label}). When present for a key,
     * {@link vacademy.io.admin_core_service.features.invoice.service.InvoiceService#replaceTemplatePlaceholders}
     * uses the override (HTML-escaped) instead of the value derived from the user /
     * institute / settings. Derived amounts ({@code subtotal}/{@code tax_amount}/
     * {@code total_amount}) and HTML placeholders ({@code line_items}, {@code institute_logo})
     * are never overridable. Null / empty means "no overrides — derive everything".
     */
    private Map<String, String> overrides;

    /**
     * Aggregated tax-component breakdown for the {{tax_components}} placeholder,
     * computed per line item by package type and summed across the invoice. Each
     * entry holds: label, rate (percent), amount. Null/empty when no tax components
     * are configured (the legacy single-rate tax path is used instead).
     */
    private List<Map<String, Object>> aggregatedTaxComponents;
}


