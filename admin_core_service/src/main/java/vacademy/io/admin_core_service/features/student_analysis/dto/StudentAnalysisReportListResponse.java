package vacademy.io.admin_core_service.features.student_analysis.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentAnalysisReportListResponse {
        private List<StudentAnalysisReportListItem> reports;
        private Integer currentPage;
        private Integer totalPages;
        private Long totalElements;
        private Integer pageSize;
}
