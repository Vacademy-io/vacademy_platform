package vacademy.io.admin_core_service.features.live_session.dto;

import java.sql.Timestamp;
import java.util.Date;

public interface AttendanceReportDTO {
    String getStudentId();
    String getFullName();
    String getEmail();
    String getMobileNumber();
    String getGender();
    Date getDateOfBirth();
    String getInstituteEnrollmentNumber();
    String getEnrollmentStatus();
    String getAttendanceStatus();
    String getAttendanceDetails();
    Timestamp getAttendanceTimestamp();
    String getSourceType();
}
