package vacademy.io.admin_core_service.features.student_analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentAnalysisReportListItem {
        private String processId;
        private String userId;
        private String instituteId;
        private LocalDate startDateIso;
        private LocalDate endDateIso;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private StudentReportData report;
}
