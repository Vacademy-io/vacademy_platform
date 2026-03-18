package vacademy.io.admin_core_service.features.hr_attendance.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AttendanceRecordDTO {

    private String id;
    private String employeeId;
    private String employeeName;
    private String employeeCode;
    private String instituteId;
    private LocalDate attendanceDate;
    private String shiftId;
    private String shiftName;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
    private BigDecimal totalHours;
    private BigDecimal overtimeHours;
    private String status;
    private String source;
    private String remarks;
    private Boolean isRegularized;
}
