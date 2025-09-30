package vacademy.io.admin_core_service.features.live_session.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.live_session.constants.LiveClassEmailBody;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.ScheduleNotification;
import vacademy.io.admin_core_service.features.live_session.enums.LiveClassAction;
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
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.live_session.service.TimezoneSettingService;

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
    private final InstituteService instituteService;
    private final InstituteDomainRoutingRepository domainRoutingRepository;
    private final TimezoneSettingService timezoneSettingService;
    @Autowired
    private SessionScheduleRepository scheduleRepository;


    @Transactional
    public void processDueNotifications() {
        // Since trigger times are now stored in UTC, we need to compare with UTC time
        ZoneId utcZone = ZoneId.of("UTC");
        LocalDateTime now = LocalDateTime.now(utcZone);
        LocalDateTime windowEnd = now.plusMinutes(15);
        System.out.println("current time (UTC): " + now);
        System.out.println("Current time on server is "+now);

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
            
            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            placeholders.put("ACTION", LiveClassAction.STARTED.getDisplayName());

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Build live class URL based on access level and domain routing
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                System.out.println("DEBUG: Final live class URL: " + liveClassUrl);
                placeholders.put("LINK", liveClassUrl);

                // Format date and time for all configured timezones
                String allTimezonesTimes = timezoneSettingService.createTimezoneDisplayString(
                    schedule.getMeetingDate(), schedule.getStartTime(), session.getInstituteId());
                placeholders.put("ALL_TIMEZONE_TIMES", allTimezonesTimes);
                
                // Keep individual DATE and TIME for backward compatibility
                placeholders.put("DATE", new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate()));
                placeholders.put("TIME", new SimpleDateFormat("h:mm a").format(schedule.getStartTime()));
            } else {
                // Build live class URL even if schedule is null
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);
                placeholders.put("ALL_TIMEZONE_TIMES", "TBD");
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
            
            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            placeholders.put("ACTION", LiveClassAction.STARTING.getDisplayName());

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Build live class URL based on access level and domain routing
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                System.out.println("DEBUG: Final live class URL: " + liveClassUrl);
                placeholders.put("LINK", liveClassUrl);

                // Format date and time for all configured timezones
                String allTimezonesTimes = timezoneSettingService.createTimezoneDisplayString(
                    schedule.getMeetingDate(), schedule.getStartTime(), session.getInstituteId());
                placeholders.put("ALL_TIMEZONE_TIMES", allTimezonesTimes);
                
                // Keep individual DATE and TIME for backward compatibility
                placeholders.put("DATE", new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate()));
                placeholders.put("TIME", new SimpleDateFormat("h:mm a").format(schedule.getStartTime()));
            } else {
                // Build live class URL even if schedule is null
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);
                placeholders.put("ALL_TIMEZONE_TIMES", "TBD");
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
                scheduleRepository.softDeleteScheduleByIdIn(List.of(scheduleId));

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
            
            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }
            
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Format date and time for all configured timezones
                String allTimezonesTimes = timezoneSettingService.createTimezoneDisplayString(
                    schedule.getMeetingDate(), schedule.getStartTime(), session.getInstituteId());
                placeholders.put("ALL_TIMEZONE_TIMES", allTimezonesTimes);
                
                // Keep individual DATE and TIME for backward compatibility
                placeholders.put("DATE", new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate()));
                placeholders.put("TIME", new SimpleDateFormat("h:mm a").format(schedule.getStartTime()));
            } else {
                placeholders.put("ALL_TIMEZONE_TIMES", "TBD");
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

    public void sendOnCreateNotification(String sessionId, List<SessionSchedule> schedules) {
        try {
            // Get session details
            LiveSession session = liveSessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));

            // Group schedules by meeting_date and find the earliest schedule >= current date
            SessionSchedule selectedSchedule = findEarliestUpcomingSchedule(schedules);
            if (selectedSchedule == null) {
                System.out.println("No upcoming schedule found for session: " + sessionId);
                return;
            }

            // Get all participants (both BATCH and USER types)
            List<LiveSessionParticipants> participants = liveSessionParticipantRepository.findBySessionId(sessionId);
            if (participants == null || participants.isEmpty()) {
                System.out.println("No participants found for session: " + sessionId);
                return;
            }

            // Fetch students from both batch and individual user participants
            List<Object[]> rows = getStudentsForNotification(participants, session.getInstituteId());
            if (rows.isEmpty()) {
                System.out.println("No students found for notification for session: " + sessionId);
                return;
            }

            // Build and send notification
            NotificationDTO notification = buildOnCreateEmailNotification(session, selectedSchedule, rows);
            notificationService.sendEmailToUsers(notification, session.getInstituteId());

            System.out.println("ON_CREATE notification sent for session: " + sessionId + " to " + rows.size() + " participants");

        } catch (Exception ex) {
            System.out.println("Error sending ON_CREATE notification for session " + sessionId + ": " + ex.getMessage());
            // Don't rethrow - we don't want to prevent session creation if notification fails
        }
    }

    /**
     * Groups schedules by meeting_date and returns the earliest schedule >= current date
     * If meeting_date = current date, then start_time must be >= current time
     */
    private SessionSchedule findEarliestUpcomingSchedule(List<SessionSchedule> schedules) {
        if (schedules == null || schedules.isEmpty()) {
            return null;
        }

        java.time.LocalDate currentDate = java.time.LocalDate.now();
        java.time.LocalTime currentTime = java.time.LocalTime.now();

        return schedules.stream()
                .filter(schedule -> schedule.getMeetingDate() != null)
                .filter(schedule -> {
                    java.time.LocalDate meetingDate = schedule.getMeetingDate().toInstant()
                            .atZone(java.time.ZoneId.systemDefault()).toLocalDate();

                    // If meeting is in the future, include it
                    if (meetingDate.isAfter(currentDate)) {
                        return true;
                    }

                    // If meeting is today, check if start time is >= current time
                    if (meetingDate.isEqual(currentDate)) {
                        if (schedule.getStartTime() != null) {
                            java.time.LocalTime startTime = schedule.getStartTime().toLocalTime();
                            return !startTime.isBefore(currentTime);
                        }
                        return false; // No start time for today's meeting
                    }

                    // Meeting is in the past
                    return false;
                })
                .min((s1, s2) -> {
                    java.time.LocalDate date1 = s1.getMeetingDate().toInstant()
                            .atZone(java.time.ZoneId.systemDefault()).toLocalDate();
                    java.time.LocalDate date2 = s2.getMeetingDate().toInstant()
                            .atZone(java.time.ZoneId.systemDefault()).toLocalDate();

                    int dateComparison = date1.compareTo(date2);
                    if (dateComparison != 0) {
                        return dateComparison;
                    }

                    // If dates are equal, compare by start time
                    if (s1.getStartTime() != null && s2.getStartTime() != null) {
                        return s1.getStartTime().compareTo(s2.getStartTime());
                    }
                    return 0;
                })
                .orElse(null);
    }

    /**
     * Gets students for notification from both batch and individual user participants
     /**
     * Builds ON_CREATE email notification
     */
    private NotificationDTO buildOnCreateEmailNotification(LiveSession session, SessionSchedule schedule, List<Object[]> rows) {
        NotificationDTO dto = new NotificationDTO();
        dto.setBody(LiveClassEmailBody.Live_Class_Email_Body);
        dto.setSubject("New Live Class Created - " + (session.getTitle() != null ? session.getTitle() : "Live Class"));
        dto.setNotificationType("EMAIL");
        dto.setSource("ADMIN_CORE");
        dto.setSourceId(session.getId());

        List<NotificationToUserDTO> users = new java.util.ArrayList<>();
        for (Object[] r : rows) {
            // Handle different data structures from batch vs individual user queries
            String userId, fullName, email;

            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
            }

            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new java.util.HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            placeholders.put("ACTION", LiveClassAction.CREATED.getDisplayName());

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Build live class URL based on access level and domain routing
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);

                // Format date and time for all configured timezones
                String allTimezonesTimes = timezoneSettingService.createTimezoneDisplayString(
                    schedule.getMeetingDate(), schedule.getStartTime(), session.getInstituteId());
                placeholders.put("ALL_TIMEZONE_TIMES", allTimezonesTimes);
                
                // Keep individual DATE and TIME for backward compatibility
                placeholders.put("DATE", new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate()));
                placeholders.put("TIME", new SimpleDateFormat("h:mm a").format(schedule.getStartTime()));
            } else {
                // Build live class URL even if schedule is null
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);
                placeholders.put("ALL_TIMEZONE_TIMES", "TBD");
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


    /**
     * Builds the live class URL based on session access level and domain routing
     * @param session LiveSession object containing access level and institute ID
     * @param sessionId Session ID to append to the URL
     * @return Built URL or fallback URL if domain routing not found
     */
    private String buildLiveClassUrl(LiveSession session, String sessionId) {
        try {
            if (session == null || session.getInstituteId() == null || sessionId == null) {
                return "#";
            }

            // Fetch domain routing for LEARNER role
            Optional<InstituteDomainRouting> routingOpt = domainRoutingRepository
                    .findByInstituteIdAndRole(session.getInstituteId(), "LEARNER");
            
            if (routingOpt.isEmpty()) {
                System.out.println("No domain routing found for institute: " + session.getInstituteId() + " with role LEARNER");
                return "#";
            }

            InstituteDomainRouting routing = routingOpt.get();
            String subdomain = routing.getSubdomain();
            String domain = routing.getDomain();

            // Build URL based on access level
            String accessLevel = session.getAccessLevel();
            if ("public".equalsIgnoreCase(accessLevel)) {
                return String.format("%s.%s/register/live-class?sessionId=%s", subdomain, domain, sessionId);
            } else {
                return String.format("%s.%s/study-library/live-class/embed?sessionId=%s", subdomain, domain, sessionId);
            }
        } catch (Exception e) {
            System.out.println("Error building live class URL for session " + sessionId + ": " + e.getMessage());
            return "#";
        }
    }

    private String getThemeColor(String instituteId) {
        try {
            if (instituteId != null && !instituteId.trim().isEmpty()) {
                var institute = instituteService.findById(instituteId);
                String themeCode = institute.getInstituteThemeCode();
                if (themeCode != null && !themeCode.trim().isEmpty()) {
                    return themeCode;
                }
            }
        } catch (Exception e) {
            System.out.println("Failed to fetch theme color for institute " + instituteId + ": " + e.getMessage());
        }
        // Default fallback color
        return "#ff6f3c";
    }



}

