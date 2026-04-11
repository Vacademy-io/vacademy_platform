package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ReceiptDetailsDTO {
    private String invoiceId;
    private String receiptNumber;
    private LocalDateTime receiptDate;
    private String downloadUrl;
    private String paymentMode;
    private String transactionId;
    private List<ReceiptLineItemDTO> lineItems;
    private BigDecimal totalExpected;
    private BigDecimal totalPaid;
    private BigDecimal balanceDue;
    private BigDecimal amountPaidNow;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ReceiptLineItemDTO {
        private String feeTypeName;
        private String cpoName;
        private Date dueDate;
        private BigDecimal amountExpected;
        private BigDecimal amountPaid;
        private BigDecimal balance;
        private String status;
    }
}
