package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Teacher's view of how one item went. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EngagementTrackingDTO {
    private String itemId;
    private String title;
    private String itemType;
    private long completedCount;
    private long correctCount;
    private List<Row> rows;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Row {
        private String userId;
        private String status;
        private Boolean isCorrect;
        private Double score;
        private Integer pointsAwarded;
        private Boolean isLate;
        private Long timeSpentMs;
        private String completedAt;
    }
}
