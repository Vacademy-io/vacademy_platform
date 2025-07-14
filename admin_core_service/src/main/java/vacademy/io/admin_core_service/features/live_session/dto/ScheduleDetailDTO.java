package vacademy.io.admin_core_service.features.live_session.dto;


import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
public class ScheduleDetailDTO {
    private String scheduleId;
    private LocalDate meetingDate;
    private LocalTime startTime;
    private LocalTime lastEntryTime;
    private String sessionId;
    private String sessionTitle;
    private String subject;
    private String sessionStatus;
    private String accessLevel;
    private String attendanceStatus;
}
