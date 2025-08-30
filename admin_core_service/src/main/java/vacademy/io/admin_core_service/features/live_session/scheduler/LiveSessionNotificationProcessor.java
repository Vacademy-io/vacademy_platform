package vacademy.io.admin_core_service.features.live_session.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
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
import java.time.format.DateTimeFormatter;
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
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowEnd = now.plusMinutes(15);
        System.out.println("current time is:"+now);

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

                // Derive package_session_ids from live_session_participants (source_type=BATCH)
                List<String> packageSessionIds = getBatchIdsForSession(sn.getSessionId());
                if (packageSessionIds.isEmpty()) {
                    sn.setStatus(NotificationStatusEnum.SENT.name());
                    scheduleNotificationRepository.save(sn);
                    continue;
                }

                // Fetch schedule details for email template
                Optional<SessionSchedule> scheduleOpt = sessionScheduleRepository.findById(sn.getScheduleId());
                SessionSchedule schedule = scheduleOpt.orElse(null);
                System.out.println("DEBUG: Notification scheduleId: " + sn.getScheduleId());
                System.out.println("DEBUG: Found schedule: " + (schedule != null ? "YES" : "NO"));
                if (schedule != null) {
                    System.out.println("DEBUG: Schedule custom meeting link: " + schedule.getCustomMeetingLink());
                    System.out.println("DEBUG: Schedule meeting date: " + schedule.getMeetingDate());
                    System.out.println("DEBUG: Schedule start time: " + schedule.getStartTime());
                }
                // Fetch students for institute and package sessions (ACTIVE statuses)
                List<Object[]> rows = mappingRepository.findMappingsWithStudentContactsByInstitute(
                        packageSessionIds,
                        session.getInstituteId(),
                        Arrays.asList("ACTIVE", "ENROLLED")
                );

                if (!rows.isEmpty()) {

                    if (sn.getType().equals(NotificationTypeEnum.BEFORE_LIVE.name())) {
                        NotificationDTO notification = buildBeforeLiveEmailNotification(session, sn, schedule, rows);
                        notificationService.sendEmailToUsers(notification, session.getInstituteId());
                    }
                        if (sn.getType().equals(NotificationTypeEnum.ON_LIVE.name())) {
                            NotificationDTO notification = buildEmailNotification(session, sn, schedule, rows);
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

    private NotificationDTO buildEmailNotification(LiveSession session, ScheduleNotification sn, SessionSchedule schedule, List<Object[]> rows) {
        NotificationDTO dto = new NotificationDTO();
        dto.setBody(liveClassEmailBody());
        dto.setSubject("Your Live Session has started – Join now!");
        dto.setNotificationType("EMAIL");
        dto.setSource("ADMIN_CORE");
        dto.setSourceId(session.getId());

        List<NotificationToUserDTO> users = new ArrayList<>();
        for (Object[] r : rows) {
            String userId = (String) r[1];
            String fullName = (String) r[3];
            String email = (String) r[5];
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
        dto.setBody(liveClassEmailBody());
        dto.setSubject("Get Ready! Your session begins shortly.");
        dto.setNotificationType("EMAIL");
        dto.setSource("ADMIN_CORE");
        dto.setSourceId(session.getId());

        List<NotificationToUserDTO> users = new ArrayList<>();
        for (Object[] r : rows) {
            String userId = (String) r[1];
            String fullName = (String) r[3];
            String email = (String) r[5];
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


    public String liveClassEmailBody() {
        String body = """
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8" />
                <title>Live Class Invitation</title>
              </head>
              <body style="margin:0; padding:0; background-color:#fdf5f2; font-family: Arial, sans-serif;">
                <table role="presentation" style="width:100%; border-collapse:collapse; background-color:#fdf5f2; padding:40px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" style="width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                        <tr>
                          <td style="background:#ff6f3c; padding:20px; text-align:center; color:#fff;">
                            <h1 style="margin:0; font-size:24px;">📢 Live Class Invitation</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:30px; color:#333;">
                            <p style="font-size:16px;">Hi <strong>{{NAME}}</strong>,</p>
                            
                            <p style="font-size:16px; line-height:1.6;">
                              We're excited to invite you to our upcoming <strong>{{SESSION_TITLE}}</strong>, designed to help you learn and grow with us. 
                            </p>
                            <table role="presentation" style="margin:20px 0; width:100%;">
                                          <tr>
                                            <td style="padding:10px; background:#fff3ec; border:1px solid #ffe0d1; border-radius:6px;">
                                              <p style="margin:0; font-size:15px;"><strong>📅 Date:</strong> {{DATE}}</p>
                                              <p style="margin:5px 0 0 0; font-size:15px;"><strong>⏰ Time:</strong> {{TIME}}</p>
                                            </td>
                                          </tr>
                                        </table>

                            <p style="font-size:16px; line-height:1.6;">
                              Key takeaways from this session:
                            </p>

                            <div style="text-align:center; margin:30px 0;">
                              <a href="{{LINK}}" target="_blank" 
                                 style="display:inline-block; padding:12px 24px; background:#ff6f3c; color:#fff; 
                                        font-size:16px; font-weight:bold; text-decoration:none; border-radius:6px;">
                                Join the Live Class
                              </a>
                            </div>

                            <p style="font-size:15px; line-height:1.6;">
                              We look forward to seeing you there!
                            </p>
                            <p style="font-size:15px; line-height:1.6; margin-top:20px;">
                              Best regards,<br/>
                              <strong>Your Team</strong>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="background:#fbeae3; text-align:center; padding:15px; font-size:12px; color:#777;">
                            © 2025 Your Organization. All rights reserved.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """;
        return body;
    }
}
