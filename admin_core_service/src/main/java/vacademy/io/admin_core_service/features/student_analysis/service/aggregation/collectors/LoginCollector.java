package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentLoginStatsDto;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.LoginSection;

import java.time.LocalDate;

/**
 * Reuses the existing login-stats fetch already wired in v1 StudentAnalysisDataService.
 * No new code paths — delegates directly to AuthService.getStudentLoginStats().
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoginCollector {

    private final AuthService authService;

    public LoginSection collect(String userId, LocalDate startDate, LocalDate endDate) {
        try {
            StudentLoginStatsDto stats = authService.getStudentLoginStats(
                    userId, startDate.toString(), endDate.toString());

            return LoginSection.builder()
                    .available(true)
                    .totalLogins(stats.getTotalLogins())
                    .lastLogin(stats.getLastLoginTime() != null ? stats.getLastLoginTime().toString() : null)
                    .avgSessionMinutes(stats.getAvgSessionDurationMinutes())
                    .totalActiveTimeMinutes(stats.getTotalActiveTimeMinutes())
                    .build();

        } catch (Exception e) {
            log.error("[LoginCollector] Failed for userId={}: {}", userId, e.getMessage());
            return LoginSection.builder().available(false).build();
        }
    }
}
