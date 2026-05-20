package vacademy.io.admin_core_service.features.ai_content.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Optional overrides sent at publish time by the new
 * "Configure → Publish" flow on the recording preview.
 *
 * The teacher fills the bulk of these fields AFTER they've seen the
 * generated questions, so any value present here trumps what was
 * captured at generation time (and persisted in
 * ai_generated_artifact.generation_params_json).
 *
 * `title` was historically the only field on this body — the legacy
 * publish call only varies the title.
 */
@Data
@NoArgsConstructor
public class PublishAssessmentOverridesDto {

    /** Optional override for the assessment name. */
    private String title;

    /** ISO local datetime, e.g. "2026-05-21T10:00". */
    private String startDateTime;
    private String endDateTime;

    /** PUBLIC | PRIVATE. */
    private String assessmentVisibility;

    private Integer marksPerQuestion;
    private Integer durationMinutes;

    private Boolean negativeMarkingEnabled;
    private Integer negativeMarkPerQuestion;

    /**
     * Retries allowed after the first submission. Null = leave default
     * (0 retries) on the assessment-service side. Required to be non-null
     * on the assessment row itself because AssessmentUserRegistration
     * copies it at first attempt-start.
     */
    private Integer reattemptCount;

    /**
     * Minutes a learner gets on the instructions/cover screen before the
     * timer starts. Null = leave at the column default on assessment-service.
     */
    private Integer previewTime;
}
