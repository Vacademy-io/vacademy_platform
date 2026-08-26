package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request/response shapes for post-session mentor feedback. */
public final class MentorFeedbackDTOs {

    private MentorFeedbackDTOs() {}

    /** A learner submitting (or revising) their rating of one session. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SubmitFeedbackRequest {
        private String bookingInstanceId;
        private Integer rating;   // 1-5
        private String comment;
    }

    /**
     * A finished mentor session the caller hasn't rated yet — what the learner's
     * "rate your session" prompt is built from.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PendingFeedbackDTO {
        private String bookingInstanceId;
        private String mentorId;
        private String mentorName;
        private String mentorProfileImageFileId;
        private String sessionTitle;
        private Long sessionStartUtc;   // epoch millis
    }

    /** One rating, for the learner's own history and the admin's per-mentor view. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class FeedbackDTO {
        private String id;
        private String bookingInstanceId;
        private String mentorId;
        private String mentorName;
        private String studentUserId;
        private String studentName;
        private Integer rating;
        private String comment;
        private Long createdAt;
    }
}
