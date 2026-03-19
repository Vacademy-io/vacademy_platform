package vacademy.io.admin_core_service.features.hr_attendance.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.math.BigDecimal;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AttendanceSummaryDTO {

    private String employeeId;
    private String employeeName;
    private String employeeCode;
    private Integer totalWorkingDays;
    private Long present;
    private Long absent;
    private Long halfDay;
    private Long onLeave;
    private Long holidays;
    private Long weekends;
    private BigDecimal overtime;
}
