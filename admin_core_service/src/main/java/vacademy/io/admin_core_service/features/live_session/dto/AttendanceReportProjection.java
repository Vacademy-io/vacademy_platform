package vacademy.io.admin_core_service.features.live_session.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public interface AttendanceReportProjection {
    String getStudentId();
    String getFullName();
    String getEmail();
    String getMobileNumber();
    String getGender();
    LocalDate getDateOfBirth();
    String getInstituteEnrollmentNumber();
    String getEnrollmentStatus();
    String getAttendanceStatus();
    String getAttendanceDetails();
    LocalDateTime getAttendanceTimestamp();
    String getSessionId();
    String getScheduleId();
    String getTitle();
    LocalDate getMeetingDate();
    LocalTime getStartTime();
    LocalTime getLastEntryTime();
}
