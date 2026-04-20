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

/**
 * Adjustment history row enriched with student + fee-type context.
 * Used by the institute-wide Adjustment Approvals history view so the admin can
 * see who the adjustment was for and against which fee without extra lookups.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnrichedAdjustmentHistoryDTO {
    private String id;
    private String studentFeePaymentId;
    private String eventType;
    private String adjustmentType;
    private BigDecimal amount;
    private String reason;
    private String resultingStatus;
    private String actorUserId;
    private String actorName;
    private String actorRole;
    private String previousEventId;
    private String metadata;
    private LocalDateTime createdAt;

    // Enrichment fields
    private String studentUserId;
    private String studentName;
    private String studentPhone;
    private String feeTypeName;
    private String cpoName;
    private Date installmentDueDate;
}
