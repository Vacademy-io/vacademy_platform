package vacademy.io.admin_core_service.features.student_analysis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Aggregated data for student analysis
 * Contains all information needed to generate the LLM report
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class StudentAnalysisData {
        // Processed activity logs (last 5)
        private List<String> processedActivityLogs;

        // Login statistics
        private Integer totalLogins;
        private String lastLoginTime;
        private Double avgSessionDurationMinutes;
        private Long totalActiveTimeMinutes;

        // Learner operations summary
        private List<LearnerOperationSummary> learnerOperations;

        // Date range (ISO 8601 format: YYYY-MM-DD)
        private String startDateIso;
        private String endDateIso;
}
