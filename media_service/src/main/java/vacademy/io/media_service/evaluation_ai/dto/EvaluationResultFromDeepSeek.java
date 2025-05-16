package vacademy.io.media_service.evaluation_ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Objects;
import java.util.Set;

@Data
public class EvaluationResultFromDeepSeek {

    @JsonProperty("evaluation_data")
    private Set<EvaluationData> evaluationData;

    @Data
    public static class EvaluationData {

        @JsonProperty("user_id")
        private String userId;

        @JsonProperty("name")
        private String name;

        @JsonProperty("email")
        private String email;

        @JsonProperty("contact_number")
        private String contactNumber;

        @JsonProperty("response_id")
        private String responseId;

        // STEP 1: Extracted Answers
        @JsonProperty("section_wise_ans_extracted")
        private List<SectionWiseAnsExtracted> sectionWiseAnsExtracted;

        // STEP 2: Evaluation Results (after extraction)
        @JsonProperty("evaluation_result")
        private EvaluationResult evaluationResult;

        @JsonProperty("status")
        private String status; // ANS_EXTRACTION_COMPLETED, ANS_EXTRACTION_FAILED, etc.

        // Override equals to ensure uniqueness based on userId
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            EvaluationData that = (EvaluationData) o;
            return Objects.equals(userId, that.userId); // Compare based on userId
        }

        // Override hashCode to ensure correct behavior in HashSet
        @Override
        public int hashCode() {
            return Objects.hash(userId); // Generate hash code based on userId
        }
    }

    // STEP 1: Answer Extraction Result
    @Data
    public static class SectionWiseAnsExtracted {

        @JsonProperty("section_id")
        private String sectionId;

        @JsonProperty("section_name")
        private String sectionName;

        @JsonProperty("question_wise_ans_extracted")
        private List<QuestionWiseAnsExtracted> questionWiseAnsExtracted;
    }

    @Data
    public static class QuestionWiseAnsExtracted {

        @JsonProperty("question_id")
        private String questionId;

        @JsonProperty("question_order")
        private Integer questionOrder;

        @JsonProperty("question_text")
        private String questionText;

        @JsonProperty("answer_html")
        private String answerHtml;

        @JsonProperty("status")
        private String status; // ATTEMPTED, NOT_ATTEMPTED
    }

    // STEP 2: Evaluation Result after answer extraction
    @Data
    public static class EvaluationResult {

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

        @JsonProperty("question_text")
        private String questionText;

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

    }
}
