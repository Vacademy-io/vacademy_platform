package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;


@Getter
@Setter
public class AttendanceDetailsDTO {
    private String scheduleId;
    private String sessionId;
    private String title;
    private LocalDate meetingDate;
    private LocalTime startTime;
    private LocalTime lastEntryTime;
    private String attendanceStatus;
    private String attendanceDetails;
    private LocalDateTime attendanceTimestamp;
    private Boolean dailyAttendance;
    // Getters & setters
}

