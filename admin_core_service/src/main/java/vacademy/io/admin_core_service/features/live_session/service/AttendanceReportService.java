package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.live_session.dto.*;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AttendanceReportService {
    @Autowired
    private LiveSessionParticipantRepository liveSessionParticipantRepository;

    @Autowired
    private SessionGuestRegistrationRepository sessionGuestRegistrationRepository;

    public Map<String, List<CustomFieldDTO>> getGuestWiseCustomFields(String sessionId) {
        List<GuestSessionCustomFieldDTO> projections = sessionGuestRegistrationRepository.findGuestCustomFieldsBySessionId(sessionId);

        Map<String, List<CustomFieldDTO>> groupedByGuest = new HashMap<>();

        for (GuestSessionCustomFieldDTO projection : projections) {
            String guestId = projection.getGuestId();

            CustomFieldDTO dto = new CustomFieldDTO();
            dto.setId(projection.getCustomFieldId());
            dto.setFieldKey(projection.getFieldKey());
            dto.setFieldName(projection.getFieldName());
            dto.setFieldType(projection.getFieldType());
            dto.setDefaultValue(projection.getDefaultValue());
            dto.setConfig(projection.getConfig());
            dto.setFormOrder(projection.getFormOrder());
            dto.setIsMandatory(projection.getIsMandatory());
            dto.setIsFilter(projection.getIsFilter());
            dto.setIsSortable(projection.getIsSortable());
            dto.setCreatedAt(projection.getCreatedAt());
            dto.setUpdatedAt(projection.getUpdatedAt());
            dto.setSessionId(projection.getLiveSessionId());
            dto.setLiveSessionId(projection.getLiveSessionId());
            dto.setCustomFieldValue(projection.getCustomFieldValue());
            dto.setGuestId(guestId);

            groupedByGuest.computeIfAbsent(guestId, k -> new ArrayList<>()).add(dto);
        }

        return groupedByGuest;
    }

    public StudentAttendanceReportDTO getStudentReport(String userId, String batchId, LocalDate start, LocalDate end) {
        List<ScheduleAttendanceProjection> projections = liveSessionParticipantRepository
                .findAttendanceForUserInBatch(batchId, userId, start, end);

        List<ScheduleDetailDTO> scheduleDetails = new ArrayList<>();
        int presentCount = 0;

        for (ScheduleAttendanceProjection projection : projections) {
            ScheduleDetailDTO dto = new ScheduleDetailDTO();
            dto.setScheduleId(projection.getScheduleId());
            dto.setMeetingDate(projection.getMeetingDate());
            dto.setStartTime(projection.getStartTime());
            dto.setLastEntryTime(projection.getLastEntryTime());
            dto.setSessionId(projection.getSessionId());
            dto.setSessionTitle(projection.getSessionTitle());
            dto.setSubject(projection.getSubject());
            dto.setSessionStatus(projection.getSessionStatus());
            dto.setAccessLevel(projection.getAccessLevel());

            String attendanceStatus = projection.getAttendanceStatus();
            dto.setAttendanceStatus(attendanceStatus);

            if ("PRESENT".equalsIgnoreCase(attendanceStatus)) {
                presentCount++;
            }

            scheduleDetails.add(dto);
        }

        double attendancePercentage = projections.isEmpty()
                ? 0.0
                : ((double) presentCount / projections.size()) * 100.0;

        StudentAttendanceReportDTO report = new StudentAttendanceReportDTO();
        report.setUserId(userId);
        report.setAttendancePercentage(attendancePercentage);
        report.setSchedules(scheduleDetails);

        return report;
    }



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
    public Page<StudentAttendanceDTO> getAllByAttendanceFilterRequest(AttendanceFilterRequest filter, Pageable pageable) {
        String name = (filter.getName() != null && !filter.getName().trim().isEmpty())
                ? filter.getName().trim()
                : null;

        List<String> batchIds = filter.getBatchIds() != null ? filter.getBatchIds() : Collections.emptyList();
        List<String> liveSessionIds = filter.getLiveSessionIds() != null ? filter.getLiveSessionIds() : Collections.emptyList();
        Page<String> studentIdsPage = liveSessionParticipantRepository.findDistinctStudentIdsWithFilters(
                name,
                filter.getStartDate(),
                filter.getEndDate(),
                batchIds,
                batchIds.size(),
                liveSessionIds,
                liveSessionIds.size(),
                pageable
        );
        if (studentIdsPage.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, 0);
        }
        List<AttendanceReportProjection> attendanceRecords = liveSessionParticipantRepository.getAttendanceReportForStudentIds(
                studentIdsPage.getContent()
        );
        Map<String, StudentAttendanceDTO> groupedData = new LinkedHashMap<>();
        for (AttendanceReportProjection record : attendanceRecords) {
            groupedData.computeIfAbsent(record.getStudentId(), id -> {
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

            groupedData.get(record.getStudentId()).getSessions().add(details);
        }
        return new PageImpl<>(
                new ArrayList<>(groupedData.values()),
                pageable,
                studentIdsPage.getTotalElements()
        );
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
