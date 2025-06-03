package vacademy.io.admin_core_service.features.live_session.service;

import jakarta.persistence.EntityNotFoundException;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionByIdResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.GetSessionDetailsBySessionIdResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.NotificationQueryDTO;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleDTO;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GetSessionByIdService {

    @Autowired
    private final SessionScheduleRepository scheduleRepository;

    @Autowired
    private final ScheduleNotificationRepository notificationRepository;

    @Data
    public static class SessionDetailsResponse {
        private GetSessionByIdResponseDTO schedule;
        private GetSessionByIdResponseDTO.NotificationConfigResponse notifications;
    }

    public SessionDetailsResponse getFullSessionDetails(String sessionId) {
        GetSessionByIdResponseDTO schedule = getScheduleDetails(sessionId);
        GetSessionByIdResponseDTO.NotificationConfigResponse notifications = getNotificationDetails(sessionId);

        SessionDetailsResponse response = new SessionDetailsResponse();
        response.setSchedule(schedule);
        response.setNotifications(notifications);
        return response;
    }

    public GetSessionByIdResponseDTO getScheduleDetails(String sessionId) {
        List<ScheduleDTO> schedules = scheduleRepository.findSchedulesBySessionId(sessionId);

        if (schedules.isEmpty()) {
            return null;
        }

        ScheduleDTO first = schedules.get(0);
        List<GetSessionByIdResponseDTO.ScheduleItem> addedSchedules = new ArrayList<>();

        for (ScheduleDTO schedule : schedules) {
            GetSessionByIdResponseDTO.ScheduleItem item = new GetSessionByIdResponseDTO.ScheduleItem();
            item.setId(schedule.getScheduleId());
            item.setDay(schedule.getMeetingDate().getDayOfWeek().name().toLowerCase());
            item.setStartTime(schedule.getScheduleStartTime().toString());
            item.setDuration("2");
            item.setLink("https://jfalies.cceoij.ceoj");
            addedSchedules.add(item);
        }

        GetSessionByIdResponseDTO dto = new GetSessionByIdResponseDTO();
        dto.setSessionId(first.getSessionId());
        dto.setInstituteId("94337b5b-7687-4a1e-993f-1b3529dd6f44");
        dto.setTitle(first.getSessionTitle());
        dto.setSubject(first.getSubject());
        dto.setDescriptionHtml("<p>Let's revise the core concepts!</p>");
        dto.setDefaultMeetLink("https://meet.example.com/default-session");
        dto.setStartTime(first.getSessionStartTime());
        dto.setLastEntryTime(first.getScheduleLastEntryTime().atDate(first.getMeetingDate()));
        dto.setLinkType("default");
        dto.setLink("https://meet.example.com/default-session");
        dto.setRecurrenceType("WEEKLY");
        dto.setSessionEndDate(LocalDate.of(2025, 6, 28));
        dto.setAddedSchedules(addedSchedules);

        return dto;
    }

    public GetSessionByIdResponseDTO.NotificationConfigResponse getNotificationDetails(String sessionId) {

        List<NotificationQueryDTO> notifications = notificationRepository.findNotificationsBySessionId(sessionId);
        List<GetSessionByIdResponseDTO.NotificationAction> addedNotificationActions = new ArrayList<>();

        for (NotificationQueryDTO n : notifications) {
            GetSessionByIdResponseDTO.NotifyBy notifyBy = new GetSessionByIdResponseDTO.NotifyBy();
            notifyBy.setMail("EMAIL".equalsIgnoreCase(n.getChannel()) || "BOTH".equalsIgnoreCase(n.getChannel()));
            notifyBy.setWhatsapp("WHATSAPP".equalsIgnoreCase(n.getChannel()) || "BOTH".equalsIgnoreCase(n.getChannel()));

            GetSessionByIdResponseDTO.NotificationAction action = new GetSessionByIdResponseDTO.NotificationAction();
            action.setId(n.getNotificationId());
            action.setType(n.getType());
            action.setNotify(true);
            action.setTime(n.getTriggerTime());
            action.setNotifyBy(notifyBy);

            addedNotificationActions.add(action);
        }

        GetSessionByIdResponseDTO.NotificationConfigResponse config = new GetSessionByIdResponseDTO.NotificationConfigResponse();
        config.setSessionId(sessionId);
        config.setAccessType("private");
        config.setPackageSessionIds(List.of("29f4a84e-5fb0-40aa-ac45-1a712d3723b7"));
        config.setJoinLink("https://jifae.coejf.ceoj");
        config.setAddedNotificationActions(addedNotificationActions);

        return config;
    }

    public GetSessionDetailsBySessionIdResponseDTO getSessionByScheduleId(String scheduleId) {
        return scheduleRepository.findScheduleDetailsById(scheduleId)
                .map(p -> GetSessionDetailsBySessionIdResponseDTO.builder()
                        .sessionId(p.getSessionId())
                        .scheduleId(p.getScheduleId())
                        .instituteId(p.getInstituteId())
                        .sessionStartTime(p.getSessionStartTime())
                        .lastEntryTime(p.getLastEntryTime())
                        .accessLevel(p.getAccessLevel())
                        .meetingType(p.getMeetingType())
                        .linkType(p.getLinkType())
                        .sessionStreamingServiceType(p.getSessionStreamingServiceType())
                        .defaultMeetLink(p.getDefaultMeetLink())
                        .waitingRoomLink(p.getWaitingRoomLink())
                        .waitingRoomTime(p.getWaitingRoomTime())
                        .registrationFormLinkForPublicSessions(p.getRegistrationFormLinkForPublicSessions())
                        .createdByUserId(p.getCreatedByUserId())
                        .title(p.getTitle())
                        .descriptionHtml(p.getDescriptionHtml())
                        .notificationEmailMessage(p.getNotificationEmailMessage())
                        .attendanceEmailMessage(p.getAttendanceEmailMessage())
                        .coverFileId(p.getCoverFileId())
                        .subject(p.getSubject())
                        .thumbnailFileId(p.getThumbnailFileId())
                        .backgroundScoreFileId(p.getBackgroundScoreFileId())
                        .status(p.getStatus())
                        .recurrenceType(p.getRecurrenceType())
                        .recurrenceKey(p.getRecurrenceKey())
                        .meetingDate(p.getMeetingDate())
                        .scheduleStartTime(p.getScheduleStartTime())
                        .scheduleLastEntryTime(p.getScheduleLastEntryTime())
                        .customMeetingLink(p.getCustomMeetingLink())
                        .customWaitingRoomMediaId(p.getCustomWaitingRoomMediaId())
                        .build())
                .orElseThrow(() -> new EntityNotFoundException("Schedule not found"));
    }
}
