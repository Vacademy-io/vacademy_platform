package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Result of a submit: what was scored, what was awarded, what to celebrate. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EngagementSubmitResponse {
    private String attemptId;
    private String status;
    private Boolean isCorrect;
    private Integer pointsAwarded;
    private Boolean isLate;
    private Boolean isVerified;
    /** Answers only travel once the reveal time has passed. */
    private Boolean isRevealed;
    private String correctOptionId;
    private String explanation;
    /** The learner's new running total, so the UI can animate it without a refetch. */
    private Long newTotalPoints;
}
