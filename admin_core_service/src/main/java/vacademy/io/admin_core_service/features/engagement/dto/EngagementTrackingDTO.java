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
        /** The written answer, when the format was TEXT. */
        private String textAnswer;
        /** Uploaded file ids, when the format was UPLOAD. */
        private List<String> fileIds;
        /** The option chosen, for MCQ/poll. */
        private String selectedOptionId;
    }

    /** Batch-level view: how each learner is keeping up across the whole plan. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LearnerProgress {
        private String userId;
        private String fullName;
        private String username;
        private long completed;
        private long correct;
        private long pointsEarned;
        /** Of the tasks that have closed so far, how many this learner never did. */
        private long missed;
        private String lastCompletedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlanOverview {
        private String planId;
        private String title;
        /** Tasks whose window has already closed. */
        private long tasksClosed;
        private long tasksTotal;
        private long learners;
        /** Learners with at least one completion. */
        private long learnersActive;
        /** Learners with 3+ missed closed tasks — the ones to nudge. */
        private long learnersSlipping;
        private List<LearnerProgress> rows;
    }
}
