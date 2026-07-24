package vacademy.io.auth_service.feature.analytics.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.analytics.dto.StudentLoginStatsBatchEntryDto;
import vacademy.io.auth_service.feature.analytics.dto.StudentLoginStatsBatchRequestDto;
import vacademy.io.auth_service.feature.analytics.dto.StudentLoginStatsBatchResponseDto;
import vacademy.io.auth_service.feature.analytics.repository.StudentLoginStatsBatchRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Batched sibling of the single-user student-login-stats lookup.
 * Runs exactly two GROUP BY queries over the whole cohort — never per-user
 * loops.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentLoginStatsBatchService {

        private static final int MAX_USER_IDS = 500;
        private static final int DEFAULT_SINCE_DAYS = 30;

        private final StudentLoginStatsBatchRepository studentLoginStatsBatchRepository;

        public StudentLoginStatsBatchResponseDto getBatchLoginStats(StudentLoginStatsBatchRequestDto request) {
                if (request == null || request.getUserIds() == null || request.getUserIds().isEmpty()) {
                        throw new VacademyException(HttpStatus.BAD_REQUEST, "userIds is required");
                }
                if (request.getUserIds().size() > MAX_USER_IDS) {
                        throw new VacademyException(HttpStatus.BAD_REQUEST,
                                        "userIds cannot exceed " + MAX_USER_IDS + " entries");
                }

                int sinceDays = request.getSinceDays() != null ? request.getSinceDays() : DEFAULT_SINCE_DAYS;
                if (sinceDays < 1) {
                        throw new VacademyException(HttpStatus.BAD_REQUEST, "sinceDays must be a positive integer");
                }

                List<String> userIds = request.getUserIds().stream()
                                .filter(Objects::nonNull)
                                .filter(id -> !id.isBlank())
                                .distinct()
                                .toList();
                if (userIds.isEmpty()) {
                        throw new VacademyException(HttpStatus.BAD_REQUEST, "userIds is required");
                }

                LocalDateTime since = LocalDateTime.now().minusDays(sinceDays);
                LocalDate sinceDate = LocalDate.now().minusDays(sinceDays);

                Map<String, StudentLoginStatsBatchEntryDto> byUserId = new HashMap<>();

                // Query 1: logins per user (count + most recent) from user_session
                List<Object[]> loginRows = studentLoginStatsBatchRepository
                                .findLoginAggregatesByUserIdsSince(userIds, since);
                for (Object[] row : loginRows) {
                        String userId = (String) row[0];
                        long loginCount = row[1] != null ? ((Number) row[1]).longValue() : 0L;
                        LocalDateTime lastLogin = (LocalDateTime) row[2];
                        byUserId.put(userId, StudentLoginStatsBatchEntryDto.builder()
                                        .lastLoginAt(lastLogin != null
                                                        ? lastLogin.toInstant(ZoneOffset.UTC).toString()
                                                        : null)
                                        .loginCount(loginCount)
                                        .totalActivityMinutes(0L)
                                        .build());
                }

                // Query 2: total activity minutes per user from daily_user_activity_summary
                List<Object[]> activityRows = studentLoginStatsBatchRepository
                                .findActivityMinutesByUserIdsSince(userIds, sinceDate);
                for (Object[] row : activityRows) {
                        String userId = (String) row[0];
                        long totalActivityMinutes = row[1] != null ? ((Number) row[1]).longValue() : 0L;
                        StudentLoginStatsBatchEntryDto entry = byUserId.get(userId);
                        if (entry != null) {
                                entry.setTotalActivityMinutes(totalActivityMinutes);
                        } else {
                                // Activity summary exists without a login row in the window — still activity.
                                byUserId.put(userId, StudentLoginStatsBatchEntryDto.builder()
                                                .lastLoginAt(null)
                                                .loginCount(0L)
                                                .totalActivityMinutes(totalActivityMinutes)
                                                .build());
                        }
                }

                log.info("[Student-Login-Stats-Batch] cohort={} sinceDays={} usersWithActivity={}",
                                userIds.size(), sinceDays, byUserId.size());

                return StudentLoginStatsBatchResponseDto.builder()
                                .byUserId(byUserId)
                                .build();
        }
}
