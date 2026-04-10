package vacademy.io.admin_core_service.features.fee_management.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollectionDashboardResponseDTO {

    private BigDecimal projectedRevenue;
    private BigDecimal expectedToDate;
    private BigDecimal collectedToDate;
    private BigDecimal totalOverdue;

    private List<ClassWiseBreakdownDTO> classWiseBreakdown;
    private List<PaymentModeBreakdownDTO> paymentModeBreakdown;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClassWiseBreakdownDTO {
        private String packageSessionId;
        private String className;
        private BigDecimal projectedRevenue;
        private BigDecimal expectedToDate;
        private BigDecimal collectedToDate;
        private BigDecimal overdue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentModeBreakdownDTO {
        private String vendor;
        private BigDecimal amount;
    }
}
