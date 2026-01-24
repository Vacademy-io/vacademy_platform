package vacademy.io.auth_service.feature.analytics.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.analytics.dto.StudentLoginStatsDto;
import vacademy.io.common.auth.repository.UserSessionRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Internal API for student analytics - used by admin_core_service
 */
@Slf4j
@RestController
@RequestMapping("/auth-service/analytics")
@RequiredArgsConstructor
public class StudentAnalyticsInternalController {

        private final UserSessionRepository userSessionRepository;

        /**
         * Get login statistics for a specific student within a date range
         * Used by student analysis feature in admin_core_service
         * 
         * @param userId    ID of the student user
         * @param startDate Start date (inclusive) in ISO format (yyyy-MM-dd)
         * @param endDate   End date (inclusive) in ISO format (yyyy-MM-dd)
         * @return StudentLoginStatsDto containing login statistics
         */
        @GetMapping("/student-login-stats")
        public ResponseEntity<StudentLoginStatsDto> getStudentLoginStats(
                        @RequestParam("userId") String userId,
                        @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
                        @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

                log.info("[Student-Login-Stats] Fetching for userId: {}, from: {} to: {}", userId, startDate, endDate);

                LocalDateTime startDateTime = startDate.atStartOfDay();
                LocalDateTime endDateTime = endDate.atTime(23, 59, 59);

                Long totalLogins = userSessionRepository.countTotalLoginsByUserAndDateRange(
                                userId, startDateTime, endDateTime);

                LocalDateTime lastLogin = userSessionRepository.findLastLoginTimeByUserAndDateRange(
                                userId, startDateTime, endDateTime);

                Double avgSessionDuration = userSessionRepository.findAvgSessionDurationByUserAndDateRange(
                                userId, startDateTime, endDateTime);

                Long totalActiveTime = userSessionRepository.findTotalActiveTimeByUserAndDateRange(
                                userId, startDateTime, endDateTime);

                StudentLoginStatsDto stats = StudentLoginStatsDto.builder()
                                .totalLogins(totalLogins != null ? totalLogins.intValue() : 0)
                                .lastLoginTime(lastLogin != null ? lastLogin.toString() : null)
                                .avgSessionDurationMinutes(avgSessionDuration != null ? avgSessionDuration : 0.0)
                                .totalActiveTimeMinutes(totalActiveTime != null ? totalActiveTime : 0L)
                                .build();

                log.info("[Student-Login-Stats] Result - Total: {}, Last: {}, Avg: {} min, Total Active: {} min",
                                stats.getTotalLogins(), stats.getLastLoginTime(),
                                stats.getAvgSessionDurationMinutes(), stats.getTotalActiveTimeMinutes());

                return ResponseEntity.ok(stats);
        }
}
