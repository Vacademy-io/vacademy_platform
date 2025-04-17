package vacademy.io.media_service.evaluation_ai.dto;

import lombok.Data;

import java.util.List;

@Data
public class EvaluationResultFromDeepSeek {
    private List<EvaluationResult> evaluationResults;

    @Data
    public static class EvaluationResult {
        private String userId;
        private String name;
        private String email;
        private String contactNumber;
        private double totalMarksObtained;
        private double totalMarks;
        private String overallVerdict; // pass/fail/absent/etc.
        private List<SectionWiseResult> sectionWiseResults;
    }

    @Data
    public static class SectionWiseResult {
        private String sectionId;
        private String sectionName;
        private double marksObtained;
        private double totalMarks;
        private String verdict; // pass/fail/null
        private List<QuestionWiseResult> questionWiseResults;
    }

    @Data
    public static class QuestionWiseResult {
        private String questionId;
        private int questionOrder;
        private double marksObtained;
        private double totalMarks;
        private String feedback;
        private String description; // why makrs are given and dedcuted
        private String verdict; // correct/partially correct/incorrect/null
    }
}
