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

    private SummaryDTO summary;
    private PipelineDTO pipeline;
    private List<ClassWiseCollectionDTO> classWiseDetails;
    private List<PaymentModeInsightDTO> paymentModeInsights;

    // ── Top summary cards ──────────────────────────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummaryDTO {
        private BigDecimal projectedRevenue;   // Full-year target (net of discounts)
        private BigDecimal tillNowExpected;    // Installments due on or before today
        private BigDecimal tillNowCollected;   // Total amount_paid across all installments
        private BigDecimal totalOverdue;       // tillNowExpected - paid (only past-due, un-waived)
        private BigDecimal totalDue;           // projectedRevenue - tillNowCollected (remaining balance)
        private Double collectionRate;         // (tillNowCollected / tillNowExpected) * 100
    }

    // ── Waterfall / pipeline chart ─────────────────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PipelineDTO {
        private BigDecimal projectedRevenue;
        private BigDecimal expectedToDate;
        private BigDecimal collectedToDate;
        private BigDecimal totalOverdue;
        private BigDecimal totalDue;
    }

    // ── Class-wise interactive table ───────────────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClassWiseCollectionDTO {
        private String className;
        private BigDecimal projectedRevenue;
        private BigDecimal expectedToDate;
        private BigDecimal collectedToDate;
        private Double collectionRate;
        private BigDecimal totalOverdue;
    }

    // ── Payment mode donut chart ───────────────────────────────────────────────
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentModeInsightDTO {
        private String mode;
        private Double percentage;
        private String color;
    }
}
