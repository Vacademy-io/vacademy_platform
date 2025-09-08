package vacademy.io.admin_core_service.features.live_session.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.live_session.constants.LiveClassEmailBody;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.ScheduleNotification;
import vacademy.io.admin_core_service.features.live_session.enums.NotificationStatusEnum;
import vacademy.io.admin_core_service.features.live_session.enums.NotificationTypeEnum;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.live_session.repository.ScheduleNotificationRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
@RequiredArgsConstructor
public class LiveSessionNotificationProcessor {

    private final ScheduleNotificationRepository scheduleNotificationRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final LiveSessionParticipantRepository liveSessionParticipantRepository;
    private final SessionScheduleRepository sessionScheduleRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper; // kept for future template rendering

    @Transactional
    public void processDueNotifications() {
        // Use Asia/Kolkata timezone (IST - UTC+5:30)
        ZoneId kolkataZone = ZoneId.of("Asia/Kolkata");
        LocalDateTime now = LocalDateTime.now(kolkataZone);
        LocalDateTime windowEnd = now.plusMinutes(15);
        System.out.println("current time (Asia/Kolkata): " + now);

        // 1) Mark past-due PENDING notifications as EXPIRED (no send)
        List<ScheduleNotification> pastDue = scheduleNotificationRepository.findPastDue(now.minusMinutes(2));
        for (ScheduleNotification sn : pastDue) {
            sn.setStatus(NotificationStatusEnum.DISABLED.name()); // or EXPIRED if you add enum
            scheduleNotificationRepository.save(sn);
        }

        // 2) Send only those strictly within [now, now+15m]
        List<ScheduleNotification> due = scheduleNotificationRepository.findPendingBetween(now.minusMinutes(2), windowEnd);
        if (due.isEmpty()) return;

        for (ScheduleNotification sn : due) {
            try {
                Optional<LiveSession> sessionOpt = liveSessionRepository.findById(sn.getSessionId());
                if (sessionOpt.isEmpty()) {
                    sn.setStatus(NotificationStatusEnum.DISABLED.name());
                    scheduleNotificationRepository.save(sn);
                    continue;
                }
                LiveSession session = sessionOpt.get();

                // Get all participants (both BATCH and USER types)
                List<LiveSessionParticipants> participants = liveSessionParticipantRepository.findBySessionId(sn.getSessionId());
                if (participants == null || participants.isEmpty()) {
                    sn.setStatus(NotificationStatusEnum.SENT.name());
                    scheduleNotificationRepository.save(sn);
                    continue;
                }

                // Fetch schedule details for email template
                Optional<SessionSchedule> scheduleOpt = sessionScheduleRepository.findById(sn.getScheduleId());
                SessionSchedule schedule = scheduleOpt.orElse(null);
                
                // Fetch students from both batch and individual user participants
                List<Object[]> rows = getStudentsForNotification(participants, session.getInstituteId());

                if (!rows.isEmpty()) {

                    if (sn.getType().equals(NotificationTypeEnum.BEFORE_LIVE.name())) {
                        NotificationDTO notification = buildBeforeLiveEmailNotification(session, sn, schedule, rows);
                        notificationService.sendEmailToUsers(notification, session.getInstituteId());
                    }
                        if (sn.getType().equals(NotificationTypeEnum.ON_LIVE.name())) {
                            NotificationDTO notification = buildOnLiveEmailNotification(session, sn, schedule, rows);
                            notificationService.sendEmailToUsers(notification, session.getInstituteId());
                        }
                }

                sn.setStatus(NotificationStatusEnum.SENT.name());
                scheduleNotificationRepository.save(sn);
            } catch (Exception ex) {
                // Skip failure tracking per requirements; keep PENDING to retry next run
                System.out.println("Skip failure tracking per requirements; keep PENDING to retry next run"+ex);
            }
        }
    }

    private List<String> getBatchIdsForSession(String sessionId) {
        List<LiveSessionParticipants> participants = liveSessionParticipantRepository.findBySessionId(sessionId);
        if (participants == null || participants.isEmpty()) return Collections.emptyList();
        Set<String> batchIds = new HashSet<>();
        for (LiveSessionParticipants p : participants) {
            if ("BATCH".equalsIgnoreCase(p.getSourceType())) {
                batchIds.add(p.getSourceId());
            }
        }
        return new ArrayList<>(batchIds);
    }

    private List<Object[]> getStudentsForNotification(List<LiveSessionParticipants> participants, String instituteId) {
        List<Object[]> allStudents = new ArrayList<>();
        
        // Separate batch and individual user participants
        List<String> batchIds = new ArrayList<>();
        List<String> individualUserIds = new ArrayList<>();
        
        for (LiveSessionParticipants p : participants) {
            if ("BATCH".equalsIgnoreCase(p.getSourceType())) {
                batchIds.add(p.getSourceId());
            } else if ("USER".equalsIgnoreCase(p.getSourceType())) {
                individualUserIds.add(p.getSourceId());
            }
        }
        
        // Fetch students from batch participants (existing functionality)
        if (!batchIds.isEmpty()) {
            List<Object[]> batchStudents = mappingRepository.findMappingsWithStudentContactsByInstitute(
                    batchIds,
                    instituteId,
                    Arrays.asList("ACTIVE", "ENROLLED")
            );
            allStudents.addAll(batchStudents);
        }
        
        // Fetch individual users directly
        if (!individualUserIds.isEmpty()) {
            List<Object[]> individualStudents = mappingRepository.findStudentContactsByUserIds(individualUserIds);
            allStudents.addAll(individualStudents);
        }
        
        return allStudents;
    }

    private NotificationDTO buildOnLiveEmailNotification(LiveSession session, ScheduleNotification sn, SessionSchedule schedule, List<Object[]> rows) {
        NotificationDTO dto = new NotificationDTO();
        dto.setBody(LiveClassEmailBody.Live_Class_Email_Body);
        dto.setSubject("Your Live Session has started – Join now!");
        dto.setNotificationType("EMAIL");
        dto.setSource("ADMIN_CORE");
        dto.setSourceId(session.getId());

        List<NotificationToUserDTO> users = new ArrayList<>();
        for (Object[] r : rows) {
            // Handle different data structures from batch vs individual user queries
            String userId, fullName, email;
            
            if (r.length >= 6) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add schedule details if available
            if (schedule != null) {
                String meetingLink = schedule.getCustomMeetingLink() != null ?
                    schedule.getCustomMeetingLink() : session.getDefaultMeetLink();
                System.out.println("DEBUG: Final meeting link: " + meetingLink);
                placeholders.put("LINK", meetingLink != null ? meetingLink : "#");

                // Format date and time
                if (schedule.getMeetingDate() != null && schedule.getStartTime() != null) {
                    // format date
                    String date = new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate());

                    // format time in 12-hour with AM/PM
                    String time = new SimpleDateFormat("h:mm a").format(schedule.getStartTime());

                    placeholders.put("DATE", date);
                    placeholders.put("TIME", time);
                }
                else {
                    placeholders.put("TIME", "TBD");
                }
            } else {
                placeholders.put("LINK", "#");
                placeholders.put("TIME", "TBD");
            }

            u.setPlaceholders(placeholders);
            u.setUserId(userId);
            u.setChannelId(email);
            users.add(u);
        }
        dto.setUsers(users);
        return dto;
    }
    private NotificationDTO buildBeforeLiveEmailNotification(LiveSession session, ScheduleNotification sn, SessionSchedule schedule, List<Object[]> rows) {
        NotificationDTO dto = new NotificationDTO();
        dto.setBody(LiveClassEmailBody.Live_Class_Email_Body);
        dto.setSubject("Get Ready! Your session begins shortly.");
        dto.setNotificationType("EMAIL");
        dto.setSource("ADMIN_CORE");
        dto.setSourceId(session.getId());

        List<NotificationToUserDTO> users = new ArrayList<>();
        for (Object[] r : rows) {
            // Handle different data structures from batch vs individual user queries
            String userId, fullName, email;
            
            if (r.length >= 6) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add schedule details if available
            if (schedule != null) {
                String meetingLink = schedule.getCustomMeetingLink() != null ?
                        schedule.getCustomMeetingLink() : session.getDefaultMeetLink();
                System.out.println("DEBUG: Final meeting link: " + meetingLink);
                placeholders.put("LINK", meetingLink != null ? meetingLink : "#");

                // Format date and time
                if (schedule.getMeetingDate() != null && schedule.getStartTime() != null) {
                    // format date
                    String date = new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate());

                    // format time in 12-hour with AM/PM
                    String time = new SimpleDateFormat("h:mm a").format(schedule.getStartTime());

                    placeholders.put("DATE", date);
                    placeholders.put("TIME", time);
                }
                else {
                    placeholders.put("TIME", "TBD");
                }
            } else {
                placeholders.put("LINK", "#");
                placeholders.put("TIME", "TBD");
            }

            u.setPlaceholders(placeholders);
            u.setUserId(userId);
            u.setChannelId(email);
            users.add(u);
        }
        dto.setUsers(users);
        return dto;
    }


    @Transactional
    public void sendDeleteNotification(String sessionId, String instituteId) {
        try {
            // Get session details before deletion
            Optional<LiveSession> sessionOpt = liveSessionRepository.findById(sessionId);
            if (sessionOpt.isEmpty()) {
                System.out.println("Session not found for delete notification: " + sessionId);
                return;
            }
            LiveSession session = sessionOpt.get();

            // Get all participants (both BATCH and USER types)
            List<LiveSessionParticipants> participants = liveSessionParticipantRepository.findBySessionId(sessionId);
            if (participants == null || participants.isEmpty()) {
                System.out.println("No participants found for session: " + sessionId);
                return;
            }

            // Get the most recent schedule for date/time information
            List<SessionSchedule> schedules = sessionScheduleRepository.findBySessionId(sessionId);
            SessionSchedule schedule = schedules.isEmpty() ? null : schedules.get(0);

            // Fetch students from both batch and individual user participants
            List<Object[]> rows = getStudentsForNotification(participants, instituteId);

            if (!rows.isEmpty()) {
                NotificationDTO notification = buildDeleteEmailNotification(session, schedule, rows);
                notificationService.sendEmailToUsers(notification, instituteId);
                System.out.println("Delete notification sent for session: " + sessionId + " to " + rows.size() + " participants");
            }
        } catch (Exception ex) {
            System.out.println("Error sending delete notification for session " + sessionId + ": " + ex.getMessage());
            // Don't rethrow - we don't want to prevent deletion if notification fails
        }
    }

    @Transactional
    public void sendDeleteNotificationForSchedules(List<String> scheduleIds, String instituteId) {
        for (String scheduleId : scheduleIds) {
            try {
                // Get session ID from schedule
                String sessionId = sessionScheduleRepository.findSessionIdByScheduleId(scheduleId, NotificationStatusEnum.DELETED.name());
                if (sessionId == null) {
                    System.out.println("Session ID not found for schedule: " + scheduleId);
                    continue;
                }

                // Get session details
                Optional<LiveSession> sessionOpt = liveSessionRepository.findById(sessionId);
                if (sessionOpt.isEmpty()) {
                    System.out.println("Session not found for schedule delete notification: " + sessionId);
                    continue;
                }
                LiveSession session = sessionOpt.get();

                // Get participants
                List<LiveSessionParticipants> participants = liveSessionParticipantRepository.findBySessionId(sessionId);
                if (participants == null || participants.isEmpty()) {
                    System.out.println("No participants found for session: " + sessionId);
                    continue;
                }

                // Get the specific schedule being deleted
                Optional<SessionSchedule> scheduleOpt = sessionScheduleRepository.findById(scheduleId);
                SessionSchedule schedule = scheduleOpt.orElse(null);

                // Fetch students
                List<Object[]> rows = getStudentsForNotification(participants, instituteId);

                if (!rows.isEmpty()) {
                    NotificationDTO notification = buildDeleteEmailNotification(session, schedule, rows);
                    notificationService.sendEmailToUsers(notification, instituteId);
                    System.out.println("Delete notification sent for schedule: " + scheduleId + " to " + rows.size() + " participants");
                }
            } catch (Exception ex) {
                System.out.println("Error sending delete notification for schedule " + scheduleId + ": " + ex.getMessage());
            }
        }
    }

    private NotificationDTO buildDeleteEmailNotification(LiveSession session, SessionSchedule schedule, List<Object[]> rows) {
        NotificationDTO dto = new NotificationDTO();
        dto.setBody(LiveClassEmailBody.Live_Class_Delete_Email_Body);
        dto.setSubject("Live Class Cancelled - " + (session.getTitle() != null ? session.getTitle() : "Live Class"));
        dto.setNotificationType("EMAIL");
        dto.setSource("ADMIN_CORE");
        dto.setSourceId(session.getId());

        List<NotificationToUserDTO> users = new ArrayList<>();
        for (Object[] r : rows) {
            // Handle different data structures from batch vs individual user queries
            String userId, fullName, email;
            
            if (r.length >= 6) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }
            
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add schedule details if available
            if (schedule != null) {
                // Format date and time
                if (schedule.getMeetingDate() != null && schedule.getStartTime() != null) {
                    // format date
                    String date = new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate());

                    // format time in 12-hour with AM/PM
                    String time = new SimpleDateFormat("h:mm a").format(schedule.getStartTime());

                    placeholders.put("DATE", date);
                    placeholders.put("TIME", time);
                } else {
                    placeholders.put("DATE", "TBD");
                    placeholders.put("TIME", "TBD");
                }
            } else {
                placeholders.put("DATE", "TBD");
                placeholders.put("TIME", "TBD");
            }

            u.setPlaceholders(placeholders);
            u.setUserId(userId);
            u.setChannelId(email);
            users.add(u);
        }
        dto.setUsers(users);
        return dto;
    }

}
