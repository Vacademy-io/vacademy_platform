package vacademy.io.admin_core_service.features.live_session.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTOImpl;
import vacademy.io.admin_core_service.features.live_session.dto.GuestAttendanceDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;

import java.sql.Timestamp;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class AttendanceReportService {
    @Autowired
    private LiveSessionParticipantRepository liveSessionParticipantRepository;

    @Autowired
    private SessionGuestRegistrationRepository sessionGuestRegistrationRepository;


    public List<AttendanceReportDTO> generateReport(String sessionId , String scheduleId , String accessType) {
        if(Objects.equals(accessType, "private"))
        return liveSessionParticipantRepository.getAttendanceReportBySessionIds(sessionId , scheduleId);
        else {
            List<GuestAttendanceDTO> guests =  sessionGuestRegistrationRepository.findGuestAttendanceBySessionAndSchedule(sessionId, scheduleId);
            return guests.stream()
                    .map(AttendanceMapper::convertGuestToAttendanceReport)
                    .collect(Collectors.toList());
        }
    }

    public class AttendanceMapper {

        public static AttendanceReportDTO convertGuestToAttendanceReport(GuestAttendanceDTO guestDto) {
            return AttendanceReportDTOImpl.builder()
                    .studentId(null)
                    .fullName(guestDto.getGuestEmail())
                    .email(guestDto.getGuestEmail())
                    .mobileNumber(null)
                    .gender(null)
                    .dateOfBirth(null)
                    .instituteEnrollmentNumber(null)
                    .enrollmentStatus(null)
                    .attendanceStatus(guestDto.getAttendanceStatus())
                    .attendanceDetails(guestDto.getAttendanceDetails())
                    .attendanceTimestamp(guestDto.getAttendanceTimestamp())
                    .build();
        }
    }




}
