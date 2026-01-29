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
}


