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

import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

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
    @Autowired
    private SessionScheduleRepository scheduleRepository;

    // Timezone mapping cache for better performance
    private static final Map<String, String> REGION_TO_TIMEZONE_MAP = new ConcurrentHashMap<>();
    
    static {
        // Initialize common region to timezone mappings
        REGION_TO_TIMEZONE_MAP.put("India", "Asia/Kolkata");
        REGION_TO_TIMEZONE_MAP.put("United Kingdom", "Europe/London");
        REGION_TO_TIMEZONE_MAP.put("UK", "Europe/London");
        REGION_TO_TIMEZONE_MAP.put("United States", "America/New_York");
        REGION_TO_TIMEZONE_MAP.put("USA", "America/New_York");
        REGION_TO_TIMEZONE_MAP.put("Canada", "America/Toronto");
        REGION_TO_TIMEZONE_MAP.put("Australia", "Australia/Sydney");
        REGION_TO_TIMEZONE_MAP.put("Germany", "Europe/Berlin");
        REGION_TO_TIMEZONE_MAP.put("France", "Europe/Paris");
        REGION_TO_TIMEZONE_MAP.put("Japan", "Asia/Tokyo");
        REGION_TO_TIMEZONE_MAP.put("China", "Asia/Shanghai");
        REGION_TO_TIMEZONE_MAP.put("Singapore", "Asia/Singapore");
        REGION_TO_TIMEZONE_MAP.put("UAE", "Asia/Dubai");
        REGION_TO_TIMEZONE_MAP.put("Saudi Arabia", "Asia/Riyadh");
        REGION_TO_TIMEZONE_MAP.put("Brazil", "America/Sao_Paulo");
        REGION_TO_TIMEZONE_MAP.put("Mexico", "America/Mexico_City");
        REGION_TO_TIMEZONE_MAP.put("South Africa", "Africa/Johannesburg");
        REGION_TO_TIMEZONE_MAP.put("Nigeria", "Africa/Lagos");
        REGION_TO_TIMEZONE_MAP.put("Egypt", "Africa/Cairo");
        REGION_TO_TIMEZONE_MAP.put("Kenya", "Africa/Nairobi");
        REGION_TO_TIMEZONE_MAP.put("Ghana", "Africa/Accra");
        REGION_TO_TIMEZONE_MAP.put("Morocco", "Africa/Casablanca");
        REGION_TO_TIMEZONE_MAP.put("Tunisia", "Africa/Tunis");
        REGION_TO_TIMEZONE_MAP.put("Algeria", "Africa/Algiers");
        REGION_TO_TIMEZONE_MAP.put("Ethiopia", "Africa/Addis_Ababa");
        REGION_TO_TIMEZONE_MAP.put("Uganda", "Africa/Kampala");
        REGION_TO_TIMEZONE_MAP.put("Tanzania", "Africa/Dar_es_Salaam");
        REGION_TO_TIMEZONE_MAP.put("Zimbabwe", "Africa/Harare");
        REGION_TO_TIMEZONE_MAP.put("Zambia", "Africa/Lusaka");
        REGION_TO_TIMEZONE_MAP.put("Botswana", "Africa/Gaborone");
        REGION_TO_TIMEZONE_MAP.put("Namibia", "Africa/Windhoek");
        REGION_TO_TIMEZONE_MAP.put("Angola", "Africa/Luanda");
        REGION_TO_TIMEZONE_MAP.put("Mozambique", "Africa/Maputo");
        REGION_TO_TIMEZONE_MAP.put("Madagascar", "Indian/Antananarivo");
        REGION_TO_TIMEZONE_MAP.put("Mauritius", "Indian/Mauritius");
        REGION_TO_TIMEZONE_MAP.put("Seychelles", "Indian/Mahe");
        REGION_TO_TIMEZONE_MAP.put("Reunion", "Indian/Reunion");
        REGION_TO_TIMEZONE_MAP.put("Comoros", "Indian/Comoro");
        REGION_TO_TIMEZONE_MAP.put("Mayotte", "Indian/Mayotte");
        REGION_TO_TIMEZONE_MAP.put("Malawi", "Africa/Blantyre");
        REGION_TO_TIMEZONE_MAP.put("Lesotho", "Africa/Maseru");
        REGION_TO_TIMEZONE_MAP.put("Eswatini", "Africa/Mbabane");
        REGION_TO_TIMEZONE_MAP.put("Rwanda", "Africa/Kigali");
        REGION_TO_TIMEZONE_MAP.put("Burundi", "Africa/Bujumbura");
    }

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
            String userId, fullName, email, region;
            
            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
                region = (String) r[6];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
                region = (String) r[4];
            }
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add timezone with UTC offset
            placeholders.put("TIMEZONE", getTimezoneWithOffset(session.getTimezone()));

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Build live class URL based on access level and domain routing
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                System.out.println("DEBUG: Final live class URL: " + liveClassUrl);
                placeholders.put("LINK", liveClassUrl);

                // Format date and time for this specific student's timezone
                Map<String, String> dateTimeMap = formatDateTimeForStudent(schedule, region, session.getTimezone());
                placeholders.put("DATE", dateTimeMap.get("DATE"));
                placeholders.put("TIME", dateTimeMap.get("TIME"));
            } else {
                // Build live class URL even if schedule is null
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);
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
            String userId, fullName, email, region;
            
            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
                region = (String) r[6];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
                region = (String) r[4];
            }
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add timezone with UTC offset
            placeholders.put("TIMEZONE", getTimezoneWithOffset(session.getTimezone()));

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Build live class URL based on access level and domain routing
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                System.out.println("DEBUG: Final live class URL: " + liveClassUrl);
                placeholders.put("LINK", liveClassUrl);

                // Format date and time for this specific student's timezone
                Map<String, String> dateTimeMap = formatDateTimeForStudent(schedule, region, session.getTimezone());
                placeholders.put("DATE", dateTimeMap.get("DATE"));
                placeholders.put("TIME", dateTimeMap.get("TIME"));
            } else {
                // Build live class URL even if schedule is null
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);
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
            String userId, fullName, email, region;
            
            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
                region = (String) r[6];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
                region = (String) r[4];
            }
            
            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add timezone with UTC offset
            placeholders.put("TIMEZONE", getTimezoneWithOffset(session.getTimezone()));

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Format date and time for this specific student's timezone
                Map<String, String> dateTimeMap = formatDateTimeForStudent(schedule, region, session.getTimezone());
                placeholders.put("DATE", dateTimeMap.get("DATE"));
                placeholders.put("TIME", dateTimeMap.get("TIME"));
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
            String userId, fullName, email, region;

            if (r.length >= 7) {
                // Batch query result: [mapping_id, user_id, expiry_date, full_name, mobile_number, email, region, package_session_id]
                userId = (String) r[1];
                fullName = (String) r[3];
                email = (String) r[5];
                region = (String) r[6];
            } else {
                // Individual user query result: [user_id, full_name, mobile_number, email, region]
                userId = (String) r[0];
                fullName = (String) r[1];
                email = (String) r[3];
                region = (String) r[4];
            }

            NotificationToUserDTO u = new NotificationToUserDTO();
            Map<String, String> placeholders = new java.util.HashMap<>();
            placeholders.put("NAME", fullName);
            placeholders.put("SESSION_TITLE", session.getTitle() != null ? session.getTitle() : "Live Class");

            // Add timezone with UTC offset
            placeholders.put("TIMEZONE", getTimezoneWithOffset(session.getTimezone()));

            // Add theme color
            placeholders.put("THEME_COLOR", getThemeColor(session.getInstituteId()));

            // Add schedule details if available
            if (schedule != null) {
                // Build live class URL based on access level and domain routing
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);

                // Format date and time for this specific student's timezone
                Map<String, String> dateTimeMap = formatDateTimeForStudent(schedule, region, session.getTimezone());
                placeholders.put("DATE", dateTimeMap.get("DATE"));
                placeholders.put("TIME", dateTimeMap.get("TIME"));
            } else {
                // Build live class URL even if schedule is null
                String liveClassUrl = buildLiveClassUrl(session, session.getId());
                placeholders.put("LINK", liveClassUrl);
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
     * Formats timezone with UTC offset for display in emails
     * @param timezone Full timezone name (e.g., "Asia/Kolkata", "Europe/London")
     * @return Timezone with offset (e.g., "Asia/Kolkata (+5:30)", "Europe/London (+0:00)")
     */
    private String getTimezoneWithOffset(String timezone) {
        if (timezone == null || timezone.trim().isEmpty()) {
            return "UTC (+0:00)";
        }

        try {
            ZoneId zoneId = ZoneId.of(timezone);
            ZoneOffset offset = zoneId.getRules().getOffset(LocalDateTime.now());
            
            // Format the UTC offset
            String offsetString = formatUtcOffset(offset);
            
            // Return full timezone name with offset
            return timezone + " (" + offsetString + " Hr)";
        } catch (Exception e) {
            // If timezone parsing fails, return the original string
            System.out.println("Failed to parse timezone: " + timezone + ", error: " + e.getMessage());
            return timezone;
        }
    }

    /**
     * Formats UTC offset in a readable format
     * @param offset ZoneOffset to format
     * @return Formatted offset string (e.g., "+5:30", "-8:00", "+0:00")
     */
    private String formatUtcOffset(ZoneOffset offset) {
        int totalSeconds = offset.getTotalSeconds();
        int hours = totalSeconds / 3600;
        int minutes = Math.abs((totalSeconds % 3600) / 60);
        
        if (hours == 0 && minutes == 0) {
            return "+0:00";
        } else {
            return String.format("%+d:%02d", hours, minutes);
        }
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

    private String getTimezoneFromRegion(String region) {
        if (region == null || region.trim().isEmpty()) {
            return "UTC";
        }
        
        // Try exact match first
        String timezone = REGION_TO_TIMEZONE_MAP.get(region.trim());
        if (timezone != null) {
            return timezone;
        }
        
        // Try case-insensitive match
        for (Map.Entry<String, String> entry : REGION_TO_TIMEZONE_MAP.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(region.trim())) {
                return entry.getValue();
            }
        }
        
        // Default to UTC if no match found
        System.out.println("No timezone mapping found for region: " + region + ", using UTC");
        return "UTC";
    }

    private Map<String, String> formatDateTimeForStudent(SessionSchedule schedule, String studentRegion, String sessionTimezone) {
        Map<String, String> result = new HashMap<>();
        
        if (schedule == null || schedule.getMeetingDate() == null || schedule.getStartTime() == null) {
            result.put("DATE", "TBD");
            result.put("TIME", "TBD");
            return result;
        }
        
        try {
            // Get student's timezone
            String studentTimezone = getTimezoneFromRegion(studentRegion);
            
            // Get session timezone (fallback to Asia/Kolkata if null)
            String sessionTz = (sessionTimezone != null && !sessionTimezone.trim().isEmpty()) 
                ? sessionTimezone 
                : "Asia/Kolkata";
            
            // If both timezones are same, no conversion needed
            if (studentTimezone.equals(sessionTz)) {
                String date = new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate());
                String time = new SimpleDateFormat("h:mm a").format(schedule.getStartTime());
                result.put("DATE", date);
                result.put("TIME", time);
                return result;
            }
            
            // Calculate time difference between timezones
            int timeDifferenceMinutes = getTimezoneDifferenceMinutes(sessionTz, studentTimezone);
            
            // Convert start time to student's timezone
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.setTime(schedule.getStartTime());
            cal.add(java.util.Calendar.MINUTE, timeDifferenceMinutes);
            
            // Format the converted time
            String date = new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate());
            String time = new SimpleDateFormat("h:mm a").format(cal.getTime());
            
            result.put("DATE", date);
            result.put("TIME", time);
            
        } catch (Exception e) {
            System.out.println("Error formatting date/time for region " + studentRegion + ": " + e.getMessage());
            // Fallback to original formatting
            String date = new SimpleDateFormat("EEEE, MMMM d, yyyy").format(schedule.getMeetingDate());
            String time = new SimpleDateFormat("h:mm a").format(schedule.getStartTime());
            result.put("DATE", date);
            result.put("TIME", time);
        }
        
        return result;
    }

    private int getTimezoneDifferenceMinutes(String fromTimezone, String toTimezone) {
        // Simple timezone difference mapping (in hours from UTC)
        Map<String, Double> timezoneOffsets = new HashMap<>();
        timezoneOffsets.put("UTC", 0.0);
        timezoneOffsets.put("Europe/London", 1.0); // BST (British Summer Time) - UTC+1
        timezoneOffsets.put("Asia/Kolkata", 5.5); // IST (Indian Standard Time) - UTC+5:30
        timezoneOffsets.put("America/New_York", -5.0); // EST
        timezoneOffsets.put("America/Los_Angeles", -8.0); // PST
        timezoneOffsets.put("Asia/Tokyo", 9.0); // JST
        timezoneOffsets.put("Australia/Sydney", 10.0); // AEST
        timezoneOffsets.put("Europe/Paris", 2.0); // CEST (Central European Summer Time) - UTC+2
        timezoneOffsets.put("Asia/Dubai", 4.0); // GST
        timezoneOffsets.put("Asia/Singapore", 8.0); // SGT
        
        double fromOffset = timezoneOffsets.getOrDefault(fromTimezone, 0.0);
        double toOffset = timezoneOffsets.getOrDefault(toTimezone, 0.0);
        
        // Convert hours to minutes
        return (int) Math.round((toOffset - fromOffset) * 60);
    }
}

