package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqm.MCQMCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqm.MCQMResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSCorrectAnswerDto;
import vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.mcqs.MCQSResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.QuestionWiseBasicDetailDto;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.*;
import vacademy.io.assessment_service.features.question_core.enums.QuestionTypes;

import java.util.*;

public class QuestionBasedStrategyFactory {
    private static final Map<String, IQuestionTypeBasedStrategy> strategies = new HashMap<>();

    static {
        strategies.put(QuestionTypes.MCQM.name(), new MCQMQuestionTypeBasedStrategy());
        strategies.put(QuestionTypes.MCQS.name(), new MCQSQuestionTypeBasedStrategy());
        strategies.put(QuestionTypes.ONE_WORD.name(), new OneWordQuestionTypeBasedStrategy());
        strategies.put(QuestionTypes.LONG_ANSWER.name(), new LongAnswerQuestionTypeBasedStrategy());
        strategies.put(QuestionTypes.NUMERIC.name(), new NUMERICQuestionTypeBasedStrategy());
        strategies.put(QuestionTypes.TRUE_FALSE.name(), new MCQSQuestionTypeBasedStrategy());
        // Add more strategies here
    }

    private static IQuestionTypeBasedStrategy getStrategy(String questionType) {
        IQuestionTypeBasedStrategy strategy = strategies.getOrDefault(questionType, null);
        if (!Objects.isNull(strategy)) {
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
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
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

    public static List<String> getResponseOptionIds(String responseJson, String type) throws JsonProcessingException {
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
        if(strategy.getType().equals(QuestionTypes.MCQS.name())){
            MCQSResponseDto responseDto = (MCQSResponseDto) verifyResponseJson(responseJson, type);

            return responseDto.getResponseData().getOptionIds();
        }

        if (strategy.getType().equals(QuestionTypes.MCQM.name())) {
            MCQMResponseDto responseDto = (MCQMResponseDto) verifyResponseJson(responseJson, type);

            return responseDto.getResponseData().getOptionIds();
        }

        return new ArrayList<>();
    }

    public static List<String> getCorrectOptionIds(String evaluationJson, String type) throws JsonProcessingException {
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
        if(strategy.getType().equals(QuestionTypes.MCQS.name()) || strategy.getType().equals(QuestionTypes.TRUE_FALSE.name())){
            MCQSCorrectAnswerDto optionDto = (MCQSCorrectAnswerDto) verifyCorrectAnswerJson(evaluationJson, type);

            return optionDto.getData().getCorrectOptionIds();
        }

        if (strategy.getType().equals(QuestionTypes.MCQM.name())) {
            MCQMCorrectAnswerDto optionDto = (MCQMCorrectAnswerDto) verifyCorrectAnswerJson(evaluationJson, type);

            return optionDto.getData().getCorrectOptionIds();
        }

        return new ArrayList<>();
    }

    public static Object getCorrectAnswerFromAutoEvaluationBasedOnQuestionType(String autoEvaluationJson) throws Exception{
        String type = getQuestionTypeFromEvaluationJson(autoEvaluationJson);
        IQuestionTypeBasedStrategy strategy = getStrategy(type);
        return strategy.validateAndGetCorrectAnswerData(autoEvaluationJson);
    }

    public static String getQuestionTypeFromEvaluationJson(String jsonString) throws Exception{
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(jsonString);
        return root.get("type").asText();
    }
}
