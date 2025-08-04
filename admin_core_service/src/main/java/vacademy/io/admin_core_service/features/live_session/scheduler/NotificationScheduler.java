package vacademy.io.admin_core_service.features.live_session.scheduler;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.UserNameEmailAndMobileNumber;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.live_session.dto.NotificationQueryDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.util.*;

@Service
public class NotificationScheduler{

    @Autowired
    private ScheduleNotificationRepository scheduleNotificationRepository;
    @Autowired
    private LiveSessionRepository liveSessionRepository;
    @Autowired
    private StudentSessionRepository studentSessionRepository;
    @Autowired
    private NotificationService notificationService;

    @Scheduled(fixedRate = 60000) // every 1 min
    public void sendScheduledNotifications() {
        List<NotificationQueryDTO> pending =
                scheduleNotificationRepository.findDueNotifications();

        for (NotificationQueryDTO notif : pending) {
            LiveSession session = liveSessionRepository.findById(notif.getSessionId()).orElse(null);
            if (session == null) continue;

            // Get students for this session
            List<UserNameEmailAndMobileNumber> students =
                    studentSessionRepository.findStudentsByPackageSessionIds(
                            Collections.singletonList(session.getId())
                    );

            NotificationDTO dto = new NotificationDTO();
            dto.setBody(notif.getMessage());
            dto.setNotificationType(notif.getChannel()); // EMAIL / WHATSAPP
            dto.setSubject("Live Class Reminder");
            dto.setSource("LIVE_SESSION");
            dto.setSourceId(session.getId());

            List<NotificationToUserDTO> users = new ArrayList<>();
            for (UserNameEmailAndMobileNumber s : students) {
                NotificationToUserDTO u = new NotificationToUserDTO();
                u.setChannelId(notif.getChannel().equals("MAIL") ? s.getEmail() : s.getMobileNumber());
                Map<String, String> placeholders = new HashMap<>();
                placeholders.put("fullName", s.getFullName());
                placeholders.put("joinLink", session.getDefaultMeetLink());
                placeholders.put("title", session.getTitle());
                u.setPlaceholders(placeholders);
                users.add(u);
            }
            dto.setUsers(users);

            notificationService.sendEmailToUsers(dto);

            scheduleNotificationRepository.updateStatusToSent(notif.getNotificationId());
        }
    }
}
