package vacademy.io.auth_service.feature.analytics.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.DailyUserActivitySummary;
import vacademy.io.common.auth.entity.UserActivityLog;
import vacademy.io.common.auth.entity.UserSession;
import vacademy.io.common.auth.repository.DailyUserActivitySummaryRepository;
import vacademy.io.common.auth.repository.UserActivityLogRepository;
import vacademy.io.common.auth.repository.UserSessionRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DailyActivityAggregationService {

    @Autowired
    private UserActivityLogRepository activityLogRepository;

    @Autowired
    private UserSessionRepository sessionRepository;

    @Autowired
    private DailyUserActivitySummaryRepository dailySummaryRepository;

    /**
     * Scheduled task to aggregate yesterday's activity data
     * Runs daily at 1:00 AM
     */
    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void aggregateYesterdayActivity() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("Starting daily activity aggregation for date: {}", yesterday);
        
        try {
            aggregateActivityForDate(yesterday);
            log.info("Successfully completed daily activity aggregation for date: {}", yesterday);
        } catch (Exception e) {
            log.error("Error during daily activity aggregation for date: {}", yesterday, e);
        }
    }

    /**
     * Aggregate activity data for a specific date
     */
    @Transactional
    public void aggregateActivityForDate(LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();

        // Get all activity logs for the date
        List<UserActivityLog> dailyLogs = activityLogRepository.findByCreatedAtBetween(startOfDay, endOfDay);
        
        // Get all sessions for the date
        List<UserSession> dailySessions = sessionRepository.findByLoginTimeBetween(startOfDay, endOfDay);

        // Group by user and institute
        Map<String, List<UserActivityLog>> logsByUserInstitute = dailyLogs.stream()
            .filter(log -> log.getUserId() != null && log.getInstituteId() != null)
            .collect(Collectors.groupingBy(log -> log.getUserId() + ":" + log.getInstituteId()));

        Map<String, List<UserSession>> sessionsByUserInstitute = dailySessions.stream()
            .filter(session -> session.getUserId() != null && session.getInstituteId() != null)
            .collect(Collectors.groupingBy(session -> session.getUserId() + ":" + session.getInstituteId()));

        // Process each user-institute combination
        Set<String> allUserInstituteKeys = new HashSet<>();
        allUserInstituteKeys.addAll(logsByUserInstitute.keySet());
        allUserInstituteKeys.addAll(sessionsByUserInstitute.keySet());

        for (String userInstituteKey : allUserInstituteKeys) {
            String[] parts = userInstituteKey.split(":");
            if (parts.length != 2) continue;
            
            String userId = parts[0];
            String instituteId = parts[1];

            List<UserActivityLog> userLogs = logsByUserInstitute.getOrDefault(userInstituteKey, new ArrayList<>());
            List<UserSession> userSessions = sessionsByUserInstitute.getOrDefault(userInstituteKey, new ArrayList<>());

            createOrUpdateDailySummary(userId, instituteId, date, userLogs, userSessions);
        }
    }

    /**
     * Create or update daily summary for a user
     */
    @Transactional
    public void createOrUpdateDailySummary(String userId, String instituteId, LocalDate date,
                                         List<UserActivityLog> logs, List<UserSession> sessions) {
        
        Optional<DailyUserActivitySummary> existingSummary = 
            dailySummaryRepository.findByUserIdAndInstituteIdAndActivityDate(userId, instituteId, date);

        DailyUserActivitySummary summary = existingSummary.orElse(
            DailyUserActivitySummary.builder()
                .userId(userId)
                .instituteId(instituteId)
                .activityDate(date)
                .build()
        );

        // Calculate metrics from logs
        summary.setTotalApiCalls(logs.size());
        
        // Calculate unique services used
        Set<String> uniqueServices = logs.stream()
            .map(UserActivityLog::getServiceName)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        summary.setUniqueServicesUsed(uniqueServices.size());
        summary.setServicesUsed(String.join(",", uniqueServices));

        // Calculate device types used
        Set<String> deviceTypes = new HashSet<>();
        deviceTypes.addAll(logs.stream()
            .map(UserActivityLog::getDeviceType)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet()));
        deviceTypes.addAll(sessions.stream()
            .map(UserSession::getDeviceType)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet()));
        summary.setDeviceTypesUsed(String.join(",", deviceTypes));

        // Calculate session metrics
        summary.setTotalSessions(sessions.size());
        
        long totalActivityMinutes = sessions.stream()
            .filter(session -> session.getSessionDurationMinutes() != null)
            .mapToLong(UserSession::getSessionDurationMinutes)
            .sum();
        summary.setTotalActivityTimeMinutes(totalActivityMinutes);

        // Calculate peak activity hour
        Map<Integer, Long> hourlyActivity = logs.stream()
            .collect(Collectors.groupingBy(
                log -> log.getCreatedAt().getHour(),
                Collectors.counting()
            ));
        
        Integer peakHour = hourlyActivity.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse(12); // Default to noon
        summary.setPeakActivityHour(peakHour);

        // Calculate first and last activity times
        if (!logs.isEmpty()) {
            LocalDateTime firstActivity = logs.stream()
                .map(UserActivityLog::getCreatedAt)
                .min(LocalDateTime::compareTo)
                .orElse(null);
            
            LocalDateTime lastActivity = logs.stream()
                .map(UserActivityLog::getCreatedAt)
                .max(LocalDateTime::compareTo)
                .orElse(null);
            
            summary.setFirstActivityTime(firstActivity);
            summary.setLastActivityTime(lastActivity);
        }

        // Add session activity times if available
        if (!sessions.isEmpty()) {
            LocalDateTime sessionFirstActivity = sessions.stream()
                .map(UserSession::getLoginTime)
                .min(LocalDateTime::compareTo)
                .orElse(null);
            
            LocalDateTime sessionLastActivity = sessions.stream()
                .map(session -> session.getLogoutTime() != null ? 
                    session.getLogoutTime() : session.getLastActivityTime())
                .max(LocalDateTime::compareTo)
                .orElse(null);

            if (summary.getFirstActivityTime() == null || 
                (sessionFirstActivity != null && sessionFirstActivity.isBefore(summary.getFirstActivityTime()))) {
                summary.setFirstActivityTime(sessionFirstActivity);
            }

            if (summary.getLastActivityTime() == null || 
                (sessionLastActivity != null && sessionLastActivity.isAfter(summary.getLastActivityTime()))) {
                summary.setLastActivityTime(sessionLastActivity);
            }
        }

        dailySummaryRepository.save(summary);
        log.debug("Updated daily summary for user {} in institute {} for date {}", userId, instituteId, date);
    }

    /**
     * Clean up old activity logs (older than 30 days)
     * Runs daily at 2:00 AM
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupOldActivityLogs() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(30);
        log.info("Starting cleanup of activity logs older than: {}", cutoffDate);
        
        try {
            List<UserActivityLog> oldLogs = activityLogRepository.findByCreatedAtBefore(cutoffDate);
            if (!oldLogs.isEmpty()) {
                activityLogRepository.deleteAll(oldLogs);
                log.info("Deleted {} old activity log records", oldLogs.size());
            }
        } catch (Exception e) {
            log.error("Error during activity logs cleanup", e);
        }
    }

    /**
     * Clean up inactive sessions every hour
     */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void cleanupInactiveSessions() {
        log.debug("Starting cleanup of inactive sessions");
        
        try {
            // Mark sessions as inactive if no activity for 2 hours
            int inactiveMinutes = 120;
            LocalDateTime cutoffTime = LocalDateTime.now().minusMinutes(inactiveMinutes);
            
            sessionRepository.endInactiveSessions(cutoffTime, LocalDateTime.now());
            log.debug("Completed cleanup of inactive sessions");
        } catch (Exception e) {
            log.error("Error during inactive sessions cleanup", e);
        }
    }

    /**
     * Manual trigger for aggregating activity for a specific date range
     */
    public void aggregateActivityForDateRange(LocalDate startDate, LocalDate endDate) {
        log.info("Starting manual activity aggregation for date range: {} to {}", startDate, endDate);
        
        LocalDate currentDate = startDate;
        while (!currentDate.isAfter(endDate)) {
            try {
                aggregateActivityForDate(currentDate);
                log.info("Completed aggregation for date: {}", currentDate);
            } catch (Exception e) {
                log.error("Error aggregating activity for date: {}", currentDate, e);
            }
            currentDate = currentDate.plusDays(1);
        }
        
        log.info("Completed manual activity aggregation for date range: {} to {}", startDate, endDate);
    }
} 