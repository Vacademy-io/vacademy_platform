package vacademy.io.admin_core_service.features.live_session.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep2RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.*;
import vacademy.io.admin_core_service.features.live_session.enums.*;
import vacademy.io.admin_core_service.features.live_session.repository.*;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.UUID;
import java.util.List;

@Service
public class Step2Service {

    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    @Autowired
    private ScheduleNotificationRepository scheduleNotificationRepository;

    @Autowired
    private LiveSessionParticipantRepository liveSessionParticipantRepository;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    @Autowired
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StudentSessionInstituteGroupMappingRepository mappingRepository;

    @Autowired
    private NotificationService notificationService;

    public Boolean step2AddService(LiveSessionStep2RequestDTO request, CustomUserDetails user) {
        LiveSession session = getSessionOrThrow(request.getSessionId());

        updateSessionAccessLevel(session, request);
        processNotificationActions(request, session.getId());
        linkParticipants(request);
        processCustomFields(request);

        session.setStatus(LiveSessionStatus.LIVE.name());
        sessionRepository.save(session);

        return true;
    }

    private LiveSession getSessionOrThrow(String sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
    }

    private void updateSessionAccessLevel(LiveSession session, LiveSessionStep2RequestDTO request) {
        session.setAccessLevel(request.getAccessType());
        if (LiveSessionAccessEnum.PUBLIC.name().equalsIgnoreCase(request.getAccessType())) {
            session.setRegistrationFormLinkForPublicSessions(request.getJoinLink());
        }
    }

    private void processNotificationActions(LiveSessionStep2RequestDTO request, String sessionId) {
        // Fetch all schedules for the session
        List<SessionSchedule> schedules = scheduleRepository.findBySessionId(sessionId);

        // Add
        if (request.getAddedNotificationActions() != null && schedules != null) {
            System.out.println("DEBUG: Found " + schedules.size() + " schedules for session " + sessionId);
            for (LiveSessionStep2RequestDTO.NotificationActionDTO dto : request.getAddedNotificationActions()) {
                for (SessionSchedule schedule : schedules) {
                    ScheduleNotification notification = mapToNotificationEntity(dto, sessionId);
                    notification.setTriggerTime(computeTriggerTime(dto, schedule));
                    notification.setScheduleId(schedule.getId());
                    scheduleNotificationRepository.save(notification);
                }
            }
        }

        // Update only metadata; do not change schedule linkage here
        if (request.getUpdatedNotificationActions() != null) {
            for (LiveSessionStep2RequestDTO.NotificationActionDTO dto : request.getUpdatedNotificationActions()) {
                ScheduleNotification existing = scheduleNotificationRepository.findById(dto.getId())
                        .orElseThrow(() -> new RuntimeException("Notification not found: " + dto.getId()));
                updateNotificationEntity(existing, dto);
                // recompute triggerTime requires schedule context; skip here to avoid mismatch
                scheduleNotificationRepository.save(existing);
            }
        }

        // Delete
        if (request.getDeletedNotificationActionIds() != null) {
            for (String id : request.getDeletedNotificationActionIds()) {
                scheduleNotificationRepository.deleteById(id);
            }
        }
    }

    private ScheduleNotification mapToNotificationEntity(LiveSessionStep2RequestDTO.NotificationActionDTO dto,
            String sessionId) {
        int offset = dto.getType() == NotificationTypeEnum.BEFORE_LIVE
                ? extractMinutes(dto.getTime())
                : 0;

        return ScheduleNotification.builder()
                .id(UUID.randomUUID().toString())
                .sessionId(sessionId)
                .type(dto.getType().name())
                .status(dto.getNotify() ? NotificationStatusEnum.PENDING.name()
                        : NotificationStatusEnum.DISABLED.name())
                .channel(NotificationMediaTypeEnum.MAIL.name())
                .offsetMinutes(offset)
                .triggerTime(null)
                .build();
    }

    private java.time.LocalDateTime computeTriggerTime(LiveSessionStep2RequestDTO.NotificationActionDTO dto, SessionSchedule schedule) {
        java.time.LocalDate meetingLocalDate = schedule.getMeetingDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate();
        java.time.LocalTime startLocalTime = schedule.getStartTime().toLocalTime();
        java.time.LocalTime lastEntryLocalTime = schedule.getLastEntryTime() != null ? schedule.getLastEntryTime().toLocalTime() : null;

        java.time.LocalDateTime startDateTime = java.time.LocalDateTime.of(meetingLocalDate, startLocalTime);
        if (dto.getType() == NotificationTypeEnum.BEFORE_LIVE) {
            int minutes = extractMinutes(dto.getTime());
            return startDateTime.minusMinutes(minutes);
        } else if (dto.getType() == NotificationTypeEnum.ON_LIVE) {
            return startDateTime;
        } else if (dto.getType() == NotificationTypeEnum.POST) {
            if (lastEntryLocalTime != null) {
                return java.time.LocalDateTime.of(meetingLocalDate, lastEntryLocalTime);
            }
            return startDateTime; // fallback
        } else if (dto.getType() == NotificationTypeEnum.ON_CREATE) {
            return java.time.LocalDateTime.now();
        }
        return null;
    }

    private void updateNotificationEntity(ScheduleNotification notification,
            LiveSessionStep2RequestDTO.NotificationActionDTO dto) {
        notification.setType(dto.getType().name());
        // TODO : change this what whatsapp service is available
        notification.setChannel(NotificationMediaTypeEnum.MAIL.name());
        notification.setStatus(
                dto.getNotify() ? NotificationStatusEnum.PENDING.name() : NotificationStatusEnum.DISABLED.name());
        notification.setOffsetMinutes(dto.getType() == NotificationTypeEnum.BEFORE_LIVE
                ? extractMinutes(dto.getTime())
                : 0);
    }
    // TODO : for later
    // private String resolveChannel(LiveSessionStep2RequestDTO.NotifyBy notifyBy) {
    // if (notifyBy.isMail()) return NotificationMediaTypeEnum.MAIL.name();
    // if (notifyBy.isWhatsapp()) return NotificationMediaTypeEnum.WHATSAPP.name();
    // return NotificationMediaTypeEnum.MAIL.name();
    // }

    private void linkParticipants(LiveSessionStep2RequestDTO request) {
        // Handle batch participants (existing functionality)
        if (request.getPackageSessionIds() != null) {
            for (String packageSessionId : request.getPackageSessionIds()) {
                // Check if participant already exists to prevent duplicates
                if (!liveSessionParticipantRepository.existsBySessionIdAndSourceTypeAndSourceId(
                        request.getSessionId(), 
                        LiveSessionParticipantsEnum.BATCH.name(), 
                        packageSessionId)) {
                    
                    LiveSessionParticipants participant = LiveSessionParticipants.builder()
                            .sessionId(request.getSessionId())
                            .sourceType(LiveSessionParticipantsEnum.BATCH.name())
                            .sourceId(packageSessionId)
                            .build();
                    liveSessionParticipantRepository.save(participant);
                }
            }
        }

        if (request.getDeletedPackageSessionIds() != null) {
            for (String deletedId : request.getDeletedPackageSessionIds()) {
                liveSessionParticipantRepository.deleteBySessionIdAndSourceId(
                        request.getSessionId(), deletedId);
            }
        }

        // Handle individual user participants (new functionality)
        if (request.getIndividualUserIds() != null) {
            for (String userId : request.getIndividualUserIds()) {
                // Check if participant already exists to prevent duplicates
                if (!liveSessionParticipantRepository.existsBySessionIdAndSourceTypeAndSourceId(
                        request.getSessionId(), 
                        LiveSessionParticipantsEnum.USER.name(), 
                        userId)) {
                    
                    LiveSessionParticipants participant = LiveSessionParticipants.builder()
                            .sessionId(request.getSessionId())
                            .sourceType(LiveSessionParticipantsEnum.USER.name())
                            .sourceId(userId)
                            .build();
                    liveSessionParticipantRepository.save(participant);
                }
            }
        }

        if (request.getDeletedIndividualUserIds() != null) {
            for (String deletedUserId : request.getDeletedIndividualUserIds()) {
                liveSessionParticipantRepository.deleteBySessionIdAndSourceId(
                        request.getSessionId(), deletedUserId);
            }
        }
    }

    private void processCustomFields(LiveSessionStep2RequestDTO request) {
        int index = 0;

        // Add
        if (request.getAddedFields() != null) {
            for (LiveSessionStep2RequestDTO.CustomFieldDTO dto : request.getAddedFields()) {
                saveNewCustomField(dto, request.getSessionId(), index++);
            }
        }

        // Update
        if (request.getUpdatedFields() != null) {
            for (LiveSessionStep2RequestDTO.CustomFieldDTO dto : request.getUpdatedFields()) {
                CustomFields existing = customFieldRepository.findById(dto.getId())
                        .orElseThrow(() -> new RuntimeException("Custom field not found: " + dto.getId()));

                existing.setFieldName(dto.getLabel());
                existing.setFieldKey(dto.getLabel().toLowerCase().replaceAll("\\s+", "_"));
                existing.setFieldType(dto.getType());
                existing.setIsMandatory(dto.isRequired());
                existing.setIsHidden(false); // Default to false for existing fields

                try {
                    if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
                        existing.setConfig(objectMapper.writeValueAsString(dto.getOptions()));
                    }
                } catch (JsonProcessingException e) {
                    throw new VacademyException(HttpStatus.BAD_REQUEST, "Failed to convert field options to JSON");
                }

                customFieldRepository.save(existing);
            }
        }

        // Delete
        if (request.getDeletedFieldIds() != null) {
            for (String id : request.getDeletedFieldIds()) {
                customFieldRepository.deleteById(id);
                instituteCustomFieldRepository.deleteByCustomFieldId(id);
            }
        }
    }

    private void saveNewCustomField(LiveSessionStep2RequestDTO.CustomFieldDTO dto, String sessionId, int index) {
        String fieldKey = dto.getLabel().toLowerCase().replaceAll("\\s+", "_");
        String configJson = "{}";
        try {
            if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
                configJson = objectMapper.writeValueAsString(dto.getOptions());
            }
        } catch (JsonProcessingException e) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Failed to convert field options to JSON");
        }

        CustomFields field = CustomFields.builder()
                .id(UUID.randomUUID().toString())
                .fieldKey(fieldKey)
                .fieldName(dto.getLabel())
                .fieldType(dto.getType())
                .defaultValue(null)
                .config(configJson)
                .formOrder(index)
                .isMandatory(dto.isRequired())
                .isFilter(false)
                .isSortable(false)
                .isHidden(false)
                .build();

        CustomFields savedField = customFieldRepository.save(field);

        InstituteCustomField mapping = InstituteCustomField.builder()
                .id(UUID.randomUUID().toString())
                .instituteId("") // set actual institute ID if needed
                .customFieldId(savedField.getId())
                .type("SESSION")
                .typeId(sessionId)
                .build();

        instituteCustomFieldRepository.save(mapping);
    }

    private int extractMinutes(String time) {
        try {
            return Integer.parseInt(time.replaceAll("[^\\d]", ""));
        } catch (Exception e) {
            return 0;
        }
    }
}
