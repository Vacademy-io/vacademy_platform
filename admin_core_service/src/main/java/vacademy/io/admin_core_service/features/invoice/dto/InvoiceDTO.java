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
    private Boolean taxIncluded;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<InvoiceLineItemDTO> lineItems;
}


