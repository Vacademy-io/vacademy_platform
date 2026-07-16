package vacademy.io.assessment_service.features.assessment.dto.evaluation_ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Parent container for all callback payloads ai_service POSTs back into
 * /copy-check/callback/{progress,question,complete,failed}. Each endpoint
 * uses one of the inner classes — Spring's @RequestBody picks the right one
 * based on the controller method signature.
 */
public class CopyCheckCallbackDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Progress {
        @JsonProperty("process_id")
        private String processId;

        @JsonProperty("job_id")
        private String jobId;

        @JsonProperty("step")
        private String step;

        @JsonProperty("progress")
        private Double progress;

        @JsonProperty("layout_map")
        private JsonNode layoutMap;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionAnnotation {
        @JsonProperty("target")
        private String target;

        @JsonProperty("page_id")
        private String pageId;

        @JsonProperty("style")
        private String style;

        @JsonProperty("text")
        private String text;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionDone {
        @JsonProperty("process_id")
        private String processId;

        @JsonProperty("job_id")
        private String jobId;

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("marks_awarded")
        private Double marksAwarded;

        @JsonProperty("max_marks")
        private Double maxMarks;

        @JsonProperty("feedback")
        private String feedback;

        @JsonProperty("extracted_answer")
        private String extractedAnswer;

        @JsonProperty("criteria_breakdown")
        private List<JsonNode> criteriaBreakdown;

        @JsonProperty("annotations")
        private List<QuestionAnnotation> annotations;

        @JsonProperty("confidence")
        private Double confidence;

        @JsonProperty("rubric_version")
        private Integer rubricVersion;

        // Per-question outcome from the grader: COMPLETED (graded) or FAILED
        // (grading failed after retry). Null is treated as COMPLETED for
        // backward-compat with older ai_service builds.
        @JsonProperty("status")
        private String status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Complete {
        @JsonProperty("process_id")
        private String processId;

        @JsonProperty("job_id")
        private String jobId;

        @JsonProperty("total_marks_awarded")
        private Double totalMarksAwarded;

        @JsonProperty("total_max_marks")
        private Double totalMaxMarks;

        @JsonProperty("questions_evaluated")
        private Integer questionsEvaluated;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Failed {
        @JsonProperty("process_id")
        private String processId;

        @JsonProperty("job_id")
        private String jobId;

        @JsonProperty("error_message")
        private String errorMessage;
    }
}
