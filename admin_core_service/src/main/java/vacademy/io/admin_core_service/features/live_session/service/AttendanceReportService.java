package vacademy.io.admin_core_service.features.live_session.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.*;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.*;
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

    public List<StudentAttendanceDTO> getGroupedAttendanceReport(String batchSessionId , LocalDate startDate , LocalDate endDate) {
        List<AttendanceReportProjection> flatData =
                liveSessionParticipantRepository.getAttendanceReportWithinDateRange(batchSessionId , startDate , endDate);

        Map<String, StudentAttendanceDTO> groupedData = new LinkedHashMap<>();

        for (AttendanceReportProjection record : flatData) {
            String studentId = record.getStudentId();

            // Create student record if not already
            groupedData.computeIfAbsent(studentId, id -> {
                StudentAttendanceDTO student = new StudentAttendanceDTO();
                student.setStudentId(id);
                student.setFullName(record.getFullName());
                student.setEmail(record.getEmail());
                student.setMobileNumber(record.getMobileNumber());
                student.setGender(record.getGender());
                student.setDateOfBirth(record.getDateOfBirth());
                student.setInstituteEnrollmentNumber(record.getInstituteEnrollmentNumber());
                student.setEnrollmentStatus(record.getEnrollmentStatus());
                student.setSessions(new ArrayList<>());
                return student;
            });

            // Add session/schedule/attendance data
            AttendanceDetailsDTO details = new AttendanceDetailsDTO();
            details.setSessionId(record.getSessionId());
            details.setScheduleId(record.getScheduleId());
            details.setTitle(record.getTitle());
            details.setMeetingDate(record.getMeetingDate());
            details.setStartTime(record.getStartTime());
            details.setLastEntryTime(record.getLastEntryTime());
            details.setAttendanceStatus(record.getAttendanceStatus());
            details.setAttendanceDetails(record.getAttendanceDetails());
            details.setAttendanceTimestamp(record.getAttendanceTimestamp());

            groupedData.get(studentId).getSessions().add(details);
        }

        return new ArrayList<>(groupedData.values());
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
