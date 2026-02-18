package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.enums.LinkType;
import vacademy.io.admin_core_service.features.live_session.enums.LiveSessionStatus;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Date;
import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class Step1Service {

    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    @Autowired
    private ScheduleNotificationRepository scheduleNotificationRepository;

    public LiveSession step1AddService(LiveSessionStep1RequestDTO request, CustomUserDetails user) {
        LiveSession session = getOrCreateSession(request, user);
        updateSessionFields(session, request, user);
        LiveSession savedSession = sessionRepository.save(session);

        // Handle all schedule operations intelligently
        if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
            // Update mode: handle complex scenarios
            handleScheduleUpdatesForExistingSession(request, savedSession);
        } else {
            // Create mode: use original logic
            handleDeletedSchedules(request);
            handleAddedSchedules(request, savedSession);
            handleUpdatedSchedules(request);
        }

        return savedSession;
    }

    /**
     * Comprehensive schedule update handler for existing sessions
     * Handles: end date changes, start date changes, day pattern changes, and
     * individual schedule updates
     */
    private void handleScheduleUpdatesForExistingSession(LiveSessionStep1RequestDTO request, LiveSession session) {
        // Step 1: Handle explicit deletions first
        handleDeletedSchedules(request);

        // Step 2: Get all existing schedules (excluding already deleted ones)
        List<SessionSchedule> existingSchedules = scheduleRepository.findBySessionId(session.getId());
        LocalDate today = LocalDate.now();

        // Separate past and future schedules
        List<SessionSchedule> futureSchedules = existingSchedules.stream()
                .filter(s -> toLocalDate(s.getMeetingDate()).isAfter(today))
                .toList();

        // Step 3: Handle recurrence type changes (if needed in future)
        // TODO: Handle WEEKLY <-> NONE conversion - clear all schedules and recreate
        if (shouldRecreateAllSchedules(request, session)) {
            // For now, just log - implement full recreation logic later
            System.out.println("Recurrence type change detected - full recreation needed (TODO)");
        }

        // Step 4: Process date range and day pattern changes
        if (request.getAddedSchedules() != null && !request.getAddedSchedules().isEmpty()) {
            LocalDate newStartDate = request.getStartTime()
                    .toInstant()
                    .atZone(ZoneOffset.UTC)
                    .toLocalDate();
            LocalDate newEndDate = LocalDate.parse(request.getSessionEndDate(), DateTimeFormatter.ISO_DATE);

            // Get requested days from the DTOs
            java.util.Set<String> requestedDays = request.getAddedSchedules().stream()
                    .map(dto -> dto.getDay().toUpperCase())
                    .collect(java.util.stream.Collectors.toSet());

            // Step 4a: Handle DAY PATTERN CHANGES - Delete future schedules for days no
            // longer in the request
            List<String> schedulesToDeleteForRemovedDays = futureSchedules.stream()
                    .filter(s -> s.getRecurrenceKey() != null
                            && !requestedDays.contains(s.getRecurrenceKey().toUpperCase()))
                    .map(SessionSchedule::getId)
                    .toList();

            if (!schedulesToDeleteForRemovedDays.isEmpty()) {
                System.out.println(
                        "Deleting " + schedulesToDeleteForRemovedDays.size() + " future schedules for removed days");
                scheduleNotificationRepository.disableNotificationsByScheduleIds(schedulesToDeleteForRemovedDays,
                        "DISABLED");
                scheduleRepository.deleteAllById(schedulesToDeleteForRemovedDays);
                // Remove from our working lists to prevent stale data
                futureSchedules = futureSchedules.stream()
                        .filter(s -> !schedulesToDeleteForRemovedDays.contains(s.getId()))
                        .toList();
                existingSchedules = existingSchedules.stream()
                        .filter(s -> !schedulesToDeleteForRemovedDays.contains(s.getId()))
                        .toList();
            }

            // Step 4b: Handle END DATE SHORTENING - Delete future schedules beyond new end
            // date
            List<String> schedulesToDeleteBeyondEndDate = futureSchedules.stream()
                    .filter(s -> toLocalDate(s.getMeetingDate()).isAfter(newEndDate))
                    .map(SessionSchedule::getId)
                    .toList();

            if (!schedulesToDeleteBeyondEndDate.isEmpty()) {
                System.out.println(
                        "Deleting " + schedulesToDeleteBeyondEndDate.size() + " future schedules beyond new end date");
                scheduleNotificationRepository.disableNotificationsByScheduleIds(schedulesToDeleteBeyondEndDate,
                        "DISABLED");
                scheduleRepository.deleteAllById(schedulesToDeleteBeyondEndDate);
                // Remove from our working lists to prevent stale data
                futureSchedules = futureSchedules.stream()
                        .filter(s -> !schedulesToDeleteBeyondEndDate.contains(s.getId()))
                        .toList();
                existingSchedules = existingSchedules.stream()
                        .filter(s -> !schedulesToDeleteBeyondEndDate.contains(s.getId()))
                        .toList();
            }

            // Step 4c: Handle START DATE CHANGES - Delete future schedules before new start
            // date
            List<String> schedulesToDeleteBeforeStartDate = futureSchedules.stream()
                    .filter(s -> toLocalDate(s.getMeetingDate()).isBefore(newStartDate))
                    .map(SessionSchedule::getId)
                    .toList();

            if (!schedulesToDeleteBeforeStartDate.isEmpty()) {
                System.out.println("Deleting " + schedulesToDeleteBeforeStartDate.size()
                        + " future schedules before new start date");
                scheduleNotificationRepository.disableNotificationsByScheduleIds(schedulesToDeleteBeforeStartDate,
                        "DISABLED");
                scheduleRepository.deleteAllById(schedulesToDeleteBeforeStartDate);
                // Remove from our working lists to prevent stale data
                futureSchedules = futureSchedules.stream()
                        .filter(s -> !schedulesToDeleteBeforeStartDate.contains(s.getId()))
                        .toList();
                existingSchedules = existingSchedules.stream()
                        .filter(s -> !schedulesToDeleteBeforeStartDate.contains(s.getId()))
                        .toList();
            }

            // Step 5: Process each day pattern in the request
            for (LiveSessionStep1RequestDTO.ScheduleDTO dto : request.getAddedSchedules()) {
                // If schedule has an ID and exists in DB, treat it as a single schedule update
                if (dto.getId() != null && !dto.getId().isEmpty() && scheduleRepository.existsById(dto.getId())) {
                    updateSingleSchedule(dto, request);
                    continue; // Skip pattern-based update logic for this DTO
                }

                String dayOfWeek = dto.getDay().toUpperCase();

                // Get existing schedules for this day (including past ones for reference)
                List<SessionSchedule> existingSchedulesForDay = existingSchedules.stream()
                        .filter(s -> s.getRecurrenceKey() != null && s.getRecurrenceKey().equalsIgnoreCase(dayOfWeek))
                        .sorted((a, b) -> toLocalDate(a.getMeetingDate()).compareTo(toLocalDate(b.getMeetingDate())))
                        .toList();

                // Step 5a: UPDATE existing future schedules for this day with new properties
                // (pattern-based)
                List<SessionSchedule> futureSchedulesForDay = existingSchedulesForDay.stream()
                        .filter(s -> toLocalDate(s.getMeetingDate()).isAfter(today))
                        .toList();

                for (SessionSchedule schedule : futureSchedulesForDay) {
                    updateScheduleProperties(schedule, dto, request);
                    scheduleRepository.save(schedule);
                }

                // Step 5b: CREATE new schedules for EXTENDED period
                // Find the last existing date for this day
                LocalDate lastExistingDate = existingSchedulesForDay.isEmpty()
                        ? null
                        : toLocalDate(existingSchedulesForDay.get(existingSchedulesForDay.size() - 1).getMeetingDate());

                // Determine starting point for new schedules
                LocalDate createFrom;
                if (lastExistingDate == null) {
                    // No existing schedules for this day, start from the beginning
                    createFrom = getNextOrSameDay(newStartDate, dayOfWeek);
                } else if (lastExistingDate.isBefore(newEndDate)) {
                    // Extend from last existing date
                    createFrom = lastExistingDate.plusWeeks(1);
                } else {
                    // No extension needed
                    createFrom = null;
                }

                // Create schedules for the extended period
                if (createFrom != null) {
                    LocalDate current = createFrom;
                    while (!current.isAfter(newEndDate)) {
                        // Use properties from the DTO (which should match last week's data)
                        SessionSchedule schedule = new SessionSchedule();
                        schedule.setSessionId(session.getId());
                        schedule.setRecurrenceType(request.getRecurrenceType());
                        schedule.setRecurrenceKey(dayOfWeek.toLowerCase());
                        schedule.setMeetingDate(java.sql.Date.valueOf(current));
                        schedule.setStartTime(Time.valueOf(dto.getStartTime()));
                        schedule.setThumbnailFileId(dto.getThumbnailFileId());
                        schedule.setDailyAttendance(dto.isDailyAttendance());
                        schedule.setStatus(LiveSessionStatus.LIVE.name());

                        // Calculate last entry time
                        LocalTime parsedStartTime = LocalTime.parse(dto.getStartTime());
                        LocalTime computedLastEntryTime = parsedStartTime
                                .plusMinutes(Long.parseLong(dto.getDuration()));
                        schedule.setLastEntryTime(Time.valueOf(computedLastEntryTime));

                        // Set meeting link
                        schedule.setCustomMeetingLink(
                                dto.getLink() != null ? dto.getLink() : request.getDefaultMeetLink());
                        schedule.setLinkType(dto.getLink() != null
                                ? getLinkTypeFromUrl(dto.getLink())
                                : getLinkTypeFromUrl(request.getDefaultMeetLink()));
                        schedule.setCustomWaitingRoomMediaId(null);

                        scheduleRepository.save(schedule);
                        System.out.println("Created new schedule for " + dayOfWeek + " on " + current);
                        current = current.plusWeeks(1);
                    }
                }

                // Step 5c: Handle START DATE BACKWARD EXTENSION
                // If new start date is before first existing schedule, create schedules for
                // that gap
                if (!existingSchedulesForDay.isEmpty()) {
                    LocalDate firstExistingDate = toLocalDate(existingSchedulesForDay.get(0).getMeetingDate());
                    LocalDate firstExpectedDate = getNextOrSameDay(newStartDate, dayOfWeek);

                    if (firstExpectedDate.isBefore(firstExistingDate)) {
                        LocalDate current = firstExpectedDate;
                        while (current.isBefore(firstExistingDate)) {
                            SessionSchedule schedule = new SessionSchedule();
                            schedule.setSessionId(session.getId());
                            schedule.setRecurrenceType(request.getRecurrenceType());
                            schedule.setRecurrenceKey(dayOfWeek.toLowerCase());
                            schedule.setMeetingDate(java.sql.Date.valueOf(current));
                            schedule.setStartTime(Time.valueOf(dto.getStartTime()));
                            schedule.setThumbnailFileId(dto.getThumbnailFileId());
                            schedule.setDailyAttendance(dto.isDailyAttendance());
                            schedule.setStatus(LiveSessionStatus.LIVE.name());

                            LocalTime parsedStartTime = LocalTime.parse(dto.getStartTime());
                            LocalTime computedLastEntryTime = parsedStartTime
                                    .plusMinutes(Long.parseLong(dto.getDuration()));
                            schedule.setLastEntryTime(Time.valueOf(computedLastEntryTime));

                            schedule.setCustomMeetingLink(
                                    dto.getLink() != null ? dto.getLink() : request.getDefaultMeetLink());
                            schedule.setLinkType(dto.getLink() != null
                                    ? getLinkTypeFromUrl(dto.getLink())
                                    : getLinkTypeFromUrl(request.getDefaultMeetLink()));
                            schedule.setCustomWaitingRoomMediaId(null);

                            scheduleRepository.save(schedule);
                            System.out.println(
                                    "Created new schedule for extended start date " + dayOfWeek + " on " + current);
                            current = current.plusWeeks(1);
                        }
                    }
                }
            }
        }

        // Always process updated_schedules if present (independent of added_schedules)
        handleUpdatedSchedules(request);
    }

    /**
     * Helper to update individual schedule properties from DTO
     */
    private void updateScheduleProperties(SessionSchedule schedule, LiveSessionStep1RequestDTO.ScheduleDTO dto,
            LiveSessionStep1RequestDTO request) {
        if (dto.getStartTime() != null) {
            schedule.setStartTime(Time.valueOf(dto.getStartTime()));

            if (dto.getDuration() != null) {
                LocalTime parsedStartTime = LocalTime.parse(dto.getStartTime());
                LocalTime computedLastEntryTime = parsedStartTime.plusMinutes(Long.parseLong(dto.getDuration()));
                schedule.setLastEntryTime(Time.valueOf(computedLastEntryTime));
            }
        }

        if (dto.getLink() != null) {
            schedule.setCustomMeetingLink(dto.getLink());
            schedule.setLinkType(getLinkTypeFromUrl(dto.getLink()));
        } else if (request.getDefaultMeetLink() != null) {
            schedule.setCustomMeetingLink(request.getDefaultMeetLink());
            schedule.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
        }

        if (dto.getThumbnailFileId() != null) {
            schedule.setThumbnailFileId(dto.getThumbnailFileId());
        }

        schedule.setDailyAttendance(dto.isDailyAttendance());
    }

    /**
     * Check if we need to recreate all schedules (recurrence type change)
     */
    private boolean shouldRecreateAllSchedules(LiveSessionStep1RequestDTO request, LiveSession session) {
        // TODO: Implement logic to detect WEEKLY <-> NONE conversion
        // For now, return false
        return false;
    }

    /**
     * Helper method to convert java.util.Date to LocalDate
     */
    private LocalDate toLocalDate(java.util.Date date) {
        if (date == null)
            return null;
        return date.toInstant()
                .atZone(ZoneOffset.UTC)
                .toLocalDate();
    }

    private LiveSession getOrCreateSession(LiveSessionStep1RequestDTO request, CustomUserDetails user) {
        if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
            return sessionRepository.findById(request.getSessionId())
                    .orElseThrow(() -> new RuntimeException("Session not found with id: " + request.getSessionId()));
        } else {
            LiveSession session = new LiveSession();
            session.setCreatedByUserId(user.getUserId());
            session.setStatus(LiveSessionStatus.DRAFT.name());
            return session;
        }
    }

    private void updateSessionFields(LiveSession session, LiveSessionStep1RequestDTO request, CustomUserDetails user) {
        if (request.getTitle() != null)
            session.setTitle(request.getTitle());
        if (request.getSubject() != null)
            session.setSubject(request.getSubject());
        if (request.getDescriptionHtml() != null)
            session.setDescriptionHtml(request.getDescriptionHtml());
        if (request.getDefaultMeetLink() != null) {
            session.setDefaultMeetLink(request.getDefaultMeetLink());
            session.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
        }

        if (request.getStartTime() != null)
            session.setStartTime(request.getStartTime());
        if (request.getLastEntryTime() != null)
            session.setLastEntryTime(request.getLastEntryTime());
        if (request.getInstituteId() != null)
            session.setInstituteId(request.getInstituteId());
        if (request.getBackgroundScoreFileId() != null)
            session.setBackgroundScoreFileId(request.getBackgroundScoreFileId());
        if (request.getThumbnailFileId() != null)
            session.setThumbnailFileId(request.getThumbnailFileId());
        if (request.getWaitingRoomTime() != null)
            session.setWaitingRoomTime(request.getWaitingRoomTime());
        if (request.getLinkType() != null)
            session.setLinkType(request.getLinkType());
        if (request.getAllowRewind() != null)
            session.setAllowRewind(request.getAllowRewind());
        if (request.getSessionStreamingServiceType() != null)
            session.setSessionStreamingServiceType(request.getSessionStreamingServiceType());
        if (request.getJoinLink() != null)
            session.setRegistrationFormLinkForPublicSessions(request.getJoinLink());
        if (request.getCoverFileId() != null)
            session.setCoverFileId(request.getCoverFileId());

        if (request.getBookingTypeId() != null)
            session.setBookingTypeId(request.getBookingTypeId());
        if (request.getSource() != null)
            session.setSource(request.getSource());
        if (request.getSourceId() != null)
            session.setSourceId(request.getSourceId());

        // New Field
        session.setAllowPlayPause(request.isAllowPlayPause());
        if (request.getTimeZone() != null)
            session.setTimezone(request.getTimeZone());

        session.setCreatedByUserId(user.getUserId());
    }

    private void handleDeletedSchedules(LiveSessionStep1RequestDTO request) {
        if (request.getDeletedScheduleIds() != null) {
            // First, disable all notifications for these schedule IDs
            scheduleNotificationRepository.disableNotificationsByScheduleIds(request.getDeletedScheduleIds(),
                    "DISABLED");

            // Then delete the schedules from session_schedule table
            for (String id : request.getDeletedScheduleIds()) {
                scheduleRepository.deleteById(id);
            }
        }
    }

    private void handleAddedSchedules(LiveSessionStep1RequestDTO request, LiveSession session) {
        if (request.getAddedSchedules() != null && !request.getAddedSchedules().isEmpty()) {
            LocalDate startDate = request.getStartTime()
                    .toInstant()
                    .atZone(ZoneOffset.UTC)
                    .toLocalDate();
            LocalDate endDate = LocalDate.parse(request.getSessionEndDate(), DateTimeFormatter.ISO_DATE);

            for (LiveSessionStep1RequestDTO.ScheduleDTO dto : request.getAddedSchedules()) {
                // If schedule has an ID and exists in DB, treat it as an update instead
                if (dto.getId() != null && !dto.getId().isEmpty() && scheduleRepository.existsById(dto.getId())) {
                    updateSingleSchedule(dto, request);
                    continue;
                }

                String dayOfWeek = dto.getDay().toUpperCase();

                LocalDate current = getNextOrSameDay(startDate, dayOfWeek);
                while (!current.isAfter(endDate)) {
                    SessionSchedule schedule = new SessionSchedule();
                    schedule.setSessionId(session.getId());
                    schedule.setRecurrenceType(request.getRecurrenceType());
                    schedule.setRecurrenceKey(dayOfWeek.toLowerCase());
                    schedule.setMeetingDate(java.sql.Date.valueOf(current));
                    schedule.setStartTime(Time.valueOf(dto.getStartTime()));
                    schedule.setThumbnailFileId(dto.getThumbnailFileId());
                    schedule.setDailyAttendance(dto.isDailyAttendance());

                    schedule.setStatus(LiveSessionStatus.LIVE.name());

                    LocalTime parsedStartTime = LocalTime.parse(dto.getStartTime());
                    LocalTime computedLastEntryTime = parsedStartTime.plusMinutes(Long.parseLong(dto.getDuration()));
                    schedule.setLastEntryTime(Time.valueOf(computedLastEntryTime));

                    schedule.setCustomMeetingLink(dto.getLink() != null ? dto.getLink() : request.getDefaultMeetLink());
                    schedule.setLinkType(dto.getLink() != null
                            ? getLinkTypeFromUrl(dto.getLink())
                            : getLinkTypeFromUrl(request.getDefaultMeetLink()));
                    schedule.setCustomWaitingRoomMediaId(null);

                    if (dto.getDefaultClassLink() != null) {
                        schedule.setDefaultClassLink(dto.getDefaultClassLink());
                        schedule.setDefaultClassName(dto.getDefaultClassName());
                        schedule.setDefaultClassLinkType(getLinkTypeFromUrl(dto.getDefaultClassLink()));
                    }

                    if (dto.getLearnerButtonConfig() != null) {
                        try {
                            schedule.setLearnerButtonConfig(new com.fasterxml.jackson.databind.ObjectMapper()
                                    .writeValueAsString(dto.getLearnerButtonConfig()));
                        } catch (Exception e) {
                            System.err.println("Error serializing LearnerButtonConfig: " + e.getMessage());
                        }
                    }

                    scheduleRepository.save(schedule);
                    current = current.plusWeeks(1);
                }
            }
        } else {
            LocalDate meetingLocalDate = request.getStartTime().toLocalDateTime().toLocalDate();
            LocalTime startLocalTime = request.getStartTime().toLocalDateTime().toLocalTime();
            LocalTime lastEntryLocalTime = request.getLastEntryTime().toLocalDateTime().toLocalTime();

            SessionSchedule schedule = new SessionSchedule();
            schedule.setSessionId(session.getId());
            schedule.setRecurrenceType(request.getRecurrenceType() != null ? request.getRecurrenceType() : "NONE");
            schedule.setMeetingDate(Date.valueOf(meetingLocalDate));
            schedule.setStartTime(Time.valueOf(startLocalTime));
            schedule.setLastEntryTime(Time.valueOf(lastEntryLocalTime));
            schedule.setCustomMeetingLink(request.getDefaultMeetLink());
            schedule.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
            schedule.setCustomWaitingRoomMediaId(null);
            schedule.setThumbnailFileId(request.getThumbnailFileId());
            schedule.setDailyAttendance(false); // default for single schedule
            schedule.setStatus(LiveSessionStatus.LIVE.name());

            if (request.getDefaultClassLink() != null) {
                schedule.setDefaultClassLink(request.getDefaultClassLink());
                schedule.setDefaultClassName(request.getDefaultClassName());
                schedule.setDefaultClassLinkType(getLinkTypeFromUrl(request.getDefaultClassLink()));
            }

            if (request.getLearnerButtonConfig() != null) {
                try {
                    schedule.setLearnerButtonConfig(new com.fasterxml.jackson.databind.ObjectMapper()
                            .writeValueAsString(request.getLearnerButtonConfig()));
                } catch (Exception e) {
                    System.err.println("Error serializing LearnerButtonConfig: " + e.getMessage());
                }
            }

            scheduleRepository.save(schedule);
        }
    }

    private void handleUpdatedSchedules(LiveSessionStep1RequestDTO request) {
        if (request.getUpdatedSchedules() != null) {
            for (LiveSessionStep1RequestDTO.ScheduleDTO dto : request.getUpdatedSchedules()) {
                updateSingleSchedule(dto, request);
            }
        }
    }

    private void updateSingleSchedule(LiveSessionStep1RequestDTO.ScheduleDTO dto, LiveSessionStep1RequestDTO request) {
        SessionSchedule schedule = scheduleRepository.findById(dto.getId())
                .orElseThrow(() -> new RuntimeException("Schedule not found with id: " + dto.getId()));

        // Update day
        if (dto.getDay() != null) {
            schedule.setRecurrenceKey(dto.getDay().toLowerCase());
        }

        // Update start time and calculate last entry time based on duration
        if (dto.getStartTime() != null) {
            schedule.setStartTime(Time.valueOf(dto.getStartTime()));

            if (dto.getDuration() != null) {
                LocalTime parsedStartTime = LocalTime.parse(dto.getStartTime());
                LocalTime computedLastEntryTime = parsedStartTime.plusMinutes(Long.parseLong(dto.getDuration()));
                schedule.setLastEntryTime(Time.valueOf(computedLastEntryTime));
            }
        }

        // Update meeting link and link type
        if (dto.getLink() != null) {
            schedule.setCustomMeetingLink(dto.getLink());
            schedule.setLinkType(getLinkTypeFromUrl(dto.getLink()));
        } else if (request.getDefaultMeetLink() != null) {
            schedule.setCustomMeetingLink(request.getDefaultMeetLink());
            schedule.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
        }

        // Update other fields
        if (dto.getThumbnailFileId() != null) {
            schedule.setThumbnailFileId(dto.getThumbnailFileId());
        }
        schedule.setDailyAttendance(dto.isDailyAttendance());

        if (dto.getDefaultClassLink() != null) {
            schedule.setDefaultClassLink(dto.getDefaultClassLink());
            schedule.setDefaultClassName(dto.getDefaultClassName());
            schedule.setDefaultClassLinkType(getLinkTypeFromUrl(dto.getDefaultClassLink()));
        }

        if (dto.getLearnerButtonConfig() != null) {
            try {
                schedule.setLearnerButtonConfig(new com.fasterxml.jackson.databind.ObjectMapper()
                        .writeValueAsString(dto.getLearnerButtonConfig()));
            } catch (Exception e) {
                System.err.println("Error serializing LearnerButtonConfig: " + e.getMessage());
            }
        }

        scheduleRepository.save(schedule);
    }

    public static String getLinkTypeFromUrl(String link) {
        if (link == null || link.isEmpty()) {
            return "UNKNOWN";
        }
        String lowerLink = link.toLowerCase();
        if (lowerLink.contains("youtube.com") || lowerLink.contains("youtu.be")) {
            return LinkType.YOUTUBE.name();
        } else if (lowerLink.contains("zoom.us") || lowerLink.contains("zoom.com")) {
            return LinkType.ZOOM.name();
        } else if (lowerLink.contains("meet.google.com")) {
            return LinkType.GMEET.name();
        } else {
            return LinkType.RECORDED.name();
        }
    }

    private LocalDate getNextOrSameDay(LocalDate startDate, String dayOfWeekStr) {
        java.time.DayOfWeek targetDay = java.time.DayOfWeek.valueOf(dayOfWeekStr);
        java.time.DayOfWeek startDay = startDate.getDayOfWeek();
        int daysToAdd = (targetDay.getValue() - startDay.getValue() + 7) % 7;
        return startDate.plusDays(daysToAdd);
    }
}
