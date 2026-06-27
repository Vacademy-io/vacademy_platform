package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ActivitySection {

    private boolean available;
    private Double totalTimeMinutes;
    private List<DailyTimeEntry> dailyTime;
    private Double avgConcentration;
    /** Keys: "videos", "documents", "quizzes" — values are time in minutes. */
    private Map<String, Double> contentEngagement;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DailyTimeEntry {
        private String date;
        private Double minutes;
    }
}
