package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@AllArgsConstructor
public class BatchReportDTO {
    private Double percentageCourseCompletedByBatch;
    private Double avgTimeSpentByBatchInMinutes;
    private Double percentageConcentrationScoreOfBatch;
    private List<BatchAvgDailyTimeSpentDTO> dailyLearnerTimeSpentByBatch;
}
