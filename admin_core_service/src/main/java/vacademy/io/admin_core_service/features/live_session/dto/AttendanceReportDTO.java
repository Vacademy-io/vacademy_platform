package vacademy.io.admin_core_service.features.live_session.dto;

public interface AttendanceReportDTO {
    String getUserId();
    String getEnrollmentStatus();
    String getAttendanceStatus();
    String getAttendanceDetails();
    java.sql.Timestamp getAttendanceLoggedAt();
}
