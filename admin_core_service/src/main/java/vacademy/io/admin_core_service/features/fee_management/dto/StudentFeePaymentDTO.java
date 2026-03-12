package vacademy.io.admin_core_service.features.fee_management.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Date;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentFeePaymentDTO {
    private String id;
    private String userPlanId;
    private String cpoId;
    private BigDecimal amountExpected;
    private BigDecimal discountAmount;
    private String discountReason;
    private BigDecimal amountPaid;
    private Date dueDate;
    private String status;
}
