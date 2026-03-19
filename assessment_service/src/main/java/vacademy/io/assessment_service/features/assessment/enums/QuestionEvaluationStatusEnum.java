package vacademy.io.assessment_service.features.assessment.enums;

public enum QuestionEvaluationStatusEnum {
        PENDING, // Not started yet
        EXTRACTING, // Extracting answer from PDF
        EVALUATING, // AI is grading
        COMPLETED, // Evaluation done
        FAILED // Error occurred
}
