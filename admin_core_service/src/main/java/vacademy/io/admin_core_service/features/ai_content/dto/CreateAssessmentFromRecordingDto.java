package vacademy.io.admin_core_service.features.ai_content.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for `POST /live-sessions/recording/{recordingId}/create-assessment`.
 *
 * The admin fills these via the CreateAssessmentFromRecordingModal in the
 * frontend. The transcript text, detected language, and batch IDs are derived
 * server-side from the existing ai_content_extraction + LiveSessionParticipants
 * rows — the client doesn't pass them.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateAssessmentFromRecordingDto {

    /** ISO-8601 datetime when learners can start the assessment. */
    private String startDateTime;

    /** ISO-8601 datetime when the assessment closes. */
    private String endDateTime;

    /** Marks awarded per correctly-answered MCQ. Default 4. */
    private Integer marksPerQuestion;

    /** Whether to deduct marks for wrong answers. */
    private Boolean negativeMarkingEnabled;

    /** Marks deducted per wrong answer (only honoured when negativeMarkingEnabled=true). */
    private Integer negativeMarkPerQuestion;

    /** How many MCQs to generate (1-50). */
    private Integer numQuestions;

    /** Total time allowed for the assessment in minutes. */
    private Integer durationMinutes;

    /** PRIVATE (batch-only) or PUBLIC (open). */
    private String assessmentVisibility;

    /**
     * Optional list of question-type codes the teacher picked in the
     * wizard (e.g. ["MCQS","TRUE_FALSE"]). Persisted on the artifact
     * so a future LLM-prompt update can honour the selection; current
     * generation still produces MCQs only.
     *
     * Accepted codes: MCQS, MCQM, TRUE_FALSE, ONE_WORD, LONG_ANSWER.
     */
    private java.util.List<String> questionTypes;

    /**
     * When true, ai-service generates a Gemini illustration for every
     * question stem and every option and embeds it as an inline
     * &lt;img&gt; tag. Adds 30-120s of latency and 5 image-gen calls per
     * question, so off by default.
     */
    private Boolean includeImages;

    /**
     * Optional override of the assessment title. If null, the LLM-generated
     * title is used.
     */
    private String overrideTitle;

    /**
     * Optional explicit batch list. If null/empty, the service auto-resolves
     * batches from LiveSessionParticipants(source_type='BATCH') for the
     * recording's session.
     */
    private List<String> packageSessionIdsOverride;
}
