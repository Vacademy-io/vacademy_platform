package vacademy.io.assessment_service.features.assessment.service;


import lombok.Getter;
import lombok.Setter;

import java.util.List;

public abstract class IMarkingStrategy {
    @Getter
    @Setter
    private String type;
    public abstract double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, List<String> studentChosenOptions) throws Exception;
}
