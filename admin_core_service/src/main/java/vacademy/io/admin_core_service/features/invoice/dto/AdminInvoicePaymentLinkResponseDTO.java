package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminInvoicePaymentLinkResponseDTO {
    private String invoiceId;
    private String invoiceNumber;
    private String userId;
    private BigDecimal totalAmount;
    private String currency;
    private String status;
    private LocalDateTime dueDate;
    // Shareable link to send to the user for payment
    private String paymentLink;
    // Direct PDF download URL
    private String pdfUrl;
}
