package vacademy.io.admin_core_service.features.student_analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentAnalysisRequest {
        private String userId;
        private String instituteId;
        private LocalDate startDateIso; // ISO 8601 format: YYYY-MM-DD
        private LocalDate endDateIso; // ISO 8601 format: YYYY-MM-DD
}
