package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import vacademy.io.assessment_service.features.assessment.dto.QuestionWiseBasicDetailDto;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.MCQMQuestionTypeBasedStrategy;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.MCQSQuestionTypeBasedStrategy;
import vacademy.io.assessment_service.features.question_core.enums.QuestionTypes;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class QuestionBasedStrategyFactory {
    private static final Map<String, IQuestionTypeBasedStrategy> strategies = new HashMap<>();

    static {
        strategies.put(QuestionTypes.MCQM.name(), new MCQMQuestionTypeBasedStrategy());
        strategies.put(QuestionTypes.MCQS.name(), new MCQSQuestionTypeBasedStrategy());
        // Add more strategies here
    }

    private static IQuestionTypeBasedStrategy getStrategy(String questionType) {
        IQuestionTypeBasedStrategy strategy = strategies.getOrDefault(questionType, null);
        if(!Objects.isNull(strategy)){
            strategy.setType(questionType);
            strategy.setAnswerStatus(QuestionResponseEnum.PENDING.name());
        }
        return strategy;
    }

    public static Object verifyMarkingJson(String markingJson, String type) throws JsonProcessingException {
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
        if (strategy == null) {
            throw new IllegalArgumentException("Invalid Question Type: " + type);
        }
        return strategy.validateAndGetMarkingData(markingJson);
    }

    public static Object verifyCorrectAnswerJson(String correctAnswerJson, String type) throws JsonProcessingException {
        IQuestionTypeBasedStrategy strategy = getStrategy(correctAnswerJson);
        if (strategy == null) {
            throw new IllegalArgumentException("Invalid Question Type: " + type);
        }
        return strategy.validateAndGetCorrectAnswerData(correctAnswerJson);
    }

    public static Object verifyResponseJson(String responseJson, String type) throws JsonProcessingException {
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
        if (strategy == null) {
            throw new IllegalArgumentException("Invalid Question Type: " + type);
        }
        return strategy.validateAndGetResponseData(responseJson);
    }

    public static QuestionWiseBasicDetailDto calculateMarks(String markingJson, String correctAnswerJson, String responseJson, String type) {
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
        if (strategy == null) {
            throw new IllegalArgumentException("Invalid Question Type: " + type);
        }
        double marks =  strategy.calculateMarks(markingJson, correctAnswerJson, responseJson);
        String answerStatus = strategy.getAnswerStatus();

        return QuestionWiseBasicDetailDto.builder().marks(marks)
                .answerStatus(answerStatus).build();
    }
}
