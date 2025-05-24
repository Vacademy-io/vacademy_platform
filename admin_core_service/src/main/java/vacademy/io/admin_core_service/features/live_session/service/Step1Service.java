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

import java.sql.Time;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
public class Step1Service {

    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    public LiveSession Step1AddService(LiveSessionStep1RequestDTO request, CustomUserDetails user) {
        LiveSession session;

        // === Fetch or Create Live Session ===
        if (request.getSessionId() != null && !request.getSessionId().isEmpty()) {
            session = sessionRepository.findById(request.getSessionId())
                    .orElseThrow(() -> new RuntimeException("Session not found with id: " + request.getSessionId()));
        } else {
            session = new LiveSession();
            session.setCreatedByUserId(user.getUserId());
            session.setStatus(LiveSessionStatus.DRAFT.name());
        }

        // === Set Basic Fields ===
        if (request.getTitle() != null) session.setTitle(request.getTitle());
        if (request.getSubject() != null) session.setSubject(request.getSubject());
        if (request.getDescriptionHtml() != null) session.setDescriptionHtml(request.getDescriptionHtml());
        if (request.getDefaultMeetLink() != null) session.setDefaultMeetLink(request.getDefaultMeetLink());
        if (request.getDefaultMeetLink() != null) session.setLinkType(getLinkTypeFromUrl(request.getDefaultMeetLink()));
        if (request.getStartTime() != null) session.setStartTime(request.getStartTime());
        if (request.getLastEntryTime() != null) session.setLastEntryTime(request.getLastEntryTime());


        session.setCreatedByUserId(user.getUserId());
        LiveSession savedSession = sessionRepository.save(session);

        // === Handle Deleted Schedules ===
        if (request.getDeletedScheduleIds() != null) {
            for (String id : request.getDeletedScheduleIds()) {
                scheduleRepository.deleteById(id);
            }
        }

        // === Handle Added Schedules ===
        if (request.getAddedSchedules() != null) {
            for (LiveSessionStep1RequestDTO.ScheduleDTO dto : request.getAddedSchedules()) {
                SessionSchedule schedule = new SessionSchedule();
                schedule.setSessionId(savedSession.getId());
                schedule.setRecurrenceType(request.getRecurrenceType());
                schedule.setRecurrenceKey(dto.getDay().toLowerCase());
                schedule.setMeetingDate(parseMeetingDate(request.getSessionEndDate())); // Optional
                schedule.setStartTime(Time.valueOf(dto.getStartTime()));
                schedule.setLastEntryTime(request.getLastEntryTime() != null ? new Time(request.getLastEntryTime().getTime()) : null);
                schedule.setCustomMeetingLink(dto.getLink() != null ? dto.getLink() : request.getDefaultMeetLink());
                schedule.setLinkType(dto.getLink() != null ? getLinkTypeFromUrl(dto.getLink()) : getLinkTypeFromUrl(request.getDefaultMeetLink()));
                schedule.setCustomWaitingRoomMediaId(null);

                scheduleRepository.save(schedule);
            }
        }

        // === Handle Updated Schedules ===
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

        return savedSession;
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

}
