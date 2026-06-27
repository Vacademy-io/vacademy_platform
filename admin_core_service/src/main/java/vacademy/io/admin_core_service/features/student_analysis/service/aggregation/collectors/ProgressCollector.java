package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.ProgressSection;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Collects course-progress metrics from learner operations and activity logs.
 * Uses the subject-module completion query already on ActivityLogRepository.
 * Output shape: ProgressSection with overallCompletionPercentage + subjects[].
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProgressCollector {

    private final ActivityLogRepository activityLogRepository;
    private final ObjectMapper objectMapper;

    private static final List<String> ACTIVE_STATUS = Arrays.asList("ACTIVE");
    private static final List<String> STANDARD_STATUSES = Arrays.asList("ACTIVE", "PUBLISHED");
    private static final List<String> CHAPTER_PACKAGE_STATUSES = Arrays.asList("ACTIVE");
    private static final List<String> SLIDE_TYPES = Arrays.asList("VIDEO", "DOCUMENT", "AUDIO", "PDF");

    public ProgressSection collect(String userId, String packageSessionId, LocalDate startDate, LocalDate endDate) {
        try {
            if (packageSessionId == null) {
                log.info("[ProgressCollector] No packageSessionId provided, skipping progress collection for userId={}", userId);
                return ProgressSection.builder().available(false).build();
            }

            // Fetch per-subject, per-module completion + time using existing query
            List<Object[]> subjectRows = activityLogRepository.getModuleCompletionByUserAndBatch(
                    packageSessionId, userId,
                    STANDARD_STATUSES, STANDARD_STATUSES, STANDARD_STATUSES,
                    STANDARD_STATUSES, STANDARD_STATUSES,
                    ACTIVE_STATUS);

            List<ProgressSection.SubjectProgress> subjects = new ArrayList<>();
            double overallCompletion = 0.0;

            if (subjectRows != null && !subjectRows.isEmpty()) {
                for (Object[] row : subjectRows) {
                    String subjectId = row[0] != null ? row[0].toString() : null;
                    String subjectName = row[1] != null ? row[1].toString() : null;
                    String modulesJson = row[2] != null ? row[2].toString() : null;

                    double subjectCompletion = 0.0;
                    double subjectTimeMinutes = 0.0;

                    if (modulesJson != null && !modulesJson.isBlank()) {
                        try {
                            JsonNode modules = objectMapper.readTree(modulesJson);
                            int count = 0;
                            for (JsonNode m : modules) {
                                subjectCompletion += m.path("module_completion_percentage").asDouble(0);
                                subjectTimeMinutes += m.path("avg_time_spent_minutes").asDouble(0);
                                count++;
                            }
                            if (count > 0) subjectCompletion /= count;
                        } catch (Exception e) {
                            log.warn("[ProgressCollector] Failed to parse modules JSON for subject {}: {}", subjectId, e.getMessage());
                        }
                    }

                    // Convert minutes to hours (1 decimal)
                    double timeHours = Math.round((subjectTimeMinutes / 60.0) * 10.0) / 10.0;

                    subjects.add(ProgressSection.SubjectProgress.builder()
                            .subjectId(subjectId)
                            .subject(subjectName)   // map "name" → "subject" for v2 output
                            .completionPercentage(Math.round(subjectCompletion * 100.0) / 100.0)
                            .timeHours(timeHours)
                            .build());

                    overallCompletion += subjectCompletion;
                }
                if (!subjects.isEmpty()) overallCompletion /= subjects.size();
            }

            // Also try the direct learner-course-completion-percentage query if available
            try {
                Double courseCompletion = activityLogRepository.getLearnerCourseCompletionPercentage(
                        packageSessionId, userId,
                        Date.valueOf(startDate), Date.valueOf(endDate),
                        STANDARD_STATUSES, STANDARD_STATUSES, STANDARD_STATUSES, STANDARD_STATUSES,
                        SLIDE_TYPES, CHAPTER_PACKAGE_STATUSES);
                if (courseCompletion != null) overallCompletion = courseCompletion;
            } catch (Exception e) {
                log.warn("[ProgressCollector] Course completion percentage query failed, using subject average: {}", e.getMessage());
            }

            return ProgressSection.builder()
                    .available(true)
                    .overallCompletionPercentage(Math.round(overallCompletion * 100.0) / 100.0)
                    .subjects(subjects)
                    .build();

        } catch (Exception e) {
            log.error("[ProgressCollector] Failed for userId={}: {}", userId, e.getMessage());
            return ProgressSection.builder().available(false).build();
        }
    }
}
