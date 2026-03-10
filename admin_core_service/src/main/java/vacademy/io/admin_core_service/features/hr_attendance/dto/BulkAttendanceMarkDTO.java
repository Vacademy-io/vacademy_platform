package vacademy.io.admin_core_service.features.hr_attendance.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkAttendanceMarkDTO {

    private String instituteId;
    private LocalDate date;
    private List<AttendanceMarkEntry> entries;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AttendanceMarkEntry {
        private String employeeId;
        private String status;
        private String remarks;
    }
}
