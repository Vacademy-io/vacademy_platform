package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

import java.time.LocalDate;

@Getter
@Setter
public class StudentAttendanceDTO {
    private String studentId;
    private String fullName;
    private String email;
    private String mobileNumber;
    private String gender;
    private LocalDate dateOfBirth;
    private String instituteEnrollmentNumber;
    private String enrollmentStatus;
    private List<AttendanceDetailsDTO> sessions;
    private Double attendancePercentage;
    // Getters & setters
}

