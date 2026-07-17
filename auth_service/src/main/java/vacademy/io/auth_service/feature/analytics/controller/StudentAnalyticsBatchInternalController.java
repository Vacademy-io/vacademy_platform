package vacademy.io.auth_service.feature.analytics.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.analytics.dto.StudentLoginStatsBatchRequestDto;
import vacademy.io.auth_service.feature.analytics.dto.StudentLoginStatsBatchResponseDto;
import vacademy.io.auth_service.feature.analytics.service.StudentLoginStatsBatchService;

/**
 * HMAC-guarded internal API for batched student login stats — used by
 * admin_core_service.
 *
 * Security: the "/auth-service/internal/**" prefix is registered under
 * INTERNAL_PATHS in ApplicationSecurityConfig (requires authentication, NOT
 * permitAll), and the shared InternalAuthFilter authenticates the caller via
 * the HMAC client headers (clientName + Signature) — same wiring as
 * InstituteSettingsInternalController. Deliberately NOT placed under the
 * permitAll /auth-service/analytics/** prefix.
 */
@Slf4j
@RestController
@RequestMapping("/auth-service/internal/v1/analytics")
@RequiredArgsConstructor
public class StudentAnalyticsBatchInternalController {

        private final StudentLoginStatsBatchService studentLoginStatsBatchService;

        /**
         * Batched login/activity stats for a cohort of users.
         *
         * POST /auth-service/internal/v1/analytics/student-login-stats/batch
         * Body: { "userIds": ["..."], "sinceDays": 30 }
         * - userIds required, max 500 (400 otherwise); sinceDays optional, default 30.
         *
         * Response: { "byUserId": { "<userId>": { "lastLoginAt": "...", "loginCount":
         * n, "totalActivityMinutes": n } } } — entry present ONLY for users with any
         * activity in the window.
         */
        @PostMapping("/student-login-stats/batch")
        public ResponseEntity<StudentLoginStatsBatchResponseDto> getStudentLoginStatsBatch(
                        @RequestBody StudentLoginStatsBatchRequestDto request) {
                return ResponseEntity.ok(studentLoginStatsBatchService.getBatchLoginStats(request));
        }
}
