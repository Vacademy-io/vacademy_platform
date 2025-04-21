package vacademy.io.media_service.evaluation_ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Set;

@Data
public class EvaluationResultFromDeepSeek {

    @JsonProperty("evaluation_results")
    private Set<EvaluationResult> evaluationResults;

    @Data
    public static class EvaluationResult {

        @JsonProperty("user_id")
        private String userId;

        @JsonProperty("name")
        private String name;

        @JsonProperty("email")
        private String email;

        @JsonProperty("contact_number")
        private String contactNumber;

        @JsonProperty("total_marks_obtained")
        private Double totalMarksObtained;

        @JsonProperty("total_marks")
        private Double totalMarks;

        @JsonProperty("overall_verdict")
        private String overallVerdict;

        @JsonProperty("overall_description")
        private String overallDescription;

        @JsonProperty("section_wise_results")
        private List<SectionWiseResult> sectionWiseResults;
    }

    @Data
    public static class SectionWiseResult {

        @JsonProperty("section_id")
        private String sectionId;

        @JsonProperty("section_name")
        private String sectionName;

        @JsonProperty("marks_obtained")
        private Double marksObtained;

        @JsonProperty("total_marks")
        private Double totalMarks;

        @JsonProperty("verdict")
        private String verdict;

        @JsonProperty("question_wise_results")
        private List<QuestionWiseResult> questionWiseResults;
    }

    @Data
    public static class QuestionWiseResult {

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("question_order")
        private Integer questionOrder;

        @JsonProperty("marks_obtained")
        private Double marksObtained;

        @JsonProperty("total_marks")
        private Double totalMarks;

        @JsonProperty("feedback")
        private String feedback;

        @JsonProperty("description")
        private String description;

        @JsonProperty("verdict")
        private String verdict;

        @JsonProperty("question_text")
        private String questionText;
    }
}
