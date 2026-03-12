package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;
import java.lang.Boolean;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentFeePaymentDTO {
    private String id;
    private String userPlanId;
    private String cpoId;
    private String cpoName;
    private String feeTypeName;
    private String feeTypeCode;
    private String feeTypeDescription;
    private BigDecimal amountExpected;
    private BigDecimal discountAmount;
    private String discountReason;
    private BigDecimal amountPaid;
    private Date dueDate;
    private String status;

    // Derived fields for "installments/dues/overdues" UI
    private BigDecimal amountDue; // amount_expected - discount_amount - amount_paid
    private Boolean isOverdue;    // due_date < today AND amountDue > 0
    private Long daysOverdue;     // null if not overdue or due_date null
}
