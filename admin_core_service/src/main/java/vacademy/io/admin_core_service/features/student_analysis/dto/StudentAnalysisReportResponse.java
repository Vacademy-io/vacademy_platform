package vacademy.io.admin_core_service.features.student_analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.ComprehensiveStudentReport;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentAnalysisReportResponse {
        private String processId;
        /** Admin-given (or auto-generated) report name. */
        private String name;
        private String status; // PENDING, PROCESSING, COMPLETED, FAILED
        /** v1 report payload. Null for v2 rows. */
        private StudentReportData report;
        private String errorMessage;
        /** "v1" (default) or "v2". Present on all COMPLETED responses. */
        private String reportVersion;
        /** v2 comprehensive report payload. Null for v1 rows. */
        private ComprehensiveStudentReport comprehensiveReport;
}
