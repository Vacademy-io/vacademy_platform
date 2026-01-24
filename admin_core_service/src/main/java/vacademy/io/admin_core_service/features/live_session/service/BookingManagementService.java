package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_session.dto.*;
import vacademy.io.admin_core_service.features.live_session.entity.BookingType;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.BookingTypeRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Date;
import java.sql.Time;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingManagementService {

    private final LiveSessionRepository sessionRepository;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionParticipantRepository participantRepository;
    private final BookingTypeRepository bookingTypeRepository;

    // ==================== CHECK AVAILABILITY ====================

    public CheckAvailabilityResponse checkAvailability(CheckAvailabilityRequest request) {
        List<CheckAvailabilityResponse.ConflictInfo> conflicts = new ArrayList<>();

        Date startDate = Date.valueOf(request.getStartDate());
        Date endDate = Date.valueOf(request.getEndDate());
        Time startTime = request.getStartTime() != null ? Time.valueOf(request.getStartTime()) : null;
        Time endTime = request.getEndTime() != null ? Time.valueOf(request.getEndTime()) : null;

        // Check user conflicts
        if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
            List<Object[]> userConflicts = scheduleRepository.findConflictingSchedulesForUsers(
                    request.getUserIds(),
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    request.getExcludeSessionId());

            conflicts.addAll(mapUserConflicts(userConflicts));
        }

        // Check resource conflicts (source/sourceId)
        if (request.getSource() != null && request.getSourceId() != null) {
            List<Object[]> resourceConflicts = scheduleRepository.findConflictingSchedulesForResource(
                    request.getSource(),
                    request.getSourceId(),
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    request.getExcludeSessionId());

            conflicts.addAll(mapResourceConflicts(resourceConflicts));
        }

        return CheckAvailabilityResponse.builder()
                .available(conflicts.isEmpty())
                .conflicts(conflicts)
                .build();
    }

    private List<CheckAvailabilityResponse.ConflictInfo> mapUserConflicts(List<Object[]> results) {
        return results.stream().map(row -> CheckAvailabilityResponse.ConflictInfo.builder()
                .sessionId((String) row[0])
                .scheduleId((String) row[1])
                .title((String) row[2])
                .date(row[3] != null ? ((Date) row[3]).toLocalDate() : null)
                .startTime(row[4] != null ? ((Time) row[4]).toLocalTime() : null)
                .endTime(row[5] != null ? ((Time) row[5]).toLocalTime() : null)
                .conflictingUserId((String) row[6])
                .build()).collect(Collectors.toList());
    }

    private List<CheckAvailabilityResponse.ConflictInfo> mapResourceConflicts(List<Object[]> results) {
        return results.stream().map(row -> CheckAvailabilityResponse.ConflictInfo.builder()
                .sessionId((String) row[0])
                .scheduleId((String) row[1])
                .title((String) row[2])
                .date(row[3] != null ? ((Date) row[3]).toLocalDate() : null)
                .startTime(row[4] != null ? ((Time) row[4]).toLocalTime() : null)
                .endTime(row[5] != null ? ((Time) row[5]).toLocalTime() : null)
                .conflictingSource((String) row[6])
                .conflictingSourceId((String) row[7])
                .build()).collect(Collectors.toList());
    }

    // ==================== CANCEL BOOKING ====================

    @Transactional
    public String cancelBooking(CancelBookingRequest request, CustomUserDetails user) {
        if (request.getScheduleId() != null) {
            // Cancel specific schedule
            scheduleRepository.updateScheduleStatus(request.getScheduleId(), "CANCELLED");
            return "Schedule cancelled successfully";
        } else if (request.getSessionId() != null) {
            // Cancel entire session
            LiveSession session = sessionRepository.findById(request.getSessionId())
                    .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Session not found"));
            session.setStatus("CANCELLED");
            sessionRepository.save(session);

            // Also cancel all schedules
            List<SessionSchedule> schedules = scheduleRepository.findBySessionId(request.getSessionId());
            for (SessionSchedule schedule : schedules) {
                scheduleRepository.updateScheduleStatus(schedule.getId(), "CANCELLED");
            }

            // TODO: Send cancellation notification if request.isNotifyParticipants()

            return "Session cancelled successfully";
        }

        throw new VacademyException(HttpStatus.BAD_REQUEST, "Either sessionId or scheduleId is required");
    }

    // ==================== RESCHEDULE BOOKING ====================

    @Transactional
    public String rescheduleBooking(RescheduleBookingRequest request, CustomUserDetails user) {
        if (!scheduleRepository.existsById(request.getScheduleId())) {
            throw new VacademyException(HttpStatus.NOT_FOUND, "Schedule not found");
        }

        // Update schedule
        scheduleRepository.reschedule(
                request.getScheduleId(),
                Date.valueOf(request.getNewDate()),
                Time.valueOf(request.getNewStartTime()),
                Time.valueOf(request.getNewEndTime()));

        // TODO: Send reschedule notification if request.isNotifyParticipants()

        return "Booking rescheduled successfully";
    }

    // ==================== GET USER CALENDAR ====================

    public List<CalendarEventDTO> getUserCalendar(String userId, LocalDate startDate, LocalDate endDate) {
        List<Object[]> events = scheduleRepository.findCalendarEventsForUser(
                userId,
                Date.valueOf(startDate),
                Date.valueOf(endDate));

        return events.stream().map(row -> CalendarEventDTO.builder()
                .sessionId((String) row[0])
                .scheduleId((String) row[1])
                .title((String) row[2])
                .subject((String) row[3])
                .date(row[4] != null ? ((Date) row[4]).toLocalDate() : null)
                .startTime(row[5] != null ? ((Time) row[5]).toLocalTime() : null)
                .endTime(row[6] != null ? ((Time) row[6]).toLocalTime() : null)
                .status((String) row[7])
                .bookingTypeId((String) row[8])
                .bookingTypeName((String) row[9])
                .source((String) row[10])
                .sourceId((String) row[11])
                .meetingLink((String) row[12])
                .accessLevel((String) row[13])
                .timezone((String) row[14])
                .build()).collect(Collectors.toList());
    }

    // ==================== GET BOOKING BY ID ====================

    public BookingDetailDTO getBookingById(String sessionId) {
        LiveSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Session not found"));

        List<SessionSchedule> schedules = scheduleRepository.findBySessionId(sessionId);
        SessionSchedule firstSchedule = schedules.isEmpty() ? null : schedules.get(0);

        // Get booking type name
        String bookingTypeName = null;
        String bookingTypeCode = null;
        if (session.getBookingTypeId() != null) {
            Optional<BookingType> bookingType = bookingTypeRepository.findById(session.getBookingTypeId());
            if (bookingType.isPresent()) {
                bookingTypeName = bookingType.get().getType();
                bookingTypeCode = bookingType.get().getCode();
            }
        }

        // Get participants
        List<LiveSessionParticipants> participants = participantRepository.findBySessionId(sessionId);
        List<BookingDetailDTO.ParticipantInfo> participantInfos = participants.stream()
                .map(p -> BookingDetailDTO.ParticipantInfo.builder()
                        .id(p.getId())
                        .sourceType(p.getSourceType())
                        .sourceId(p.getSourceId())
                        .build())
                .collect(Collectors.toList());

        return BookingDetailDTO.builder()
                .sessionId(session.getId())
                .title(session.getTitle())
                .subject(session.getSubject())
                .descriptionHtml(session.getDescriptionHtml())
                .status(session.getStatus())
                .accessLevel(session.getAccessLevel())
                .timezone(session.getTimezone())
                .bookingTypeId(session.getBookingTypeId())
                .bookingTypeName(bookingTypeName)
                .bookingTypeCode(bookingTypeCode)
                .source(session.getSource())
                .sourceId(session.getSourceId())
                .scheduleId(firstSchedule != null ? firstSchedule.getId() : null)
                .meetingDate(firstSchedule != null && firstSchedule.getMeetingDate() != null
                        ? ((Date) firstSchedule.getMeetingDate()).toLocalDate()
                        : null)
                .startTime(firstSchedule != null && firstSchedule.getStartTime() != null
                        ? firstSchedule.getStartTime().toLocalTime()
                        : null)
                .endTime(firstSchedule != null && firstSchedule.getLastEntryTime() != null
                        ? firstSchedule.getLastEntryTime().toLocalTime()
                        : null)
                .meetingLink(firstSchedule != null && firstSchedule.getCustomMeetingLink() != null
                        ? firstSchedule.getCustomMeetingLink()
                        : session.getDefaultMeetLink())
                .participants(participantInfos)
                .createdByUserId(session.getCreatedByUserId())
                .createdAt(session.getCreatedAt() != null ? session.getCreatedAt().toString() : null)
                .updatedAt(session.getUpdatedAt() != null ? session.getUpdatedAt().toString() : null)
                .build();
    }

    // ==================== UPDATE BOOKING STATUS ====================

    @Transactional
    public String updateBookingStatus(String sessionId, UpdateBookingStatusRequest request, CustomUserDetails user) {
        LiveSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Session not found"));

        session.setStatus(request.getStatus());
        sessionRepository.save(session);

        return "Status updated to " + request.getStatus();
    }

    // ==================== BOOKING TYPE CRUD ====================

    public BookingType createBookingType(BookingTypeDTO dto) {
        BookingType bookingType = BookingType.builder()
                .type(dto.getType())
                .code(dto.getCode())
                .description(dto.getDescription())
                .instituteId(dto.getInstituteId())
                .build();

        return bookingTypeRepository.save(bookingType);
    }

    public BookingType updateBookingType(String id, BookingTypeDTO dto) {
        BookingType bookingType = bookingTypeRepository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Booking type not found"));

        if (dto.getType() != null)
            bookingType.setType(dto.getType());
        if (dto.getCode() != null)
            bookingType.setCode(dto.getCode());
        if (dto.getDescription() != null)
            bookingType.setDescription(dto.getDescription());

        return bookingTypeRepository.save(bookingType);
    }

    public void deleteBookingType(String id) {
        if (!bookingTypeRepository.existsById(id)) {
            throw new VacademyException(HttpStatus.NOT_FOUND, "Booking type not found");
        }
        bookingTypeRepository.deleteById(id);
    }

    public Page<BookingType> getBookingTypes(String instituteId, Pageable pageable) {
        return bookingTypeRepository.findByInstituteIdOrInstituteIdIsNull(instituteId, pageable);
    }

    public Page<BookingType> getAllBookingTypes(Pageable pageable) {
        return bookingTypeRepository.findAll(pageable);
    }

    public Page<BookingType> getGlobalBookingTypes(Pageable pageable) {
        return bookingTypeRepository.findByInstituteIdIsNull(pageable);
    }

    public Page<BookingType> getInstituteBookingTypes(String instituteId, Pageable pageable) {
        return bookingTypeRepository.findByInstituteId(instituteId, pageable);
    }
}
