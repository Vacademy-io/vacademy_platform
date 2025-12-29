package vacademy.io.admin_core_service.features.student_analysis.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.learner_operation.entity.LearnerOperation;
import vacademy.io.admin_core_service.features.learner_operation.repository.LearnerOperationRepository;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.LearnerOperationSummary;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentAnalysisData;
import vacademy.io.admin_core_service.features.student_analysis.dto.StudentLoginStatsDto;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service to aggregate all data needed for student analysis
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentAnalysisDataService {

        private final ActivityLogRepository activityLogRepository;
        private final LearnerOperationRepository learnerOperationRepository;
        private final AuthService authService;

        /**
         * Collect all data needed for student analysis report
         */
        public StudentAnalysisData collectStudentData(String userId, LocalDate startDateIso, LocalDate endDateIso) {
                log.info("[Student-Analysis-Data] Collecting data for user: {} from {} to {}", userId, startDateIso,
                                endDateIso);

                // Convert LocalDate to Timestamp
                Timestamp startTimestamp = Timestamp.valueOf(startDateIso.atStartOfDay());
                Timestamp endTimestamp = Timestamp.valueOf(endDateIso.atTime(23, 59, 59));

                // 1. Get last 5 processed activity logs
                List<ActivityLog> activityLogs = activityLogRepository.findProcessedLogsForAnalysis(
                                userId, startTimestamp, endTimestamp);

                List<String> processedLogs = activityLogs.stream()
                                .map(ActivityLog::getProcessedJson)
                                .filter(json -> json != null && !json.isEmpty())
                                .collect(Collectors.toList());

                log.info("[Student-Analysis-Data] Found {} processed activity logs", processedLogs.size());

                // 2. Get learner operations
                List<LearnerOperation> operations = learnerOperationRepository.findByUserIdAndDateRange(
                                userId, startTimestamp, endTimestamp);

                List<LearnerOperationSummary> operationSummaries = operations.stream()
                                .map(op -> LearnerOperationSummary.builder()
                                                .source(op.getSource())
                                                .operation(op.getOperation())
                                                .value(op.getValue())
                                                .timestamp(op.getUpdatedAt() != null ? op.getUpdatedAt().toString()
                                                                : null)
                                                .build())
                                .collect(Collectors.toList());
                log.info("[Student-Analysis-Data] Found {} learner operations", operationSummaries.size());

                // 3. Get login statistics from auth service
                StudentLoginStatsDto loginStats = authService.getStudentLoginStats(
                                userId, startDateIso.toString(), endDateIso.toString());

                log.info("[Student-Analysis-Data] Login stats - Total: {}, Last: {}, Avg Duration: {} min, Total Active: {} min",
                                loginStats.getTotalLogins(), loginStats.getLastLoginTime(),
                                loginStats.getAvgSessionDurationMinutes(), loginStats.getTotalActiveTimeMinutes());

                return StudentAnalysisData.builder()
                                .userId(userId)
                                .processedActivityLogs(processedLogs)
                                .totalLogins(loginStats.getTotalLogins())
                                .lastLoginTime(loginStats.getLastLoginTime())
                                .avgSessionDurationMinutes(loginStats.getAvgSessionDurationMinutes())
                                .totalActiveTimeMinutes(loginStats.getTotalActiveTimeMinutes())
                                .learnerOperations(operationSummaries)
                                .startDateIso(startDateIso.toString())
                                .endDateIso(endDateIso.toString())
                                .build();
        }
}
