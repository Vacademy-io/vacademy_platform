package vacademy.io.admin_core_service.features.hr_leave.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeaveBalanceDTO {

    private String id;
    private String employeeId;
    private String leaveTypeId;
    private String leaveTypeName;
    private Integer year;
    private BigDecimal openingBalance;
    private BigDecimal accrued;
    private BigDecimal used;
    private BigDecimal adjustment;
    private BigDecimal carriedForward;
    private BigDecimal encashed;
    private BigDecimal closingBalance;
}
