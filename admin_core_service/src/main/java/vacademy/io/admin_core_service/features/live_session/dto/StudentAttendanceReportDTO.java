package vacademy.io.admin_core_service.features.live_session.dto;


import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class StudentAttendanceReportDTO {
    private String userId;
    private double attendancePercentage;
    private List<ScheduleDetailDTO> schedules;
}

