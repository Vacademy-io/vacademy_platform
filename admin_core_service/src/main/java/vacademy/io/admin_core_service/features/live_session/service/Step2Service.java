package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep2RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;
import vacademy.io.admin_core_service.features.live_session.entity.ScheduleNotification;
import vacademy.io.admin_core_service.features.live_session.enums.*;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

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

    public Boolean Step2AddService(LiveSessionStep2RequestDTO request, CustomUserDetails user) {
        LiveSession session = sessionRepository.findById(UUID.fromString(request.getSessionId()))
                .orElseThrow(() -> new RuntimeException("Session not found"));

        session.setAccessLevel(request.getAccessType());
        if ("public".equalsIgnoreCase(request.getAccessType())) {
            session.setRegistrationFormLinkForPublicSessions(request.getJoinLink());
        }

        session.setUpdatedAt(Timestamp.from(Instant.now()));


        Timestamp now = Timestamp.from(Instant.now());
        UUID sessionId = UUID.fromString(request.getSessionId());
        // TODO : inable whatsapp notification
        //String channel = getChannel(request.getNotifySettings().getNotifyBy());
        String channel = NotificationMediaTypeEnum.MAIL.name();
        // 2. Create Notifications (for each schedule under this session)


        if (request.getNotifySettings().isBeforeLive() && request.getNotifySettings().getBeforeLiveTime() != null) {
            for (LiveSessionStep2RequestDTO.NotifySettings.BeforeLiveTime entry : request.getNotifySettings().getBeforeLiveTime()) {
                int offset = extractMinutes(entry.getTime());

                ScheduleNotification notification = ScheduleNotification.builder()
                        .sessionId(sessionId)
                        .type(NotificationTypeEnum.PRE.name())
                        .status(NotificationStatusEnum.PENDING.name())
                        .channel(channel)
                        .offsetMinutes(offset)
                        .triggerTime(null) // Can be calculated if needed
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();

                scheduleNotificationRepository.save(notification);
            }
        }

        // On-Live Notification
        if (request.getNotifySettings().isOnLive()) {
            ScheduleNotification onLiveNotification = ScheduleNotification.builder()
                    .sessionId(sessionId)
                    .type(NotificationTypeEnum.ON_LIVE.name())
                    .status(NotificationStatusEnum.PENDING.name())
                    .channel(channel)
                    .offsetMinutes(0)
                    .triggerTime(null)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            scheduleNotificationRepository.save(onLiveNotification);
        }

        // On-Create Notification
        // TODO : changes needed when notification scheduler will be created
        if (request.getNotifySettings().isOnCreate()) {
            ScheduleNotification createNotification = ScheduleNotification.builder()
                    .sessionId(sessionId)
                    .type(NotificationTypeEnum.ON_CREATION.name())
                    .status(NotificationStatusEnum.PENDING.name())
                    .channel(channel)
                    .offsetMinutes(0)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    //.triggerTime(Instant.now())
                    .build();

            scheduleNotificationRepository.save(createNotification);
        }

        ScheduleNotification createNotification = ScheduleNotification.builder()
                .sessionId(sessionId)
                .type(NotificationTypeEnum.ATTENDANCE.name())
                .status(NotificationStatusEnum.PENDING.name())
                .channel(channel)
                .offsetMinutes(15)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                //.triggerTime(Instant.now())
                .build();

        scheduleNotificationRepository.save(createNotification);


        //linkin batches with the session ids by inserting into live session participants table
        for (String packageSessionId : request.getPackageSessionIds()) {
            LiveSessionParticipants participant = LiveSessionParticipants.builder()
                    .sessionId(UUID.fromString(request.getSessionId()))
                    .sourceType(LiveSessionParticipantsEnum.BATCH.name())
                    .sourceId(UUID.fromString(packageSessionId))
                    .build();
            liveSessionParticipantRepository.save(participant);
        }

        // make the session live
        session.setStatus(LiveSessionStatus.LIVE.name());
        sessionRepository.save(session);
        return true;
    }

    private int extractMinutes(String time) {
        try {
            return Integer.parseInt(time.replaceAll("[^\\d]", ""));
        } catch (Exception e) {
            return 0;
        }
    }

    // TODO : when whatsapp functionality is available
    private String getChannel(LiveSessionStep2RequestDTO.NotifyBy notifyBy) {
        if (notifyBy.isMail() && notifyBy.isWhatsapp()) return "email,whatsapp";
        if (notifyBy.isMail()) return "email";
        if (notifyBy.isWhatsapp()) return "whatsapp";
        return "none";
    }
}



