package vacademy.io.assessment_service.features.assessment.enums;

public enum AiEvaluationStatusEnum {
        PENDING, // Request queued
        STARTED, // Evaluation initiated
        PROCESSING, // Processing PDF with Mathpix
        EXTRACTING, // Extracting all answers (batch)
        EVALUATING, // Grading questions
        COMPLETED, // All done
        FAILED // Error occurred
}
