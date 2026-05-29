package vacademy.io.admin_core_service.features.ai_content.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

/**
 * Projection returned to the frontend after Create Assessment finishes.
 *
 * Carries the LLM-generated title + questions so the UI can show a preview
 * without re-calling the LLM, plus the soft-pointer to the persisted Assessment
 * in assessment_service (once that push lands — currently nullable since the
 * direct integration with assessment_service is staged for a follow-up).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssessmentArtifactDto {

    private String artifactId;          // ai_generated_artifact.id
    private String recordingId;
    private String status;              // IN_PROGRESS | COMPLETED | FAILED
    private String errorMessage;

    private String title;
    private List<GeneratedQuestionDto> questions;

    private String targetLanguage;
    private String modelUsed;
    private Integer numQuestions;

    /** Once the push to assessment_service lands, this is the assessment.id there. */
    private String assessmentId;
    private String assessmentViewUrl;

    private List<String> registeredBatchIds;

    private Date createdAt;
    private Date updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedQuestionDto {
        private String id;
        private String question;
        private List<String> options;
        private Integer correctAnswerIndex;
        private String explanation;
    }
}
