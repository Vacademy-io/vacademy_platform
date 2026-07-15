package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InvoiceDTO {
    private String id;
    private String invoiceNumber;
    private String userPlanId;
    private String paymentLogId; // Primary payment log ID (for backward compatibility)
    private List<String> paymentLogIds; // All payment log IDs
    private String userId;
    private String instituteId;
    private LocalDateTime invoiceDate;
    private LocalDateTime dueDate;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal taxAmount;
    private BigDecimal totalAmount;
    private String currency;
    private String status;
    private String pdfFileId; // File ID reference to media service
    private String pdfUrl; // Computed URL (for convenience, retrieved from file ID)
    /**
     * Learner-facing payment link for PENDING_PAYMENT admin invoices (the page on
     * the learner portal where they can pay via gateway). Null for non-pending
     * statuses + synthetic SFP-derived rows. Same value the create response
     * exposes — surfaced on the list so the Copy Link button on the Invoices
     * section can copy without a separate fetch.
     */
    private String paymentLink;
    private Boolean taxIncluded;
    private String source;
    private String sourceId;
    // Admin-entered notes (from invoice_data_json), if any — used by the frontend
    // "Duplicate" action to prefill a new Create-Invoice dialog from this invoice.
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<InvoiceLineItemDTO> lineItems;
}


