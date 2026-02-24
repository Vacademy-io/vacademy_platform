package vacademy.io.admin_core_service.features.fee_management.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentFeeAllocationLedgerDTO {
    private String id;
    private String paymentLogId;
    private String studentFeePaymentId;
    private BigDecimal amountAllocated;
    private String allocationType;
    private String remarks;
    private LocalDateTime createdAt;
}
