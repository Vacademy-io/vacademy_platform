package vacademy.io.assessment_service.features.assessment.enums;

public enum AiEvaluationStepEnum {
        PROCESSING, // Converting PDF to HTML
        EXTRACTION, // Extracting all answers at once
        CRITERIA_GENERATION, // Creating evaluation criteria
        GRADING, // Evaluating answer
        STORING_RESULTS // Saving to database
}
