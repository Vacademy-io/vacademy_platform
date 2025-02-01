package vacademy.io.assessment_service.features.assessment.service.marking_strategy;

import vacademy.io.assessment_service.features.assessment.service.IMarkingStrategy;

public class Markingfactory {
    public static IMarkingStrategy getMarkingStrategy(String type) {
        return switch (type) {
            case "MCQM" -> new MCQMMarkingStrategy();
            case "MCQS" -> new MCQSMarkingStrategy();
            default -> throw new IllegalArgumentException("Unknown question type: " + type);
        };
    }
}
