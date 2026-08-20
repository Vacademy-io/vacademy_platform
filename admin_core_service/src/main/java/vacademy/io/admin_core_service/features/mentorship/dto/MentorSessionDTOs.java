package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Shapes for the mentorship session views and the mentor's outcome recording. */
public final class MentorSessionDTOs {

    private MentorSessionDTOs() {}

    /**
     * One mentorship session, assembled for the admin session list and detail view:
     * the booking, both parties (with emails, as the admin brief requires), the
     * mentor's outcome, and the learner's rating.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class MentorSessionDTO {
        private String bookingInstanceId;
        private String title;
        private Long scheduledStartUtc;   // epoch millis
        private Long scheduledEndUtc;
        private Integer durationMinutes;
        /** The appointment's own state: CONFIRMED | CANCELLED | RESCHEDULED. */
        private String bookingStatus;
        private String meetLink;

        private String mentorId;
        private String mentorName;
        private String mentorEmail;

        private String studentUserId;
        private String studentName;
        private String studentEmail;

        /** COMPLETED | NO_SHOW, or null when the mentor hasn't reviewed it yet. */
        private String outcome;
        private String topic;
        /** Mentor's notes. Admin/mentor only — never returned to a learner. */
        private String notes;
        private Long markedAt;

        /** The learner's rating of this session, when they gave one. */
        private Integer rating;
        private String feedbackComment;

        /**
         * Derived lifecycle for display, so every surface agrees on the wording:
         * CANCELLED / RESCHEDULED (from the booking), then COMPLETED / NO_SHOW
         * (from the record), else UPCOMING or AWAITING_REVIEW by time.
         */
        private String lifecycle;
    }

    /** A mentor recording what happened in one of their sessions. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RecordSessionRequest {
        private String bookingInstanceId;
        private String outcome;   // COMPLETED | NO_SHOW
        private String topic;
        private String notes;
    }

    /** Cancel a mentorship session. The reason is shown in the cancellation notice. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CancelSessionRequest {
        private String bookingInstanceId;
        private String reason;
    }

    /** Move a mentorship session to a new start time (ISO-8601, as the booking API expects). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RescheduleSessionRequest {
        private String bookingInstanceId;
        private String startTime;
        private String inviteeTimezone;
    }

    /**
     * Schedule a 1:1 on a learner's behalf, without making the learner fill in a
     * booking form. The mentor's own booking page supplies the availability rules,
     * so a scheduled session is indistinguishable from one the learner booked.
     *
     * <p>{@code mentorId} is required when an admin schedules and ignored when a
     * mentor schedules for themselves — a mentor may only book their own calendar.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ScheduleSessionRequest {
        private String mentorId;
        private String studentUserId;
        /** ISO-8601 offset datetime of the chosen slot start. */
        private String startTime;
        private String inviteeTimezone;
        /** Session length; null = the mentor's default booking-page duration. */
        private Integer durationMinutes;
    }

    /** Session counts for the admin dashboard. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SessionStatsDTO {
        private Integer today;
        private Integer upcoming;
        private Integer completed;
        private Integer cancelled;
        private Integer noShow;
        /** Past sessions the mentor hasn't recorded an outcome for yet. */
        private Integer awaitingReview;
    }
}
