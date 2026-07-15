package vacademy.io.admin_core_service.features.user_account.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserAccountSummaryDTO {
    private String userId;
    private String instituteId;
    private BigDecimal totalAccrued;
    private BigDecimal totalPaid;
    private BigDecimal balance;      // totalAccrued - totalPaid (positive = user still owes)
    private BigDecimal overdue;      // debits past due_date with no matching credit
    private String currency;
}
