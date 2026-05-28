package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionEvaluationResultDto {

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("question_number")
        private Integer questionNumber;

        @JsonProperty("status")
        private String status;

        // Results
        @JsonProperty("marks_awarded")
        private BigDecimal marksAwarded;

        @JsonProperty("max_marks")
        private BigDecimal maxMarks;

        @JsonProperty("feedback")
        private String feedback;

        @JsonProperty("extracted_answer")
        private String extractedAnswer;

        // Only the criteria breakdown details (avoiding redundancy)
        @JsonProperty("evaluation_details_json")
        private JsonNode evaluationDetailsJson;

        // copy-check fields — surfaced top-level for the FE annotation overlay.
        // For legacy (non-copy-check) evaluations these stay null; the FE
        // already reads from evaluation_details_json in that case.
        @JsonProperty("annotations")
        private List<JsonNode> annotations;

        @JsonProperty("criteria_breakdown")
        private List<JsonNode> criteriaBreakdown;

        @JsonProperty("rubric_version")
        private Integer rubricVersion;

        @JsonProperty("confidence")
        private Double confidence;

        // Timestamps
        @JsonProperty("started_at")
        private Date startedAt;

        @JsonProperty("completed_at")
        private Date completedAt;
}
