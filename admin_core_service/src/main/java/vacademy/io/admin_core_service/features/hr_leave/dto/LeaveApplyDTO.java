package vacademy.io.admin_core_service.features.hr_leave.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeaveApplyDTO {

    private String employeeId;
    private String leaveTypeId;
    private LocalDate fromDate;
    private LocalDate toDate;
    private BigDecimal totalDays;
    private Boolean isHalfDay;
    private String halfDayType;
    private String reason;
    private String documentFileId;
}
