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
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;
import vacademy.io.admin_core_service.features.live_session.repository.*;

import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GetSessionByIdService {

    @Autowired
    private final SessionScheduleRepository scheduleRepository;

    @Autowired
    private final ScheduleNotificationRepository notificationRepository;

    @Autowired
    private final SessionGuestRegistrationRepository sessionGuestRegistrationRepository;
    @Autowired
    private final LiveSessionParticipantRepository liveSessionParticipantRepository;
    @Autowired
    private final CustomFieldRepository customFieldRepository;

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
        List<LiveSessionParticipants> participants = liveSessionParticipantRepository.findBySessionId(sessionId);

        List<GetSessionByIdResponseDTO.ScheduleItem> addedSchedules = new ArrayList<>();
        ScheduleDTO first = null;
        ScheduleDTO last = null;

        if (!schedules.isEmpty()) {
            first = schedules.get(0);
            last = schedules.get(schedules.size() - 1);

            for (ScheduleDTO schedule : schedules) {
                GetSessionByIdResponseDTO.ScheduleItem item = new GetSessionByIdResponseDTO.ScheduleItem();
                LocalTime startTime = schedule.getScheduleStartTime();
                LocalTime lastEntryTime = schedule.getScheduleLastEntryTime();

                long durationMinutes = Duration.between(startTime, lastEntryTime).toMinutes();
                long durationHours = Duration.between(startTime, lastEntryTime).toHours();

                item.setId(schedule.getScheduleId());
                item.setDay(schedule.getMeetingDate().getDayOfWeek().name().toLowerCase());
                item.setStartTime(schedule.getScheduleStartTime().toString());
                item.setDuration(String.valueOf(durationHours)); // or durationMinutes if preferred
                item.setLink(schedule.getCustomMeetingLink());
                addedSchedules.add(item);
            }
        }

        List<String> packageSessionIds = new ArrayList<>();
        for (LiveSessionParticipants participant : participants) {
            if ("BATCH".equals(participant.getSourceType())) {
                packageSessionIds.add(participant.getSourceId());
            }
        }

        GetSessionByIdResponseDTO dto = new GetSessionByIdResponseDTO();

        if (first != null) {
            dto.setSessionId(first.getSessionId());
            dto.setInstituteId(first.getInstituteId());
            dto.setTitle(first.getSessionTitle());
            dto.setSubject(first.getSubject());
            dto.setDescriptionHtml(first.getDescriptionHtml());
            dto.setDefaultMeetLink(first.getDefaultMeetLink());
            dto.setStartTime(first.getSessionStartTime());
            dto.setLastEntryTime(first.getScheduleLastEntryTime().atDate(first.getMeetingDate()));
            dto.setLinkType(first.getLinkType());
            dto.setJoinLink(first.getRegistrationFormLinkForPublicSessions());
            dto.setRecurrenceType(first.getRecurrenceType());
            dto.setAccessType(first.getAccessLevel());
        }

        if (last != null) {
            dto.setSessionEndDate(last.getMeetingDate());
        }

        dto.setAddedSchedules(addedSchedules);
        dto.setPackageSessionIds(packageSessionIds);

        return dto;
    }


    public GetSessionByIdResponseDTO.NotificationConfigResponse getNotificationDetails(String sessionId) {

        List<NotificationQueryDTO> notifications = notificationRepository.findNotificationsBySessionId(sessionId);
        List<CustomFieldRepository.FlatFieldProjection> flatList =
                customFieldRepository.getSessionCustomFieldsBySessionId(sessionId);
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

        List<GetSessionByIdResponseDTO.Field> fields = new ArrayList<>();

        for(CustomFieldRepository.FlatFieldProjection item : flatList){
            GetSessionByIdResponseDTO.Field field = new GetSessionByIdResponseDTO.Field();
            field.setId(item.getCustomFieldId());
            field.setLabel(item.getFieldName());
            field.setRequired(item.getIsMandatory());
            field.setType(item.getFieldType());
            fields.add(field);
        }

        GetSessionByIdResponseDTO.NotificationConfigResponse config = new GetSessionByIdResponseDTO.NotificationConfigResponse();
        config.setAddedNotificationActions(addedNotificationActions);
        config.setAddedFields(fields);

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

    public GetSessionDetailsBySessionIdResponseDTO getSessionByScheduleIdForGuestUser(String scheduleId) {

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

    public String findEarliestSchedule(String sessionId){
        return scheduleRepository.findEarliestScheduleIdBySessionId(sessionId);
    }
}
