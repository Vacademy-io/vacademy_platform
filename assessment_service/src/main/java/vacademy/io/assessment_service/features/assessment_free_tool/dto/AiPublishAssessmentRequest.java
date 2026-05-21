package vacademy.io.assessment_service.features.assessment_free_tool.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payload for admin-core → assessment-service when publishing an
 * AI-generated MCQ assessment built from a class recording transcript.
 *
 * Different from the wizard's BasicAssessmentDetailsDTO because the
 * questions are fully-formed MCQs (text + 4 options + correct index +
 * explanation), not skeleton placeholders. Avoids re-using the wizard
 * DTO which expects session/lookup IDs that don't apply here.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiPublishAssessmentRequest {
    private String name;
    private String instituteId;
    private String startDateTime;          // ISO-8601, used as bound_start_time
    private String endDateTime;            // ISO-8601, used as bound_end_time
    private String assessmentVisibility;   // "PUBLIC" or "PRIVATE"
    private Integer durationMinutes;       // assessment.duration is stored in minutes
    private Integer marksPerQuestion;
    private Integer negativeMarkPerQuestion;     // 0 if negative marking disabled
    /**
     * Number of retries a learner is allowed AFTER their first submission.
     * Must be non-null on persist — the learner-side
     * AssessmentUserRegistration row copies this value at first attempt-start
     * and rejects null. Treat null on this request as "0 retries".
     */
    private Integer reattemptCount;
    /**
     * Minutes a learner gets on the instructions/cover screen before the
     * timer starts. Optional — defaults to the assessment-service column
     * default (typically 0) when unset.
     */
    private Integer previewTime;
    /** Package-session IDs to auto-register the assessment against. */
    private List<String> batchIds;
    private List<AiQuestion> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiQuestion {
        private String question;          // plain text
        private List<String> options;     // 4 entries
        private Integer correctAnswerIndex;
        private String explanation;
    }
}
