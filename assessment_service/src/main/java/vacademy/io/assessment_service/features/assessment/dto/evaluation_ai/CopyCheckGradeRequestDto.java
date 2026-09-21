package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Outbound payload to ai_service POST /copy-check/grade.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CopyCheckGradeRequestDto {

    @JsonProperty("process_id")
    private String processId;

    @JsonProperty("attempt_id")
    private String attemptId;

    @JsonProperty("assessment_id")
    private String assessmentId;

    @JsonProperty("institute_id")
    private String instituteId;

    @JsonProperty("pdf_url")
    private String pdfUrl;

    @JsonProperty("preferred_model")
    private String preferredModel;

    @JsonProperty("callback_base_url")
    private String callbackBaseUrl;

    @JsonProperty("questions")
    private List<QuestionInput> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class QuestionInput {

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("question_text")
        private String questionText;

        @JsonProperty("question_type")
        private String questionType;

        @JsonProperty("max_marks")
        private Double maxMarks;

        @JsonProperty("subject")
        private String subject;

        /** 1-based position in the paper's order (section, then question). */
        @JsonProperty("question_number")
        private Integer questionNumber;

        /**
         * The number the student sees printed next to this question — "2", "3(a)",
         * "Q7" — which may repeat across sections. Without it the grader was told
         * the question's UUID was "the number on the paper" and had to guess where
         * the answer sat from the wording alone.
         */
        @JsonProperty("paper_label")
        private String paperLabel;

        /** Section heading as printed ("Section B", "Passage II"), when known. */
        @JsonProperty("section")
        private String section;

        @JsonProperty("options")
        private List<Map<String, Object>> options;

        @JsonProperty("correct_answer")
        private String correctAnswer;
    }
}
