package vacademy.io.assessment_service.features.assessment.service;


import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;

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

    public abstract Object validateAndGetSurveyData(Assessment assessment, AssessmentQuestionPreviewDto assessmentQuestionPreviewDto, List<QuestionWiseMarks> allRespondentData);
}
