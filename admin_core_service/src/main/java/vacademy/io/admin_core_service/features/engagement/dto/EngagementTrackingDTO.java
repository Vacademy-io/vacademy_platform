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
    /** Paging over `rows`; the counts above are always for the whole item. */
    private int page;
    private int pageSize;
    private long totalRows;
    private int totalPages;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Row {
        private String userId;
        /** Hydrated from auth_service — admin_core has no users table to join. */
        private String fullName;
        private String username;
        private String email;
        private String status;
        private Boolean isCorrect;
        private Double score;
        private Integer pointsAwarded;
        private Boolean isLate;
        private Long timeSpentMs;
        private String completedAt;
    }
}
