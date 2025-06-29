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
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Service
public class Step1Service {

    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    public LiveSession step1AddService(LiveSessionStep1RequestDTO request, CustomUserDetails user) {
        LiveSession session = getOrCreateSession(request, user);
        updateSessionFields(session, request, user);
        LiveSession savedSession = sessionRepository.save(session);

        handleDeletedSchedules(request);
        handleAddedSchedules(request, savedSession);
        handleUpdatedSchedules(request);

        return savedSession;
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
        if (request.getTitle() != null) session.setTitle(request.getTitle());
        if (request.getSubject() != null) session.setSubject(request.getSubject());
        if (request.getDescriptionHtml() != null) session.setDescriptionHtml(request.getDescriptionHtml());
        if (request.getDefaultMeetLink() != null) {
            session.setDefaultMeetLink(request.getDefaultMeetLink());
            session.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
        }
        if (request.getStartTime() != null) session.setStartTime(request.getStartTime());
        if (request.getLastEntryTime() != null) session.setLastEntryTime(request.getLastEntryTime());
        if(request.getInstituteId() != null) session.setInstituteId(request.getInstituteId());
        if(request.getBackgroundScoreFileId() != null) session.setBackgroundScoreFileId(request.getBackgroundScoreFileId());
        if(request.getThumbnailFileId() != null) session.setThumbnailFileId(request.getThumbnailFileId());
        if(request.getWaitingRoomTime() != null) session.setWaitingRoomTime(request.getWaitingRoomTime());
        if(request.getLinkType() != null) session.setLinkType(request.getLinkType());
        if(request.getAllowRewind() != null) session.setAllowRewind(request.getAllowRewind());
        if(request.getSessionStreamingServiceType() != null) session.setSessionStreamingServiceType(request.getSessionStreamingServiceType());
        if(request.getJoinLink() != null) session.setRegistrationFormLinkForPublicSessions(request.getJoinLink());
        if(request.getCoverFileId() != null) session.setCoverFileId(request.getCoverFileId());
        session.setCreatedByUserId(user.getUserId());
    }

    private void handleDeletedSchedules(LiveSessionStep1RequestDTO request) {
        if (request.getDeletedScheduleIds() != null) {
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
                String dayOfWeek = dto.getDay().toUpperCase(); // e.g., "WEDNESDAY"

                // Loop through weeks to add recurring schedules on the specified day
                LocalDate current = getNextOrSameDay(startDate, dayOfWeek);
                while (!current.isAfter(endDate)) {
                    SessionSchedule schedule = new SessionSchedule();
                    schedule.setSessionId(session.getId());
                    schedule.setRecurrenceType(request.getRecurrenceType());
                    schedule.setRecurrenceKey(dayOfWeek.toLowerCase()); // for tracking like "wednesday"
                    schedule.setMeetingDate(java.sql.Date.valueOf(current));
                    schedule.setStartTime(Time.valueOf(dto.getStartTime()));
                    java.time.LocalTime parsedStartTime = java.time.LocalTime.parse(dto.getStartTime());
                    java.time.LocalTime computedLastEntryTime = parsedStartTime.plusMinutes(Long.parseLong(dto.getDuration()));

                    schedule.setLastEntryTime(Time.valueOf(computedLastEntryTime));

                    schedule.setCustomMeetingLink(dto.getLink() != null ? dto.getLink() : request.getDefaultMeetLink());
                    schedule.setLinkType(dto.getLink() != null
                            ? getLinkTypeFromUrl(dto.getLink())
                            : getLinkTypeFromUrl(request.getDefaultMeetLink()));
                    schedule.setCustomWaitingRoomMediaId(null);

                    scheduleRepository.save(schedule);

                    current = current.plusWeeks(1);
                }
            }
        }
        else {
            LocalDate meetingLocalDate = request.getStartTime().toLocalDateTime().toLocalDate();
            LocalTime startLocalTime = request.getStartTime().toLocalDateTime().toLocalTime();
            LocalTime lastEntryLocalTime = request.getLastEntryTime().toLocalDateTime().toLocalTime();

            SessionSchedule schedule = new SessionSchedule();
            schedule.setSessionId(session.getId());
            schedule.setRecurrenceType(request.getRecurrenceType());
            schedule.setMeetingDate(Date.valueOf(meetingLocalDate));
            schedule.setStartTime(Time.valueOf(startLocalTime));
            schedule.setLastEntryTime(Time.valueOf(lastEntryLocalTime));
            schedule.setCustomMeetingLink(request.getDefaultMeetLink());
            schedule.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
            schedule.setCustomWaitingRoomMediaId(null);

            scheduleRepository.save(schedule);
        }

    }

    private void handleUpdatedSchedules(LiveSessionStep1RequestDTO request) {
        if (request.getUpdatedSchedules() != null) {
            for (LiveSessionStep1RequestDTO.ScheduleDTO dto : request.getUpdatedSchedules()) {
                SessionSchedule schedule = scheduleRepository.findById(dto.getId())
                        .orElseThrow(() -> new RuntimeException("Schedule not found with id: " + dto.getId()));

                schedule.setRecurrenceKey(dto.getDay().toLowerCase());
                schedule.setStartTime(Time.valueOf(dto.getStartTime()));
                schedule.setCustomMeetingLink(dto.getLink() != null ? dto.getLink() : request.getDefaultMeetLink());

                scheduleRepository.save(schedule);
            }
        }
    }

    private java.sql.Date parseMeetingDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) return null;
        LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_DATE);
        return java.sql.Date.valueOf(date);
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
