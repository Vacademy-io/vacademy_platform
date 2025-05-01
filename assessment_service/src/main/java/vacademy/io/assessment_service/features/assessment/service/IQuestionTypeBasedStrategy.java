package vacademy.io.assessment_service.features.assessment.service;


import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.Getter;
import lombok.Setter;

public abstract class IQuestionTypeBasedStrategy {
    @Getter
    @Setter
    private String type;

    @Getter
    @Setter
    private String answerStatus;

    public abstract double calculateMarks(String markingJsonStr, String correctAnswerJsonStr, String responseJson);

    public abstract Object validateAndGetMarkingData(String jsonContent) throws JsonProcessingException;

    public abstract Object validateAndGetCorrectAnswerData(String correctAnswerJson) throws JsonProcessingException;

    public abstract Object validateAndGetResponseData(String responseJson) throws JsonProcessingException;
}
