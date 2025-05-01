package vacademy.io.media_service.evaluation_ai.enums;

public enum EvaluationStepsStatusEnum {
    EXTRACTING_ANSWER,       // Extraction of the question is in progress
    ANSWER_EXTRACTION_FAILED, // Question extraction failed
    EVALUATING,                 // Evaluation is in progress
    EVALUATION_FAILED,          // Evaluation failed
    EVALUATION_COMPLETED,     // Evaluation completed successfully
    WAITING
}
