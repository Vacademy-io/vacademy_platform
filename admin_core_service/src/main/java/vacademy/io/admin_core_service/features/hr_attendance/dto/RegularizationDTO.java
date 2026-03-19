package vacademy.io.admin_core_service.features.hr_attendance.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RegularizationDTO {

    private String id;
    private String attendanceId;
    private String employeeId;
    private String originalStatus;
    private String requestedStatus;
    private LocalDateTime originalCheckIn;
    private LocalDateTime originalCheckOut;
    private LocalDateTime requestedCheckIn;
    private LocalDateTime requestedCheckOut;
    private String reason;
    private String approvalStatus;
    private String remarks;
}
