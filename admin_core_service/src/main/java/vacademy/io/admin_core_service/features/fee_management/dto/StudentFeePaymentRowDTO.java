package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentFeePaymentRowDTO {
    
    // Group context
    private String studentId;
    private String cpoId;
    private List<String> packageSessionIds;
    
    // Enriched student info
    private String studentName;
    private String phone;
    
    // Enriched course/payment info
    private String cpoName;

    // Financial calculations
    private BigDecimal totalExpectedAmount;
    private BigDecimal totalPaidAmount;
    private BigDecimal dueAmount;
    private BigDecimal overdueAmount;

    // Status: PENDING, PAID, PARTIAL_PAID, OVERDUE, WAIVED
    private String status;
}
