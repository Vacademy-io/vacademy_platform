package vacademy.io.admin_core_service.features.fee_management.dto;

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
public class InvoiceReceiptDTO {
    private String invoiceId;
    private String invoiceNumber;
    private BigDecimal totalAmount;
    private String currency;
    private String status;
    private String pdfFileId;
    private String type;
    private LocalDateTime invoiceDate;
    private LocalDateTime createdAt;

    // Summary fields from invoice_data_json
    private BigDecimal amountPaidNow;
    private BigDecimal totalPaid;
    private BigDecimal balanceDue;
    private BigDecimal totalDiscount;
    private BigDecimal totalExpected;

    private List<InvoiceLineItemDTO> lineItems;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class InvoiceLineItemDTO {
        private String lineItemId;
        private String itemType;
        private String description;
        private BigDecimal amount;
        private String sourceId;
        private String feeTypeName;
        private String feeTypeCode;
        private String cpoName;
    }
}
