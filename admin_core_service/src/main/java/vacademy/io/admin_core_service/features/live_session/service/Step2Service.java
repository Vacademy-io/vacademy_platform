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
import vacademy.io.admin_core_service.features.institute_learner.dto.UserNameEmailAndMobileNumber;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.live_session.dto.LiveClassNotification;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep2RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.*;
import vacademy.io.admin_core_service.features.live_session.enums.*;
import vacademy.io.admin_core_service.features.live_session.repository.*;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

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
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private NotificationService notificationService;

    public Boolean step2AddService(LiveSessionStep2RequestDTO request, CustomUserDetails user) {
        LiveSession session = getSessionOrThrow(request.getSessionId());

        updateSessionAccessLevel(session, request);
        processNotificationActions(request, session.getId());
        linkParticipants(request);
        processCustomFields(request);
        sendLiveClassNotifications(request,session);

        session.setStatus(LiveSessionStatus.LIVE.name());
        sessionRepository.save(session);

        return true;
    }
    private void sendLiveClassNotifications(LiveSessionStep2RequestDTO request, LiveSession session) {
        List<UserNameEmailAndMobileNumber> students = new ArrayList<>();

        // PRIVATE access → fetch only batch students
        if ("PRIVATE".equalsIgnoreCase(request.getAccessType()) && request.getPackageSessionIds() != null) {
            students = studentSessionRepository.findStudentsByPackageSessionIds(request.getPackageSessionIds());
        }
        // PUBLIC access → fetch all students or handle open join link
        else if ("PUBLIC".equalsIgnoreCase(request.getAccessType())) {
            if (request.getPackageSessionIds() != null && !request.getPackageSessionIds().isEmpty()) {
                students = studentSessionRepository.findStudentsByPackageSessionIds(request.getPackageSessionIds());
            }
        }

        if (students.isEmpty()) {
            return; // No students to notify
        }

        if (request.getAddedNotificationActions() != null) {
            for (LiveSessionStep2RequestDTO.NotificationActionDTO action : request.getAddedNotificationActions()) {

                int offsetMinutes = action.getType() == NotificationTypeEnum.BEFORE_LIVE
                        ? extractMinutes(action.getTime()) : 0;

                String joinLink = session.getDefaultMeetLink();
                if ("PUBLIC".equalsIgnoreCase(request.getAccessType()) && request.getJoinLink() != null) {
                    joinLink = request.getJoinLink();
                }

                // Common placeholders
                Map<String, String> basePlaceholders = new HashMap<>();
//                basePlaceholders.put("joinLink", joinLink);

                // ------------ EMAIL NOTIFICATION ------------
                if (action.getNotifyBy() != null && action.getNotifyBy().isMail()) {
                    NotificationDTO notificationDTO = new NotificationDTO();
                    notificationDTO.setBody("Hello {{fullName}}, you have a live class: " + session.getTitle()
                            + ". Join here: {{joinLink}}");
                    notificationDTO.setSubject("Live Class Invitation");
                    notificationDTO.setSource("LIVE_SESSION");
                    notificationDTO.setNotificationType("EMAIL");
                    notificationDTO.setSourceId(session.getId());

                    List<NotificationToUserDTO> emailUsers = new ArrayList<>();
                    for (UserNameEmailAndMobileNumber student : students) {
                        NotificationToUserDTO userDTO = new NotificationToUserDTO();
                        userDTO.setUserId(null);
                        userDTO.setChannelId("tapeshchawle@gmail.com");
                        Map<String, String> placeholders = new HashMap<>(basePlaceholders);
                        placeholders.put("fullName", student.getFullName());
                        placeholders.put("joinLink", joinLink+"/"+userDTO.getUserId());
                        userDTO.setPlaceholders(placeholders);
                        emailUsers.add(userDTO);
                    }
                    notificationDTO.setUsers(emailUsers);

                    if (action.getType() == NotificationTypeEnum.ON_CREATE) {
                        notificationService.sendEmailToUsers(notificationDTO);
                    } else {
                        scheduleNotification(notificationDTO, offsetMinutes);
                    }
                }

                // ------------ WHATSAPP NOTIFICATION ------------
                if (action.getNotifyBy() != null && action.getNotifyBy().isWhatsapp()) {
                    WhatsappRequest whatsappRequest = new WhatsappRequest();
                    whatsappRequest.setTemplateName("live_class_invite"); // Your WhatsApp template name
                    whatsappRequest.setLanguageCode("en_US");
                    whatsappRequest.setHeaderType(null);
                    whatsappRequest.setHeaderParams(null);

                    List<Map<String, Map<String, String>>> bodyParams = new ArrayList<>();
                    for (UserNameEmailAndMobileNumber student : students) {
                        Map<String, String> params = new HashMap<>();
                        params.put("1", student.getFullName());
                        params.put("2", session.getTitle());
                        params.put("3", joinLink);

                        Map<String, Map<String, String>> singleUser = new HashMap<>();
                        singleUser.put("916263442911", params);
                        bodyParams.add(singleUser);
                    }
                    whatsappRequest.setUserDetails(bodyParams);

                    if (action.getType() == NotificationTypeEnum.ON_CREATE) {
                        notificationService.sendWhatsappToUsers(whatsappRequest);
                    } else {
                        scheduleWhatsappNotification(whatsappRequest, offsetMinutes);
                    }
                }
            }
        }
    }
    private void scheduleWhatsappNotification(WhatsappRequest request, int offsetMinutes) {
        // TODO: Integrate with Quartz / DB cron scheduler
        // For now, just print scheduled time
        System.out.println("Scheduled WhatsApp notification in {} minutes for template {}"+offsetMinutes+" "+request.getTemplateName());
        // Store in schedule_notifications table
    }
    private void scheduleNotification(NotificationDTO notificationDTO, int offsetMinutes) {
        // TODO: Integrate with Quartz / DB cron scheduler
        // For now, just print scheduled time
        System.out.println("Notification scheduled for " + offsetMinutes + " minutes before class.");
        // Store in schedule_notifications table

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
        // Add
        if (request.getAddedNotificationActions() != null) {
            for (LiveSessionStep2RequestDTO.NotificationActionDTO dto : request.getAddedNotificationActions()) {
                ScheduleNotification notification = mapToNotificationEntity(dto, sessionId);
                scheduleNotificationRepository.save(notification);
            }
        }

        // Update
        if (request.getUpdatedNotificationActions() != null) {
            for (LiveSessionStep2RequestDTO.NotificationActionDTO dto : request.getUpdatedNotificationActions()) {
                ScheduleNotification existing = scheduleNotificationRepository.findById(dto.getId())
                        .orElseThrow(() -> new RuntimeException("Notification not found: " + dto.getId()));
                updateNotificationEntity(existing, dto);
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

    private ScheduleNotification mapToNotificationEntity(LiveSessionStep2RequestDTO.NotificationActionDTO dto, String sessionId) {
        int offset = dto.getType() == NotificationTypeEnum.BEFORE_LIVE
                ? extractMinutes(dto.getTime()) : 0;

        return ScheduleNotification.builder()
                .id(UUID.randomUUID().toString())
                .sessionId(sessionId)
                .type(dto.getType().name())
                .status(dto.getNotify() ? NotificationStatusEnum.PENDING.name() : NotificationStatusEnum.DISABLED.name() )
                .channel(NotificationMediaTypeEnum.MAIL.name())
                .offsetMinutes(offset)
                .triggerTime(null)
                .build();
    }

    private void updateNotificationEntity(ScheduleNotification notification, LiveSessionStep2RequestDTO.NotificationActionDTO dto) {
        notification.setType(dto.getType().name());
        // TODO : change this what whatsapp service is available
        notification.setChannel(NotificationMediaTypeEnum.MAIL.name());
        notification.setStatus(dto.getNotify() ? NotificationStatusEnum.PENDING.name() : NotificationStatusEnum.DISABLED.name());
        notification.setOffsetMinutes(dto.getType() == NotificationTypeEnum.BEFORE_LIVE
                ? extractMinutes(dto.getTime()) : 0);
    }

    private void linkParticipants(LiveSessionStep2RequestDTO request) {
        if (request.getPackageSessionIds() != null) {
            for (String packageSessionId : request.getPackageSessionIds()) {
                LiveSessionParticipants participant = LiveSessionParticipants.builder()
                        .sessionId(request.getSessionId())
                        .sourceType(LiveSessionParticipantsEnum.BATCH.name())
                        .sourceId(packageSessionId)
                        .build();
                liveSessionParticipantRepository.save(participant);
            }
        }

        if (request.getDeletedPackageSessionIds() != null) {
            for (String deletedId : request.getDeletedPackageSessionIds()) {
                liveSessionParticipantRepository.deleteBySessionIdAndSourceId(
                        request.getSessionId(), deletedId);
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

                try {
                    if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
                        existing.setConfig(objectMapper.writeValueAsString(dto.getOptions()));
                    }
                } catch (JsonProcessingException e) {
                    throw new VacademyException(HttpStatus.BAD_REQUEST,"Failed to convert field options to JSON");
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
            throw new VacademyException(HttpStatus.BAD_REQUEST,"Failed to convert field options to JSON");
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
